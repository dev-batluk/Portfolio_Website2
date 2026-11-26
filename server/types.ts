export type OrderStatus = 'new' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';
export type PaymentStatus = 'demo' | 'pending' | 'paid' | 'refunded';
export type DeliveryMethod = 'courier_msk' | 'cdek_rf' | 'showroom';

export interface CatalogCategory {
  id: string;
  label: string;
  sortOrder: number;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  category: string;
  categoryLabel: string;
  title: string;
  price: number;
  priceFormatted: string;
  description: string;
  material: string;
  fit: string;
  sizes: string[];
  image: string;
  gallery?: string[];
  stock: Record<string, number>;
  hidden: boolean;
}

export interface BestsellerProduct {
  id: string;
  tag: string;
  sku: string;
  categoryLabel: string;
  title: string;
  price: number;
  priceFormatted: string;
  description: string;
  material: string;
  fit: string;
  sizes: string[];
  image: string;
  modelImage: string;
  gallery?: string[];
  stock: Record<string, number>;
  hidden: boolean;
}

export interface OrderItemSnapshot {
  productId: string;
  sku: string;
  title: string;
  categoryLabel: string;
  image: string;
  hasModel: boolean;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  completedAt: string | null;
  consentAcceptedAt: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    telegram?: string;
  };
  delivery: {
    method: DeliveryMethod;
    label: string;
    addressSummary: string;
    comment?: string;
    trackingNumber?: string;
  };
  items: OrderItemSnapshot[];
  subtotal: number;
  promoCode: string | null;
  discountAmount: number;
  deliveryCost: number;
  grandTotal: number;
  managerNote?: string;
  cancelReason?: string;
  stockDeducted: boolean;
  history: OrderHistoryEntry[];
}

export interface PromoCodeRule {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount?: number;
  active: boolean;
  usageCount: number;
}

export interface PublicPromoHint {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount?: number;
}

export interface StoreSettings {
  freeDeliveryThreshold: number;
  courierMskPrice: number;
  cdekRfPrice: number;
  showroomCity: string;
  showroomAddress: string;
  showroomHoursTitle: string;
  showroomHoursSubtitle: string;
  tickerItems: string[];
}

export interface DbRetentionStats {
  totalOrders: number;
  completedOrders: number;
  retentionDays: number;
  lastPurgedCount: number;
  lastPurgedAt: string | null;
}

export interface StorefrontPayload {
  categories: CatalogCategory[];
  catalogItems: CatalogProduct[];
  bestsellers: BestsellerProduct[];
  settings: StoreSettings;
  publicPromoHint: PublicPromoHint | null;
}

export interface AdminBootstrapPayload {
  categories: CatalogCategory[];
  catalogItems: CatalogProduct[];
  bestsellers: BestsellerProduct[];
  orders: AdminOrder[];
  promos: PromoCodeRule[];
  settings: StoreSettings;
  dbStats: DbRetentionStats;
}
