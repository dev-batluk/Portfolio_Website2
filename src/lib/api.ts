import type {
  BestsellerItem,
  CatalogCategory,
  CatalogItem,
} from '../data/products';
import type {
  AdminOrder,
  DbRetentionStats,
  DeliveryMethod,
  OrderStatus,
  PaymentStatus,
  PromoCodeRule,
  PublicPromoHint,
  StoreSettings,
} from '../data/adminSeed';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function apiFetch<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'fetch',
  };
  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: bodyStr,
    credentials: 'same-origin',
    signal: options.signal,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  if (!res.ok) {
    const message =
      typeof parsed.error === 'string' && parsed.error
        ? parsed.error
        : `Ошибка сервера (${res.status})`;
    const code = typeof parsed.code === 'string' ? parsed.code : 'API_ERROR';
    throw new ApiError(res.status, message, code);
  }

  return parsed as T;
}

export interface StorefrontResponse {
  categories: CatalogCategory[];
  catalogItems: CatalogItem[];
  bestsellers: BestsellerItem[];
  settings: StoreSettings;
  publicPromoHint: PublicPromoHint | null;
}

export interface AdminBootstrapResponse {
  categories: CatalogCategory[];
  catalogItems: CatalogItem[];
  bestsellers: BestsellerItem[];
  orders: AdminOrder[];
  promos: PromoCodeRule[];
  settings: StoreSettings;
  dbStats: DbRetentionStats;
}

export interface CheckoutOrderPayload {
  items: Array<{ productId: string; size: string; quantity: number }>;
  promoCode: string | null;
  deliveryMethod: DeliveryMethod;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    telegram?: string;
  };
  delivery: {
    address?: string;
    city?: string;
    cdekPoint?: string;
    comment?: string;
  };
  consentAccepted: true;
}

export const api = {
  // Public storefront & checkout
  getStorefront: (signal?: AbortSignal) =>
    apiFetch<StorefrontResponse>('/api/storefront', { signal }),

  validatePromo: (code: string, subtotal: number) =>
    apiFetch<{
      ok: boolean;
      message: string;
      promo: PublicPromoHint | null;
      discountAmount: number;
    }>('/api/promos/validate', {
      method: 'POST',
      body: { code, subtotal },
    }),

  createOrder: (payload: CheckoutOrderPayload) =>
    apiFetch<{ order: AdminOrder }>('/api/orders', {
      method: 'POST',
      body: payload,
    }),

  // Admin authentication
  getSession: () =>
    apiFetch<{ authenticated: boolean; username?: string }>('/api/auth/session'),

  login: (username: string, password: string) =>
    apiFetch<{ authenticated: boolean; username: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    }),

  logout: () =>
    apiFetch<{ authenticated: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  // Admin workspace
  getAdminBootstrap: () => apiFetch<AdminBootstrapResponse>('/api/admin/bootstrap'),

  purgeExpiredOrders: () =>
    apiFetch<{
      purgedCount: number;
      lastPurgedAt: string | null;
      orders: AdminOrder[];
      dbStats: DbRetentionStats;
    }>('/api/admin/orders/purge-expired', { method: 'POST', body: {} }),

  updateOrder: (
    orderId: string,
    patch: {
      status?: OrderStatus;
      cancelReason?: string;
      paymentStatus?: PaymentStatus;
      trackingNumber?: string;
      managerNote?: string;
    },
  ) =>
    apiFetch<{ order: AdminOrder; dbStats: DbRetentionStats }>(
      `/api/admin/orders/${encodeURIComponent(orderId)}`,
      { method: 'PATCH', body: patch },
    ),

  // Categories CRUD
  createCategory: (label: string) =>
    apiFetch<{ category: CatalogCategory }>('/api/admin/categories', {
      method: 'POST',
      body: { label },
    }),

  updateCategory: (id: string, label: string) =>
    apiFetch<{ category: CatalogCategory }>(
      `/api/admin/categories/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { label } },
    ),

  reorderCategory: (id: string, direction: 'up' | 'down') =>
    apiFetch<{ categories: CatalogCategory[] }>(
      `/api/admin/categories/${encodeURIComponent(id)}/reorder`,
      { method: 'POST', body: { direction } },
    ),

  deleteCategory: (id: string, reassignTo?: string) =>
    apiFetch<{ ok: boolean }>(`/api/admin/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: reassignTo ? { reassignTo } : {},
    }),

  // Products CRUD
  createProduct: (input: {
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
    gallery?: string[];
    stock: Record<string, number>;
    hidden?: boolean;
  }) =>
    apiFetch<{ product: CatalogItem }>('/api/admin/products', {
      method: 'POST',
      body: input,
    }),

  updateProduct: (id: string, patch: Record<string, unknown>) =>
    apiFetch<{ product: CatalogItem }>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    }),

  deleteProduct: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Bestsellers CRUD
  createBestseller: (input: Record<string, unknown>) =>
    apiFetch<{ bestseller: BestsellerItem }>('/api/admin/bestsellers', {
      method: 'POST',
      body: input,
    }),

  updateBestseller: (id: string, patch: Record<string, unknown>) =>
    apiFetch<{ bestseller: BestsellerItem }>(
      `/api/admin/bestsellers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: patch },
    ),

  deleteBestseller: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/admin/bestsellers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  reorderBestseller: (id: string, direction: 'up' | 'down') =>
    apiFetch<{ bestsellers: BestsellerItem[] }>(
      `/api/admin/bestsellers/${encodeURIComponent(id)}/reorder`,
      { method: 'POST', body: { direction } },
    ),

  promoteToBestseller: (catalogItemId: string, modelImage: string, tag: string) =>
    apiFetch<{ bestseller: BestsellerItem }>('/api/admin/bestsellers/promote', {
      method: 'POST',
      body: { catalogItemId, modelImage, tag },
    }),

  // Promos & Settings
  createPromo: (input: {
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    minOrderAmount?: number;
    active: boolean;
  }) =>
    apiFetch<{ promo: PromoCodeRule }>('/api/admin/promos', {
      method: 'POST',
      body: input,
    }),

  togglePromo: (id: string, active: boolean) =>
    apiFetch<{ promo: PromoCodeRule }>(`/api/admin/promos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { active },
    }),

  deletePromo: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/admin/promos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  updateSettings: (patch: Partial<StoreSettings>) =>
    apiFetch<{ settings: StoreSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: patch,
    }),

  uploadMedia: (dataBase64: string, mimeType: 'image/webp' | 'image/jpeg' | 'image/png') =>
    apiFetch<{ id: string; url: string; mimeType: string; sizeBytes: number }>(
      '/api/admin/uploads',
      {
        method: 'POST',
        body: { dataBase64, mimeType },
      },
    ),

  resetDemo: () =>
    apiFetch<AdminBootstrapResponse>('/api/admin/reset-demo', {
      method: 'POST',
      body: {},
    }),
};
