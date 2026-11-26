import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShoppingBag, X } from 'lucide-react';
import type { BaseProduct } from '../data/products';
import { useStoreData } from '../context/StoreDataContext';
import { useResolvedImage } from '../lib/imageStore';
import { OpticalButton, RollingText } from './OpticalPrimitives';

interface QuickViewModalProps {
  product: BaseProduct | null;
  initialSize?: string;
  onClose: () => void;
  onAddToCart: (product: BaseProduct, size: string) => void;
}

const FIT_GUIDE: Record<string, string> = {
  XS: 'Рекомендуемый рост 160–169 см · Компактная посадка',
  S: 'Рекомендуемый рост 168–176 см · Умеренный объём',
  M: 'Рекомендуемый рост 175–183 см · Свободная посадка',
  L: 'Рекомендуемый рост 182–190 см · Выраженный оверсайз',
  XL: 'Рекомендуемый рост 188–198 см · Максимальный силуэт',
};

function QuickViewThumb({
  src,
  active,
  hasModel,
  index,
  onSelect,
}: {
  src: string;
  active: boolean;
  hasModel: boolean;
  index: number;
  onSelect: () => void;
}) {
  const resolved = useResolvedImage(src);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      aria-label={`Показать ракурс ${index + 1}`}
      aria-pressed={active}
      className={`h-9 w-8 sm:h-10 sm:w-9 shrink-0 overflow-hidden rounded-lg border p-0.5 transition-all duration-200 ${
        active
          ? 'border-[#0B0B0B] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] scale-105'
          : 'border-black/12 bg-white/75 opacity-70 hover:opacity-100'
      }`}
    >
      <img
        src={resolved || src}
        alt=""
        draggable={false}
        className={`h-full w-full object-contain ${
          hasModel ? 'cutout-shadow' : 'studio-blend'
        }`}
      />
    </button>
  );
}

export function QuickViewModal({
  product,
  initialSize,
  onClose,
  onAddToCart,
}: QuickViewModalProps) {
  const { getAvailableStock, getProductById } = useStoreData();

  const [renderedProduct, setRenderedProduct] = useState<BaseProduct | null>(product);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [viewMode, setViewMode] = useState<'garment' | 'model'>('garment');
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [isZooming, setIsZooming] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const stageRectRef = useRef<DOMRect | null>(null);
  const zoomRafRef = useRef<number>(0);
  const zoomPosRef = useRef({ x: 0, y: 0 });
  const garmentImgRef = useRef<HTMLImageElement>(null);
  const modelImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    return () => {
      if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current);
    };
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (product) {
      const liveProduct = getProductById(product.id) ?? product;
      setRenderedProduct(liveProduct);

      const firstAvailableSize =
        initialSize &&
        liveProduct.sizes.includes(initialSize) &&
        getAvailableStock(liveProduct.id, initialSize) > 0
          ? initialSize
          : (liveProduct.sizes.find((s) => getAvailableStock(liveProduct.id, s) > 0) ??
              liveProduct.sizes[1] ??
              liveProduct.sizes[0] ??
              'M');

      setSelectedSize(firstAvailableSize);
      setViewMode('garment');
      setActiveFrameIdx(0);
      setIsZooming(false);

      if (prefersReduced) {
        setIsVisible(true);
        return;
      }

      setIsVisible(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }

    setIsVisible(false);
    setIsZooming(false);
    if (prefersReduced) {
      setRenderedProduct(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setRenderedProduct(null);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [product, initialSize, getAvailableStock, getProductById]);

  useEffect(() => {
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [product, onClose]);

  const garmentFrames = useMemo(() => {
    if (!renderedProduct) return [];
    return [renderedProduct.image, ...(renderedProduct.gallery ?? [])].filter(Boolean);
  }, [renderedProduct]);

  const activeFrameRaw =
    garmentFrames[activeFrameIdx] ?? garmentFrames[0] ?? renderedProduct?.image ?? '';
  const resolvedGarmentSrc = useResolvedImage(activeFrameRaw);
  const resolvedModelSrc = useResolvedImage(renderedProduct?.modelImage);

  if (!renderedProduct) return null;

  const hasModel = Boolean(renderedProduct.modelImage);
  const showingModel = hasModel && viewMode === 'model';
  const selectedSizeStock = getAvailableStock(renderedProduct.id, selectedSize);
  const fitHint =
    selectedSizeStock <= 0
      ? `Размер ${selectedSize} временно распродан (Sold Out)`
      : (FIT_GUIDE[selectedSize] ?? `Размер ${selectedSize} · ${renderedProduct.fit}`);

  const handleStagePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    stageRectRef.current = stageRef.current?.getBoundingClientRect() ?? null;
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    zoomPosRef.current.x = e.clientX;
    zoomPosRef.current.y = e.clientY;
    if (!isZooming) setIsZooming(true);
    if (zoomRafRef.current) return;

    zoomRafRef.current = requestAnimationFrame(() => {
      zoomRafRef.current = 0;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stageRectRef.current ?? stage.getBoundingClientRect();
      stageRectRef.current = rect;
      if (!rect.width || !rect.height) return;

      const xPct = Math.max(
        0,
        Math.min(100, ((zoomPosRef.current.x - rect.left) / rect.width) * 100),
      );
      const yPct = Math.max(
        0,
        Math.min(100, ((zoomPosRef.current.y - rect.top) / rect.height) * 100),
      );
      const origin = `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`;

      if (garmentImgRef.current) garmentImgRef.current.style.transformOrigin = origin;
      if (modelImgRef.current) modelImgRef.current.style.transformOrigin = origin;
    });
  };

  const handleStagePointerLeave = () => {
    stageRectRef.current = null;
    if (zoomRafRef.current) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = 0;
    }
    setIsZooming(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-6 backdrop-blur-md transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        data-lenis-prevent="true"
        className={`relative w-full max-w-[940px] max-h-[88svh] md:max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-[#F6F6F4]/90 backdrop-blur-xl border border-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_34px_96px_rgba(0,0,0,0.30)] grid grid-cols-1 md:grid-cols-12 transition-all duration-360 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
          isVisible
            ? 'translate-y-0 opacity-100 md:scale-100 md:blur-0'
            : 'translate-y-8 opacity-0 md:translate-y-0 md:scale-[0.96] md:blur-[4px]'
        }`}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть окно товара"
          className="acrylic-light-strong absolute top-3.5 right-3.5 md:top-4 md:right-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0B0B0B] transition-all duration-250 hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left Image Stage with 1.65x Interactive Optical Loupe & Optional Extra Photos Gallery */}
        <div
          ref={stageRef}
          onPointerEnter={handleStagePointerEnter}
          onPointerMove={handleStagePointerMove}
          onPointerLeave={handleStagePointerLeave}
          className="md:col-span-6 relative h-[215px] sm:h-[265px] md:h-auto md:min-h-[520px] bg-[#ECECE8]/85 overflow-hidden flex items-center justify-center p-4 sm:p-8 lg:cursor-zoom-in"
        >
          <span className="hidden md:inline-flex acrylic-light-strong absolute top-4 left-4 z-20 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/70 pointer-events-none">
            {renderedProduct.sku}
          </span>

          <span
            aria-hidden="true"
            className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] absolute top-4 right-4 z-20 pointer-events-none transition-all duration-250 ${
              isZooming
                ? 'acrylic-dark text-[#F6F6F4]'
                : 'acrylic-light-strong text-[#0B0B0B]/65'
            }`}
          >
            <Search className="h-3 w-3" />
            <span>1.65× · Фактура</span>
          </span>

          {/* Extra Garment Photos Strip (appears automatically when gallery has extra photos) */}
          {garmentFrames.length > 1 && !showingModel && (
            <div
              onMouseEnter={() => setIsZooming(false)}
              className="acrylic-light-strong absolute top-3 left-3 md:top-14 md:left-4 z-20 flex md:flex-col items-center gap-1.5 rounded-xl p-1.5 cursor-default max-w-[75%] md:max-w-none overflow-x-auto no-scrollbar"
            >
              {garmentFrames.map((frameSrc, idx) => (
                <QuickViewThumb
                  key={`${frameSrc}-${idx}`}
                  src={frameSrc}
                  active={idx === activeFrameIdx}
                  hasModel={hasModel}
                  index={idx}
                  onSelect={() => {
                    setActiveFrameIdx(idx);
                    setIsZooming(false);
                  }}
                />
              ))}
            </div>
          )}

          {/* Garment layer */}
          <img
            key={activeFrameRaw}
            ref={garmentImgRef}
            src={resolvedGarmentSrc || activeFrameRaw}
            alt={renderedProduct.title}
            draggable={false}
            className={`animate-optical-roll-in max-h-[172px] sm:max-h-[225px] md:max-h-[420px] w-full object-contain transition-[opacity,filter,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
              hasModel ? 'cutout-shadow' : 'studio-blend'
            } ${
              showingModel
                ? 'opacity-0 blur-[4px] pointer-events-none'
                : 'opacity-100 blur-0'
            } ${isZooming && !showingModel ? 'md:scale-[1.65]' : 'scale-100'}`}
          />

          {/* Model layer (stacked when available for smooth blur crossfade) */}
          {hasModel && renderedProduct.modelImage && (
            <img
              ref={modelImgRef}
              src={resolvedModelSrc || renderedProduct.modelImage}
              alt={`${renderedProduct.title} на модели`}
              draggable={false}
              className={`cutout-shadow absolute inset-0 m-auto max-h-[182px] sm:max-h-[235px] md:max-h-[440px] w-[85%] object-contain transition-[opacity,filter,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                showingModel
                  ? 'opacity-100 blur-0'
                  : 'opacity-0 blur-[4px] pointer-events-none'
              } ${isZooming && showingModel ? 'md:scale-[1.65]' : 'scale-100'}`}
            />
          )}

          {/* Floating Frosted Sliding Segmented Toggle ("Вещь / На модели") */}
          {hasModel && (
            <div
              onMouseEnter={() => setIsZooming(false)}
              className="acrylic-light-strong absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 p-1 rounded-full grid grid-cols-2 w-[214px] cursor-default"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#0B0B0B] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-320 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  showingModel ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  setViewMode('garment');
                  setIsZooming(false);
                }}
                className={`relative z-10 rounded-full py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors duration-250 bg-transparent border-0 ${
                  !showingModel ? 'text-[#F6F6F4]' : 'text-[#0B0B0B]/70 hover:text-[#0B0B0B]'
                }`}
              >
                Вещь
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('model');
                  setIsZooming(false);
                }}
                className={`relative z-10 rounded-full py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors duration-250 bg-transparent border-0 ${
                  showingModel ? 'text-[#F6F6F4]' : 'text-[#0B0B0B]/70 hover:text-[#0B0B0B]'
                }`}
              >
                На модели
              </button>
            </div>
          )}
        </div>

        {/* Right Details */}
        <div className="md:col-span-6 flex flex-col justify-between p-5 sm:p-8 lg:p-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/45 mb-1.5 md:mb-2">
              {renderedProduct.categoryLabel}
            </p>

            <h3
              id="quick-view-title"
              className="font-display text-lg sm:text-2xl font-extrabold uppercase tracking-[-0.02em] leading-[1.15] text-[#0B0B0B] pr-10 mb-2 md:mb-3"
            >
              {renderedProduct.title}
            </h3>

            <p className="font-display text-base sm:text-lg font-bold text-[#0B0B0B] mb-3.5 md:mb-5">
              {renderedProduct.priceFormatted}
            </p>

            <p className="text-xs sm:text-sm leading-[1.6] sm:leading-[1.65] text-[#0B0B0B]/75 mb-4 md:mb-6">
              {renderedProduct.description}
            </p>

            <div className="space-y-2.5 md:space-y-3 border-t border-black/10 pt-4 md:pt-5 mb-4 md:mb-6 text-xs">
              <div className="flex items-start justify-between gap-4">
                <span className="font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/50 shrink-0">
                  Материал
                </span>
                <span className="text-right font-medium text-[#0B0B0B]">
                  {renderedProduct.material}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/50 shrink-0">
                  Посадка
                </span>
                <span className="text-right font-medium text-[#0B0B0B]">
                  {renderedProduct.fit}
                </span>
              </div>
            </div>

            {/* Interactive Size Selector with Sold Out States + Live Fit Guide */}
            <div className="mb-5 md:mb-8">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/55">
                  Выберите размер
                </p>
                {selectedSizeStock > 0 && selectedSizeStock <= 2 && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/55">
                    Осталось {selectedSizeStock} шт.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {renderedProduct.sizes.map((size) => {
                  const stock = getAvailableStock(renderedProduct.id, size);
                  const isOut = stock <= 0;
                  const active = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={isOut}
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={active}
                      title={isOut ? `${size} — Sold Out` : `Размер ${size}`}
                      className={`h-10 min-w-12 rounded-lg border px-3 text-xs font-bold uppercase tracking-[0.06em] transition-all duration-200 ${
                        isOut
                          ? 'border-black/10 bg-black/[0.03] text-[#0B0B0B]/35 line-through cursor-not-allowed'
                          : active
                            ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                            : 'border-black/12 bg-white/75 text-[#0B0B0B] hover:border-black/40'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 overflow-hidden">
                <p
                  key={`${selectedSize}-${selectedSizeStock}`}
                  className="animate-optical-roll-in text-[11px] font-medium text-[#0B0B0B]/62"
                >
                  {fitHint}
                </p>
              </div>
            </div>
          </div>

          <OpticalButton
            variant="dark"
            disabled={selectedSizeStock <= 0}
            onClick={() => onAddToCart(renderedProduct, selectedSize)}
            leadingIcon={<ShoppingBag className="h-4 w-4 shrink-0" />}
            className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {selectedSizeStock <= 0 ? (
              <span>Нет в наличии · Sold Out</span>
            ) : (
              <RollingText text={`Добавить в корзину · ${renderedProduct.priceFormatted}`} />
            )}
          </OpticalButton>
        </div>
      </div>
    </div>
  );
}
