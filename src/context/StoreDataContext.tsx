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
import {
  BESTSELLERS,
  CATALOG_CATEGORIES,
  CATALOG_ITEMS,
  type BaseProduct,
  type BestsellerItem,
  type CatalogCategory,
  type CatalogItem,
} from '../data/products';
import {
  ALL_SIZES,
  createSeedBestsellers,
  createSeedCatalog,
  createSeedSettings,
  formatRub,
  type AdminOrder,
  type DbRetentionStats,
  type OrderStatus,
  type PaymentStatus,
  type PromoCodeRule,
  type PublicPromoHint,
  type StoreSettings,
} from '../data/adminSeed';
import { ApiError, api, type CheckoutOrderPayload } from '../lib/api';

const SYNC_CHANNEL_NAME = 'nevermind_store_sync_v1';
const MIN_BESTSELLERS = 2;
const MAX_BESTSELLERS = 8;

const INITIAL_SEED_CATEGORIES: CatalogCategory[] = CATALOG_CATEGORIES.filter(
  (c) => c.id !== 'all',
).map((c, idx) => ({
  id: c.id,
  label: c.label,
  sortOrder: idx,
}));

export interface CatalogItemInput {
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
}

export interface BestsellerInput {
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
}

export interface PromoInput {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount?: number;
  active: boolean;
}

export interface AdminAuthState {
  status: 'idle' | 'checking' | 'unauthenticated' | 'authenticated';
  username?: string;
}

function syncSizesWithStock(sizes: string[], stock: Record<string, number>): string[] {
  const keys = Object.keys(stock);
  if (keys.length === 0) return sizes.length > 0 ? sizes : ['M'];
  const ordered = ALL_SIZES.filter((s) => keys.includes(s));
  const extra = keys.filter((k) => !(ALL_SIZES as readonly string[]).includes(k));
  return [...ordered, ...extra];
}

// Keep deterministic initial public catalog reference before first API response
void CATALOG_ITEMS;
void BESTSELLERS;
void formatRub;

interface StoreDataContextValue {
  storefrontLoaded: boolean;
  categories: CatalogCategory[];
  catalogItems: CatalogItem[];
  visibleCatalogItems: CatalogItem[];
  bestsellers: BestsellerItem[];
  orders: AdminOrder[];
  promos: PromoCodeRule[];
  publicPromoHint: PublicPromoHint | null;
  settings: StoreSettings;
  dbStats: DbRetentionStats | null;
  newOrdersCount: number;
  adminAuth: AdminAuthState;

  refreshStorefront: () => Promise<void>;
  refreshAdminData: () => Promise<void>;
  checkAdminSession: () => Promise<boolean>;
  loginAdmin: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;

  getProductById: (id: string) => BaseProduct | undefined;
  getAvailableStock: (productId: string, size: string) => number;
  getTotalStock: (product: BaseProduct) => number;

  validatePromo: (
    code: string,
    subtotal: number,
  ) => Promise<{
    ok: boolean;
    message: string;
    promo: PublicPromoHint | null;
    discountAmount: number;
  }>;
  submitCheckoutOrder: (payload: CheckoutOrderPayload) => Promise<AdminOrder>;

  updateOrderStatus: (
    orderId: string,
    nextStatus: OrderStatus,
    cancelReason?: string,
  ) => Promise<void>;
  updateOrderPaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
  ) => Promise<void>;
  updateOrderTracking: (orderId: string, trackingNumber: string) => Promise<void>;
  updateOrderNote: (orderId: string, managerNote: string) => Promise<void>;
  purgeExpiredOrders: () => Promise<number>;

  addCategory: (label: string) => Promise<CatalogCategory>;
  updateCategory: (id: string, label: string) => Promise<CatalogCategory>;
  reorderCategory: (id: string, direction: 'up' | 'down') => Promise<void>;
  deleteCategory: (id: string, reassignTo?: string) => Promise<void>;

  addCatalogItem: (input: CatalogItemInput) => Promise<CatalogItem>;
  updateCatalogItem: (id: string, patch: Partial<CatalogItemInput>) => Promise<void>;
  deleteCatalogItem: (id: string) => Promise<void>;
  toggleCatalogItemHidden: (id: string) => Promise<void>;

  addBestseller: (input: BestsellerInput) => Promise<BestsellerItem | null>;
  updateBestseller: (id: string, patch: Partial<BestsellerInput>) => Promise<void>;
  deleteBestseller: (id: string) => Promise<boolean>;
  reorderBestseller: (id: string, direction: 'up' | 'down') => Promise<void>;
  promoteCatalogToBestseller: (
    catalogItemId: string,
    modelImage: string,
    tag: string,
  ) => Promise<BestsellerItem | null>;

  addPromo: (input: PromoInput) => Promise<PromoCodeRule | null>;
  togglePromo: (id: string) => Promise<void>;
  deletePromo: (id: string) => Promise<void>;

  updateSettings: (patch: Partial<StoreSettings>) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const StoreDataContext = createContext<StoreDataContextValue | null>(null);

export function StoreDataProvider({ children }: { children: ReactNode }) {
  const [storefrontLoaded, setStorefrontLoaded] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>(INITIAL_SEED_CATEGORIES);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(createSeedCatalog);
  const [bestsellers, setBestsellers] = useState<BestsellerItem[]>(createSeedBestsellers);
  const [settings, setSettings] = useState<StoreSettings>(createSeedSettings);
  const [publicPromoHint, setPublicPromoHint] = useState<PublicPromoHint | null>(null);

  // Strict security isolation: orders, promos, and dbStats start empty and load ONLY inside authenticated /admin
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [promos, setPromos] = useState<PromoCodeRule[]>([]);
  const [dbStats, setDbStats] = useState<DbRetentionStats | null>(null);
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>({ status: 'idle' });

  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  const broadcastSync = useCallback(() => {
    try {
      syncChannelRef.current?.postMessage({ type: 'storefront_updated', ts: Date.now() });
    } catch {
      // Ignore BroadcastChannel errors
    }
  }, []);

  const handleUnauthorizedError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      setAdminAuth({ status: 'unauthenticated' });
      setOrders([]);
      setPromos([]);
      setDbStats(null);
    }
  }, []);

  const refreshStorefront = useCallback(async () => {
    try {
      const data = await api.getStorefront();
      setCategories(data.categories);
      setCatalogItems(data.catalogItems);
      setBestsellers(data.bestsellers);
      setSettings(data.settings);
      setPublicPromoHint(data.publicPromoHint);
    } catch {
      // Keep fallback seed for first-paint resilience if offline
    } finally {
      setStorefrontLoaded(true);
    }
  }, []);

  const refreshAdminData = useCallback(async () => {
    try {
      const data = await api.getAdminBootstrap();
      setCategories(data.categories);
      setCatalogItems(data.catalogItems);
      setBestsellers(data.bestsellers);
      setOrders(data.orders);
      setPromos(data.promos);
      setSettings(data.settings);
      setDbStats(data.dbStats);
      setStorefrontLoaded(true);
    } catch (err) {
      handleUnauthorizedError(err);
      throw err;
    }
  }, [handleUnauthorizedError]);

  const checkAdminSession = useCallback(async (): Promise<boolean> => {
    setAdminAuth((prev) =>
      prev.status === 'authenticated' ? prev : { status: 'checking' },
    );
    try {
      const res = await api.getSession();
      if (res.authenticated) {
        setAdminAuth({ status: 'authenticated', username: res.username });
        return true;
      }
      setAdminAuth({ status: 'unauthenticated' });
      setOrders([]);
      setPromos([]);
      setDbStats(null);
      return false;
    } catch {
      setAdminAuth({ status: 'unauthenticated' });
      return false;
    }
  }, []);

  const loginAdmin = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await api.login(username, password);
        setAdminAuth({ status: 'authenticated', username: res.username });
        await refreshAdminData();
        return { ok: true };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Не удалось выполнить вход';
        return { ok: false, error: msg };
      }
    },
    [refreshAdminData],
  );

  const logoutAdmin = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local state regardless
    }
    setAdminAuth({ status: 'unauthenticated' });
    setOrders([]);
    setPromos([]);
    setDbStats(null);
  }, []);

  // Load public storefront data on mount & listen for cross-tab sync events
  useEffect(() => {
    void refreshStorefront();

    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannelRef.current = ch;
      ch.onmessage = (event) => {
        if (event.data?.type === 'storefront_updated') {
          void refreshStorefront();
        }
      };
      return () => {
        ch.close();
        syncChannelRef.current = null;
      };
    }
    return undefined;
  }, [refreshStorefront]);

  const visibleCatalogItems = useMemo(
    () => catalogItems.filter((item) => !item.hidden),
    [catalogItems],
  );

  const productLookup = useMemo(() => {
    const map = new Map<string, BaseProduct>();
    for (const item of bestsellers) map.set(item.id, item);
    for (const item of catalogItems) map.set(item.id, item);
    return map;
  }, [bestsellers, catalogItems]);

  const newOrdersCount = useMemo(
    () => orders.filter((order) => order.status === 'new').length,
    [orders],
  );

  const getProductById = useCallback(
    (id: string) => productLookup.get(id),
    [productLookup],
  );

  const getAvailableStock = useCallback(
    (productId: string, size: string): number => {
      const product = productLookup.get(productId);
      if (!product) return 0;
      if (!product.sizes.includes(size)) return 0;
      if (!product.stock) return 5;
      const count = product.stock[size];
      return typeof count === 'number' ? Math.max(0, count) : 0;
    },
    [productLookup],
  );

  const getTotalStock = useCallback((product: BaseProduct): number => {
    if (!product.stock) return product.sizes.length * 5;
    return product.sizes.reduce((sum, size) => {
      const val = product.stock?.[size];
      return sum + (typeof val === 'number' ? Math.max(0, val) : 0);
    }, 0);
  }, []);

  const validatePromo = useCallback(async (code: string, subtotal: number) => {
    return api.validatePromo(code, subtotal);
  }, []);

  const submitCheckoutOrder = useCallback(
    async (payload: CheckoutOrderPayload): Promise<AdminOrder> => {
      const { order } = await api.createOrder(payload);
      await refreshStorefront();
      broadcastSync();
      return order;
    },
    [refreshStorefront, broadcastSync],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, nextStatus: OrderStatus, cancelReason?: string) => {
      try {
        const res = await api.updateOrder(orderId, {
          status: nextStatus,
          cancelReason: cancelReason?.trim() || undefined,
        });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
        setDbStats(res.dbStats);
        await refreshStorefront();
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, refreshStorefront, broadcastSync],
  );

  const updateOrderPaymentStatus = useCallback(
    async (orderId: string, paymentStatus: PaymentStatus) => {
      try {
        const res = await api.updateOrder(orderId, { paymentStatus });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
        setDbStats(res.dbStats);
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError],
  );

  const updateOrderTracking = useCallback(
    async (orderId: string, trackingNumber: string) => {
      try {
        const res = await api.updateOrder(orderId, { trackingNumber });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError],
  );

  const updateOrderNote = useCallback(
    async (orderId: string, managerNote: string) => {
      try {
        const res = await api.updateOrder(orderId, { managerNote });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError],
  );

  const purgeExpiredOrders = useCallback(async (): Promise<number> => {
    try {
      const res = await api.purgeExpiredOrders();
      setOrders(res.orders);
      setDbStats(res.dbStats);
      return res.purgedCount;
    } catch (err) {
      handleUnauthorizedError(err);
      throw err;
    }
  }, [handleUnauthorizedError]);

  const addCategory = useCallback(
    async (label: string): Promise<CatalogCategory> => {
      try {
        const { category } = await api.createCategory(label);
        setCategories((prev) => [...prev, category]);
        broadcastSync();
        return category;
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const updateCategory = useCallback(
    async (id: string, label: string): Promise<CatalogCategory> => {
      try {
        const { category } = await api.updateCategory(id, label);
        setCategories((prev) => prev.map((c) => (c.id === id ? category : c)));
        setCatalogItems((prev) =>
          prev.map((item) =>
            item.category === id ? { ...item, categoryLabel: category.label } : item,
          ),
        );
        broadcastSync();
        return category;
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const reorderCategory = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      try {
        const { categories: nextCats } = await api.reorderCategory(id, direction);
        setCategories(nextCats);
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const deleteCategory = useCallback(
    async (id: string, reassignTo?: string) => {
      try {
        await api.deleteCategory(id, reassignTo);
        await refreshAdminData();
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, refreshAdminData, broadcastSync],
  );

  const addCatalogItem = useCallback(
    async (input: CatalogItemInput): Promise<CatalogItem> => {
      try {
        const cleanStock = { ...input.stock };
        const cleanSizes = syncSizesWithStock(input.sizes, cleanStock);
        const { product } = await api.createProduct({
          ...input,
          sizes: cleanSizes,
          stock: cleanStock,
        });
        setCatalogItems((prev) => [product, ...prev]);
        broadcastSync();
        return product;
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const updateCatalogItem = useCallback(
    async (id: string, patch: Partial<CatalogItemInput>) => {
      try {
        const { product } = await api.updateProduct(id, patch);
        setCatalogItems((prev) => prev.map((item) => (item.id === id ? product : item)));
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const deleteCatalogItem = useCallback(
    async (id: string) => {
      try {
        await api.deleteProduct(id);
        setCatalogItems((prev) => prev.filter((item) => item.id !== id));
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const toggleCatalogItemHidden = useCallback(
    async (id: string) => {
      const target = catalogItems.find((item) => item.id === id);
      if (!target) return;
      await updateCatalogItem(id, { hidden: !target.hidden });
    },
    [catalogItems, updateCatalogItem],
  );

  const addBestseller = useCallback(
    async (input: BestsellerInput): Promise<BestsellerItem | null> => {
      if (bestsellers.length >= MAX_BESTSELLERS) return null;
      try {
        const cleanStock = { ...input.stock };
        const cleanSizes = syncSizesWithStock(input.sizes, cleanStock);
        const { bestseller } = await api.createBestseller({
          ...input,
          sizes: cleanSizes,
          stock: cleanStock,
        });
        setBestsellers((prev) => [...prev, bestseller]);
        broadcastSync();
        return bestseller;
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [bestsellers.length, handleUnauthorizedError, broadcastSync],
  );

  const updateBestseller = useCallback(
    async (id: string, patch: Partial<BestsellerInput>) => {
      try {
        const { bestseller } = await api.updateBestseller(id, patch);
        setBestsellers((prev) =>
          prev.map((item) => (item.id === id ? bestseller : item)),
        );
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const deleteBestseller = useCallback(
    async (id: string): Promise<boolean> => {
      if (bestsellers.length <= MIN_BESTSELLERS) return false;
      try {
        await api.deleteBestseller(id);
        setBestsellers((prev) => prev.filter((item) => item.id !== id));
        broadcastSync();
        return true;
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [bestsellers.length, handleUnauthorizedError, broadcastSync],
  );

  const reorderBestseller = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      try {
        const { bestsellers: ordered } = await api.reorderBestseller(id, direction);
        setBestsellers(ordered);
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const promoteCatalogToBestseller = useCallback(
    async (
      catalogItemId: string,
      modelImage: string,
      tag: string,
    ): Promise<BestsellerItem | null> => {
      if (bestsellers.length >= MAX_BESTSELLERS) return null;
      try {
        const { bestseller } = await api.promoteToBestseller(
          catalogItemId,
          modelImage,
          tag,
        );
        setBestsellers((prev) => [...prev, bestseller]);
        broadcastSync();
        return bestseller;
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [bestsellers.length, handleUnauthorizedError, broadcastSync],
  );

  const addPromo = useCallback(
    async (input: PromoInput): Promise<PromoCodeRule | null> => {
      const normalized = input.code.trim().toUpperCase();
      if (!normalized) return null;
      try {
        const { promo } = await api.createPromo({
          code: normalized,
          type: input.type,
          value: input.value,
          minOrderAmount: input.minOrderAmount,
          active: input.active,
        });
        setPromos((prev) => [promo, ...prev]);
        await refreshStorefront();
        broadcastSync();
        return promo;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          return null;
        }
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, refreshStorefront, broadcastSync],
  );

  const togglePromo = useCallback(
    async (id: string) => {
      const current = promos.find((p) => p.id === id);
      if (!current) return;
      try {
        const { promo } = await api.togglePromo(id, !current.active);
        setPromos((prev) => prev.map((p) => (p.id === id ? promo : p)));
        await refreshStorefront();
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [promos, handleUnauthorizedError, refreshStorefront, broadcastSync],
  );

  const deletePromo = useCallback(
    async (id: string) => {
      try {
        await api.deletePromo(id);
        setPromos((prev) => prev.filter((p) => p.id !== id));
        await refreshStorefront();
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, refreshStorefront, broadcastSync],
  );

  const updateSettings = useCallback(
    async (patch: Partial<StoreSettings>) => {
      try {
        const { settings: updated } = await api.updateSettings(patch);
        setSettings(updated);
        broadcastSync();
      } catch (err) {
        handleUnauthorizedError(err);
        throw err;
      }
    },
    [handleUnauthorizedError, broadcastSync],
  );

  const resetDemoData = useCallback(async () => {
    try {
      const data = await api.resetDemo();
      setCategories(data.categories);
      setCatalogItems(data.catalogItems);
      setBestsellers(data.bestsellers);
      setOrders(data.orders);
      setPromos(data.promos);
      setSettings(data.settings);
      setDbStats(data.dbStats);
      await refreshStorefront();
      broadcastSync();
    } catch (err) {
      handleUnauthorizedError(err);
      throw err;
    }
  }, [handleUnauthorizedError, refreshStorefront, broadcastSync]);

  const value = useMemo<StoreDataContextValue>(
    () => ({
      storefrontLoaded,
      categories,
      catalogItems,
      visibleCatalogItems,
      bestsellers,
      orders,
      promos,
      publicPromoHint,
      settings,
      dbStats,
      newOrdersCount,
      adminAuth,
      refreshStorefront,
      refreshAdminData,
      checkAdminSession,
      loginAdmin,
      logoutAdmin,
      getProductById,
      getAvailableStock,
      getTotalStock,
      validatePromo,
      submitCheckoutOrder,
      updateOrderStatus,
      updateOrderPaymentStatus,
      updateOrderTracking,
      updateOrderNote,
      purgeExpiredOrders,
      addCategory,
      updateCategory,
      reorderCategory,
      deleteCategory,
      addCatalogItem,
      updateCatalogItem,
      deleteCatalogItem,
      toggleCatalogItemHidden,
      addBestseller,
      updateBestseller,
      deleteBestseller,
      reorderBestseller,
      promoteCatalogToBestseller,
      addPromo,
      togglePromo,
      deletePromo,
      updateSettings,
      resetDemoData,
    }),
    [
      storefrontLoaded,
      categories,
      catalogItems,
      visibleCatalogItems,
      bestsellers,
      orders,
      promos,
      publicPromoHint,
      settings,
      dbStats,
      newOrdersCount,
      adminAuth,
      refreshStorefront,
      refreshAdminData,
      checkAdminSession,
      loginAdmin,
      logoutAdmin,
      getProductById,
      getAvailableStock,
      getTotalStock,
      validatePromo,
      submitCheckoutOrder,
      updateOrderStatus,
      updateOrderPaymentStatus,
      updateOrderTracking,
      updateOrderNote,
      purgeExpiredOrders,
      addCategory,
      updateCategory,
      reorderCategory,
      deleteCategory,
      addCatalogItem,
      updateCatalogItem,
      deleteCatalogItem,
      toggleCatalogItemHidden,
      addBestseller,
      updateBestseller,
      deleteBestseller,
      reorderBestseller,
      promoteCatalogToBestseller,
      addPromo,
      togglePromo,
      deletePromo,
      updateSettings,
      resetDemoData,
    ],
  );

  return (
    <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>
  );
}

export function useStoreData(): StoreDataContextValue {
  const ctx = useContext(StoreDataContext);
  if (!ctx) {
    throw new Error('useStoreData must be used within a StoreDataProvider');
  }
  return ctx;
}
