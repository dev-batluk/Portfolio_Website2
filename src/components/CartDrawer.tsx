import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  formatRub,
  useCart,
  type CartLineItem,
} from '../context/CartContext';
import { useStoreData } from '../context/StoreDataContext';
import { useResolvedImage } from '../lib/imageStore';
import type { BaseProduct } from '../data/products';
import { OpticalButton, useSpecularPointer } from './OpticalPrimitives';

interface CartDrawerProps {
  onNavigateToCatalog: () => void;
  onSelectProduct: (product: BaseProduct, size: string) => void;
  onNotify: (message: string) => void;
}

interface CartItemCardProps {
  item: CartLineItem;
  index: number;
  openCycle: number;
  availableStock: number;
  isRecentlyAdded: boolean;
  addedSeq: number;
  isRemoving: boolean;
  onSelect: () => void;
  onUpdateQuantity: (delta: number) => void;
  onTriggerRemove: () => void;
}

function CartItemCard({
  item,
  index,
  openCycle,
  availableStock,
  isRecentlyAdded,
  addedSeq,
  isRemoving,
  onSelect,
  onUpdateQuantity,
  onTriggerRemove,
}: CartItemCardProps) {
  const specularRef = useSpecularPointer<HTMLElement>({ magnetic: false });
  const cardElRef = useRef<HTMLElement | null>(null);
  const resolvedImage = useResolvedImage(item.product.image);

  useEffect(() => {
    if (!isRecentlyAdded || isRemoving) return;
    const el = cardElRef.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [isRecentlyAdded, addedSeq, isRemoving]);

  const hasModel = Boolean(item.product.modelImage);
  const lineTotal = item.product.price * item.quantity;

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity,transform,filter,margin] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
        isRemoving
          ? 'grid-rows-[0fr] opacity-0 translate-x-5 blur-[4px] scale-[0.97] !mt-0 pointer-events-none'
          : 'grid-rows-[1fr] opacity-100 translate-x-0 blur-0 scale-100'
      }`}
    >
      <div className={isRemoving ? 'min-h-0 overflow-hidden' : 'min-h-0 overflow-visible'}>
        <div
          key={`enter-${openCycle}`}
          style={
            openCycle > 0
              ? { animationDelay: `${Math.min(index, 6) * 40}ms` }
              : undefined
          }
          className={openCycle > 0 ? 'animate-catalog-card-in' : undefined}
        >
          <article
            key={isRecentlyAdded ? `hl-${addedSeq}` : 'steady'}
            ref={(el) => {
              specularRef.current = el;
              cardElRef.current = el;
            }}
            className={`acrylic-light specular-card rounded-2xl p-3 flex items-center gap-3.5 ${
              isRecentlyAdded ? 'animate-cart-item-highlight' : ''
            }`}
          >
            <button
              type="button"
              onClick={onSelect}
              aria-label={`Открыть ${item.product.title}`}
              className="relative z-10 h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#ECECE8]/85 border border-black/[0.05] p-1.5 flex items-center justify-center transition-transform duration-250 hover:scale-[1.03] active:scale-95"
            >
              <img
                src={resolvedImage || item.product.image}
                alt={item.product.title}
                draggable={false}
                className={`h-full w-full object-contain ${
                  hasModel ? 'cutout-shadow' : 'studio-blend'
                }`}
              />
            </button>

            <div className="relative z-10 min-w-0 flex-1 flex flex-col justify-between gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/48">
                    {item.product.sku}
                  </p>
                  <button
                    type="button"
                    onClick={onSelect}
                    className="bg-transparent border-0 p-0 text-left font-display text-xs font-bold uppercase tracking-[0.01em] leading-[1.3] text-[#0B0B0B] line-clamp-2 hover:opacity-75 transition-opacity"
                  >
                    {item.product.title}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onTriggerRemove}
                  aria-label={`Удалить ${item.product.title} (${item.size})`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-transparent border-0 text-[#0B0B0B]/42 transition-all duration-200 hover:bg-black/[0.07] hover:text-[#0B0B0B] active:scale-90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-black/12 bg-white/75 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[#0B0B0B]">
                    {item.size}
                  </span>

                  <div className="inline-flex h-7 items-center rounded-full border border-black/12 bg-white/75 px-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.quantity <= 1) {
                          onTriggerRemove();
                        } else {
                          onUpdateQuantity(-1);
                        }
                      }}
                      aria-label={`Уменьшить количество ${item.product.title}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-transparent border-0 text-[#0B0B0B]/70 transition-all duration-150 hover:bg-black/[0.08] hover:text-[#0B0B0B] active:scale-90"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="inline-flex min-w-6 justify-center overflow-hidden">
                      <span
                        key={item.quantity}
                        className="animate-optical-roll-in text-center text-[11px] font-bold tabular-nums text-[#0B0B0B]"
                      >
                        {item.quantity}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={item.quantity >= availableStock}
                      onClick={() => onUpdateQuantity(1)}
                      aria-label={`Увеличить количество ${item.product.title}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-transparent border-0 text-[#0B0B0B]/70 transition-all duration-150 hover:bg-black/[0.08] hover:text-[#0B0B0B] active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {item.quantity >= availableStock && (
                    <span className="text-[10px] font-medium text-[#0B0B0B]/48">
                      Макс. {availableStock}
                    </span>
                  )}
                </div>

                <span className="inline-flex overflow-hidden">
                  <span
                    key={lineTotal}
                    className="animate-optical-roll-in font-display text-xs font-bold text-[#0B0B0B] tabular-nums whitespace-nowrap"
                  >
                    {formatRub(lineTotal)}
                  </span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer({
  onNavigateToCatalog,
  onSelectProduct,
  onNotify,
}: CartDrawerProps) {
  const {
    items,
    totalItems,
    subtotal,
    promoCode,
    activePromo,
    suggestedPromo,
    discountAmount,
    discountedSubtotal,
    freeDeliveryRemaining,
    freeDeliveryProgress,
    lastAdded,
    isCartOpen,
    closeCart,
    openCheckout,
    updateQuantity,
    removeItem,
    clearCart,
    applyPromo,
    removePromo,
  } = useCart();

  const { getAvailableStock } = useStoreData();

  const [isMounted, setIsMounted] = useState(isCartOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [openCycle, setOpenCycle] = useState(0);
  const [removingKeys, setRemovingKeys] = useState<string[]>([]);
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const removeTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(removeTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      removeTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isCartOpen) {
      setIsMounted(true);
      setPromoFeedback(null);
      setRemovingKeys([]);
      setOpenCycle((c) => c + 1);

      if (prefersReduced) {
        setIsVisible(true);
        return;
      }

      setIsVisible(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    Object.values(removeTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    removeTimersRef.current = {};
    setRemovingKeys([]);
    setIsVisible(false);

    if (prefersReduced) {
      setIsMounted(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsMounted(false);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [isCartOpen]);

  useEffect(() => {
    if (!isCartOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCartOpen, closeCart]);

  if (!isMounted) return null;

  const handleAnimatedRemove = (lineKey: string) => {
    if (removingKeys.includes(lineKey)) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      removeItem(lineKey);
      return;
    }

    setRemovingKeys((prev) => [...prev, lineKey]);
    removeTimersRef.current[lineKey] = window.setTimeout(() => {
      delete removeTimersRef.current[lineKey];
      removeItem(lineKey);
      setRemovingKeys((prev) => prev.filter((k) => k !== lineKey));
    }, 240);
  };

  const handlePromoSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (promoLoading) return;
    setPromoLoading(true);
    try {
      const res = await applyPromo(promoInput);
      setPromoFeedback(res);
      if (res.ok) {
        setPromoInput('');
      }
    } finally {
      setPromoLoading(false);
    }
  };

  const handleQuickApplyDemoPromo = async () => {
    if (!suggestedPromo || promoLoading) return;
    setPromoLoading(true);
    try {
      const res = await applyPromo(suggestedPromo.code);
      setPromoFeedback(res);
      if (res.ok) {
        setPromoInput('');
      }
    } finally {
      setPromoLoading(false);
    }
  };

  const handleClear = () => {
    Object.values(removeTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    removeTimersRef.current = {};
    setRemovingKeys([]);
    clearCart();
    setPromoInput('');
    setPromoFeedback(null);
    onNotify('Корзина очищена');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCart();
      }}
      className={`fixed inset-0 z-[72] flex justify-end bg-black/40 backdrop-blur-md transition-opacity duration-320 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <aside
        data-inview={isVisible ? 'true' : 'false'}
        className={`relative ml-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-[#F6F6F4]/92 backdrop-blur-xl border-l border-white/65 shadow-[inset_1px_0_0_rgba(255,255,255,0.85),-24px_0_80px_rgba(0,0,0,0.22)] transition-transform duration-360 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Ambient Optical Refraction Layer inside Drawer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="studio-orb-light animate-studio-drift-a absolute -right-24 top-12 h-80 w-80 rounded-full" />
          <div className="studio-orb-dark animate-studio-drift-b absolute -left-24 bottom-24 h-72 w-72 rounded-full" />
          <span className="font-display font-black uppercase tracking-[-0.05em] leading-none text-[8rem] text-[#0B0B0B]/[0.03] select-none absolute -right-10 bottom-36 -rotate-90 origin-center">
            CART
          </span>
        </div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-black/10 px-5 sm:px-6 pt-5 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0B0B0B]/50 mb-1 tabular-nums">
              CART / {String(totalItems).padStart(2, '0')}
            </p>
            <h2
              id="cart-drawer-title"
              className="font-display text-lg sm:text-xl font-black uppercase tracking-[-0.02em] text-[#0B0B0B]"
            >
              КОРЗИНА
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="bg-transparent border-0 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/50 transition-colors hover:text-[#0B0B0B]"
              >
                Очистить
              </button>
            )}

            <button
              type="button"
              onClick={closeCart}
              aria-label="Закрыть корзину"
              className="acrylic-light-strong inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0B0B0B] transition-all duration-250 hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Free Delivery Progress Bar */}
        {items.length > 0 && (
          <div className="relative z-10 border-b border-black/[0.07] px-5 sm:px-6 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#0B0B0B]/75 mb-2">
              {freeDeliveryRemaining === 0 ? (
                <span className="animate-optical-roll-in inline-flex items-center gap-1.5 font-semibold text-[#0B0B0B]">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>Бесплатная доставка активирована</span>
                </span>
              ) : (
                <span>
                  До бесплатной доставки:{' '}
                  <strong className="font-bold text-[#0B0B0B] tabular-nums">
                    {formatRub(freeDeliveryRemaining)}
                  </strong>
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/45 tabular-nums">
                {Math.round(freeDeliveryProgress * 100)}%
              </span>
            </div>

            <div className="relative h-[2px] w-full rounded-full bg-black/10 overflow-hidden">
              <div
                style={{ transform: `scaleX(${freeDeliveryProgress.toFixed(4)})` }}
                className="h-full w-full bg-[#0B0B0B] origin-left transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              />
              {freeDeliveryRemaining === 0 && (
                <span
                  aria-hidden="true"
                  className="animate-bar-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                />
              )}
            </div>
          </div>
        )}

        {/* Scrollable Items Area */}
        <div
          data-lenis-prevent="true"
          className="relative z-10 flex-1 overflow-y-auto px-5 sm:px-6 py-4"
        >
          {items.length === 0 ? (
            <div className="animate-optical-roll-in flex h-full flex-col items-center justify-center text-center py-12">
              <div className="acrylic-light-strong mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full text-[#0B0B0B]">
                <ShoppingBag className="h-6 w-6" />
              </div>

              <h3 className="font-display text-lg font-extrabold uppercase tracking-[-0.02em] text-[#0B0B0B] mb-2">
                КОРЗИНА ПУСТА
              </h3>
              <p className="max-w-[260px] text-xs leading-[1.6] text-[#0B0B0B]/62 mb-7">
                Выберите силуэт и нужный размер в каталоге или бестселлерах — вещи сразу появятся
                здесь.
              </p>

              <OpticalButton
                variant="dark"
                rollingLabel="Перейти в каталог"
                onClick={() => {
                  closeCart();
                  onNavigateToCatalog();
                }}
                className="h-11 px-7 text-xs font-semibold uppercase tracking-[0.08em]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <CartItemCard
                  key={item.lineKey}
                  item={item}
                  index={idx}
                  openCycle={openCycle}
                  availableStock={getAvailableStock(item.product.id, item.size)}
                  isRecentlyAdded={lastAdded?.lineKey === item.lineKey}
                  addedSeq={lastAdded?.seq ?? 0}
                  isRemoving={removingKeys.includes(item.lineKey)}
                  onSelect={() => {
                    closeCart();
                    onSelectProduct(item.product, item.size);
                  }}
                  onUpdateQuantity={(delta) => updateQuantity(item.lineKey, delta)}
                  onTriggerRemove={() => handleAnimatedRemove(item.lineKey)}
                />
              ))}

              {/* Compact Demo Promo Code Block */}
              <div className="acrylic-light rounded-2xl p-3.5 mt-4">
                {promoCode && activePromo ? (
                  <div className="animate-optical-roll-in flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0B0B0B] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#F6F6F4]">
                        <Check className="h-3 w-3" />
                        <span>
                          {activePromo.code} ·{' '}
                          {activePromo.type === 'percent'
                            ? `−${activePromo.value}%`
                            : `−${formatRub(activePromo.value)}`}
                        </span>
                      </span>
                      <span className="text-[11px] font-medium text-[#0B0B0B]/65 tabular-nums">
                        {discountAmount > 0 ? `−${formatRub(discountAmount)}` : 'Недостаточная сумма'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removePromo();
                        setPromoFeedback(null);
                      }}
                      aria-label="Удалить промокод"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-transparent border border-black/12 text-[#0B0B0B]/65 transition-colors hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <form onSubmit={handlePromoSubmit} className="flex items-center gap-2">
                      <label htmlFor="cart-promo-input" className="sr-only">
                        Промокод
                      </label>
                      <input
                        id="cart-promo-input"
                        type="text"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value);
                          if (promoFeedback) setPromoFeedback(null);
                        }}
                        placeholder="Промокод"
                        autoComplete="off"
                        className="acrylic-input h-9 flex-1 min-w-0 rounded-full border border-black/12 px-3.5 text-xs font-medium uppercase tracking-[0.06em] text-[#0B0B0B] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#0B0B0B]/40"
                      />
                      <button
                        type="submit"
                        disabled={promoLoading}
                        className="h-9 shrink-0 rounded-full border border-black/15 bg-white/85 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] transition-all duration-200 hover:border-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95 disabled:opacity-50"
                      >
                        {promoLoading ? '...' : 'Применить'}
                      </button>
                    </form>

                    {promoFeedback ? (
                      <p
                        className={`mt-2 text-[11px] font-medium animate-optical-roll-in ${
                          promoFeedback.ok ? 'text-[#0B0B0B]' : 'text-[#B42318]'
                        }`}
                      >
                        {promoFeedback.message}
                      </p>
                    ) : suggestedPromo ? (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[10px] font-medium text-[#0B0B0B]/50">
                        <span>Промокод:</span>
                        <button
                          type="button"
                          onClick={handleQuickApplyDemoPromo}
                          className="rounded-full border border-black/12 bg-white/75 px-2 py-0.5 font-bold uppercase tracking-[0.06em] text-[#0B0B0B] transition-colors hover:border-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95"
                        >
                          {suggestedPromo.code}
                        </button>
                        <span>
                          (
                          {suggestedPromo.type === 'percent'
                            ? `−${suggestedPromo.value}%`
                            : `−${formatRub(suggestedPromo.value)}`}
                          )
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Summary Footer */}
        {items.length > 0 && (
          <div className="relative z-10 border-t border-black/10 bg-white/58 backdrop-blur-md px-5 sm:px-6 pt-4 pb-5">
            <div className="space-y-1.5 text-xs mb-4">
              <div className="flex items-center justify-between text-[#0B0B0B]/65">
                <span>Товары ({totalItems})</span>
                <span className="inline-flex overflow-hidden">
                  <span
                    key={subtotal}
                    className="animate-optical-roll-in font-semibold text-[#0B0B0B] tabular-nums"
                  >
                    {formatRub(subtotal)}
                  </span>
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-[#0B0B0B]/65 animate-optical-roll-in">
                  <span>Скидка ({promoCode})</span>
                  <span className="font-semibold text-[#0B0B0B] tabular-nums">
                    −{formatRub(discountAmount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[#0B0B0B]/65">
                <span>Доставка</span>
                <span className="font-medium text-[#0B0B0B]">
                  {freeDeliveryRemaining === 0 ? 'Бесплатно' : 'На шаге оформления'}
                </span>
              </div>

              <div className="flex items-baseline justify-between border-t border-black/10 pt-2.5 mt-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/65">
                  ИТОГО
                </span>
                <span className="inline-flex overflow-hidden">
                  <span
                    key={discountedSubtotal}
                    className="animate-optical-roll-in font-display text-lg font-extrabold text-[#0B0B0B] tabular-nums"
                  >
                    {formatRub(discountedSubtotal)}
                  </span>
                </span>
              </div>
            </div>

            <OpticalButton
              variant="dark"
              onClick={openCheckout}
              rollingLabel={`Оформить заказ · ${formatRub(discountedSubtotal)}`}
              trailingIcon={
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
              }
              className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
            />
          </div>
        )}
      </aside>
    </div>
  );
}
