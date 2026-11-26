import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import {
  ArrowUpRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Shirt,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useStoreData } from '../context/StoreDataContext';
import { AdminDashboard } from './AdminDashboard';
import { AdminOrders, type OrderStatusFilter } from './AdminOrders';
import { AdminCatalog } from './AdminCatalog';
import { AdminBestsellers } from './AdminBestsellers';
import { AdminSettings } from './AdminSettings';
import { AdminLogin } from './AdminLogin';

type AdminTab = 'dashboard' | 'orders' | 'catalog' | 'bestsellers' | 'settings';

const ADMIN_TABS: Array<{
  id: AdminTab;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Дашборд', shortLabel: 'Обзор', icon: LayoutDashboard },
  { id: 'orders', label: 'Заказы', shortLabel: 'Заказы', icon: ClipboardList },
  { id: 'catalog', label: 'Каталог', shortLabel: 'Каталог', icon: Shirt },
  { id: 'bestsellers', label: 'Бестселлеры', shortLabel: 'Топ', icon: Sparkles },
  { id: 'settings', label: 'Настройки', shortLabel: 'Опции', icon: SlidersHorizontal },
];

export default function AdminApp() {
  const {
    newOrdersCount,
    adminAuth,
    checkAdminSession,
    refreshAdminData,
    logoutAdmin,
  } = useStoreData();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [ordersPresetStatus, setOrdersPresetStatus] = useState<OrderStatusFilter>('all');
  const [ordersPresetId, setOrdersPresetId] = useState<string | null>(null);
  const [catalogCreateOpen, setCatalogCreateOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const toastClearRef = useRef<number | null>(null);

  // Mobile floating dock sliding pill geometry
  const dockRef = useRef<HTMLDivElement>(null);
  const dockItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [dockPill, setDockPill] = useState({ left: 0, width: 0, visible: false });

  // SEO noindex & document title for hidden /admin route
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'NEVERMIND — Admin Console';

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => {
      document.title = prevTitle;
      meta.remove();
    };
  }, []);

  // Verify admin session on mount and load full DB bootstrap when authenticated
  useEffect(() => {
    let cancelled = false;
    void checkAdminSession().then((ok) => {
      if (!cancelled && ok) {
        void refreshAdminData().catch(() => {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkAdminSession, refreshAdminData]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (toastClearRef.current) window.clearTimeout(toastClearRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (adminAuth.status !== 'authenticated') return;

    const measureDock = () => {
      const activeEl = dockItemRefs.current[activeTab];
      if (!activeEl || activeEl.offsetWidth === 0) return;
      setDockPill({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        visible: true,
      });
    };

    measureDock();
    const raf = requestAnimationFrame(measureDock);
    window.addEventListener('resize', measureDock);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && dockRef.current) {
      observer = new ResizeObserver(measureDock);
      observer.observe(dockRef.current);
    }

    document.fonts?.ready.then(measureDock).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measureDock);
      observer?.disconnect();
    };
  }, [activeTab, newOrdersCount, adminAuth.status]);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (toastClearRef.current) window.clearTimeout(toastClearRef.current);

    setToastMessage(message);
    requestAnimationFrame(() => setToastVisible(true));

    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
      toastClearRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 280);
    }, 2600);
  }, []);

  const handleOpenOrders = useCallback(
    (preset?: { status?: 'active' | 'new' | 'all'; orderId?: string }) => {
      if (preset?.status) setOrdersPresetStatus(preset.status);
      else setOrdersPresetStatus('all');
      setOrdersPresetId(preset?.orderId ?? null);
      setActiveTab('orders');
    },
    [],
  );

  const handleAddProductFromDashboard = useCallback(() => {
    setCatalogCreateOpen(true);
    setActiveTab('catalog');
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutAdmin();
    showToast('Вы вышли из консоли');
  }, [logoutAdmin, showToast]);

  if (adminAuth.status === 'idle' || adminAuth.status === 'checking') {
    return (
      <div className="min-h-screen bg-[#F6F6F4] flex items-center justify-center p-4">
        <div className="acrylic-light-strong rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]">
          ПРОВЕРКА СЕССИИ...
        </div>
      </div>
    );
  }

  if (adminAuth.status !== 'authenticated') {
    return <AdminLogin />;
  }

  return (
    <div
      data-inview="true"
      className="relative min-h-screen bg-[#F6F6F4] text-[#0B0B0B] selection:bg-[#0B0B0B] selection:text-[#F6F6F4]"
    >
      {/* Ambient Optical Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="studio-orb-light animate-studio-drift-a absolute -left-24 top-10 h-[520px] w-[520px] rounded-full" />
        <div className="studio-orb-dark animate-studio-drift-b absolute -right-24 bottom-10 h-[520px] w-[520px] rounded-full" />
      </div>

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-4 left-4 z-30 w-[248px] flex-col justify-between rounded-2xl acrylic-light-strong p-4">
        <div className="space-y-6">
          <div className="px-2 pt-1">
            <p className="font-display text-sm font-black uppercase tracking-[0.16em] text-[#0B0B0B]">
              NEVERMIND
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/48">
              Admin Console · {adminAuth.username || 'admin'}
            </p>
          </div>

          <nav aria-label="Разделы админ-панели" className="space-y-1">
            {ADMIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[#0B0B0B] text-[#F6F6F4] shadow-[0_8px_20px_rgba(0,0,0,0.18)]'
                      : 'bg-transparent text-[#0B0B0B]/68 hover:bg-black/[0.05] hover:text-[#0B0B0B]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </span>

                  {tab.id === 'orders' && newOrdersCount > 0 && (
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                        isActive
                          ? 'bg-[#F6F6F4] text-[#0B0B0B]'
                          : 'bg-[#0B0B0B] text-[#F6F6F4]'
                      }`}
                    >
                      {newOrdersCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="acrylic-light flex h-10 items-center justify-between rounded-xl px-3.5 text-xs font-semibold text-[#0B0B0B] transition-colors hover:bg-[#0B0B0B] hover:text-[#F6F6F4]"
          >
            <span>Открыть витрину</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="acrylic-light flex w-full h-10 items-center justify-between rounded-xl px-3.5 text-xs font-semibold text-[#0B0B0B]/70 transition-colors hover:border-[#B42318]/40 hover:text-[#B42318]"
          >
            <span>Выйти</span>
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      {/* Mobile Sticky Compact Header */}
      <header className="lg:hidden sticky top-0 z-30 px-3 pt-2.5">
        <div className="acrylic-light-strong rounded-full h-12 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-xs font-black uppercase tracking-[0.14em] text-[#0B0B0B] truncate">
              NEVERMIND
            </span>
            <span className="rounded-full bg-black/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0B0B0B]/70">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-black/12 bg-white/80 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]"
            >
              <span>Витрина</span>
              <ArrowUpRight className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Выйти из админ-панели"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B]/75 hover:text-[#B42318]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="relative z-10 lg:pl-[280px] lg:pr-6 pt-4 sm:pt-6 pb-28 lg:pb-10 px-3.5 sm:px-6 max-w-[1440px]">
        {activeTab === 'dashboard' && (
          <AdminDashboard
            onOpenOrders={handleOpenOrders}
            onAddProduct={handleAddProductFromDashboard}
            onNotify={showToast}
          />
        )}
        {activeTab === 'orders' && (
          <AdminOrders
            initialStatusFilter={ordersPresetStatus}
            initialOrderId={ordersPresetId}
            onClearInitialOrder={() => setOrdersPresetId(null)}
            onNotify={showToast}
          />
        )}
        {activeTab === 'catalog' && (
          <AdminCatalog
            initialCreateOpen={catalogCreateOpen}
            onClearInitialCreate={() => setCatalogCreateOpen(false)}
            onNotify={showToast}
          />
        )}
        {activeTab === 'bestsellers' && <AdminBestsellers onNotify={showToast} />}
        {activeTab === 'settings' && <AdminSettings onNotify={showToast} />}
      </main>

      {/* Mobile Floating Frosted Bottom Dock */}
      <nav
        aria-label="Мобильная навигация админки"
        className="lg:hidden fixed bottom-3 inset-x-3 z-40 mx-auto max-w-[460px]"
      >
        <div
          ref={dockRef}
          className="acrylic-light-strong relative grid grid-cols-5 items-center rounded-full p-1.5"
        >
          <span
            aria-hidden="true"
            style={{
              transform: `translate3d(${dockPill.left}px, 0, 0)`,
              width: `${dockPill.width}px`,
              opacity: dockPill.visible ? 1 : 0,
            }}
            className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full bg-[#0B0B0B] shadow-[0_6px_16px_rgba(0,0,0,0.22)] transition-[transform,width,opacity] duration-320 ease-[cubic-bezier(0.22,1,0.36,1)]"
          />

          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  dockItemRefs.current[tab.id] = el;
                }}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full min-h-[44px] py-1.5 px-1 bg-transparent border-0 transition-colors duration-250 ${
                  isActive ? 'text-[#F6F6F4]' : 'text-[#0B0B0B]/65'
                }`}
              >
                <span className="relative inline-flex">
                  <Icon className="h-4 w-4" />
                  {tab.id === 'orders' && newOrdersCount > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
                        isActive
                          ? 'bg-[#F6F6F4] text-[#0B0B0B]'
                          : 'bg-[#0B0B0B] text-[#F6F6F4]'
                      }`}
                    >
                      {newOrdersCount}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-semibold tracking-[0.02em] leading-none">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Smoky Frosted Dark Toast */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed top-16 lg:top-auto lg:bottom-6 left-1/2 -translate-x-1/2 z-[90] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          toastVisible
            ? 'opacity-100 translate-y-0 blur-0'
            : 'opacity-0 translate-y-2 blur-[4px]'
        }`}
      >
        {toastMessage && (
          <div className="acrylic-dark rounded-full px-5 py-2.5 text-xs font-medium text-[#F6F6F4] whitespace-nowrap">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
