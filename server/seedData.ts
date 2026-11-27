import { BESTSELLERS, CATALOG_ITEMS } from '../src/data/products.js';
import type {
  AdminOrder,
  BestsellerProduct,
  CatalogCategory,
  CatalogProduct,
  DeliveryMethod,
  OrderHistoryEntry,
  OrderItemSnapshot,
  OrderStatus,
  PaymentStatus,
  PromoCodeRule,
  StoreSettings,
} from './types.js';

const rubFormatter = new Intl.NumberFormat('ru-RU');

export function formatRub(amount: number): string {
  return `${rubFormatter.format(Math.round(amount))} ₽`;
}

export const DEFAULT_TICKER_ITEMS: string[] = [
  '480 GSM HEAVY FLEECE',
  'LIMITED DROPS',
  'MOSCOW ARCHIVE',
  'ARCHITECTURAL MONOCHROME',
  'UNISEX FIT',
  'DROP 2026',
];

export const SEED_CATEGORIES: CatalogCategory[] = [
  { id: 'hoodies', label: 'Худи', sortOrder: 0 },
  { id: 'sweatshirts', label: 'Свитшоты', sortOrder: 1 },
  { id: 'longsleeves', label: 'Лонгсливы', sortOrder: 2 },
  { id: 'pants', label: 'Штаны', sortOrder: 3 },
  { id: 'jeans', label: 'Джинсы', sortOrder: 4 },
];

function buildDeterministicStock(sizes: string[], seedIndex: number): Record<string, number> {
  const stock: Record<string, number> = {};
  sizes.forEach((size, sIdx) => {
    stock[size] = ((seedIndex * 3 + sIdx * 2) % 6) + 2;
  });
  return stock;
}

export function createSeedCatalog(): CatalogProduct[] {
  return CATALOG_ITEMS.map((item, idx) => ({
    id: item.id,
    sku: item.sku,
    category: item.category,
    categoryLabel: item.categoryLabel,
    title: item.title,
    price: item.price,
    priceFormatted: formatRub(item.price),
    description: item.description,
    material: item.material,
    fit: item.fit,
    sizes: [...item.sizes],
    image: item.image,
    gallery: item.gallery ? [...item.gallery] : [],
    stock: item.stock ? { ...item.stock } : buildDeterministicStock(item.sizes, idx + 1),
    hidden: false,
  }));
}

export function createSeedBestsellers(): BestsellerProduct[] {
  return BESTSELLERS.map((item, idx) => ({
    id: item.id,
    tag: item.tag,
    sku: item.sku,
    categoryLabel: item.categoryLabel,
    title: item.title,
    price: item.price,
    priceFormatted: formatRub(item.price),
    description: item.description,
    material: item.material,
    fit: item.fit,
    sizes: [...item.sizes],
    image: item.image,
    modelImage: item.modelImage,
    gallery: item.gallery ? [...item.gallery] : [],
    stock: item.stock ? { ...item.stock } : buildDeterministicStock(item.sizes, idx + 21),
    hidden: false,
  }));
}

export function createSeedPromos(): PromoCodeRule[] {
  return [
    {
      id: 'promo-nevermind10',
      code: 'NEVERMIND10',
      type: 'percent',
      value: 10,
      active: true,
      usageCount: 4,
    },
    {
      id: 'promo-archive2000',
      code: 'ARCHIVE2000',
      type: 'fixed',
      value: 2000,
      minOrderAmount: 20000,
      active: true,
      usageCount: 1,
    },
  ];
}

export function createSeedSettings(): StoreSettings {
  return {
    freeDeliveryThreshold: 25000,
    courierMskPrice: 690,
    cdekRfPrice: 490,
    showroomCity: 'Москва · Центр',
    showroomAddress: 'Столешников переулок, приватная запись',
    showroomHoursTitle: 'Пн — Вс',
    showroomHoursSubtitle: '12:00 — 21:00 по предварительному запросу',
    tickerItems: [...DEFAULT_TICKER_ITEMS],
  };
}

function isoHoursAgo(daysAgo: number, hourOfDay: number, minute = 15): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(daysAgo));
  date.setHours(hourOfDay, minute, 0, 0);
  return date.toISOString();
}

export function createSeedOrders(): AdminOrder[] {
  const allProducts = [...createSeedBestsellers(), ...createSeedCatalog()];
  const byId = new Map(allProducts.map((p) => [p.id, p]));
  const pick = (id: string) => byId.get(id) ?? allProducts[0];

  const makeOrderItem = (id: string, size: string, quantity: number): OrderItemSnapshot => {
    const product = pick(id);
    return {
      productId: product.id,
      sku: product.sku,
      title: product.title,
      categoryLabel: product.categoryLabel,
      image: product.image,
      hasModel: 'modelImage' in product && Boolean(product.modelImage),
      size,
      quantity,
      unitPrice: product.price,
    };
  };

  const specs: Array<{
    orderNumber: string;
    daysAgo: number;
    hour: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    customer: AdminOrder['customer'];
    method: DeliveryMethod;
    addressSummary: string;
    trackingNumber?: string;
    comment?: string;
    promoCode: string | null;
    items: OrderItemSnapshot[];
    managerNote?: string;
    cancelReason?: string;
  }> = [
    {
      orderNumber: 'NVM-2026-9412',
      daysAgo: 0,
      hour: 16,
      status: 'new',
      paymentStatus: 'demo',
      customer: {
        fullName: 'Артём Соколов',
        phone: '+7 (916) 482-19-30',
        email: 'artem.sokolov@mail.ru',
        telegram: '@artem_skl',
      },
      method: 'courier_msk',
      addressSummary: 'ул. Малая Бронная, д. 24, кв. 11',
      comment: 'Позвонить за 30 минут',
      promoCode: 'NEVERMIND10',
      items: [makeOrderItem('bs-01', 'L', 1), makeOrderItem('hd-01', 'M', 1)],
      managerNote: 'Ожидает звонка для подтверждения интервала доставки',
    },
    {
      orderNumber: 'NVM-2026-9388',
      daysAgo: 0,
      hour: 12,
      status: 'new',
      paymentStatus: 'pending',
      customer: {
        fullName: 'Ксения Морозова',
        phone: '+7 (925) 740-55-12',
        email: 'k.morozova@gmail.com',
        telegram: '@ksenia_mrz',
      },
      method: 'showroom',
      addressSummary: 'Москва · Столешников переулок (Пн—Вс, 12:00—21:00)',
      promoCode: null,
      items: [makeOrderItem('bs-02', 'S', 1), makeOrderItem('pt-03', 'S', 1)],
    },
    {
      orderNumber: 'NVM-2026-9314',
      daysAgo: 1,
      hour: 19,
      status: 'confirmed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Денис Литвинов',
        phone: '+7 (903) 614-88-21',
        email: 'litvinov.d@yandex.ru',
      },
      method: 'cdek_rf',
      addressSummary: 'Санкт-Петербург, ПВЗ СДЭК: Невский пр., 90',
      promoCode: null,
      items: [makeOrderItem('jn-02', 'L', 1), makeOrderItem('ls-02', 'L', 1)],
      managerNote: 'Упакован в архивный короб, передаётся курьеру СДЭК',
    },
    {
      orderNumber: 'NVM-2026-9240',
      daysAgo: 2,
      hour: 15,
      status: 'shipping',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Егор Власов',
        phone: '+7 (985) 301-44-09',
        email: 'egor.vlasov@icloud.com',
        telegram: '@vlasov_archive',
      },
      method: 'cdek_rf',
      addressSummary: 'Екатеринбург, ПВЗ СДЭК: ул. Ленина, 41',
      trackingNumber: '1548291044',
      promoCode: 'NEVERMIND10',
      items: [makeOrderItem('bs-03', 'M', 1)],
    },
    {
      orderNumber: 'NVM-2026-9185',
      daysAgo: 4,
      hour: 14,
      status: 'shipping',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Мария Громова',
        phone: '+7 (917) 802-37-64',
        email: 'm.gromova@bk.ru',
      },
      method: 'courier_msk',
      addressSummary: 'Кутузовский пр., д. 12, корп. 2, кв. 88',
      promoCode: null,
      items: [makeOrderItem('sw-03', 'M', 1), makeOrderItem('pt-01', 'M', 1)],
    },
    {
      orderNumber: 'NVM-2026-9102',
      daysAgo: 5,
      hour: 18,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Никита Чернов',
        phone: '+7 (909) 118-92-45',
        email: 'chernov.nik@gmail.com',
        telegram: '@n_chernov',
      },
      method: 'showroom',
      addressSummary: 'Москва · Столешников переулок (Пн—Вс, 12:00—21:00)',
      promoCode: null,
      items: [makeOrderItem('bs-01', 'XL', 1), makeOrderItem('jn-01', 'L', 1)],
    },
    {
      orderNumber: 'NVM-2026-9047',
      daysAgo: 7,
      hour: 13,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Алина Белова',
        phone: '+7 (926) 553-10-77',
        email: 'alina.belova@inbox.ru',
      },
      method: 'courier_msk',
      addressSummary: 'ул. Покровка, д. 18, кв. 42',
      promoCode: 'NEVERMIND10',
      items: [makeOrderItem('hd-02', 'S', 1), makeOrderItem('ls-01', 'S', 1)],
    },
    {
      orderNumber: 'NVM-2026-8973',
      daysAgo: 10,
      hour: 17,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Роман Ковалёв',
        phone: '+7 (962) 440-71-88',
        email: 'kovalev.r@yandex.ru',
        telegram: '@r_kovalev',
      },
      method: 'cdek_rf',
      addressSummary: 'Казань, ПВЗ СДЭК: ул. Баумана, 58',
      trackingNumber: '1547109238',
      promoCode: null,
      items: [makeOrderItem('bs-04', 'L', 1), makeOrderItem('pt-02', 'L', 1)],
    },
    {
      orderNumber: 'NVM-2026-8891',
      daysAgo: 12,
      hour: 11,
      status: 'cancelled',
      paymentStatus: 'refunded',
      customer: {
        fullName: 'Тимур Захаров',
        phone: '+7 (905) 334-02-19',
        email: 'timur.z@mail.ru',
      },
      method: 'cdek_rf',
      addressSummary: 'Краснодар, ПВЗ СДЭК: ул. Красная, 124',
      promoCode: null,
      items: [makeOrderItem('hd-03', 'M', 1)],
      cancelReason: 'Покупатель передумал до отправки и запросил другой размер',
    },
    {
      orderNumber: 'NVM-2026-8810',
      daysAgo: 14,
      hour: 20,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Владислав Орлов',
        phone: '+7 (915) 779-64-10',
        email: 'orlov.vlad@gmail.com',
        telegram: '@orlov_v',
      },
      method: 'courier_msk',
      addressSummary: 'Ленинградский пр., д. 36, стр. 11',
      promoCode: 'ARCHIVE2000',
      items: [makeOrderItem('sw-01', 'L', 1), makeOrderItem('jn-03', 'L', 1)],
    },
    {
      orderNumber: 'NVM-2026-8744',
      daysAgo: 17,
      hour: 16,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'София Тихонова',
        phone: '+7 (929) 602-83-51',
        email: 'sofia.tihonova@icloud.com',
      },
      method: 'showroom',
      addressSummary: 'Москва · Столешников переулок (Пн—Вс, 12:00—21:00)',
      promoCode: null,
      items: [makeOrderItem('bs-03', 'S', 1)],
    },
    {
      orderNumber: 'NVM-2026-8652',
      daysAgo: 21,
      hour: 14,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Павел Демидов',
        phone: '+7 (910) 295-14-33',
        email: 'pavel.demidov@yandex.ru',
      },
      method: 'cdek_rf',
      addressSummary: 'Нижний Новгород, ПВЗ СДЭК: ул. Большая Покровская, 32',
      trackingNumber: '1545998120',
      promoCode: null,
      items: [makeOrderItem('hd-04', 'XL', 1), makeOrderItem('sw-02', 'L', 1)],
    },
    {
      orderNumber: 'NVM-2026-8590',
      daysAgo: 25,
      hour: 18,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Максим Кузнецов',
        phone: '+7 (903) 841-59-04',
        email: 'kuznetsov.m@gmail.com',
        telegram: '@mk_street',
      },
      method: 'courier_msk',
      addressSummary: 'Пресненская наб., д. 8, стр. 1',
      promoCode: 'NEVERMIND10',
      items: [makeOrderItem('jn-04', 'M', 1), makeOrderItem('ls-04', 'M', 1)],
    },
    {
      orderNumber: 'NVM-2026-8511',
      daysAgo: 28,
      hour: 13,
      status: 'completed',
      paymentStatus: 'paid',
      customer: {
        fullName: 'Дарья Смирнова',
        phone: '+7 (916) 912-40-66',
        email: 'daria.smirnova@mail.ru',
      },
      method: 'cdek_rf',
      addressSummary: 'Новосибирск, ПВЗ СДЭК: Красный пр., 65',
      trackingNumber: '1544201887',
      promoCode: null,
      items: [makeOrderItem('sw-04', 'S', 1), makeOrderItem('pt-04', 'S', 1)],
    },
  ];

  const deliveryLabels: Record<DeliveryMethod, string> = {
    courier_msk: 'Курьер по Москве',
    cdek_rf: 'СДЭК · Пункт выдачи по РФ',
    showroom: 'Самовывоз из шоурума',
  };

  return specs.map((spec, idx) => {
    const subtotal = spec.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountAmount =
      spec.promoCode === 'NEVERMIND10'
        ? Math.round(subtotal * 0.1)
        : spec.promoCode === 'ARCHIVE2000' && subtotal >= 20000
          ? 2000
          : 0;
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const deliveryCost =
      spec.method === 'showroom' || afterDiscount >= 25000
        ? 0
        : spec.method === 'courier_msk'
          ? 690
          : 490;
    const grandTotal = afterDiscount + deliveryCost;
    const createdAt = isoHoursAgo(spec.daysAgo, spec.hour, (idx * 11) % 55);

    const history: OrderHistoryEntry[] = [
      { status: 'new', timestamp: createdAt, note: 'Заказ создан на витрине' },
    ];
    if (spec.status === 'confirmed' || spec.status === 'shipping' || spec.status === 'completed') {
      history.push({
        status: 'confirmed',
        timestamp: isoHoursAgo(Math.max(0, spec.daysAgo - 1), Math.min(22, spec.hour + 1), 10),
        note: 'Подтверждён менеджером',
      });
    }
    if (spec.status === 'shipping' || spec.status === 'completed') {
      history.push({
        status: 'shipping',
        timestamp: isoHoursAgo(Math.max(0, spec.daysAgo - 1), 11, 30),
        note: spec.trackingNumber ? `Передан в доставку · трек ${spec.trackingNumber}` : 'Передан в доставку',
      });
    }

    let completedAt: string | null = null;
    if (spec.status === 'completed') {
      completedAt = isoHoursAgo(Math.max(0, spec.daysAgo - 1), 17, 45);
      history.push({
        status: 'completed',
        timestamp: completedAt,
        note: 'Доставлен и получен клиентом',
      });
    }
    if (spec.status === 'cancelled') {
      history.push({
        status: 'cancelled',
        timestamp: isoHoursAgo(Math.max(0, spec.daysAgo - 1), 15, 20),
        note: spec.cancelReason ?? 'Отменён',
      });
    }

    return {
      id: `ord-seed-${idx + 1}`,
      orderNumber: spec.orderNumber,
      createdAt,
      completedAt,
      consentAcceptedAt: createdAt,
      status: spec.status,
      paymentStatus: spec.paymentStatus,
      customer: spec.customer,
      delivery: {
        method: spec.method,
        label: deliveryLabels[spec.method],
        addressSummary: spec.addressSummary,
        comment: spec.comment,
        trackingNumber: spec.trackingNumber,
      },
      items: spec.items,
      subtotal,
      promoCode: spec.promoCode,
      discountAmount,
      deliveryCost,
      grandTotal,
      managerNote: spec.managerNote,
      cancelReason: spec.cancelReason,
      stockDeducted: spec.status !== 'cancelled',
      history,
    };
  });
}
