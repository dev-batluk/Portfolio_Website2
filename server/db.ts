import crypto from 'node:crypto';
import {
  SEED_CATEGORIES,
  createSeedBestsellers,
  createSeedCatalog,
  createSeedOrders,
  createSeedPromos,
  createSeedSettings,
  formatRub,
} from './seedData.js';
import {
  execDdl,
  execute,
  getDbEngineLabel,
  getDbLocationDescription,
  isPostgresDb,
  queryAll,
  queryOne,
  runTransaction,
  type SqlExecutor,
} from './sqlClient.js';
import { slugifyCategoryLabel } from './validation.js';
import type {
  AdminBootstrapPayload,
  AdminOrder,
  BestsellerProduct,
  CatalogCategory,
  CatalogProduct,
  DbRetentionStats,
  DeliveryMethod,
  OrderHistoryEntry,
  OrderItemSnapshot,
  OrderStatus,
  PaymentStatus,
  PromoCodeRule,
  PublicPromoHint,
  StoreSettings,
  StorefrontPayload,
} from './types.js';

export class StoreServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
const MAX_BESTSELLERS = 8;
const MIN_BESTSELLERS = 2;
const PURGE_THROTTLE_MS = 60_000;

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  shipping: 'В доставке',
  completed: 'Выполнен',
  cancelled: 'Отменён',
};

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  courier_msk: 'Курьер по Москве',
  cdek_rf: 'СДЭК · Пункт выдачи по РФ',
  showroom: 'Самовывоз из шоурума',
};

let initPromise: Promise<void> | null = null;
let lastPurgeCheckAt = 0;

export { getDbEngineLabel, getDbLocationDescription };

export function getRetentionDays(): number {
  const parsed = Number.parseInt(process.env.ORDER_RETENTION_DAYS || '30', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return parsed;
}

function syncSizesWithStock(sizes: string[], stock: Record<string, number>): string[] {
  const keys = Object.keys(stock);
  if (keys.length === 0) return sizes.length > 0 ? sizes : ['M'];
  const ordered = ALL_SIZES.filter((s) => keys.includes(s));
  const extra = keys.filter((k) => !(ALL_SIZES as readonly string[]).includes(k));
  return [...ordered, ...extra];
}

async function seedTablesInsideTransaction(tx: SqlExecutor): Promise<void> {
  for (const cat of SEED_CATEGORIES) {
    await tx.execute(
      'INSERT INTO categories (id, label, sort_order) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      [cat.id, cat.label, cat.sortOrder],
    );
  }

  const nowIso = new Date().toISOString();
  const seedProducts = createSeedCatalog();
  for (let idx = 0; idx < seedProducts.length; idx += 1) {
    const p = seedProducts[idx];
    await tx.execute(
      `INSERT INTO products (
        id, sku, category, category_label, title, price, description,
        material, fit, sizes_json, image, gallery_json, stock_json,
        hidden, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
      [
        p.id,
        p.sku,
        p.category,
        p.categoryLabel,
        p.title,
        p.price,
        p.description,
        p.material,
        p.fit,
        JSON.stringify(p.sizes),
        p.image,
        JSON.stringify(p.gallery ?? []),
        JSON.stringify(p.stock),
        p.hidden ? 1 : 0,
        idx,
        nowIso,
      ],
    );
  }

  const seedBestsellers = createSeedBestsellers();
  for (let idx = 0; idx < seedBestsellers.length; idx += 1) {
    const b = seedBestsellers[idx];
    await tx.execute(
      `INSERT INTO bestsellers (
        id, tag, sku, category_label, title, price, description,
        material, fit, sizes_json, image, model_image, gallery_json,
        stock_json, hidden, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
      [
        b.id,
        b.tag,
        b.sku,
        b.categoryLabel,
        b.title,
        b.price,
        b.description,
        b.material,
        b.fit,
        JSON.stringify(b.sizes),
        b.image,
        b.modelImage,
        JSON.stringify(b.gallery ?? []),
        JSON.stringify(b.stock),
        b.hidden ? 1 : 0,
        idx,
      ],
    );
  }

  const seedPromos = createSeedPromos();
  for (let idx = 0; idx < seedPromos.length; idx += 1) {
    const promo = seedPromos[idx];
    const ts = new Date(Date.now() - (seedPromos.length - idx) * 1000).toISOString();
    await tx.execute(
      `INSERT INTO promos (id, code, type, value, min_order_amount, active, usage_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [
        promo.id,
        promo.code.toUpperCase(),
        promo.type,
        promo.value,
        promo.minOrderAmount ?? null,
        promo.active ? 1 : 0,
        promo.usageCount,
        ts,
      ],
    );
  }

  for (const ord of createSeedOrders()) {
    await tx.execute(
      `INSERT INTO orders (
        id, order_number, created_at, completed_at, consent_accepted_at,
        status, payment_status, customer_json, delivery_json, items_json,
        subtotal, promo_code, discount_amount, delivery_cost, grand_total,
        manager_note, cancel_reason, stock_deducted, history_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
      [
        ord.id,
        ord.orderNumber,
        ord.createdAt,
        ord.completedAt,
        ord.consentAcceptedAt,
        ord.status,
        ord.paymentStatus,
        JSON.stringify(ord.customer),
        JSON.stringify(ord.delivery),
        JSON.stringify(ord.items),
        ord.subtotal,
        ord.promoCode,
        ord.discountAmount,
        ord.deliveryCost,
        ord.grandTotal,
        ord.managerNote ?? null,
        ord.cancelReason ?? null,
        ord.stockDeducted ? 1 : 0,
        JSON.stringify(ord.history),
      ],
    );
  }

  await tx.execute(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ['store_settings', JSON.stringify(createSeedSettings())],
  );

  await tx.execute(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ['purge_meta', JSON.stringify({ lastPurgedCount: 0, lastPurgedAt: null })],
  );
}

async function migrateExistingSqliteColumnsIfNeeded(): Promise<void> {
  if (isPostgresDb()) return;

  const promoCols = await queryAll<{ name: string }>('PRAGMA table_info(promos)');
  if (promoCols.length > 0 && !promoCols.some((c) => c.name === 'created_at')) {
    await execDdl("ALTER TABLE promos ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
    await execute("UPDATE promos SET created_at = ? WHERE created_at = ''", [
      new Date().toISOString(),
    ]);
  }

  const mediaCols = await queryAll<{ name: string }>('PRAGMA table_info(media)');
  if (mediaCols.length > 0 && !mediaCols.some((c) => c.name === 'data_base64')) {
    await execDdl("ALTER TABLE media ADD COLUMN data_base64 TEXT NOT NULL DEFAULT ''");
  }
}

async function initializeSchemaAndSeed(): Promise<void> {
  const auditPk = isPostgresDb()
    ? 'SERIAL PRIMARY KEY'
    : 'INTEGER PRIMARY KEY AUTOINCREMENT';

  await execDdl(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      material TEXT NOT NULL,
      fit TEXT NOT NULL,
      sizes_json TEXT NOT NULL,
      image TEXT NOT NULL,
      gallery_json TEXT NOT NULL,
      stock_json TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bestsellers (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      sku TEXT NOT NULL,
      category_label TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      material TEXT NOT NULL,
      fit TEXT NOT NULL,
      sizes_json TEXT NOT NULL,
      image TEXT NOT NULL,
      model_image TEXT NOT NULL,
      gallery_json TEXT NOT NULL,
      stock_json TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      consent_accepted_at TEXT,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      customer_json TEXT NOT NULL,
      delivery_json TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      promo_code TEXT,
      discount_amount INTEGER NOT NULL,
      delivery_cost INTEGER NOT NULL,
      grand_total INTEGER NOT NULL,
      manager_note TEXT,
      cancel_reason TEXT,
      stock_deducted INTEGER NOT NULL DEFAULT 1,
      history_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promos (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      min_order_amount INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      user_agent TEXT,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS revoked_sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id ${auditPk},
      created_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      meta_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status_completed ON orders(status, completed_at);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_revoked_expires ON revoked_sessions(expires_at);
  `);

  await migrateExistingSqliteColumnsIfNeeded();

  const existing = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM categories');
  if (existing && Number(existing.cnt) > 0) return;

  await runTransaction(async (tx) => {
    const doubleCheck = await tx.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM categories',
    );
    if (doubleCheck && Number(doubleCheck.cnt) > 0) return;
    await seedTablesInsideTransaction(tx);
  });
}

async function ensureDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeSchemaAndSeed().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

function rowToCategory(row: Record<string, unknown>): CatalogCategory {
  return {
    id: String(row.id),
    label: String(row.label),
    sortOrder: Number(row.sort_order),
  };
}

function rowToProduct(row: Record<string, unknown>): CatalogProduct {
  const price = Number(row.price);
  return {
    id: String(row.id),
    sku: String(row.sku),
    category: String(row.category),
    categoryLabel: String(row.category_label),
    title: String(row.title),
    price,
    priceFormatted: formatRub(price),
    description: String(row.description),
    material: String(row.material),
    fit: String(row.fit),
    sizes: JSON.parse(String(row.sizes_json)) as string[],
    image: String(row.image),
    gallery: JSON.parse(String(row.gallery_json)) as string[],
    stock: JSON.parse(String(row.stock_json)) as Record<string, number>,
    hidden: Boolean(Number(row.hidden)),
  };
}

function rowToBestseller(row: Record<string, unknown>): BestsellerProduct {
  const price = Number(row.price);
  return {
    id: String(row.id),
    tag: String(row.tag),
    sku: String(row.sku),
    categoryLabel: String(row.category_label),
    title: String(row.title),
    price,
    priceFormatted: formatRub(price),
    description: String(row.description),
    material: String(row.material),
    fit: String(row.fit),
    sizes: JSON.parse(String(row.sizes_json)) as string[],
    image: String(row.image),
    modelImage: String(row.model_image),
    gallery: JSON.parse(String(row.gallery_json)) as string[],
    stock: JSON.parse(String(row.stock_json)) as Record<string, number>,
    hidden: Boolean(Number(row.hidden)),
  };
}

function rowToOrder(row: Record<string, unknown>): AdminOrder {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    consentAcceptedAt: row.consent_accepted_at ? String(row.consent_accepted_at) : null,
    status: String(row.status) as OrderStatus,
    paymentStatus: String(row.payment_status) as PaymentStatus,
    customer: JSON.parse(String(row.customer_json)) as AdminOrder['customer'],
    delivery: JSON.parse(String(row.delivery_json)) as AdminOrder['delivery'],
    items: JSON.parse(String(row.items_json)) as OrderItemSnapshot[],
    subtotal: Number(row.subtotal),
    promoCode: row.promo_code ? String(row.promo_code) : null,
    discountAmount: Number(row.discount_amount),
    deliveryCost: Number(row.delivery_cost),
    grandTotal: Number(row.grand_total),
    managerNote: row.manager_note ? String(row.manager_note) : undefined,
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : undefined,
    stockDeducted: Boolean(Number(row.stock_deducted)),
    history: JSON.parse(String(row.history_json)) as OrderHistoryEntry[],
  };
}

function rowToPromo(row: Record<string, unknown>): PromoCodeRule {
  return {
    id: String(row.id),
    code: String(row.code),
    type: String(row.type) as 'percent' | 'fixed',
    value: Number(row.value),
    minOrderAmount:
      row.min_order_amount !== null && row.min_order_amount !== undefined
        ? Number(row.min_order_amount)
        : undefined,
    active: Boolean(Number(row.active)),
    usageCount: Number(row.usage_count),
  };
}

async function readSettings(exec?: SqlExecutor): Promise<StoreSettings> {
  const row = exec
    ? await exec.queryOne<{ value_json: string }>(
        'SELECT value_json FROM settings WHERE key = ?',
        ['store_settings'],
      )
    : await queryOne<{ value_json: string }>(
        'SELECT value_json FROM settings WHERE key = ?',
        ['store_settings'],
      );
  if (!row) return createSeedSettings();
  try {
    return { ...createSeedSettings(), ...(JSON.parse(row.value_json) as Partial<StoreSettings>) };
  } catch {
    return createSeedSettings();
  }
}

export async function writeAuditLog(
  actor: string,
  action: string,
  targetId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureDbReady();
    await execute(
      'INSERT INTO audit_logs (created_at, actor, action, target_id, meta_json) VALUES (?, ?, ?, ?, ?)',
      [
        new Date().toISOString(),
        actor,
        action,
        targetId ?? null,
        meta ? JSON.stringify(meta) : null,
      ],
    );
  } catch {
    // Non-blocking audit logging
  }
}

export async function purgeExpiredCompletedOrders(force = false): Promise<{
  purgedCount: number;
  lastPurgedAt: string | null;
}> {
  await ensureDbReady();
  const now = Date.now();

  if (!force && now - lastPurgeCheckAt < PURGE_THROTTLE_MS) {
    const metaRow = await queryOne<{ value_json: string }>(
      'SELECT value_json FROM settings WHERE key = ?',
      ['purge_meta'],
    );
    if (metaRow) {
      try {
        const parsed = JSON.parse(metaRow.value_json) as {
          lastPurgedCount?: number;
          lastPurgedAt?: string | null;
        };
        return {
          purgedCount: Number(parsed.lastPurgedCount ?? 0),
          lastPurgedAt: parsed.lastPurgedAt ?? null,
        };
      } catch {
        // Fall through
      }
    }
    return { purgedCount: 0, lastPurgedAt: null };
  }

  lastPurgeCheckAt = now;
  const retentionDays = getRetentionDays();
  const cutoffIso = new Date(now - retentionDays * 86_400_000).toISOString();
  const nowIso = new Date(now).toISOString();

  const expiredRows = await queryAll<{ id: string; order_number: string }>(
    `SELECT id, order_number FROM orders
     WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at <= ?`,
    [cutoffIso],
  );
  const purgedCount = expiredRows.length;

  await runTransaction(async (tx) => {
    if (purgedCount > 0) {
      await tx.execute(
        `DELETE FROM orders
         WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at <= ?`,
        [cutoffIso],
      );
    }

    await tx.execute('DELETE FROM admin_sessions WHERE expires_at <= ?', [nowIso]);
    await tx.execute('DELETE FROM revoked_sessions WHERE expires_at <= ?', [nowIso]);

    if (purgedCount > 0 || force) {
      const prevRow = await tx.queryOne<{ value_json: string }>(
        'SELECT value_json FROM settings WHERE key = ?',
        ['purge_meta'],
      );
      let prevAt: string | null = null;
      let prevCount = 0;
      if (prevRow) {
        try {
          const parsed = JSON.parse(prevRow.value_json) as {
            lastPurgedCount?: number;
            lastPurgedAt?: string | null;
          };
          prevAt = parsed.lastPurgedAt ?? null;
          prevCount = Number(parsed.lastPurgedCount ?? 0);
        } catch {
          // Ignore
        }
      }

      const nextMeta =
        purgedCount > 0
          ? { lastPurgedCount: purgedCount, lastPurgedAt: nowIso }
          : { lastPurgedCount: prevCount, lastPurgedAt: prevAt ?? nowIso };

      await tx.execute(
        `INSERT INTO settings (key, value_json) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
        ['purge_meta', JSON.stringify(nextMeta)],
      );
    }
  });

  if (purgedCount > 0) {
    await writeAuditLog('system', 'purge_expired_completed_orders', undefined, {
      purgedCount,
      retentionDays,
      orderNumbers: expiredRows.map((r) => r.order_number),
    });
  }

  const metaRow = await queryOne<{ value_json: string }>(
    'SELECT value_json FROM settings WHERE key = ?',
    ['purge_meta'],
  );
  let lastPurgedAt: string | null = nowIso;
  if (metaRow) {
    try {
      const parsed = JSON.parse(metaRow.value_json) as { lastPurgedAt?: string | null };
      lastPurgedAt = parsed.lastPurgedAt ?? nowIso;
    } catch {
      // Keep default
    }
  }

  return { purgedCount, lastPurgedAt };
}

export async function getDbStats(): Promise<DbRetentionStats> {
  await ensureDbReady();
  const totalRow = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM orders');
  const completedRow = await queryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM orders WHERE status = 'completed'",
  );
  const metaRow = await queryOne<{ value_json: string }>(
    'SELECT value_json FROM settings WHERE key = ?',
    ['purge_meta'],
  );

  let lastPurgedCount = 0;
  let lastPurgedAt: string | null = null;
  if (metaRow) {
    try {
      const parsed = JSON.parse(metaRow.value_json) as {
        lastPurgedCount?: number;
        lastPurgedAt?: string | null;
      };
      lastPurgedCount = Number(parsed.lastPurgedCount ?? 0);
      lastPurgedAt = parsed.lastPurgedAt ?? null;
    } catch {
      // Ignore
    }
  }

  return {
    totalOrders: Number(totalRow?.cnt ?? 0),
    completedOrders: Number(completedRow?.cnt ?? 0),
    retentionDays: getRetentionDays(),
    lastPurgedCount,
    lastPurgedAt,
  };
}

export async function getStorefrontData(): Promise<StorefrontPayload> {
  await ensureDbReady();
  const [categoryRows, productRows, bestsellerRows, firstActivePromo, settings] =
    await Promise.all([
      queryAll<Record<string, unknown>>('SELECT * FROM categories ORDER BY sort_order ASC'),
      queryAll<Record<string, unknown>>(
        'SELECT * FROM products WHERE hidden = 0 ORDER BY sort_order ASC',
      ),
      queryAll<Record<string, unknown>>(
        'SELECT * FROM bestsellers WHERE hidden = 0 ORDER BY sort_order ASC',
      ),
      queryOne<Record<string, unknown>>(
        'SELECT code, type, value, min_order_amount FROM promos WHERE active = 1 ORDER BY created_at ASC, id ASC LIMIT 1',
      ),
      readSettings(),
    ]);

  const categories = categoryRows.map(rowToCategory);
  const catalogItems = productRows.map(rowToProduct);
  const bestsellers = bestsellerRows.map(rowToBestseller);

  const publicPromoHint: PublicPromoHint | null = firstActivePromo
    ? {
        code: String(firstActivePromo.code),
        type: String(firstActivePromo.type) as 'percent' | 'fixed',
        value: Number(firstActivePromo.value),
        minOrderAmount:
          firstActivePromo.min_order_amount !== null &&
          firstActivePromo.min_order_amount !== undefined
            ? Number(firstActivePromo.min_order_amount)
            : undefined,
      }
    : null;

  return {
    categories,
    catalogItems,
    bestsellers,
    settings,
    publicPromoHint,
  };
}

export async function getAdminBootstrap(): Promise<AdminBootstrapPayload> {
  await purgeExpiredCompletedOrders(false);

  const [categoryRows, productRows, bestsellerRows, orderRows, promoRows, settings, dbStats] =
    await Promise.all([
      queryAll<Record<string, unknown>>('SELECT * FROM categories ORDER BY sort_order ASC'),
      queryAll<Record<string, unknown>>('SELECT * FROM products ORDER BY sort_order ASC'),
      queryAll<Record<string, unknown>>('SELECT * FROM bestsellers ORDER BY sort_order ASC'),
      queryAll<Record<string, unknown>>('SELECT * FROM orders ORDER BY created_at DESC'),
      queryAll<Record<string, unknown>>(
        'SELECT * FROM promos ORDER BY created_at DESC, id DESC',
      ),
      readSettings(),
      getDbStats(),
    ]);

  return {
    categories: categoryRows.map(rowToCategory),
    catalogItems: productRows.map(rowToProduct),
    bestsellers: bestsellerRows.map(rowToBestseller),
    orders: orderRows.map(rowToOrder),
    promos: promoRows.map(rowToPromo),
    settings,
    dbStats,
  };
}

export async function getAdminOrders(): Promise<{
  orders: AdminOrder[];
  dbStats: DbRetentionStats;
}> {
  await purgeExpiredCompletedOrders(false);
  const orders = (
    await queryAll<Record<string, unknown>>('SELECT * FROM orders ORDER BY created_at DESC')
  ).map(rowToOrder);
  return { orders, dbStats: await getDbStats() };
}

export async function validatePromoForSubtotal(
  rawCode: string,
  subtotal: number,
): Promise<{
  ok: boolean;
  message: string;
  promo: PublicPromoHint | null;
  discountAmount: number;
}> {
  await ensureDbReady();
  const normalized = rawCode.trim().toUpperCase();
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM promos WHERE active = 1 AND UPPER(code) = ?',
    [normalized],
  );

  if (!row) {
    const hint = await queryOne<{ code: string }>(
      'SELECT code FROM promos WHERE active = 1 ORDER BY created_at ASC, id ASC LIMIT 1',
    );
    return {
      ok: false,
      message: hint
        ? `Промокод не найден · попробуйте ${hint.code}`
        : 'Промокод не найден или отключён',
      promo: null,
      discountAmount: 0,
    };
  }

  const rule = rowToPromo(row);
  if (rule.minOrderAmount && subtotal < rule.minOrderAmount) {
    return {
      ok: false,
      message: `Минимальная сумма для ${rule.code}: ${formatRub(rule.minOrderAmount)}`,
      promo: null,
      discountAmount: 0,
    };
  }

  const discountAmount =
    rule.type === 'percent'
      ? Math.min(subtotal, Math.round((subtotal * rule.value) / 100))
      : Math.min(subtotal, rule.value);

  const desc = rule.type === 'percent' ? `−${rule.value}%` : `−${formatRub(rule.value)}`;

  return {
    ok: true,
    message: `Промокод ${rule.code} применён (${desc})`,
    promo: {
      code: rule.code,
      type: rule.type,
      value: rule.value,
      minOrderAmount: rule.minOrderAmount,
    },
    discountAmount,
  };
}

export async function createOrderFromCheckout(input: {
  items: Array<{ productId: string; size: string; quantity: number }>;
  promoCode?: string | null;
  deliveryMethod: DeliveryMethod;
  customer: { fullName: string; phone: string; email: string; telegram?: string };
  delivery: { address?: string; city?: string; cdekPoint?: string; comment?: string };
}): Promise<AdminOrder> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const settings = await readSettings(tx);
    const mergedRequests = new Map<
      string,
      { productId: string; size: string; quantity: number }
    >();

    for (const item of input.items) {
      const key = `${item.productId}__${item.size}`;
      const prev = mergedRequests.get(key);
      if (prev) {
        prev.quantity += item.quantity;
      } else {
        mergedRequests.set(key, { ...item });
      }
    }

    const snapshots: OrderItemSnapshot[] = [];
    const productUpdates: Array<{
      table: 'products' | 'bestsellers';
      id: string;
      stock: Record<string, number>;
    }> = [];

    const bsCache = new Map<string, BestsellerProduct>();
    const prodCache = new Map<string, CatalogProduct>();

    for (const reqItem of mergedRequests.values()) {
      let table: 'bestsellers' | 'products' = 'bestsellers';
      let record: (BestsellerProduct | CatalogProduct) | undefined = bsCache.get(
        reqItem.productId,
      );

      if (!record) {
        const bsRow = await tx.queryOne<Record<string, unknown>>(
          'SELECT * FROM bestsellers WHERE id = ? AND hidden = 0',
          [reqItem.productId],
        );
        if (bsRow) {
          record = rowToBestseller(bsRow);
          bsCache.set(record.id, record);
        }
      }

      if (!record) {
        table = 'products';
        record = prodCache.get(reqItem.productId);
        if (!record) {
          const pRow = await tx.queryOne<Record<string, unknown>>(
            'SELECT * FROM products WHERE id = ? AND hidden = 0',
            [reqItem.productId],
          );
          if (pRow) {
            record = rowToProduct(pRow);
            prodCache.set(record.id, record);
          }
        }
      }

      if (!record) {
        throw new StoreServiceError(
          400,
          'PRODUCT_UNAVAILABLE',
          'Один из выбранных товаров больше недоступен на витрине',
        );
      }

      if (!record.sizes.includes(reqItem.size)) {
        throw new StoreServiceError(
          400,
          'INVALID_SIZE',
          `Размер ${reqItem.size} недоступен для ${record.title}`,
        );
      }

      const available = Math.max(0, Number(record.stock[reqItem.size] ?? 0));
      if (available < reqItem.quantity) {
        throw new StoreServiceError(
          409,
          'INSUFFICIENT_STOCK',
          available === 0
            ? `${record.title} (${reqItem.size}) временно распродан (Sold Out)`
            : `Доступно только ${available} шт. для ${record.title} (${reqItem.size})`,
        );
      }

      record.stock[reqItem.size] = available - reqItem.quantity;
      productUpdates.push({ table, id: record.id, stock: record.stock });

      snapshots.push({
        productId: record.id,
        sku: record.sku,
        title: record.title,
        categoryLabel: record.categoryLabel,
        image: record.image,
        hasModel: 'modelImage' in record && Boolean(record.modelImage),
        size: reqItem.size,
        quantity: reqItem.quantity,
        unitPrice: record.price,
      });
    }

    const subtotal = snapshots.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);

    let appliedPromoCode: string | null = null;
    let discountAmount = 0;
    if (input.promoCode?.trim()) {
      const normalized = input.promoCode.trim().toUpperCase();
      const promoRow = await tx.queryOne<Record<string, unknown>>(
        'SELECT * FROM promos WHERE active = 1 AND UPPER(code) = ?',
        [normalized],
      );
      if (!promoRow) {
        throw new StoreServiceError(
          400,
          'INVALID_PROMO',
          'Указанный промокод не найден или отключён',
        );
      }
      const promo = rowToPromo(promoRow);
      if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
        throw new StoreServiceError(
          400,
          'PROMO_MIN_AMOUNT',
          `Минимальная сумма заказа для промокода ${promo.code}: ${formatRub(promo.minOrderAmount)}`,
        );
      }
      appliedPromoCode = promo.code;
      discountAmount =
        promo.type === 'percent'
          ? Math.min(subtotal, Math.round((subtotal * promo.value) / 100))
          : Math.min(subtotal, promo.value);

      await tx.execute('UPDATE promos SET usage_count = usage_count + 1 WHERE id = ?', [
        promo.id,
      ]);
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const deliveryCost =
      input.deliveryMethod === 'showroom' || afterDiscount >= settings.freeDeliveryThreshold
        ? 0
        : input.deliveryMethod === 'courier_msk'
          ? settings.courierMskPrice
          : settings.cdekRfPrice;
    const grandTotal = afterDiscount + deliveryCost;

    const addressSummary =
      input.deliveryMethod === 'showroom'
        ? `${settings.showroomCity} · ${settings.showroomAddress} (${settings.showroomHoursTitle})`
        : input.deliveryMethod === 'courier_msk'
          ? `${(input.delivery.address || '').trim()}${
              input.delivery.comment?.trim() ? ` · ${input.delivery.comment.trim()}` : ''
            }`
          : `${(input.delivery.city || '').trim()}, ПВЗ СДЭК: ${(input.delivery.cdekPoint || '').trim()}`;

    for (const upd of productUpdates) {
      await tx.execute(`UPDATE ${upd.table} SET stock_json = ? WHERE id = ?`, [
        JSON.stringify(upd.stock),
        upd.id,
      ]);
    }

    let orderNumber = `NVM-2026-${crypto.randomInt(1000, 9999)}`;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const existing = await tx.queryOne<Record<string, unknown>>(
        'SELECT 1 FROM orders WHERE order_number = ?',
        [orderNumber],
      );
      if (!existing) break;
      orderNumber = `NVM-2026-${crypto.randomInt(1000, 9999)}`;
    }

    const nowIso = new Date().toISOString();
    const orderId = `ord-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const delivery: AdminOrder['delivery'] = {
      method: input.deliveryMethod,
      label: DELIVERY_LABELS[input.deliveryMethod],
      addressSummary,
      comment: input.delivery.comment?.trim() || undefined,
    };
    const history: OrderHistoryEntry[] = [
      { status: 'new', timestamp: nowIso, note: 'Оформлен покупателем на витрине' },
    ];

    await tx.execute(
      `INSERT INTO orders (
        id, order_number, created_at, completed_at, consent_accepted_at,
        status, payment_status, customer_json, delivery_json, items_json,
        subtotal, promo_code, discount_amount, delivery_cost, grand_total,
        manager_note, cancel_reason, stock_deducted, history_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        orderNumber,
        nowIso,
        null,
        nowIso,
        'new',
        'demo',
        JSON.stringify(input.customer),
        JSON.stringify(delivery),
        JSON.stringify(snapshots),
        subtotal,
        appliedPromoCode,
        discountAmount,
        deliveryCost,
        grandTotal,
        null,
        null,
        1,
        JSON.stringify(history),
      ],
    );

    return {
      id: orderId,
      orderNumber,
      createdAt: nowIso,
      completedAt: null,
      consentAcceptedAt: nowIso,
      status: 'new',
      paymentStatus: 'demo',
      customer: input.customer,
      delivery,
      items: snapshots,
      subtotal,
      promoCode: appliedPromoCode,
      discountAmount,
      deliveryCost,
      grandTotal,
      stockDeducted: true,
      history,
    };
  });
}

async function adjustOrderStockInDb(
  tx: SqlExecutor,
  items: OrderItemSnapshot[],
  direction: -1 | 1,
): Promise<void> {
  const deltaByProduct = new Map<string, Map<string, number>>();
  for (const item of items) {
    let sizeMap = deltaByProduct.get(item.productId);
    if (!sizeMap) {
      sizeMap = new Map<string, number>();
      deltaByProduct.set(item.productId, sizeMap);
    }
    sizeMap.set(item.size, (sizeMap.get(item.size) ?? 0) + item.quantity * direction);
  }

  for (const [productId, sizeMap] of deltaByProduct.entries()) {
    for (const table of ['products', 'bestsellers'] as const) {
      const row = await tx.queryOne<{ stock_json: string }>(
        `SELECT stock_json FROM ${table} WHERE id = ?`,
        [productId],
      );
      if (!row) continue;
      const stock = JSON.parse(row.stock_json) as Record<string, number>;
      for (const [size, delta] of sizeMap.entries()) {
        const current = typeof stock[size] === 'number' ? stock[size] : 5;
        stock[size] = Math.max(0, current + delta);
      }
      await tx.execute(`UPDATE ${table} SET stock_json = ? WHERE id = ?`, [
        JSON.stringify(stock),
        productId,
      ]);
    }
  }
}

export async function updateOrderAdmin(
  orderId: string,
  patch: {
    status?: OrderStatus;
    cancelReason?: string;
    paymentStatus?: PaymentStatus;
    trackingNumber?: string;
    managerNote?: string;
  },
): Promise<AdminOrder> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const row = await tx.queryOne<Record<string, unknown>>(
      'SELECT * FROM orders WHERE id = ?',
      [orderId],
    );
    if (!row) {
      throw new StoreServiceError(404, 'ORDER_NOT_FOUND', 'Заказ не найден');
    }

    const order = rowToOrder(row);
    const nowIso = new Date().toISOString();

    if (patch.status !== undefined) {
      const nextStatus = patch.status;
      if (nextStatus === 'cancelled' && order.stockDeducted) {
        await adjustOrderStockInDb(tx, order.items, 1);
        order.stockDeducted = false;
      } else if (nextStatus !== 'cancelled' && !order.stockDeducted) {
        await adjustOrderStockInDb(tx, order.items, -1);
        order.stockDeducted = true;
      }

      if (nextStatus === 'completed' && order.status !== 'completed') {
        order.completedAt = order.completedAt || nowIso;
      } else if (nextStatus !== 'completed') {
        order.completedAt = null;
      }

      if (order.status !== nextStatus || (nextStatus === 'cancelled' && patch.cancelReason)) {
        const note =
          nextStatus === 'cancelled'
            ? patch.cancelReason?.trim()
              ? `Отменён: ${patch.cancelReason.trim()}`
              : 'Заказ отменён · остатки возвращены'
            : `Статус изменён на «${ORDER_STATUS_LABELS[nextStatus]}»`;
        order.history.push({ status: nextStatus, timestamp: nowIso, note });
      }

      order.status = nextStatus;
      order.cancelReason =
        nextStatus === 'cancelled'
          ? patch.cancelReason?.trim() || order.cancelReason
          : undefined;
    }

    if (patch.paymentStatus !== undefined) {
      order.paymentStatus = patch.paymentStatus;
    }

    if (patch.trackingNumber !== undefined) {
      order.delivery = {
        ...order.delivery,
        trackingNumber: patch.trackingNumber.trim() || undefined,
      };
    }

    if (patch.managerNote !== undefined) {
      order.managerNote = patch.managerNote.trim() || undefined;
    }

    await tx.execute(
      `UPDATE orders SET
        status = ?,
        completed_at = ?,
        payment_status = ?,
        delivery_json = ?,
        manager_note = ?,
        cancel_reason = ?,
        stock_deducted = ?,
        history_json = ?
      WHERE id = ?`,
      [
        order.status,
        order.completedAt,
        order.paymentStatus,
        JSON.stringify(order.delivery),
        order.managerNote ?? null,
        order.cancelReason ?? null,
        order.stockDeducted ? 1 : 0,
        JSON.stringify(order.history),
        order.id,
      ],
    );

    return order;
  });
}

export async function createCategory(input: {
  label: string;
  id?: string;
}): Promise<CatalogCategory> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const label = input.label.trim();
    const baseId = input.id ? input.id.trim().toLowerCase() : slugifyCategoryLabel(label);

    let finalId = baseId;
    let suffix = 2;
    while (
      await tx.queryOne<Record<string, unknown>>(
        'SELECT 1 FROM categories WHERE id = ?',
        [finalId],
      )
    ) {
      if (input.id) {
        throw new StoreServiceError(
          409,
          'CATEGORY_EXISTS',
          `Раздел «${finalId}» уже существует`,
        );
      }
      finalId = `${baseId.slice(0, 26)}-${suffix}`;
      suffix += 1;
    }

    const dupLabel = await tx.queryOne<Record<string, unknown>>(
      'SELECT 1 FROM categories WHERE LOWER(label) = LOWER(?)',
      [label],
    );
    if (dupLabel) {
      throw new StoreServiceError(
        409,
        'CATEGORY_EXISTS',
        `Раздел «${label}» уже существует`,
      );
    }

    const maxRow = await tx.queryOne<{ max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM categories',
    );
    const sortOrder = Number(maxRow?.max_order ?? -1) + 1;

    await tx.execute(
      'INSERT INTO categories (id, label, sort_order) VALUES (?, ?, ?)',
      [finalId, label, sortOrder],
    );

    return { id: finalId, label, sortOrder };
  });
}

export async function updateCategory(
  id: string,
  label: string,
): Promise<CatalogCategory> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const existing = await tx.queryOne<Record<string, unknown>>(
      'SELECT * FROM categories WHERE id = ?',
      [id],
    );
    if (!existing) {
      throw new StoreServiceError(404, 'CATEGORY_NOT_FOUND', 'Раздел каталога не найден');
    }

    const trimmed = label.trim();
    const dupLabel = await tx.queryOne<Record<string, unknown>>(
      'SELECT id FROM categories WHERE LOWER(label) = LOWER(?) AND id != ?',
      [trimmed, id],
    );
    if (dupLabel) {
      throw new StoreServiceError(
        409,
        'CATEGORY_EXISTS',
        `Раздел «${trimmed}» уже существует`,
      );
    }

    await tx.execute('UPDATE categories SET label = ? WHERE id = ?', [trimmed, id]);
    await tx.execute('UPDATE products SET category_label = ? WHERE category = ?', [
      trimmed,
      id,
    ]);

    return {
      id,
      label: trimmed,
      sortOrder: Number(existing.sort_order),
    };
  });
}

export async function reorderCategory(
  id: string,
  direction: 'up' | 'down',
): Promise<CatalogCategory[]> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const all = (
      await tx.queryAll<Record<string, unknown>>(
        'SELECT * FROM categories ORDER BY sort_order ASC',
      )
    ).map(rowToCategory);

    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) {
      throw new StoreServiceError(404, 'CATEGORY_NOT_FOUND', 'Раздел каталога не найден');
    }

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < all.length) {
      const [moved] = all.splice(idx, 1);
      all.splice(targetIdx, 0, moved);
      for (let orderIdx = 0; orderIdx < all.length; orderIdx += 1) {
        all[orderIdx].sortOrder = orderIdx;
        await tx.execute('UPDATE categories SET sort_order = ? WHERE id = ?', [
          orderIdx,
          all[orderIdx].id,
        ]);
      }
    }

    return all;
  });
}

export async function deleteCategory(id: string, reassignTo?: string): Promise<void> {
  await ensureDbReady();

  await runTransaction(async (tx) => {
    const all = (
      await tx.queryAll<Record<string, unknown>>(
        'SELECT * FROM categories ORDER BY sort_order ASC',
      )
    ).map(rowToCategory);

    if (!all.some((c) => c.id === id)) {
      throw new StoreServiceError(404, 'CATEGORY_NOT_FOUND', 'Раздел каталога не найден');
    }
    if (all.length <= 1) {
      throw new StoreServiceError(
        400,
        'LAST_CATEGORY',
        'В каталоге должен остаться хотя бы 1 раздел',
      );
    }

    const countRow = await tx.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM products WHERE category = ?',
      [id],
    );

    if (Number(countRow?.cnt ?? 0) > 0) {
      if (!reassignTo || reassignTo === id) {
        throw new StoreServiceError(
          409,
          'CATEGORY_NOT_EMPTY',
          `В разделе есть товары (${countRow?.cnt}). Выберите раздел для переноса перед удалением.`,
        );
      }
      const targetCat = all.find((c) => c.id === reassignTo);
      if (!targetCat) {
        throw new StoreServiceError(
          400,
          'INVALID_TARGET_CATEGORY',
          'Целевой раздел для переноса не найден',
        );
      }
      await tx.execute(
        'UPDATE products SET category = ?, category_label = ? WHERE category = ?',
        [targetCat.id, targetCat.label, id],
      );
    }

    await tx.execute('DELETE FROM categories WHERE id = ?', [id]);

    const remaining = (
      await tx.queryAll<Record<string, unknown>>(
        'SELECT * FROM categories ORDER BY sort_order ASC',
      )
    ).map(rowToCategory);
    for (let idx = 0; idx < remaining.length; idx += 1) {
      await tx.execute('UPDATE categories SET sort_order = ? WHERE id = ?', [
        idx,
        remaining[idx].id,
      ]);
    }
  });
}

export async function createProduct(input: {
  title: string;
  sku: string;
  category: string;
  categoryLabel?: string;
  price: number;
  description: string;
  material: string;
  fit: string;
  sizes: string[];
  image: string;
  gallery?: string[];
  stock: Record<string, number>;
  hidden?: boolean;
}): Promise<CatalogProduct> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const catRow = await tx.queryOne<{ id: string; label: string }>(
      'SELECT id, label FROM categories WHERE id = ?',
      [input.category],
    );
    if (!catRow) {
      throw new StoreServiceError(
        400,
        'INVALID_CATEGORY',
        'Выбранный раздел каталога не найден',
      );
    }

    const cleanStock = { ...input.stock };
    const cleanSizes = syncSizesWithStock(input.sizes, cleanStock);
    const cleanPrice = Math.max(1, Math.round(input.price));
    const id = `cat-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const minOrderRow = await tx.queryOne<{ min_order: number }>(
      'SELECT COALESCE(MIN(sort_order), 0) as min_order FROM products',
    );
    const sortOrder = Number(minOrderRow?.min_order ?? 0) - 1;
    const nowIso = new Date().toISOString();

    const product: CatalogProduct = {
      id,
      sku: input.sku.trim().toUpperCase(),
      category: catRow.id,
      categoryLabel: catRow.label,
      title: input.title.trim().toUpperCase(),
      price: cleanPrice,
      priceFormatted: formatRub(cleanPrice),
      description: input.description.trim(),
      material: input.material.trim(),
      fit: input.fit.trim(),
      sizes: cleanSizes,
      image: input.image.trim(),
      gallery: (input.gallery ?? []).filter(Boolean),
      stock: cleanStock,
      hidden: Boolean(input.hidden),
    };

    await tx.execute(
      `INSERT INTO products (
        id, sku, category, category_label, title, price, description,
        material, fit, sizes_json, image, gallery_json, stock_json,
        hidden, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.sku,
        product.category,
        product.categoryLabel,
        product.title,
        product.price,
        product.description,
        product.material,
        product.fit,
        JSON.stringify(product.sizes),
        product.image,
        JSON.stringify(product.gallery ?? []),
        JSON.stringify(product.stock),
        product.hidden ? 1 : 0,
        sortOrder,
        nowIso,
      ],
    );

    return product;
  });
}

export async function updateProduct(
  id: string,
  patch: Partial<{
    title: string;
    sku: string;
    category: string;
    categoryLabel: string;
    price: number;
    description: string;
    material: string;
    fit: string;
    sizes: string[];
    image: string;
    gallery: string[];
    stock: Record<string, number>;
    hidden: boolean;
  }>,
): Promise<CatalogProduct> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const existingRow = await tx.queryOne<Record<string, unknown>>(
      'SELECT * FROM products WHERE id = ?',
      [id],
    );
    if (!existingRow) {
      throw new StoreServiceError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден');
    }
    const existing = rowToProduct(existingRow);

    let nextCategory = existing.category;
    let nextCategoryLabel = existing.categoryLabel;
    if (patch.category !== undefined) {
      const catRow = await tx.queryOne<{ id: string; label: string }>(
        'SELECT id, label FROM categories WHERE id = ?',
        [patch.category],
      );
      if (!catRow) {
        throw new StoreServiceError(
          400,
          'INVALID_CATEGORY',
          'Раздел каталога не найден',
        );
      }
      nextCategory = catRow.id;
      nextCategoryLabel = catRow.label;
    }

    const nextPrice =
      typeof patch.price === 'number'
        ? Math.max(1, Math.round(patch.price))
        : existing.price;
    const nextStock = patch.stock ? { ...patch.stock } : existing.stock;
    const nextSizes = syncSizesWithStock(patch.sizes ?? existing.sizes, nextStock);

    const updated: CatalogProduct = {
      ...existing,
      ...patch,
      category: nextCategory,
      categoryLabel: nextCategoryLabel,
      sku: patch.sku !== undefined ? patch.sku.trim().toUpperCase() : existing.sku,
      title: patch.title !== undefined ? patch.title.trim().toUpperCase() : existing.title,
      price: nextPrice,
      priceFormatted: formatRub(nextPrice),
      description:
        patch.description !== undefined ? patch.description.trim() : existing.description,
      material: patch.material !== undefined ? patch.material.trim() : existing.material,
      fit: patch.fit !== undefined ? patch.fit.trim() : existing.fit,
      image: patch.image !== undefined ? patch.image.trim() : existing.image,
      sizes: nextSizes,
      stock: nextStock,
      gallery:
        patch.gallery !== undefined ? patch.gallery.filter(Boolean) : existing.gallery,
      hidden: patch.hidden !== undefined ? Boolean(patch.hidden) : existing.hidden,
    };

    await tx.execute(
      `UPDATE products SET
        sku = ?, category = ?, category_label = ?, title = ?, price = ?,
        description = ?, material = ?, fit = ?, sizes_json = ?, image = ?,
        gallery_json = ?, stock_json = ?, hidden = ?
      WHERE id = ?`,
      [
        updated.sku,
        updated.category,
        updated.categoryLabel,
        updated.title,
        updated.price,
        updated.description,
        updated.material,
        updated.fit,
        JSON.stringify(updated.sizes),
        updated.image,
        JSON.stringify(updated.gallery ?? []),
        JSON.stringify(updated.stock),
        updated.hidden ? 1 : 0,
        id,
      ],
    );

    return updated;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await ensureDbReady();
  const res = await execute('DELETE FROM products WHERE id = ?', [id]);
  if (Number(res.changes) === 0) {
    throw new StoreServiceError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден');
  }
}

export async function createBestseller(input: {
  tag: string;
  title: string;
  sku: string;
  categoryLabel: string;
  price: number;
  description: string;
  material: string;
  fit: string;
  sizes: string[];
  image: string;
  modelImage: string;
  gallery?: string[];
  stock: Record<string, number>;
}): Promise<BestsellerProduct> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const countRow = await tx.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM bestsellers',
    );
    if (Number(countRow?.cnt ?? 0) >= MAX_BESTSELLERS) {
      throw new StoreServiceError(
        400,
        'MAX_BESTSELLERS',
        'Максимум 8 бестселлеров на витрине',
      );
    }

    const maxRow = await tx.queryOne<{ max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM bestsellers',
    );
    const sortOrder = Number(maxRow?.max_order ?? -1) + 1;

    const cleanStock = { ...input.stock };
    const cleanSizes = syncSizesWithStock(input.sizes, cleanStock);
    const cleanPrice = Math.max(1, Math.round(input.price));
    const item: BestsellerProduct = {
      id: `bs-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      tag: input.tag.trim(),
      sku: input.sku.trim().toUpperCase(),
      categoryLabel: input.categoryLabel.trim(),
      title: input.title.trim().toUpperCase(),
      price: cleanPrice,
      priceFormatted: formatRub(cleanPrice),
      description: input.description.trim(),
      material: input.material.trim(),
      fit: input.fit.trim(),
      sizes: cleanSizes,
      image: input.image.trim(),
      modelImage: input.modelImage.trim(),
      gallery: (input.gallery ?? []).filter(Boolean),
      stock: cleanStock,
      hidden: false,
    };

    await tx.execute(
      `INSERT INTO bestsellers (
        id, tag, sku, category_label, title, price, description,
        material, fit, sizes_json, image, model_image, gallery_json,
        stock_json, hidden, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.tag,
        item.sku,
        item.categoryLabel,
        item.title,
        item.price,
        item.description,
        item.material,
        item.fit,
        JSON.stringify(item.sizes),
        item.image,
        item.modelImage,
        JSON.stringify(item.gallery ?? []),
        JSON.stringify(item.stock),
        0,
        sortOrder,
      ],
    );

    return item;
  });
}

export async function updateBestseller(
  id: string,
  patch: Partial<{
    tag: string;
    title: string;
    sku: string;
    categoryLabel: string;
    price: number;
    description: string;
    material: string;
    fit: string;
    sizes: string[];
    image: string;
    modelImage: string;
    gallery: string[];
    stock: Record<string, number>;
  }>,
): Promise<BestsellerProduct> {
  await ensureDbReady();

  return runTransaction(async (tx) => {
    const existingRow = await tx.queryOne<Record<string, unknown>>(
      'SELECT * FROM bestsellers WHERE id = ?',
      [id],
    );
    if (!existingRow) {
      throw new StoreServiceError(404, 'BESTSELLER_NOT_FOUND', 'Бестселлер не найден');
    }
    const existing = rowToBestseller(existingRow);

    const nextPrice =
      typeof patch.price === 'number'
        ? Math.max(1, Math.round(patch.price))
        : existing.price;
    const nextStock = patch.stock ? { ...patch.stock } : existing.stock;
    const nextSizes = syncSizesWithStock(patch.sizes ?? existing.sizes, nextStock);

    const updated: BestsellerProduct = {
      ...existing,
      ...patch,
      tag: patch.tag !== undefined ? patch.tag.trim() : existing.tag,
      sku: patch.sku !== undefined ? patch.sku.trim().toUpperCase() : existing.sku,
      title: patch.title !== undefined ? patch.title.trim().toUpperCase() : existing.title,
      categoryLabel:
        patch.categoryLabel !== undefined ? patch.categoryLabel.trim() : existing.categoryLabel,
      price: nextPrice,
      priceFormatted: formatRub(nextPrice),
      description:
        patch.description !== undefined ? patch.description.trim() : existing.description,
      material: patch.material !== undefined ? patch.material.trim() : existing.material,
      fit: patch.fit !== undefined ? patch.fit.trim() : existing.fit,
      image: patch.image !== undefined ? patch.image.trim() : existing.image,
      modelImage:
        patch.modelImage !== undefined ? patch.modelImage.trim() : existing.modelImage,
      sizes: nextSizes,
      stock: nextStock,
      gallery:
        patch.gallery !== undefined ? patch.gallery.filter(Boolean) : existing.gallery,
    };

    await tx.execute(
      `UPDATE bestsellers SET
        tag = ?, sku = ?, category_label = ?, title = ?, price = ?,
        description = ?, material = ?, fit = ?, sizes_json = ?,
        image = ?, model_image = ?, gallery_json = ?, stock_json = ?
      WHERE id = ?`,
      [
        updated.tag,
        updated.sku,
        updated.categoryLabel,
        updated.title,
        updated.price,
        updated.description,
        updated.material,
        updated.fit,
        JSON.stringify(updated.sizes),
        updated.image,
        updated.modelImage,
        JSON.stringify(updated.gallery ?? []),
        JSON.stringify(updated.stock),
        id,
      ],
    );

    return updated;
  });
}

export async function deleteBestseller(id: string): Promise<void> {
  await ensureDbReady();
  await runTransaction(async (tx) => {
    const countRow = await tx.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM bestsellers',
    );
    if (Number(countRow?.cnt ?? 0) <= MIN_BESTSELLERS) {
      throw new StoreServiceError(
        400,
        'MIN_BESTSELLERS',
        'Должно остаться минимум 2 бестселлера',
      );
    }
    const res = await tx.execute('DELETE FROM bestsellers WHERE id = ?', [id]);
    if (Number(res.changes) === 0) {
      throw new StoreServiceError(404, 'BESTSELLER_NOT_FOUND', 'Бестселлер не найден');
    }
  });
}

export async function reorderBestseller(
  id: string,
  direction: 'up' | 'down',
): Promise<BestsellerProduct[]> {
  await ensureDbReady();
  return runTransaction(async (tx) => {
    const list = (
      await tx.queryAll<Record<string, unknown>>(
        'SELECT * FROM bestsellers ORDER BY sort_order ASC',
      )
    ).map(rowToBestseller);

    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) {
      throw new StoreServiceError(404, 'BESTSELLER_NOT_FOUND', 'Бестселлер не найден');
    }
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const [moved] = list.splice(idx, 1);
      list.splice(targetIdx, 0, moved);
      for (let orderIdx = 0; orderIdx < list.length; orderIdx += 1) {
        await tx.execute('UPDATE bestsellers SET sort_order = ? WHERE id = ?', [
          orderIdx,
          list[orderIdx].id,
        ]);
      }
    }

    return list;
  });
}

export async function promoteCatalogToBestseller(
  catalogItemId: string,
  modelImage?: string,
  tag?: string,
): Promise<BestsellerProduct> {
  await ensureDbReady();
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM products WHERE id = ?',
    [catalogItemId],
  );
  if (!row) {
    throw new StoreServiceError(404, 'PRODUCT_NOT_FOUND', 'Товар каталога не найден');
  }
  const source = rowToProduct(row);
  const countRow = await queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM bestsellers',
  );
  return createBestseller({
    tag: tag?.trim() || `Drop 0${Number(countRow?.cnt ?? 0) + 1} · ${source.categoryLabel}`,
    title: source.title,
    sku: source.sku,
    categoryLabel: source.categoryLabel,
    price: source.price,
    description: source.description,
    material: source.material,
    fit: source.fit,
    sizes: [...source.sizes],
    image: source.image,
    modelImage: modelImage?.trim() || source.image,
    gallery: source.gallery ? [...source.gallery] : [],
    stock: { ...source.stock },
  });
}

export async function createPromo(input: {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount?: number;
  active: boolean;
}): Promise<PromoCodeRule> {
  await ensureDbReady();
  const normalized = input.code.trim().toUpperCase();
  const existing = await queryOne<Record<string, unknown>>(
    'SELECT 1 FROM promos WHERE UPPER(code) = ?',
    [normalized],
  );
  if (existing) {
    throw new StoreServiceError(409, 'PROMO_EXISTS', 'Такой промокод уже существует');
  }

  const created: PromoCodeRule = {
    id: `promo-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    code: normalized,
    type: input.type,
    value: Math.max(1, Math.round(input.value)),
    minOrderAmount:
      input.minOrderAmount && input.minOrderAmount > 0
        ? Math.round(input.minOrderAmount)
        : undefined,
    active: Boolean(input.active),
    usageCount: 0,
  };

  await execute(
    `INSERT INTO promos (id, code, type, value, min_order_amount, active, usage_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      created.id,
      created.code,
      created.type,
      created.value,
      created.minOrderAmount ?? null,
      created.active ? 1 : 0,
      0,
      new Date().toISOString(),
    ],
  );

  return created;
}

export async function updatePromo(
  id: string,
  patch: { active?: boolean },
): Promise<PromoCodeRule> {
  await ensureDbReady();
  const existing = await queryOne<Record<string, unknown>>(
    'SELECT * FROM promos WHERE id = ?',
    [id],
  );
  if (!existing) {
    throw new StoreServiceError(404, 'PROMO_NOT_FOUND', 'Промокод не найден');
  }
  const nextActive =
    patch.active !== undefined ? patch.active : !Boolean(Number(existing.active));
  await execute('UPDATE promos SET active = ? WHERE id = ?', [nextActive ? 1 : 0, id]);
  const updated = (await queryOne<Record<string, unknown>>(
    'SELECT * FROM promos WHERE id = ?',
    [id],
  )) as Record<string, unknown>;
  return rowToPromo(updated);
}

export async function deletePromo(id: string): Promise<void> {
  await ensureDbReady();
  const res = await execute('DELETE FROM promos WHERE id = ?', [id]);
  if (Number(res.changes) === 0) {
    throw new StoreServiceError(404, 'PROMO_NOT_FOUND', 'Промокод не найден');
  }
}

export async function updateStoreSettings(
  patch: Partial<StoreSettings>,
): Promise<StoreSettings> {
  await ensureDbReady();
  const current = await readSettings();
  const next: StoreSettings = {
    ...current,
    ...patch,
    tickerItems:
      patch.tickerItems && patch.tickerItems.length > 0
        ? patch.tickerItems
        : current.tickerItems,
  };
  await execute(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ['store_settings', JSON.stringify(next)],
  );
  return next;
}

export async function saveMedia(
  mimeType: string,
  data: Buffer,
): Promise<{
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}> {
  await ensureDbReady();
  const id = `m_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  const base64 = data.toString('base64');
  await execute(
    'INSERT INTO media (id, mime_type, data_base64, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, mimeType, base64, data.length, new Date().toISOString()],
  );

  return {
    id,
    url: `/api/media/${id}`,
    mimeType,
    sizeBytes: data.length,
  };
}

export async function getMedia(
  id: string,
): Promise<{ mimeType: string; data: Buffer } | null> {
  await ensureDbReady();
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM media WHERE id = ?',
    [id],
  );
  if (!row) return null;

  if (typeof row.data_base64 === 'string' && row.data_base64.length > 0) {
    return {
      mimeType: String(row.mime_type),
      data: Buffer.from(row.data_base64, 'base64'),
    };
  }
  if (row.data instanceof Uint8Array) {
    return {
      mimeType: String(row.mime_type),
      data: Buffer.from(row.data),
    };
  }
  return null;
}

export async function recordAdminSession(
  tokenHash: string,
  username: string,
  expiresAt: string,
  userAgent?: string,
  ip?: string,
): Promise<void> {
  await ensureDbReady();
  const createdAt = new Date().toISOString();
  await execute('DELETE FROM admin_sessions WHERE expires_at <= ?', [createdAt]);
  await execute(
    `INSERT INTO admin_sessions (token_hash, username, created_at, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(token_hash) DO NOTHING`,
    [tokenHash, username, createdAt, expiresAt, userAgent?.slice(0, 200) ?? null, ip ?? null],
  );
}

export async function revokeAdminSession(
  tokenHash: string,
  expiresAt: string,
): Promise<void> {
  await ensureDbReady();
  await execute('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
  await execute(
    `INSERT INTO revoked_sessions (token_hash, expires_at) VALUES (?, ?)
     ON CONFLICT(token_hash) DO NOTHING`,
    [tokenHash, expiresAt],
  );
}

export async function isAdminSessionRevoked(tokenHash: string): Promise<boolean> {
  await ensureDbReady();
  const row = await queryOne<Record<string, unknown>>(
    'SELECT 1 FROM revoked_sessions WHERE token_hash = ?',
    [tokenHash],
  );
  return Boolean(row);
}

export async function resetDemoDatabase(): Promise<AdminBootstrapPayload> {
  await ensureDbReady();
  await runTransaction(async (tx) => {
    await tx.execute('DELETE FROM orders');
    await tx.execute('DELETE FROM products');
    await tx.execute('DELETE FROM bestsellers');
    await tx.execute('DELETE FROM promos');
    await tx.execute('DELETE FROM categories');
    await tx.execute('DELETE FROM settings');
    await tx.execute('DELETE FROM media');
    await seedTablesInsideTransaction(tx);
  });
  return getAdminBootstrap();
}
