import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, LayoutGrid, Square } from 'lucide-react';
import type {
  BaseProduct,
  CatalogItem,
  CategoryId,
} from '../data/products';
import { useStoreData } from '../context/StoreDataContext';
import { useResolvedImage } from '../lib/imageStore';
import { useInViewport } from './OpticalPrimitives';

interface CatalogProps {
  onQuickView: (product: BaseProduct, initialSize?: string) => void;
  onQuickAdd: (product: BaseProduct, size: string) => void;
  onScrollToY?: (y: number) => void;
}

interface CatalogCardProps {
  item: CatalogItem;
  index: number;
  filterCycle: number;
  onQuickView: (product: BaseProduct, initialSize?: string) => void;
  onQuickAdd: (product: BaseProduct, size: string) => void;
}

function CatalogCard({ item, index, filterCycle, onQuickView, onQuickAdd }: CatalogCardProps) {
  const { getAvailableStock, getTotalStock } = useStoreData();
  const resolvedImage = useResolvedImage(item.image);
  const totalStock = getTotalStock(item);
  const extraPhotosCount = item.gallery?.length ?? 0;

  const frameRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number>(0);
  const pointerPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    rectRef.current = frameRef.current?.getBoundingClientRect() ?? null;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    pointerPosRef.current.x = e.clientX;
    pointerPosRef.current.y = e.clientY;
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const frame = frameRef.current;
      if (!frame) return;
      const rect = rectRef.current ?? frame.getBoundingClientRect();
      rectRef.current = rect;
      frame.style.setProperty('--mx', `${(pointerPosRef.current.x - rect.left).toFixed(1)}px`);
      frame.style.setProperty('--my', `${(pointerPosRef.current.y - rect.top).toFixed(1)}px`);
    });
  };

  const handlePointerLeave = () => {
    rectRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  return (
    <article
      onClick={() => onQuickView(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onQuickView(item);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${item.title}, ${item.priceFormatted} — открыть подробности`}
      style={
        filterCycle > 0
          ? { animationDelay: `${Math.min(index, 10) * 35}ms` }
          : undefined
      }
      className={`group cursor-pointer focus-visible:outline-none ${
        filterCycle > 0 ? 'animate-catalog-card-in' : ''
      }`}
    >
      {/* Studio Garment Frame with Cursor Specular Glare & Floating Frosted Size Capsule */}
      <div
        ref={frameRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ contain: 'layout paint style' }}
        className="specular-card relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-[#EFEFED] border border-black/[0.06] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] lg:group-hover:border-black/22 lg:group-hover:shadow-[0_20px_44px_rgba(0,0,0,0.08)]"
      >
        {/* Desktop-only Frosted Glass Top Badges (hidden via visibility until hovered to eliminate idle backdrop-filter layers) */}
        <div className="pointer-events-none invisible group-hover:visible group-focus-within:visible absolute top-3 left-3 right-3 z-20 hidden lg:flex items-center justify-between gap-2 opacity-0 -translate-y-1.5 scale-[0.97] transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100">
          <div className="flex items-center gap-1.5">
            <span className="acrylic-light-strong rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/80">
              {item.sku}
            </span>
            {extraPhotosCount > 0 && (
              <span className="acrylic-light-strong rounded-full px-2 py-1 text-[10px] font-semibold text-[#0B0B0B]/70">
                +{extraPhotosCount} фото
              </span>
            )}
          </div>
          <span className="acrylic-light-strong inline-flex h-7 w-7 items-center justify-center rounded-full text-[#0B0B0B]">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        {totalStock === 0 && (
          <span className="acrylic-dark pointer-events-none absolute top-3 right-3 z-20 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#F6F6F4]">
            Sold Out
          </span>
        )}

        {/* Garment photo with studio multiply blend & crisp hover scale */}
        <img
          src={resolvedImage || item.image}
          alt={item.title}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`studio-blend relative z-10 h-full w-full object-contain p-2.5 sm:p-4 lg:p-5 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:group-hover:scale-[1.08] ${
            totalStock === 0 ? 'opacity-65' : ''
          }`}
        />

        {/* Bottom Floating Frosted Glass Size Capsule (invisible until hover/focus so 20 idle backdrops don't stack) */}
        <div className="invisible group-hover:visible group-focus-within:visible absolute inset-x-2.5 bottom-2.5 z-20 hidden lg:flex items-center justify-between gap-1 rounded-full acrylic-light-strong px-2 py-1.5 opacity-0 translate-y-2.5 scale-[0.97] transition-[opacity,transform,visibility] duration-320 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100">
          {item.sizes.map((size) => {
            const stock = getAvailableStock(item.id, size);
            const isOut = stock <= 0;
            return (
              <button
                key={size}
                type="button"
                disabled={isOut}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isOut) onQuickAdd(item, size);
                }}
                title={isOut ? `${size} — Sold Out` : `Добавить размер ${size} в корзину`}
                aria-label={
                  isOut
                    ? `${item.title}, размер ${size} — нет в наличии`
                    : `Добавить ${item.title}, размер ${size} в корзину`
                }
                className={`h-7 flex-1 min-w-7 rounded-full bg-transparent border-0 text-[10px] font-bold uppercase tracking-[0.06em] transition-all duration-200 ${
                  isOut
                    ? 'text-[#0B0B0B]/30 line-through cursor-not-allowed'
                    : 'text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-90'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card Typography & Specs */}
      <div className="mt-2.5 sm:mt-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[11px] sm:text-xs font-bold uppercase tracking-[0.01em] leading-[1.3] text-[#0B0B0B] line-clamp-2 transition-transform duration-300 lg:group-hover:translate-x-0.5">
            {item.title}
          </h3>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-medium text-[#0B0B0B]/50">
            {item.categoryLabel} · {item.sizes.join(' / ')}
          </p>
        </div>

        <span className="text-xs font-bold tracking-[0.01em] text-[#0B0B0B] whitespace-nowrap">
          {item.priceFormatted}
        </span>
      </div>
    </article>
  );
}

export function Catalog({ onQuickView, onQuickAdd, onScrollToY }: CatalogProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const sidebarItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileGridRef = useRef<HTMLDivElement>(null);
  const mobileItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { visibleCatalogItems, categories: dbCategories } = useStoreData();
  const inView = useInViewport(sectionRef, '200px');

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [filterCycle, setFilterCycle] = useState(0);
  const [mobileCols, setMobileCols] = useState<1 | 2>(2);

  useEffect(() => {
    if (
      activeCategory !== 'all' &&
      !dbCategories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory('all');
    }
  }, [activeCategory, dbCategories]);

  const categories = useMemo(
    () => [
      {
        id: 'all',
        label: 'Все вещи',
        count: visibleCatalogItems.length,
      },
      ...dbCategories.map((cat) => ({
        id: cat.id,
        label: cat.label,
        count: visibleCatalogItems.filter((item) => item.category === cat.id).length,
      })),
    ],
    [dbCategories, visibleCatalogItems],
  );

  const categorySignature = categories.map((c) => `${c.id}:${c.label}:${c.count}`).join('|');

  const [desktopHighlight, setDesktopHighlight] = useState({
    top: 0,
    height: 0,
    visible: false,
  });
  const [mobileHighlight, setMobileHighlight] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return visibleCatalogItems;
    return visibleCatalogItems.filter((item) => item.category === activeCategory);
  }, [activeCategory, visibleCatalogItems]);

  // Refresh downstream ScrollTrigger offsets whenever the grid height changes
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeCategory, mobileCols, filteredItems.length]);

  // Measure active category buttons for sliding desktop frosted backing & mobile obsidian pill
  useLayoutEffect(() => {
    const measureDesktop = () => {
      const btn = sidebarItemRefs.current[activeCategory];
      if (!btn) return;
      setDesktopHighlight({
        top: btn.offsetTop,
        height: btn.offsetHeight,
        visible: true,
      });
    };

    const measureMobile = () => {
      const btn = mobileItemRefs.current[activeCategory];
      if (!btn) return;
      setMobileHighlight({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        visible: true,
      });
    };

    const measureAll = () => {
      measureDesktop();
      measureMobile();
    };

    measureAll();
    const raf = requestAnimationFrame(measureAll);
    window.addEventListener('resize', measureAll);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measureAll);
      if (sidebarNavRef.current) observer.observe(sidebarNavRef.current);
      if (mobileGridRef.current) observer.observe(mobileGridRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measureAll);
      observer?.disconnect();
    };
  }, [activeCategory, categorySignature]);

  const selectCategory = (catId: CategoryId) => {
    if (catId === activeCategory) return;
    setActiveCategory(catId);
    setFilterCycle((c) => c + 1);
  };

  const handleMobileCategorySelect = (catId: CategoryId) => {
    selectCategory(catId);
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0) {
      const targetY = rect.top + window.scrollY;
      if (onScrollToY) onScrollToY(targetY);
      else window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  };

  return (
    <section
      id="catalog"
      ref={sectionRef}
      data-inview={inView ? 'true' : 'false'}
      className="relative z-20 lg:-mt-[100vh] bg-[#F6F6F4] border-t border-black/10 shadow-[0_-28px_72px_rgba(0,0,0,0.10)] py-20 sm:py-24 lg:py-32"
    >
      {/* Subtle Pre-Softened Ambient Light Orbs (isolated in overflow-hidden child so sticky sidebars stay intact) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="studio-orb-light animate-studio-drift-a absolute left-[4%] top-[16%] h-96 w-96 rounded-full" />
        <div className="studio-orb-dark animate-studio-drift-b absolute right-[8%] top-[40%] h-[440px] w-[440px] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black/10 pb-6 mb-6 lg:mb-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-3">
              03 / Каталог
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-[-0.03em] text-[#0B0B0B]">
              КАТАЛОГ
            </h2>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/55">
            <div className="flex items-center gap-3">
              <span>Позиций в наличии:</span>
              <span className="acrylic-light-strong inline-flex h-7 min-w-8 items-center justify-center rounded-full px-3 text-[#0B0B0B] tabular-nums">
                {filteredItems.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileCols((prev) => (prev === 2 ? 1 : 2))}
              aria-label={mobileCols === 2 ? 'Переключить в 1 колонку' : 'Переключить в 2 колонки'}
              className="lg:hidden acrylic-light-strong inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0B0B0B] transition-transform active:scale-95"
            >
              {mobileCols === 2 ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  <span>1 кол.</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>2 кол.</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sticky Mobile Control Bar: Frosted Glass Container + Sliding Active Highlight */}
        <div className="lg:hidden sticky top-16 z-20 -mx-5 px-5 sm:-mx-8 sm:px-8 mb-6 border-y border-black/[0.08] bg-[#F6F6F4]/84 py-2.5 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <div
            ref={mobileGridRef}
            role="group"
            aria-label="Категории каталога"
            className="relative grid grid-cols-3 gap-1.5"
          >
            {/* Sliding Dark Pill Highlight */}
            <span
              aria-hidden="true"
              style={{
                transform: `translate3d(${mobileHighlight.left}px, ${mobileHighlight.top}px, 0)`,
                width: `${mobileHighlight.width}px`,
                height: `${mobileHighlight.height}px`,
                opacity: mobileHighlight.visible ? 1 : 0,
              }}
              className="pointer-events-none absolute top-0 left-0 rounded-lg bg-[#0B0B0B] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-[transform,width,height,opacity] duration-340 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />

            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              const shortLabel = cat.id === 'all' ? 'Все' : cat.label;
              return (
                <button
                  key={cat.id}
                  ref={(el) => {
                    mobileItemRefs.current[cat.id] = el;
                  }}
                  type="button"
                  onClick={() => handleMobileCategorySelect(cat.id)}
                  aria-pressed={isActive}
                  className={`relative z-10 flex items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.04em] transition-colors duration-250 ${
                    isActive
                      ? 'border-transparent bg-transparent text-[#F6F6F4]'
                      : 'border-black/10 bg-white/60 text-[#0B0B0B]/80'
                  }`}
                >
                  <span className="truncate">{shortLabel}</span>
                  <span
                    className={`tabular-nums ${isActive ? 'text-white/75' : 'text-[#0B0B0B]/45'}`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout: Left Sticky Sidebar (Desktop) + Adaptive Grid */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Desktop Vertical Sticky Sidebar with Sliding Frosted Glass Highlight */}
          <aside className="hidden lg:block w-[220px] xl:w-[240px] shrink-0 sticky top-28 self-start">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/45 mb-4">
              Категории вещей
            </p>

            <nav
              ref={sidebarNavRef}
              aria-label="Фильтр категорий каталога"
              className="relative flex flex-col gap-1 border-t border-black/10 pt-2"
            >
              {/* Sliding Frosted Glass Pill Backing */}
              <span
                aria-hidden="true"
                style={{
                  transform: `translate3d(0, ${desktopHighlight.top}px, 0)`,
                  height: `${desktopHighlight.height}px`,
                  opacity: desktopHighlight.visible ? 1 : 0,
                }}
                className="acrylic-light-strong pointer-events-none absolute top-0 inset-x-0 rounded-xl transition-[transform,height,opacity] duration-380 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <span className="absolute left-0 top-2.5 bottom-2.5 w-[2.5px] rounded-r-full bg-[#0B0B0B]" />
              </span>

              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    ref={(el) => {
                      sidebarItemRefs.current[cat.id] = el;
                    }}
                    type="button"
                    onClick={() => selectCategory(cat.id)}
                    aria-pressed={isActive}
                    className={`group relative z-10 flex w-full items-center justify-between rounded-xl py-3 pl-4 pr-3 text-left transition-colors duration-250 bg-transparent border-0 ${
                      isActive ? 'text-[#0B0B0B]' : 'text-[#0B0B0B]/52 hover:text-[#0B0B0B]'
                    }`}
                  >
                    <span
                      className={`text-xs uppercase tracking-[0.1em] ${isActive ? 'font-bold' : 'font-medium'}`}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums">
                      {String(cat.count).padStart(2, '0')}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Product Grid: 2 cols (or 1 col toggleable) mobile, 2 cols tablet, 4 cols desktop */}
          <div className="flex-1 w-full">
            {filteredItems.length === 0 ? (
              <div className="acrylic-light rounded-2xl p-10 text-center">
                <p className="font-display text-sm font-bold uppercase text-[#0B0B0B] mb-1.5">
                  В этой категории пока нет позиций
                </p>
                <p className="text-xs text-[#0B0B0B]/60">
                  Выберите другую категорию или откройте раздел «Все вещи».
                </p>
              </div>
            ) : (
              <div
                className={`grid ${
                  mobileCols === 2 ? 'grid-cols-2 gap-x-3 gap-y-6' : 'grid-cols-1 gap-y-8'
                } md:grid-cols-2 md:gap-x-5 md:gap-y-10 lg:grid-cols-4`}
              >
                {filteredItems.map((item, idx) => (
                  <CatalogCard
                    key={`${item.id}-${filterCycle}`}
                    item={item}
                    index={idx}
                    filterCycle={filterCycle}
                    onQuickView={onQuickView}
                    onQuickAdd={onQuickAdd}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
