import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { RollingText, useSpecularPointer } from './OpticalPrimitives';

export interface NavSection {
  id: string;
  label: string;
}

const NAV_ITEMS: NavSection[] = [
  { id: 'hero', label: 'Главная' },
  { id: 'about', label: 'О нас' },
  { id: 'bestsellers', label: 'Бестселлеры' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'contacts', label: 'Контакты' },
];

interface HeaderProps {
  activeSection: string;
  isOverDark: boolean;
  cartCount: number;
  onNavigate: (sectionId: string) => void;
  onOpenCart: () => void;
  onMobileMenuChange?: (open: boolean) => void;
}

interface MagneticNavLinkProps {
  item: NavSection;
  isActive: boolean;
  isOverDark: boolean;
  registerRef: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}

function MagneticNavLink({
  item,
  isActive,
  isOverDark,
  registerRef,
  onClick,
}: MagneticNavLinkProps) {
  const pointerRef = useSpecularPointer<HTMLButtonElement>({
    magnetic: true,
    strength: 3,
  });

  return (
    <button
      ref={(el) => {
        pointerRef.current = el;
        registerRef(el);
      }}
      type="button"
      onClick={onClick}
      data-active={isActive ? 'true' : 'false'}
      className={`nav-link-roll relative z-10 rounded-full bg-transparent border-0 px-3.5 py-1.5 text-[13px] font-medium tracking-[0.02em] transition-colors duration-250 ${
        isActive
          ? isOverDark
            ? 'text-[#F6F6F4]'
            : 'text-[#0B0B0B]'
          : isOverDark
            ? 'text-[#F6F6F4]/68 hover:text-[#F6F6F4]'
            : 'text-[#0B0B0B]/68 hover:text-[#0B0B0B]'
      }`}
    >
      <span className="nav-link-roll__inner">
        <span className="nav-link-roll__primary">{item.label}</span>
        <span aria-hidden="true" className="nav-link-roll__clone">
          {item.label}
        </span>
      </span>
    </button>
  );
}

interface HeaderCartButtonProps {
  cartCount: number;
  isDarkSurface: boolean;
  onClick: () => void;
}

function HeaderCartButton({
  cartCount,
  isDarkSurface,
  onClick,
}: HeaderCartButtonProps) {
  const pointerRef = useSpecularPointer<HTMLButtonElement>({
    magnetic: true,
    strength: 3,
  });

  return (
    <button
      ref={pointerRef}
      type="button"
      onClick={onClick}
      aria-label={
        cartCount > 0 ? `Открыть корзину, товаров: ${cartCount}` : 'Открыть корзину'
      }
      className={`optical-trigger group relative inline-flex h-9 items-center rounded-full border px-2.5 lg:px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-250 ${
        isDarkSurface
          ? 'specular-dark border-white/15 bg-white/[0.08] text-[#F6F6F4] hover:bg-white/[0.16]'
          : 'specular-light border-black/10 bg-white/65 text-[#0B0B0B] hover:border-black/25 hover:bg-white'
      }`}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-105" />
        <span className="hidden lg:inline-flex">
          <RollingText text="Корзина" />
        </span>
        {cartCount > 0 && (
          <span
            key={cartCount}
            className={`animate-cart-badge-pop inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
              isDarkSurface
                ? 'bg-[#F6F6F4] text-[#0B0B0B]'
                : 'bg-[#0B0B0B] text-[#F6F6F4]'
            }`}
          >
            {cartCount}
          </span>
        )}
      </span>
    </button>
  );
}

export function Header({
  activeSection,
  isOverDark,
  cartCount,
  onNavigate,
  onOpenCart,
  onMobileMenuChange,
}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, visible: false });

  const isScrolledRef = useRef(false);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const updateMobileMenu = (next: boolean) => {
    setMobileMenuOpen(next);
    onMobileMenuChange?.(next);
  };

  useEffect(() => {
    let rafId = 0;

    const updateScrollState = () => {
      rafId = 0;
      const next = window.scrollY > 36;
      if (next !== isScrolledRef.current) {
        isScrolledRef.current = next;
        setIsScrolled(next);
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateScrollState);
      }
    };

    updateScrollState();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        updateMobileMenu(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  // Measure active desktop nav button to drive the sliding frosted pill indicator
  useLayoutEffect(() => {
    const measurePill = () => {
      const navEl = navRef.current;
      const activeEl = itemRefs.current[activeSection];
      if (!navEl || !activeEl) return;

      setPillStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        visible: true,
      });
    };

    measurePill();
    const raf = requestAnimationFrame(measurePill);
    window.addEventListener('resize', measurePill);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      observer = new ResizeObserver(measurePill);
      observer.observe(navRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measurePill);
      observer?.disconnect();
    };
  }, [activeSection, isScrolled]);

  const handleNavClick = (id: string) => {
    updateMobileMenu(false);
    onNavigate(id);
  };

  const isCapsule = isScrolled && !mobileMenuOpen;

  const containerThemeClass = mobileMenuOpen
    ? 'max-w-[1600px] h-16 px-5 sm:px-8 rounded-none text-[#F6F6F4] bg-transparent border-b border-white/10'
    : isCapsule
      ? isOverDark
        ? 'max-w-[920px] h-13 md:h-14 px-4 sm:px-5 lg:px-6 rounded-full acrylic-dark text-[#F6F6F4]'
        : 'max-w-[920px] h-13 md:h-14 px-4 sm:px-5 lg:px-6 rounded-full acrylic-light-strong text-[#0B0B0B]'
      : 'max-w-[1600px] h-16 md:h-[72px] px-5 sm:px-8 lg:px-12 rounded-none bg-transparent border border-transparent text-[#0B0B0B]';

  const isDarkSurface = isOverDark || mobileMenuOpen;

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-[60] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCapsule ? 'pt-3 px-3 sm:px-5' : 'pt-0 px-0'
        }`}
      >
        <div
          className={`pointer-events-auto relative mx-auto flex items-center justify-between transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${containerThemeClass}`}
        >
          {/* LEFT: Navigation links with sliding frosted capsule pill */}
          <nav
            ref={navRef}
            aria-label="Основная навигация"
            className="hidden lg:flex relative items-center gap-1 xl:gap-1.5"
          >
            <span
              aria-hidden="true"
              style={{
                transform: `translate3d(${pillStyle.left}px, 0, 0)`,
                width: `${pillStyle.width}px`,
                opacity: pillStyle.visible ? 1 : 0,
              }}
              className={`pointer-events-none absolute top-0 bottom-0 left-0 rounded-full transition-[transform,width,opacity,background-color,border-color] duration-380 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isOverDark
                  ? 'bg-white/[0.12] border border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                  : 'bg-black/[0.06] border border-black/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]'
              }`}
            />

            {NAV_ITEMS.map((item) => (
              <MagneticNavLink
                key={item.id}
                item={item}
                isActive={activeSection === item.id}
                isOverDark={isOverDark}
                registerRef={(el) => {
                  itemRefs.current[item.id] = el;
                }}
                onClick={() => handleNavClick(item.id)}
              />
            ))}
          </nav>

          {/* Mobile menu toggle on LEFT */}
          <button
            type="button"
            onClick={() => updateMobileMenu(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden inline-flex items-center gap-2 bg-transparent border-0 p-1 text-xs font-semibold uppercase tracking-[0.14em]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="hidden min-[360px]:inline">Меню</span>
          </button>

          {/* RIGHT: Centered Brand on Mobile + Brand + Divider + Cart on Desktop */}
          <div className="flex items-center gap-3 lg:gap-4">
            <button
              type="button"
              onClick={() => handleNavClick('hero')}
              aria-label="NEVERMIND — на главную"
              className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 bg-transparent border-0 p-0 font-display text-sm sm:text-base font-extrabold tracking-[0.16em] uppercase transition-opacity duration-200 hover:opacity-70"
            >
              NEVERMIND
            </button>

            <span
              aria-hidden="true"
              className={`hidden lg:block h-4 w-px transition-colors duration-300 ${
                isDarkSurface ? 'bg-white/15' : 'bg-black/12'
              }`}
            />

            <HeaderCartButton
              cartCount={cartCount}
              isDarkSurface={isDarkSurface}
              onClick={() => {
                updateMobileMenu(false);
                onOpenCart();
              }}
            />
          </div>
        </div>
      </header>

      {/* Mobile full-screen frosted smoky glass navigation overlay */}
      <div
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 z-50 bg-[#0B0B0B]/86 backdrop-blur-xl text-[#F6F6F4] lg:hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none -translate-y-4'
        }`}
      >
        <div className="flex h-full flex-col justify-between px-6 pt-28 pb-12">
          <nav aria-label="Мобильное меню" className="flex flex-col gap-5">
            {NAV_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                style={{
                  transitionDelay: mobileMenuOpen ? `${70 + idx * 55}ms` : '0ms',
                }}
                className={`group flex items-baseline justify-between border-b border-white/10 pb-4 text-left bg-transparent transition-all duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                  mobileMenuOpen
                    ? 'opacity-100 translate-y-0 blur-0'
                    : 'opacity-0 translate-y-4 blur-[4px]'
                }`}
              >
                <span className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight transition-transform duration-300 group-hover:translate-x-2">
                  {item.label}
                </span>
                <span className="text-xs font-medium tracking-[0.2em] text-white/45">
                  0{idx + 1}
                </span>
              </button>
            ))}
          </nav>

          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/50">
            <span>NEVERMIND ARCHIVE</span>
            <span>DROP 2026</span>
          </div>
        </div>
      </div>
    </>
  );
}
