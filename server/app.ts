import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import {
  StoreServiceError,
  createBestseller,
  createCategory,
  createOrderFromCheckout,
  createProduct,
  createPromo,
  deleteBestseller,
  deleteCategory,
  deleteProduct,
  deletePromo,
  getAdminBootstrap,
  getAdminOrders,
  getDbEngineLabel,
  getDbStats,
  getMedia,
  getRetentionDays,
  getStorefrontData,
  isAdminSessionRevoked,
  promoteCatalogToBestseller,
  purgeExpiredCompletedOrders,
  recordAdminSession,
  reorderBestseller,
  reorderCategory,
  resetDemoDatabase,
  revokeAdminSession,
  saveMedia,
  updateBestseller,
  updateCategory,
  updateOrderAdmin,
  updateProduct,
  updatePromo,
  updateStoreSettings,
  validatePromoForSubtotal,
  writeAuditLog,
} from './db.ts';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  applySecurityHeaders,
  buildClearSessionCookie,
  buildSessionCookie,
  checkRateLimit,
  createSignedSessionToken,
  getClientIp,
  hasFetchCsrfHeader,
  isRequestHttps,
  parseCookies,
  recordRateLimitHit,
  resetRateLimitBucket,
  verifyAdminCredentials,
  verifySameOrigin,
  verifySignedSessionToken,
} from './security.ts';
import {
  bestsellerInputSchema,
  bestsellerPatchSchema,
  categoryCreateSchema,
  categoryDeleteSchema,
  categoryUpdateSchema,
  createOrderSchema,
  loginSchema,
  mediaUploadSchema,
  orderPatchSchema,
  productInputSchema,
  productPatchSchema,
  promoInputSchema,
  promoPatchSchema,
  promoteBestsellerSchema,
  reorderSchema,
  sanitizeTelegram,
  settingsPatchSchema,
  validatePromoSchema,
  verifyImageMagicBytes,
} from './validation.ts';

class PayloadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_JSON_LIMIT = 64 * 1024;
const UPLOAD_JSON_LIMIT = 4_400_000;
const MAX_UPLOAD_RAW_BYTES = 3 * 1024 * 1024;

function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
  opts?: { noStore?: boolean; extraHeaders?: Record<string, string> },
): void {
  const payload = JSON.stringify(body);
  applySecurityHeaders(req, res, { noStore: opts?.noStore, urlPath: req.url });
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (opts?.extraHeaders) {
    for (const [k, v] of Object.entries(opts.extraHeaders)) {
      res.setHeader(k, v);
    }
  }
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage, maxBytes = DEFAULT_JSON_LIMIT): Promise<unknown> {
  // On Vercel Node.js Functions (@vercel/node), req.body may already be pre-parsed
  const preParsedReq = req as IncomingMessage & { body?: unknown };
  if (preParsedReq.body !== undefined) {
    if (preParsedReq.body === null) return {};
    if (typeof preParsedReq.body === 'string') {
      if (Buffer.byteLength(preParsedReq.body, 'utf8') > maxBytes) {
        throw new PayloadError(413, 'Слишком большой размер запроса');
      }
      if (!preParsedReq.body.trim()) return {};
      try {
        return JSON.parse(preParsedReq.body);
      } catch {
        throw new PayloadError(400, 'Некорректный JSON в теле запроса');
      }
    }
    if (Buffer.isBuffer(preParsedReq.body)) {
      if (preParsedReq.body.length > maxBytes) {
        throw new PayloadError(413, 'Слишком большой размер запроса');
      }
      const text = preParsedReq.body.toString('utf8').trim();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        throw new PayloadError(400, 'Некорректный JSON в теле запроса');
      }
    }
    if (typeof preParsedReq.body === 'object') {
      const serializedSize = Buffer.byteLength(JSON.stringify(preParsedReq.body), 'utf8');
      if (serializedSize > maxBytes) {
        throw new PayloadError(413, 'Слишком большой размер запроса');
      }
      return preParsedReq.body;
    }
  }

  if (req.readableEnded) {
    return {};
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        fail(new PayloadError(413, 'Слишком большой размер запроса'));
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new PayloadError(400, 'Некорректный JSON в теле запроса'));
      }
    });

    req.on('error', (err) => {
      fail(err instanceof Error ? err : new Error('Request stream error'));
    });
  });
}

async function getAuthenticatedSession(
  req: IncomingMessage,
): Promise<{ tokenHash: string; username: string; expiresAt: string } | null> {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const verified = verifySignedSessionToken(rawToken);
  if (!verified) return null;

  if (await isAdminSessionRevoked(verified.tokenHash)) {
    return null;
  }

  return verified;
}

async function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<{ tokenHash: string; username: string; expiresAt: string } | null> {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    sendJson(
      req,
      res,
      401,
      { error: 'Требуется авторизация администратора', code: 'UNAUTHORIZED' },
      { noStore: true },
    );
    return null;
  }
  return session;
}

function formatZodError(err: ZodError): string {
  const first = err.issues[0];
  if (!first) return 'Некорректные данные запроса';
  return first.message || 'Ошибка валидации данных';
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const ip = getClientIp(req);

  const generalLimit = checkRateLimit('api_general', ip, 240, 60_000);
  if (!generalLimit.allowed) {
    sendJson(
      req,
      res,
      429,
      { error: 'Слишком много запросов. Повторите через минуту.', code: 'RATE_LIMITED' },
      {
        noStore: true,
        extraHeaders: { 'Retry-After': String(generalLimit.retryAfterSec) },
      },
    );
    return;
  }
  recordRateLimitHit('api_general', ip, 60_000);

  if (method === 'OPTIONS') {
    applySecurityHeaders(req, res, { urlPath: pathname });
    res.statusCode = 204;
    res.end();
    return;
  }

  const isMutating =
    method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
  const isCronPath = pathname === '/api/cleanup-orders';

  if (isMutating && !isCronPath) {
    if (!verifySameOrigin(req)) {
      sendJson(
        req,
        res,
        403,
        { error: 'Запрещённый источник запроса', code: 'FORBIDDEN_ORIGIN' },
        { noStore: true },
      );
      return;
    }

    if (
      (pathname.startsWith('/api/admin/') || pathname === '/api/auth/logout') &&
      !hasFetchCsrfHeader(req)
    ) {
      sendJson(
        req,
        res,
        403,
        { error: 'Отсутствует обязательный заголовок запроса', code: 'CSRF_HEADER_MISSING' },
        { noStore: true },
      );
      return;
    }
  }

  try {
    // 1. Health & Storefront
    if (method === 'GET' && pathname === '/api/health') {
      sendJson(req, res, 200, {
        ok: true,
        db: getDbEngineLabel(),
        retentionDays: getRetentionDays(),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/storefront') {
      await purgeExpiredCompletedOrders(false);
      const data = await getStorefrontData();
      sendJson(req, res, 200, data, { noStore: true });
      return;
    }

    if (method === 'POST' && pathname === '/api/promos/validate') {
      const limit = checkRateLimit('promo_validate', ip, 30, 60_000);
      if (!limit.allowed) {
        sendJson(
          req,
          res,
          429,
          { error: 'Слишком много попыток проверки промокода', code: 'RATE_LIMITED' },
          {
            noStore: true,
            extraHeaders: { 'Retry-After': String(limit.retryAfterSec) },
          },
        );
        return;
      }
      recordRateLimitHit('promo_validate', ip, 60_000);

      const raw = await readJsonBody(req);
      const parsed = validatePromoSchema.parse(raw);
      const result = await validatePromoForSubtotal(parsed.code, parsed.subtotal);
      sendJson(req, res, 200, result, { noStore: true });
      return;
    }

    if (method === 'POST' && pathname === '/api/orders') {
      const limit = checkRateLimit('orders_create', ip, 10, 10 * 60_000);
      if (!limit.allowed) {
        sendJson(
          req,
          res,
          429,
          { error: 'Превышен лимит создания заказов. Попробуйте позже.', code: 'RATE_LIMITED' },
          {
            noStore: true,
            extraHeaders: { 'Retry-After': String(limit.retryAfterSec) },
          },
        );
        return;
      }

      const raw = await readJsonBody(req);
      const parsed = createOrderSchema.parse(raw);
      recordRateLimitHit('orders_create', ip, 10 * 60_000);

      const order = await createOrderFromCheckout({
        items: parsed.items,
        promoCode: parsed.promoCode ?? null,
        deliveryMethod: parsed.deliveryMethod,
        customer: {
          fullName: parsed.customer.fullName,
          phone: parsed.customer.phone,
          email: parsed.customer.email,
          telegram: sanitizeTelegram(parsed.customer.telegram),
        },
        delivery: {
          address: parsed.delivery.address,
          city: parsed.delivery.city,
          cdekPoint: parsed.delivery.cdekPoint,
          comment: parsed.delivery.comment,
        },
      });

      await writeAuditLog('customer', 'order_created', order.id, {
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
      });

      sendJson(req, res, 201, { order }, { noStore: true });
      return;
    }

    // 2. Public uploaded media endpoint
    const mediaMatch = pathname.match(/^\/api\/media\/([A-Za-z0-9_-]{4,64})$/);
    if (method === 'GET' && mediaMatch) {
      const media = await getMedia(mediaMatch[1]);
      if (!media) {
        sendJson(req, res, 404, { error: 'Файл не найден', code: 'NOT_FOUND' });
        return;
      }
      applySecurityHeaders(req, res, { isMedia: true, urlPath: pathname });
      res.statusCode = 200;
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(media.data);
      return;
    }

    // 3. Auth Routes
    if (method === 'GET' && pathname === '/api/auth/session') {
      const session = await getAuthenticatedSession(req);
      sendJson(
        req,
        res,
        200,
        session
          ? { authenticated: true, username: session.username }
          : { authenticated: false },
        { noStore: true },
      );
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const failLimit = checkRateLimit('auth_login_fail', ip, 5, 15 * 60_000);
      if (!failLimit.allowed) {
        sendJson(
          req,
          res,
          429,
          {
            error: `Слишком много неудачных попыток входа. Повторите через ${failLimit.retryAfterSec} сек.`,
            code: 'LOGIN_RATE_LIMITED',
          },
          {
            noStore: true,
            extraHeaders: { 'Retry-After': String(failLimit.retryAfterSec) },
          },
        );
        return;
      }

      const raw = await readJsonBody(req);
      const parsed = loginSchema.parse(raw);

      if (!verifyAdminCredentials(parsed.username, parsed.password)) {
        recordRateLimitHit('auth_login_fail', ip, 15 * 60_000);
        await writeAuditLog('anonymous', 'admin_login_failed', undefined, {
          username: parsed.username,
          ip,
        });
        sendJson(
          req,
          res,
          401,
          { error: 'Неверный логин или пароль', code: 'INVALID_CREDENTIALS' },
          { noStore: true },
        );
        return;
      }

      resetRateLimitBucket('auth_login_fail', ip);
      const { token, tokenHash, expiresAt } = createSignedSessionToken(
        parsed.username.trim(),
        SESSION_TTL_SECONDS,
      );
      await recordAdminSession(
        tokenHash,
        parsed.username.trim(),
        expiresAt,
        req.headers['user-agent'],
        ip,
      );
      await writeAuditLog(parsed.username.trim(), 'admin_login_success', undefined, { ip });

      sendJson(
        req,
        res,
        200,
        { authenticated: true, username: parsed.username.trim() },
        {
          noStore: true,
          extraHeaders: {
            'Set-Cookie': buildSessionCookie(token, isRequestHttps(req)),
          },
        },
      );
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const session = await getAuthenticatedSession(req);
      if (session) {
        await revokeAdminSession(session.tokenHash, session.expiresAt);
        await writeAuditLog(session.username, 'admin_logout');
      }
      sendJson(
        req,
        res,
        200,
        { authenticated: false },
        {
          noStore: true,
          extraHeaders: {
            'Set-Cookie': buildClearSessionCookie(isRequestHttps(req)),
          },
        },
      );
      return;
    }

    // 4. Cron cleanup endpoint (for Vercel Schedules)
    if ((method === 'POST' || method === 'GET') && pathname === '/api/cleanup-orders') {
      const cronSecret = process.env.CRON_SECRET?.trim();
      const authHeader = req.headers.authorization;
      const session = await getAuthenticatedSession(req);
      const authorizedByCron =
        Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
      if (!authorizedByCron && !session) {
        sendJson(
          req,
          res,
          401,
          { error: 'Недостаточно прав для выполнения очистки', code: 'UNAUTHORIZED' },
          { noStore: true },
        );
        return;
      }
      const result = await purgeExpiredCompletedOrders(true);
      sendJson(
        req,
        res,
        200,
        { ok: true, ...result, dbStats: await getDbStats() },
        { noStore: true },
      );
      return;
    }

    // 5. Protected Admin API Routes
    if (pathname.startsWith('/api/admin/')) {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      if (method === 'GET' && pathname === '/api/admin/bootstrap') {
        sendJson(req, res, 200, await getAdminBootstrap(), { noStore: true });
        return;
      }

      if (method === 'GET' && pathname === '/api/admin/orders') {
        sendJson(req, res, 200, await getAdminOrders(), { noStore: true });
        return;
      }

      if (method === 'POST' && pathname === '/api/admin/orders/purge-expired') {
        const result = await purgeExpiredCompletedOrders(true);
        await writeAuditLog(admin.username, 'manual_purge_orders', undefined, result);
        const ordersData = await getAdminOrders();
        sendJson(req, res, 200, { ...result, ...ordersData }, { noStore: true });
        return;
      }

      const orderMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (method === 'PATCH' && orderMatch) {
        const raw = await readJsonBody(req);
        const parsed = orderPatchSchema.parse(raw);
        const order = await updateOrderAdmin(decodeURIComponent(orderMatch[1]), parsed);
        await writeAuditLog(admin.username, 'order_updated', order.id, parsed);
        sendJson(
          req,
          res,
          200,
          { order, dbStats: await getDbStats() },
          { noStore: true },
        );
        return;
      }

      // Categories CRUD
      if (method === 'POST' && pathname === '/api/admin/categories') {
        const raw = await readJsonBody(req);
        const parsed = categoryCreateSchema.parse(raw);
        const category = await createCategory(parsed);
        await writeAuditLog(admin.username, 'category_created', category.id, parsed);
        sendJson(req, res, 201, { category }, { noStore: true });
        return;
      }

      const catReorderMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)\/reorder$/);
      if (method === 'POST' && catReorderMatch) {
        const raw = await readJsonBody(req);
        const parsed = reorderSchema.parse(raw);
        const categories = await reorderCategory(
          decodeURIComponent(catReorderMatch[1]),
          parsed.direction,
        );
        sendJson(req, res, 200, { categories }, { noStore: true });
        return;
      }

      const catMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
      if (catMatch) {
        const catId = decodeURIComponent(catMatch[1]);
        if (method === 'PATCH') {
          const raw = await readJsonBody(req);
          const parsed = categoryUpdateSchema.parse(raw);
          const category = await updateCategory(catId, parsed.label);
          await writeAuditLog(admin.username, 'category_updated', catId, parsed);
          sendJson(req, res, 200, { category }, { noStore: true });
          return;
        }
        if (method === 'DELETE') {
          const raw = await readJsonBody(req);
          const parsed = categoryDeleteSchema.parse(raw);
          const reassignTo =
            parsed.reassignTo || url.searchParams.get('reassignTo') || undefined;
          await deleteCategory(catId, reassignTo);
          await writeAuditLog(admin.username, 'category_deleted', catId, { reassignTo });
          sendJson(req, res, 200, { ok: true }, { noStore: true });
          return;
        }
      }

      // Products CRUD
      if (method === 'POST' && pathname === '/api/admin/products') {
        const raw = await readJsonBody(req);
        const parsed = productInputSchema.parse(raw);
        const product = await createProduct(parsed);
        await writeAuditLog(admin.username, 'product_created', product.id, { sku: product.sku });
        sendJson(req, res, 201, { product }, { noStore: true });
        return;
      }

      const prodMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (prodMatch) {
        const prodId = decodeURIComponent(prodMatch[1]);
        if (method === 'PATCH') {
          const raw = await readJsonBody(req);
          const parsed = productPatchSchema.parse(raw);
          const product = await updateProduct(prodId, parsed);
          await writeAuditLog(admin.username, 'product_updated', prodId);
          sendJson(req, res, 200, { product }, { noStore: true });
          return;
        }
        if (method === 'DELETE') {
          await deleteProduct(prodId);
          await writeAuditLog(admin.username, 'product_deleted', prodId);
          sendJson(req, res, 200, { ok: true }, { noStore: true });
          return;
        }
      }

      // Bestsellers CRUD
      if (method === 'POST' && pathname === '/api/admin/bestsellers/promote') {
        const raw = await readJsonBody(req);
        const parsed = promoteBestsellerSchema.parse(raw);
        const bestseller = await promoteCatalogToBestseller(
          parsed.catalogItemId,
          parsed.modelImage,
          parsed.tag,
        );
        await writeAuditLog(admin.username, 'bestseller_promoted', bestseller.id);
        sendJson(req, res, 201, { bestseller }, { noStore: true });
        return;
      }

      const bsReorderMatch = pathname.match(/^\/api\/admin\/bestsellers\/([^/]+)\/reorder$/);
      if (method === 'POST' && bsReorderMatch) {
        const raw = await readJsonBody(req);
        const parsed = reorderSchema.parse(raw);
        const bestsellers = await reorderBestseller(
          decodeURIComponent(bsReorderMatch[1]),
          parsed.direction,
        );
        sendJson(req, res, 200, { bestsellers }, { noStore: true });
        return;
      }

      if (method === 'POST' && pathname === '/api/admin/bestsellers') {
        const raw = await readJsonBody(req);
        const parsed = bestsellerInputSchema.parse(raw);
        const bestseller = await createBestseller(parsed);
        await writeAuditLog(admin.username, 'bestseller_created', bestseller.id);
        sendJson(req, res, 201, { bestseller }, { noStore: true });
        return;
      }

      const bsMatch = pathname.match(/^\/api\/admin\/bestsellers\/([^/]+)$/);
      if (bsMatch) {
        const bsId = decodeURIComponent(bsMatch[1]);
        if (method === 'PATCH') {
          const raw = await readJsonBody(req);
          const parsed = bestsellerPatchSchema.parse(raw);
          const bestseller = await updateBestseller(bsId, parsed);
          await writeAuditLog(admin.username, 'bestseller_updated', bsId);
          sendJson(req, res, 200, { bestseller }, { noStore: true });
          return;
        }
        if (method === 'DELETE') {
          await deleteBestseller(bsId);
          await writeAuditLog(admin.username, 'bestseller_deleted', bsId);
          sendJson(req, res, 200, { ok: true }, { noStore: true });
          return;
        }
      }

      // Promos CRUD
      if (method === 'POST' && pathname === '/api/admin/promos') {
        const raw = await readJsonBody(req);
        const parsed = promoInputSchema.parse(raw);
        const promo = await createPromo(parsed);
        await writeAuditLog(admin.username, 'promo_created', promo.id, { code: promo.code });
        sendJson(req, res, 201, { promo }, { noStore: true });
        return;
      }

      const promoMatch = pathname.match(/^\/api\/admin\/promos\/([^/]+)$/);
      if (promoMatch) {
        const promoId = decodeURIComponent(promoMatch[1]);
        if (method === 'PATCH') {
          const raw = await readJsonBody(req);
          const parsed = promoPatchSchema.parse(raw);
          const promo = await updatePromo(promoId, parsed);
          await writeAuditLog(admin.username, 'promo_updated', promoId);
          sendJson(req, res, 200, { promo }, { noStore: true });
          return;
        }
        if (method === 'DELETE') {
          await deletePromo(promoId);
          await writeAuditLog(admin.username, 'promo_deleted', promoId);
          sendJson(req, res, 200, { ok: true }, { noStore: true });
          return;
        }
      }

      // Settings
      if (method === 'PATCH' && pathname === '/api/admin/settings') {
        const raw = await readJsonBody(req);
        const parsed = settingsPatchSchema.parse(raw);
        const settings = await updateStoreSettings(parsed);
        await writeAuditLog(admin.username, 'settings_updated');
        sendJson(req, res, 200, { settings }, { noStore: true });
        return;
      }

      // Authenticated image upload (base64 + magic bytes check)
      if (method === 'POST' && pathname === '/api/admin/uploads') {
        const raw = await readJsonBody(req, UPLOAD_JSON_LIMIT);
        const parsed = mediaUploadSchema.parse(raw);
        const base64Clean = parsed.dataBase64.replace(/^data:[^;]+;base64,/, '').trim();
        const buf = Buffer.from(base64Clean, 'base64');

        if (buf.length === 0 || buf.length > MAX_UPLOAD_RAW_BYTES) {
          sendJson(
            req,
            res,
            400,
            { error: 'Изображение не должно превышать 3 МБ', code: 'IMAGE_TOO_LARGE' },
            { noStore: true },
          );
          return;
        }

        const detectedMime = verifyImageMagicBytes(buf);
        if (!detectedMime) {
          sendJson(
            req,
            res,
            400,
            {
              error: 'Неподдерживаемый или повреждённый формат изображения (разрешены PNG, JPEG, WebP)',
              code: 'INVALID_IMAGE_FORMAT',
            },
            { noStore: true },
          );
          return;
        }

        const saved = await saveMedia(detectedMime, buf);
        await writeAuditLog(admin.username, 'media_uploaded', saved.id, {
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
        });
        sendJson(req, res, 201, saved, { noStore: true });
        return;
      }

      // Demo Reset
      if (method === 'POST' && pathname === '/api/admin/reset-demo') {
        const payload = await resetDemoDatabase();
        await writeAuditLog(admin.username, 'demo_data_reset');
        sendJson(req, res, 200, payload, { noStore: true });
        return;
      }
    }

    sendJson(
      req,
      res,
      404,
      { error: 'API маршрут не найден', code: 'NOT_FOUND' },
      { noStore: true },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      sendJson(
        req,
        res,
        400,
        { error: formatZodError(err), code: 'VALIDATION_ERROR' },
        { noStore: true },
      );
      return;
    }
    if (err instanceof PayloadError) {
      sendJson(
        req,
        res,
        err.status,
        { error: err.message, code: 'BAD_REQUEST' },
        { noStore: true },
      );
      return;
    }
    if (err instanceof StoreServiceError) {
      sendJson(
        req,
        res,
        err.status,
        { error: err.message, code: err.code },
        { noStore: true },
      );
      return;
    }

    console.error('[API ERROR]', err);
    sendJson(
      req,
      res,
      500,
      { error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' },
      { noStore: true },
    );
  }
}
