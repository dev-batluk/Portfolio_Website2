import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { BaseProduct } from '../data/products';
import {
  formatRub,
  type DeliveryMethod,
  type PublicPromoHint,
} from '../data/adminSeed';
import { useStoreData } from './StoreDataContext';

export { formatRub, type DeliveryMethod };

export interface DeliveryOptionMeta {
  id: DeliveryMethod;
  label: string;
  eta: string;
  basePrice: number;
  description: string;
}

const STORAGE_KEY = 'nevermind_cart_v1';
const MAX_ITEM_QTY = 99;

export interface CartLineItem {
  lineKey: string;
  product: BaseProduct;
  size: string;
  quantity: number;
}

export interface PromoResult {
  ok: boolean;
  message: string;
}

export interface AddItemResult {
  ok: boolean;
  reason?: 'out_of_stock' | 'max_stock';
  maxStock?: number;
}

interface PersistedCartItem {
  productId: string;
  size: string;
  quantity: number;
}

interface PersistedCartPayload {
  items: PersistedCartItem[];
  promoCode: string | null;
}

function makeLineKey(productId: string, size: string): string {
  return `${productId}__${size}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function readPersistedCartRaw(): PersistedCartPayload {
  if (typeof window === 'undefined') {
    return { items: [], promoCode: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], promoCode: null };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { items: [], promoCode: null };
    }
    const record = parsed as Partial<PersistedCartPayload>;
    const items = Array.isArray(record.items) ? record.items : [];
    const promoCode =
      typeof record.promoCode === 'string' && record.promoCode.trim()
        ? record.promoCode.trim().toUpperCase()
        : null;
    return { items, promoCode };
  } catch {
    return { items: [], promoCode: null };
  }
}

interface CartContextValue {
  items: CartLineItem[];
  totalItems: number;
  subtotal: number;
  promoCode: string | null;
  activePromo: PublicPromoHint | null;
  suggestedPromo: PublicPromoHint | null;
  discountAmount: number;
  discountedSubtotal: number;
  freeDeliveryThreshold: number;
  freeDeliveryRemaining: number;
  freeDeliveryProgress: number;
  deliveryOptions: Record<DeliveryMethod, DeliveryOptionMeta>;
  getDeliveryCost: (method: DeliveryMethod) => number;
  lastAdded: { lineKey: string; seq: number } | null;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  isOverlayHandoff: boolean;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
  returnToCartFromCheckout: () => void;
  addItem: (
    product: BaseProduct,
    size: string,
    options?: { openDrawer?: boolean },
  ) => AddItemResult;
  updateQuantity: (lineKey: string, delta: number) => void;
  removeItem: (lineKey: string) => void;
  clearCart: () => void;
  applyPromo: (rawCode: string) => Promise<PromoResult>;
  removePromo: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const {
    storefrontLoaded,
    bestsellers,
    catalogItems,
    publicPromoHint,
    settings,
    getProductById,
    getAvailableStock,
    validatePromo,
  } = useStoreData();

  const [items, setItems] = useState<CartLineItem[]>(() => {
    const raw = readPersistedCartRaw();
    const seenKeys = new Set<string>();
    const hydrated: CartLineItem[] = [];

    for (const entry of raw.items) {
      if (!entry || typeof entry !== 'object') continue;
      const { productId, size, quantity } = entry;
      if (typeof productId !== 'string' || typeof size !== 'string') continue;
      const product = getProductById(productId);
      if (!product || product.hidden || !product.sizes.includes(size)) continue;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity)) continue;

      const available = getAvailableStock(product.id, size);
      if (available <= 0) continue;

      const safeQty = Math.min(available, Math.min(MAX_ITEM_QTY, Math.floor(quantity)));
      if (safeQty < 1) continue;

      const lineKey = makeLineKey(product.id, size);
      if (seenKeys.has(lineKey)) continue;
      seenKeys.add(lineKey);

      hydrated.push({
        lineKey,
        product,
        size,
        quantity: safeQty,
      });
    }

    return hydrated;
  });

  const [promoCode, setPromoCode] = useState<string | null>(() => {
    return readPersistedCartRaw().promoCode;
  });
  const [activePromo, setActivePromo] = useState<PublicPromoHint | null>(null);

  const [lastAdded, setLastAdded] = useState<{ lineKey: string; seq: number } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOverlayHandoff, setIsOverlayHandoff] = useState(false);

  const handoffTimerRef = useRef<number | null>(null);
  const reconciledAfterFetchRef = useRef(false);

  const clearHandoffTimer = useCallback(() => {
    if (handoffTimerRef.current !== null) {
      window.clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
    setIsOverlayHandoff(false);
  }, []);

  useEffect(() => {
    return () => {
      if (handoffTimerRef.current !== null) {
        window.clearTimeout(handoffTimerRef.current);
      }
    };
  }, []);

  // Re-hydrate persisted cart against authoritative server data once storefront loads,
  // and keep lines synced on subsequent storefront refreshes
  useEffect(() => {
    if (!storefrontLoaded) return;

    if (!reconciledAfterFetchRef.current) {
      reconciledAfterFetchRef.current = true;
      const raw = readPersistedCartRaw();
      if (raw.items.length > 0) {
        const seenKeys = new Set<string>();
        const synced: CartLineItem[] = [];
        for (const entry of raw.items) {
          if (!entry || typeof entry !== 'object') continue;
          const product = getProductById(entry.productId);
          if (!product || product.hidden || !product.sizes.includes(entry.size)) continue;
          const available = getAvailableStock(product.id, entry.size);
          if (available <= 0) continue;
          const safeQty = Math.min(available, Math.min(MAX_ITEM_QTY, Math.max(1, Math.floor(entry.quantity))));
          const lineKey = makeLineKey(product.id, entry.size);
          if (seenKeys.has(lineKey)) continue;
          seenKeys.add(lineKey);
          synced.push({ lineKey, product, size: entry.size, quantity: safeQty });
        }
        setItems(synced);
        return;
      }
    }

    setItems((prev) => {
      let changed = false;
      const next: CartLineItem[] = [];

      for (const entry of prev) {
        const liveProduct = getProductById(entry.product.id);
        if (!liveProduct || liveProduct.hidden || !liveProduct.sizes.includes(entry.size)) {
          changed = true;
          continue;
        }
        const available = getAvailableStock(liveProduct.id, entry.size);
        if (available <= 0) {
          changed = true;
          continue;
        }
        const clampedQty = Math.min(entry.quantity, available, MAX_ITEM_QTY);
        if (clampedQty !== entry.quantity || liveProduct !== entry.product) {
          changed = true;
        }
        next.push({
          ...entry,
          product: liveProduct,
          quantity: clampedQty,
        });
      }

      return changed ? next : prev;
    });
  }, [storefrontLoaded, bestsellers, catalogItems, getProductById, getAvailableStock]);

  useEffect(() => {
    if (typeof window === 'undefined' || !storefrontLoaded) return;
    try {
      const payload: PersistedCartPayload = {
        items: items.map((item) => ({
          productId: item.product.id,
          size: item.size,
          quantity: item.quantity,
        })),
        promoCode,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [items, promoCode, storefrontLoaded]);

  // Sync cart state across open tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const raw = readPersistedCartRaw();
      const hydrated: CartLineItem[] = [];
      for (const entry of raw.items) {
        if (!entry || typeof entry !== 'object') continue;
        const product = getProductById(entry.productId);
        if (!product || product.hidden || !product.sizes.includes(entry.size)) continue;
        const available = getAvailableStock(product.id, entry.size);
        if (available <= 0) continue;
        hydrated.push({
          lineKey: makeLineKey(product.id, entry.size),
          product,
          size: entry.size,
          quantity: Math.min(available, Math.max(1, Math.floor(entry.quantity))),
        });
      }
      setItems(hydrated);
      setPromoCode(raw.promoCode);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [getProductById, getAvailableStock]);

  const deliveryOptions = useMemo<Record<DeliveryMethod, DeliveryOptionMeta>>(
    () => ({
      courier_msk: {
        id: 'courier_msk',
        label: 'Курьер по Москве',
        eta: '1–2 дня',
        basePrice: settings.courierMskPrice,
        description: 'Доставка до двери в удобный интервал',
      },
      cdek_rf: {
        id: 'cdek_rf',
        label: 'СДЭК · Пункт выдачи по РФ',
        eta: '2–5 дней',
        basePrice: settings.cdekRfPrice,
        description: 'Доставка до ближайшего пункта выдачи СДЭК',
      },
      showroom: {
        id: 'showroom',
        label: 'Самовывоз из шоурума',
        eta: `${settings.showroomHoursTitle}, ${settings.showroomHoursSubtitle.split(' ')[0] ?? '12:00—21:00'}`,
        basePrice: 0,
        description: `${settings.showroomCity} · ${settings.showroomAddress}`,
      },
    }),
    [settings],
  );

  const freeDeliveryThreshold = settings.freeDeliveryThreshold;

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );

  // Server-validate persisted or updated promo when storefront loads or subtotal changes
  useEffect(() => {
    if (!storefrontLoaded) return;
    if (!promoCode) {
      setActivePromo(null);
      return;
    }

    let cancelled = false;
    void validatePromo(promoCode, subtotal)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.promo) {
          setActivePromo(res.promo);
        } else {
          setActivePromo(null);
          if (subtotal > 0) {
            setPromoCode(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setActivePromo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [storefrontLoaded, promoCode, subtotal, validatePromo]);

  const suggestedPromo = publicPromoHint;

  const discountAmount = useMemo(() => {
    if (!activePromo || subtotal <= 0) return 0;
    if (activePromo.minOrderAmount && subtotal < activePromo.minOrderAmount) {
      return 0;
    }
    if (activePromo.type === 'percent') {
      return Math.min(subtotal, Math.round((subtotal * activePromo.value) / 100));
    }
    return Math.min(subtotal, activePromo.value);
  }, [activePromo, subtotal]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const freeDeliveryRemaining = Math.max(0, freeDeliveryThreshold - discountedSubtotal);
  const freeDeliveryProgress =
    freeDeliveryThreshold <= 0
      ? 1
      : discountedSubtotal <= 0
        ? 0
        : Math.min(1, discountedSubtotal / freeDeliveryThreshold);

  const getDeliveryCost = useCallback(
    (method: DeliveryMethod): number => {
      if (method === 'showroom') return 0;
      if (items.length > 0 && discountedSubtotal >= freeDeliveryThreshold) return 0;
      return deliveryOptions[method].basePrice;
    },
    [items.length, discountedSubtotal, freeDeliveryThreshold, deliveryOptions],
  );

  const openCart = useCallback(() => {
    clearHandoffTimer();
    setIsCheckoutOpen(false);
    setIsCartOpen(true);
  }, [clearHandoffTimer]);

  const closeCart = useCallback(() => {
    clearHandoffTimer();
    setIsCartOpen(false);
  }, [clearHandoffTimer]);

  const openCheckout = useCallback(() => {
    if (items.length === 0) return;
    clearHandoffTimer();

    if (isCartOpen && !prefersReducedMotion()) {
      setIsCartOpen(false);
      setIsOverlayHandoff(true);
      handoffTimerRef.current = window.setTimeout(() => {
        handoffTimerRef.current = null;
        setIsOverlayHandoff(false);
        setIsCheckoutOpen(true);
      }, 110);
      return;
    }

    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, [items.length, isCartOpen, clearHandoffTimer]);

  const closeCheckout = useCallback(() => {
    clearHandoffTimer();
    setIsCheckoutOpen(false);
  }, [clearHandoffTimer]);

  const returnToCartFromCheckout = useCallback(() => {
    clearHandoffTimer();

    if (isCheckoutOpen && !prefersReducedMotion()) {
      setIsCheckoutOpen(false);
      setIsOverlayHandoff(true);
      handoffTimerRef.current = window.setTimeout(() => {
        handoffTimerRef.current = null;
        setIsOverlayHandoff(false);
        setIsCartOpen(true);
      }, 110);
      return;
    }

    setIsCheckoutOpen(false);
    setIsCartOpen(true);
  }, [isCheckoutOpen, clearHandoffTimer]);

  const addItem = useCallback(
    (
      product: BaseProduct,
      size: string,
      options?: { openDrawer?: boolean },
    ): AddItemResult => {
      const targetSize = product.sizes.includes(size)
        ? size
        : (product.sizes[1] ?? product.sizes[0] ?? 'M');
      const available = getAvailableStock(product.id, targetSize);

      if (available <= 0) {
        return { ok: false, reason: 'out_of_stock', maxStock: 0 };
      }

      const lineKey = makeLineKey(product.id, targetSize);
      const existing = items.find((entry) => entry.lineKey === lineKey);
      if (existing && existing.quantity >= available) {
        return { ok: false, reason: 'max_stock', maxStock: available };
      }

      setItems((prev) => {
        const existingIdx = prev.findIndex((entry) => entry.lineKey === lineKey);
        if (existingIdx >= 0) {
          return prev.map((entry, idx) =>
            idx === existingIdx
              ? {
                  ...entry,
                  product,
                  quantity: Math.min(available, MAX_ITEM_QTY, entry.quantity + 1),
                }
              : entry,
          );
        }
        return [
          ...prev,
          {
            lineKey,
            product,
            size: targetSize,
            quantity: 1,
          },
        ];
      });

      setLastAdded((prev) => ({ lineKey, seq: (prev?.seq ?? 0) + 1 }));

      if (options?.openDrawer !== false) {
        clearHandoffTimer();
        setIsCheckoutOpen(false);
        setIsCartOpen(true);
      }

      return { ok: true };
    },
    [items, getAvailableStock, clearHandoffTimer],
  );

  const updateQuantity = useCallback(
    (lineKey: string, delta: number) => {
      setItems((prev) =>
        prev.flatMap((entry) => {
          if (entry.lineKey !== lineKey) return [entry];
          const available = getAvailableStock(entry.product.id, entry.size);
          const cap = Math.max(1, Math.min(MAX_ITEM_QTY, available));
          const nextQty = Math.min(cap, entry.quantity + delta);
          if (nextQty <= 0) return [];
          return [{ ...entry, quantity: nextQty }];
        }),
      );
    },
    [getAvailableStock],
  );

  const removeItem = useCallback((lineKey: string) => {
    setItems((prev) => prev.filter((entry) => entry.lineKey !== lineKey));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setPromoCode(null);
    setActivePromo(null);
    setLastAdded(null);
  }, []);

  const applyPromo = useCallback(
    async (rawCode: string): Promise<PromoResult> => {
      const normalized = rawCode.trim().toUpperCase();
      if (!normalized) {
        return { ok: false, message: 'Введите промокод' };
      }
      try {
        const res = await validatePromo(normalized, subtotal);
        if (res.ok && res.promo) {
          setPromoCode(res.promo.code);
          setActivePromo(res.promo);
          return { ok: true, message: res.message };
        }
        return { ok: false, message: res.message };
      } catch (err) {
        return {
          ok: false,
          message:
            err instanceof Error ? err.message : 'Не удалось проверить промокод',
        };
      }
    },
    [validatePromo, subtotal],
  );

  const removePromo = useCallback(() => {
    setPromoCode(null);
    setActivePromo(null);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      subtotal,
      promoCode: activePromo ? activePromo.code : null,
      activePromo,
      suggestedPromo,
      discountAmount,
      discountedSubtotal,
      freeDeliveryThreshold,
      freeDeliveryRemaining,
      freeDeliveryProgress,
      deliveryOptions,
      getDeliveryCost,
      lastAdded,
      isCartOpen,
      isCheckoutOpen,
      isOverlayHandoff,
      openCart,
      closeCart,
      openCheckout,
      closeCheckout,
      returnToCartFromCheckout,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyPromo,
      removePromo,
    }),
    [
      items,
      totalItems,
      subtotal,
      activePromo,
      suggestedPromo,
      discountAmount,
      discountedSubtotal,
      freeDeliveryThreshold,
      freeDeliveryRemaining,
      freeDeliveryProgress,
      deliveryOptions,
      getDeliveryCost,
      lastAdded,
      isCartOpen,
      isCheckoutOpen,
      isOverlayHandoff,
      openCart,
      closeCart,
      openCheckout,
      closeCheckout,
      returnToCartFromCheckout,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyPromo,
      removePromo,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
