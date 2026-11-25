import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { BESTSELLERS, type BaseProduct, type BestsellerItem } from '../data/products';
import {
  OpticalButton,
  useInViewport,
  useSpecularPointer,
} from './OpticalPrimitives';

gsap.registerPlugin(ScrollTrigger);

interface BestsellersProps {
  onQuickView: (product: BaseProduct, initialSize?: string) => void;
  onScrollToY: (y: number) => void;
}

const SLIDE_SNAP_SCROLL_FACTORS = [0.02, 0.37, 0.69, 0.98];
const DESKTOP_SCROLL_VH = 1.4;

// 2 clones on each side for seamless peeking loop without empty edges: [bs3, bs4, bs1, bs2, bs3, bs4, bs1, bs2]
const MOBILE_SLIDES: BestsellerItem[] = [
  BESTSELLERS[BESTSELLERS.length - 2],
  BESTSELLERS[BESTSELLERS.length - 1],
  ...BESTSELLERS,
  BESTSELLERS[0],
  BESTSELLERS[1],
];
const MOBILE_BASE_IDX = 2;
const MOBILE_SLIDE_WIDTH_PCT = 62;
const MOBILE_CENTER_OFFSET_PCT = (100 - MOBILE_SLIDE_WIDTH_PCT) / 2; // 19%

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export function Bestsellers({ onQuickView, onScrollToY }: BestsellersProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const stickyStageRef = useRef<HTMLDivElement>(null);
  const stageInnerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const infoCardRef = useRef<HTMLDivElement>(null);
  const infoCardContentRef = useRef<HTMLDivElement>(null);
  const bgIndexRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const dimOverlayRef = useRef<HTMLDivElement>(null);
  const mobileViewportRef = useRef<HTMLDivElement>(null);

  const infoCardSpecularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const isDesktop = useIsDesktop();
  const inView = useInViewport(sectionRef, '200px');

  const [desktopActiveIdx, setDesktopActiveIdx] = useState(0);
  const [desktopHoverModel, setDesktopHoverModel] = useState(false);

  // Mobile infinite peeking carousel state (indices 2..5 map to BESTSELLERS 0..3)
  const [mobileTrackIdx, setMobileTrackIdx] = useState(MOBILE_BASE_IDX);
  const [mobileAnimate, setMobileAnimate] = useState(true);
  const [mobileShowModel, setMobileShowModel] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);

  const lastDesktopIdxRef = useRef(0);
  const suppressClickRef = useRef(false);

  const activeBestseller = BESTSELLERS[desktopActiveIdx];

  const realMobileIdx =
    (((mobileTrackIdx - MOBILE_BASE_IDX) % BESTSELLERS.length) + BESTSELLERS.length) %
    BESTSELLERS.length;
  const activeMobileItem = BESTSELLERS[realMobileIdx];

  // Refresh ScrollTrigger whenever viewport switches across the 1024px breakpoint
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(raf);
  }, [isDesktop]);

  // Desktop GSAP horizontal scrub + decoupled inner content blur + uniform progress fill + Catalog overlap
  useEffect(() => {
    if (!isDesktop) return;

    const ctx = gsap.context(() => {
      const wrapper = desktopWrapperRef.current;
      const track = trackRef.current;
      const infoCard = infoCardRef.current;
      const infoCardContent = infoCardContentRef.current;
      const bgIndex = bgIndexRef.current;
      const progressBar = progressBarRef.current;
      const stageInner = stageInnerRef.current;
      const dimOverlay = dimOverlayRef.current;

      if (!wrapper || !track || !infoCard || !infoCardContent || !stageInner || !dimOverlay) {
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: () => `+=${window.innerHeight * DESKTOP_SCROLL_VH}`,
          scrub: 0.25,
          invalidateOnRefresh: true,
          onUpdate: () => {
            const currentXPercent = Number(gsap.getProperty(track, 'xPercent')) || 0;
            const visualPos = Math.max(0, Math.min(3, -currentXPercent / 25));

            if (progressBar) {
              const uniformFill = 0.25 + (visualPos / 3) * 0.75;
              progressBar.style.transform = `scaleX(${Math.max(0.25, Math.min(1, uniformFill)).toFixed(4)})`;
            }

            if (bgIndex) {
              bgIndex.style.transform = `translate3d(${(visualPos * -28).toFixed(1)}px, ${(visualPos * -14).toFixed(1)}px, 0)`;
            }

            const nearest = Math.round(visualPos);
            const distFromCenter = Math.abs(visualPos - nearest);

            // Pause garment levitation during slide motion so animations never fight scroll
            stageInner.dataset.moving = distFromCenter > 0.03 ? 'true' : 'false';

            // Outer .acrylic-light card animates ONLY compositor-friendly opacity + transform
            const opacityVal = Math.max(0.22, 1 - distFromCenter * 1.52);
            const shiftY = distFromCenter * 14;
            infoCard.style.opacity = opacityVal.toFixed(3);
            infoCard.style.transform = `translate3d(0, ${shiftY.toFixed(1)}px, 0)`;

            // Inner content receives transition blur so backdrop-filter on the glass shell stays cached
            const blurPx = Math.min(6, distFromCenter * 14);
            infoCardContent.style.filter = blurPx < 0.15 ? 'none' : `blur(${blurPx.toFixed(2)}px)`;

            if (nearest !== lastDesktopIdxRef.current) {
              lastDesktopIdxRef.current = nearest;
              setDesktopActiveIdx(nearest);
              setDesktopHoverModel(false);
            }
          },
        },
      });

      tl.set(track, { xPercent: 0 })
        .to(track, { xPercent: 0, duration: 0.06, ease: 'none' })
        .to(track, { xPercent: -25, duration: 0.27, ease: 'power2.inOut' })
        .to(track, { xPercent: -25, duration: 0.06, ease: 'none' })
        .to(track, { xPercent: -50, duration: 0.27, ease: 'power2.inOut' })
        .to(track, { xPercent: -50, duration: 0.06, ease: 'none' })
        .to(track, { xPercent: -75, duration: 0.22, ease: 'power2.inOut' })
        .to(track, { xPercent: -75, duration: 0.06, ease: 'none' });

      const catalogEl = document.getElementById('catalog');
      if (catalogEl) {
        gsap.fromTo(
          stageInner,
          { yPercent: 0, scale: 1 },
          {
            yPercent: -15,
            scale: 0.94,
            ease: 'none',
            scrollTrigger: {
              trigger: catalogEl,
              start: 'top bottom',
              end: 'top top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );

        gsap.fromTo(
          dimOverlay,
          { opacity: 0 },
          {
            opacity: 0.82,
            ease: 'none',
            scrollTrigger: {
              trigger: catalogEl,
              start: 'top bottom',
              end: 'top top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      }
    }, desktopWrapperRef);

    return () => ctx.revert();
  }, [isDesktop]);

  const jumpToDesktopSlide = (idx: number) => {
    const wrapper = desktopWrapperRef.current;
    if (!wrapper) return;
    const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
    const targetY =
      wrapperTop + window.innerHeight * DESKTOP_SCROLL_VH * SLIDE_SNAP_SCROLL_FACTORS[idx];
    onScrollToY(targetY);
  };

  // Mobile infinite carousel controls
  const goToMobileRealIndex = (realIdx: number) => {
    setMobileShowModel(false);
    setMobileAnimate(true);
    setMobileTrackIdx(MOBILE_BASE_IDX + realIdx);
  };

  const handleMobileStep = (dir: 1 | -1) => {
    setMobileShowModel(false);
    setMobileAnimate(true);
    setMobileTrackIdx((prev) => {
      const safeBase =
        prev <= 0
          ? prev + BESTSELLERS.length
          : prev >= MOBILE_SLIDES.length - 1
            ? prev - BESTSELLERS.length
            : prev;
      return Math.max(0, Math.min(MOBILE_SLIDES.length - 1, safeBase + dir));
    });
  };

  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
    if (mobileTrackIdx < MOBILE_BASE_IDX) {
      setMobileAnimate(false);
      setMobileTrackIdx((prev) => prev + BESTSELLERS.length);
    } else if (mobileTrackIdx >= MOBILE_BASE_IDX + BESTSELLERS.length) {
      setMobileAnimate(false);
      setMobileTrackIdx((prev) => prev - BESTSELLERS.length);
    }
  };

  // Re-enable CSS transition right after silent wrap
  useEffect(() => {
    if (mobileAnimate) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileAnimate(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [mobileAnimate]);

  // Native non-passive touch swipe + mouse drag physics on mobile carousel
  const stepRef = useRef(handleMobileStep);
  stepRef.current = handleMobileStep;

  useEffect(() => {
    if (isDesktop) return;
    const viewport = mobileViewportRef.current;
    if (!viewport) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lock: 'none' | 'horizontal' | 'vertical' = 'none';
    let isMouseDragging = false;
    let currentDx = 0;

    const resetDrag = () => {
      lock = 'none';
      isMouseDragging = false;
      currentDx = 0;
      setDragOffsetPx(0);
    };

    const finishSwipe = (dx: number) => {
      const elapsed = Math.max(1, Date.now() - startTime);
      const velocity = Math.abs(dx) / elapsed;
      if (Math.abs(dx) > 40 || (Math.abs(dx) > 16 && velocity > 0.35)) {
        suppressClickRef.current = true;
        stepRef.current(dx < 0 ? 1 : -1);
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }
      resetDrag();
    };

    const onTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('button[data-arrow]')) return;
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      lock = 'none';
      currentDx = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (lock === 'none') {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          lock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        }
      }

      if (lock === 'horizontal') {
        e.preventDefault();
        currentDx = dx;
        setDragOffsetPx(dx);
      }
    };

    const onTouchEnd = () => {
      if (lock === 'horizontal') {
        finishSwipe(currentDx);
      } else {
        resetDrag();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button[data-arrow]')) return;
      isMouseDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTime = Date.now();
      lock = 'horizontal';
      currentDx = 0;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        currentDx = dx;
        setDragOffsetPx(dx);
      }
    };

    const onMouseUp = () => {
      if (!isMouseDragging) return;
      if (Math.abs(currentDx) > 8) {
        finishSwipe(currentDx);
      } else {
        resetDrag();
      }
    };

    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', resetDrag, { passive: true });
    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', resetDrag);
      viewport.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDesktop]);

  return (
    <section
      id="bestsellers"
      ref={sectionRef}
      data-inview={inView ? 'true' : 'false'}
      className="relative bg-[#F6F6F4]"
    >
      {isDesktop ? (
        /* ================= DESKTOP PINNED STAGE (Asymmetric 2-col) ================= */
        <div ref={desktopWrapperRef} className="relative h-[340vh]">
          <div
            ref={stickyStageRef}
            className="sticky top-0 h-screen w-full overflow-hidden bg-[#F6F6F4] z-10"
          >
            {/* Optical Background Refraction Layer (Pre-softened drifting orbs + Parallax Index Watermark) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
              <div className="studio-orb-light animate-studio-drift-a absolute left-[6%] top-[14%] h-[480px] w-[480px] rounded-full" />
              <div className="studio-orb-dark animate-studio-drift-b absolute right-[10%] bottom-[8%] h-[440px] w-[440px] rounded-full" />

              <div
                ref={bgIndexRef}
                className="absolute right-[6%] top-1/2 -translate-y-1/2 will-change-transform select-none"
              >
                <span className="font-display font-black leading-none tracking-[-0.05em] text-[clamp(14rem,25vw,23rem)] text-[#0B0B0B]/[0.045]">
                  0{desktopActiveIdx + 1}
                </span>
              </div>
            </div>

            {/* Dimming overlay controlled by Catalog gliding up */}
            <div
              ref={dimOverlayRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 bg-[#0A0A0A] opacity-0 will-change-[opacity]"
            />

            <div
              ref={stageInnerRef}
              className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] flex-col justify-between px-12 pt-24 pb-10 will-change-transform"
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50">
                    02 / Бестселлеры
                  </span>
                  <span className="h-3 w-px bg-black/15" />
                  <span className="font-display text-sm font-extrabold uppercase tracking-[0.04em] text-[#0B0B0B]">
                    ИЗБРАННЫЕ ПОЗИЦИИ
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  {/* Quick slide indicators */}
                  <div className="flex items-center gap-2">
                    {BESTSELLERS.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => jumpToDesktopSlide(idx)}
                        aria-label={`Перейти к бестселлеру ${idx + 1}: ${item.title}`}
                        className={`h-6 px-2 text-[11px] font-semibold tracking-[0.1em] transition-colors bg-transparent border-0 ${
                          desktopActiveIdx === idx
                            ? 'text-[#0B0B0B] underline underline-offset-4'
                            : 'text-[#0B0B0B]/35 hover:text-[#0B0B0B]/70'
                        }`}
                      >
                        0{idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Progress hairline */}
                  <div className="h-[2px] w-32 bg-black/12 overflow-hidden">
                    <div
                      ref={progressBarRef}
                      style={{ transform: 'scaleX(0.25)' }}
                      className="h-full w-full bg-[#0B0B0B] origin-left will-change-transform"
                    />
                  </div>
                </div>
              </div>

              {/* Asymmetric Two-Column Showcase */}
              <div className="grid flex-1 grid-cols-12 items-center gap-8 min-h-0 py-4">
                {/* LEFT (~58% / 7 cols): Horizontal Garment Track */}
                <div className="col-span-7 relative h-full max-h-[68vh] overflow-hidden flex items-center">
                  {/* Soft studio stage glow pulsing subtly when switching to model */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-[10%] inset-y-[6%] rounded-3xl bg-radial from-white via-[#F1F1EE] to-transparent transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      desktopHoverModel ? 'opacity-100 scale-105' : 'opacity-80 scale-100'
                    }`}
                  />

                  <div
                    ref={trackRef}
                    className="flex h-full w-[400%] shrink-0 items-center will-change-transform"
                  >
                    {BESTSELLERS.map((item, idx) => {
                      const isCurrent = desktopActiveIdx === idx;
                      const showModelNow = desktopHoverModel && isCurrent;
                      return (
                        <div
                          key={item.id}
                          style={{ contain: 'layout style' }}
                          className="relative flex h-full w-1/4 shrink-0 items-center justify-center px-6"
                        >
                          <div className="relative flex h-[min(56vh,540px)] w-[min(100%,540px)] items-center justify-center">
                            {/* Dual-layer floor shadow (pure CSS radial gradients, 0ms blur) */}
                            <div
                              aria-hidden="true"
                              className={`floor-shadow-contact pointer-events-none absolute bottom-2 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                showModelNow
                                  ? 'h-4 w-[50%] opacity-100'
                                  : 'h-3 w-[36%] opacity-70'
                              }`}
                            />
                            <div
                              aria-hidden="true"
                              className={`floor-shadow-ambient pointer-events-none absolute bottom-0 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                showModelNow
                                  ? 'h-10 w-[68%] opacity-100'
                                  : isCurrent
                                    ? 'animate-shadow-breathe h-8 w-[54%]'
                                    : 'h-8 w-[54%] opacity-70'
                              }`}
                            />

                            {/* Normalized garment cutout with gentle passive levitation while idle */}
                            <div
                              className={`absolute inset-0 flex items-center justify-center ${
                                isCurrent && !showModelNow ? 'animate-garment-levitate' : ''
                              }`}
                            >
                              <img
                                src={item.image}
                                alt={item.title}
                                loading="eager"
                                decoding="async"
                                draggable={false}
                                className={`max-h-[84%] max-w-[84%] object-contain transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                                  showModelNow
                                    ? 'opacity-0 scale-95 translate-y-2 blur-[5px]'
                                    : isCurrent
                                      ? 'cutout-shadow opacity-100 scale-100 translate-y-0 blur-0'
                                      : 'opacity-100 scale-100 translate-y-0 blur-0'
                                }`}
                              />
                            </div>

                            {/* Normalized model cutout (grounded, no levitation) */}
                            <img
                              src={item.modelImage}
                              alt={`${item.title} на модели`}
                              loading="eager"
                              decoding="async"
                              draggable={false}
                              className={`absolute inset-0 m-auto max-h-[94%] max-w-[88%] object-contain transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                                showModelNow
                                  ? 'cutout-shadow opacity-100 scale-100 translate-y-0 blur-0'
                                  : 'opacity-0 scale-[1.03] -translate-y-2 blur-[5px] pointer-events-none'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT (~42% / 5 cols): Active Product Frosted Acrylic Card (single "Показать на модели" control) */}
                <div className="col-span-5 flex items-center pl-4 xl:pl-8">
                  <div
                    ref={(el) => {
                      infoCardRef.current = el;
                      infoCardSpecularRef.current = el;
                    }}
                    className="acrylic-light specular-card w-full max-w-[460px] rounded-2xl p-8 xl:p-10 will-change-[opacity,transform]"
                  >
                    <div ref={infoCardContentRef} className="relative z-10">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/50 mb-5">
                        <span>{activeBestseller.tag}</span>
                        <span>{activeBestseller.sku}</span>
                      </div>

                      <h3 className="font-display text-2xl xl:text-[28px] font-extrabold uppercase tracking-[-0.02em] leading-[1.12] text-[#0B0B0B] mb-3">
                        {activeBestseller.title}
                      </h3>

                      <p className="font-display text-lg font-bold text-[#0B0B0B] mb-5">
                        {activeBestseller.priceFormatted}
                      </p>

                      <p className="text-sm leading-[1.65] text-[#0B0B0B]/75 mb-6">
                        {activeBestseller.description}
                      </p>

                      <div className="border-t border-black/10 pt-5 mb-6 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#0B0B0B]/50 uppercase tracking-[0.1em] font-semibold">
                            Крой
                          </span>
                          <span className="font-medium text-[#0B0B0B]">{activeBestseller.fit}</span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-[#0B0B0B]/50 uppercase tracking-[0.1em] font-semibold">
                            Размеры
                          </span>
                          <div className="flex items-center gap-1.5">
                            {activeBestseller.sizes.map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => onQuickView(activeBestseller, size)}
                                aria-label={`Открыть ${activeBestseller.title}, размер ${size}`}
                                className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-black/15 bg-white/55 px-2 text-[11px] font-semibold text-[#0B0B0B] transition-colors duration-200 hover:border-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4]"
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* STRICT HOVER ONLY on desktop ("Показать на модели") + QuickView */}
                      <div className="flex items-center gap-3">
                        <OpticalButton
                          variant={desktopHoverModel ? 'dark' : 'outline'}
                          onMouseEnter={() => setDesktopHoverModel(true)}
                          onMouseLeave={() => setDesktopHoverModel(false)}
                          onFocus={() => setDesktopHoverModel(true)}
                          onBlur={() => setDesktopHoverModel(false)}
                          rollingLabel="Показать на модели"
                          leadingIcon={<Eye className="h-4 w-4 shrink-0" />}
                          className="flex-1 h-12 px-5 text-xs font-semibold uppercase tracking-[0.08em]"
                        />

                        <OpticalButton
                          variant="icon-light"
                          onClick={() => onQuickView(activeBestseller)}
                          aria-label={`Подробнее о ${activeBestseller.title}`}
                          className="h-12 w-12 shrink-0"
                        >
                          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </OpticalButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : (
        /* ================= MOBILE INFINITE PEEKING CAROUSEL (NO PINNING) ================= */
        <div className="relative overflow-hidden border-t border-black/[0.06] py-16 sm:py-20 bg-[#F6F6F4]">
          {/* Pre-Softened Ambient Mobile Studio Light Orbs */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            <div className="studio-orb-light animate-studio-drift-a absolute -left-16 bottom-24 h-72 w-72 rounded-full" />
            <div className="studio-orb-dark animate-studio-drift-b absolute -right-12 bottom-10 h-72 w-72 rounded-full" />
          </div>

          {/* Header */}
          <div className="relative z-10 mx-auto max-w-[460px] px-5 text-center mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-2">
              02 / Бестселлеры
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-[-0.03em] text-[#0B0B0B]">
              ИЗБРАННЫЕ ПОЗИЦИИ
            </h2>
          </div>

          {/* Full-bleed Floating Peeking Garment Viewport */}
          <div
            ref={mobileViewportRef}
            style={{ touchAction: 'pan-y' }}
            className="relative z-10 w-full overflow-hidden py-3 select-none cursor-grab active:cursor-grabbing"
          >
            {/* Floating Frosted Acrylic Side Arrows */}
            <button
              type="button"
              data-arrow="prev"
              onClick={() => handleMobileStep(-1)}
              aria-label="Предыдущая вещь"
              className="acrylic-light-strong absolute left-2.5 top-[54%] -translate-y-1/2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#0B0B0B] transition-transform active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              data-arrow="next"
              onClick={() => handleMobileStep(1)}
              aria-label="Следующая вещь"
              className="acrylic-light-strong absolute right-2.5 top-[54%] -translate-y-1/2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#0B0B0B] transition-transform active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Horizontal Track (62% slide width -> 19% side margin + uniform neighbor peek) */}
            <div
              onTransitionEnd={handleTrackTransitionEnd}
              style={{
                transform: `translate3d(calc(${MOBILE_CENTER_OFFSET_PCT}% - ${mobileTrackIdx * MOBILE_SLIDE_WIDTH_PCT}% + ${dragOffsetPx}px), 0, 0)`,
                transition:
                  mobileAnimate && dragOffsetPx === 0
                    ? 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)'
                    : 'none',
              }}
              className="flex w-full items-center will-change-transform"
            >
              {MOBILE_SLIDES.map((item, slideIndex) => {
                const offset = slideIndex - mobileTrackIdx;
                const isCurrentVisible = offset === 0;
                const showingModel = isCurrentVisible && mobileShowModel;
                const neighborTransformClass =
                  offset <= -1
                    ? 'translate-x-5 scale-[0.82] opacity-75 cursor-pointer'
                    : offset >= 1
                      ? '-translate-x-5 scale-[0.82] opacity-75 cursor-pointer'
                      : 'translate-x-0 scale-100 opacity-100 z-10';

                return (
                  <div
                    key={`${item.id}-${slideIndex}`}
                    style={{ contain: 'layout style' }}
                    onClick={() => {
                      if (suppressClickRef.current) return;
                      if (offset === -1) handleMobileStep(-1);
                      else if (offset === 1) handleMobileStep(1);
                    }}
                    className={`relative w-[62%] shrink-0 transition-all duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] ${neighborTransformClass}`}
                  >
                    <div className="relative h-[280px] sm:h-[330px] w-full flex items-center justify-center">
                      {/* Dual-layer floor shadow (pure CSS radial gradients) */}
                      <div
                        aria-hidden="true"
                        className={`floor-shadow-contact pointer-events-none absolute bottom-1.5 h-3 rounded-full transition-all duration-300 ${
                          isCurrentVisible
                            ? showingModel
                              ? 'w-[50%] opacity-100'
                              : 'w-[38%] opacity-75'
                            : 'w-[32%] opacity-25'
                        }`}
                      />
                      <div
                        aria-hidden="true"
                        className={`floor-shadow-ambient pointer-events-none absolute bottom-0 h-7 w-[66%] rounded-full transition-opacity duration-300 ${
                          isCurrentVisible
                            ? showingModel
                              ? 'opacity-100'
                              : 'animate-shadow-breathe'
                            : 'opacity-35'
                        }`}
                      />

                      {/* Normalized garment cutout */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center ${
                          isCurrentVisible && !showingModel ? 'animate-garment-levitate' : ''
                        }`}
                      >
                        <img
                          src={item.image}
                          alt={item.title}
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          className={`max-h-[86%] max-w-[90%] object-contain transition-[opacity,transform,filter] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                            showingModel
                              ? 'opacity-0 scale-95 blur-[5px]'
                              : isCurrentVisible
                                ? 'cutout-shadow opacity-100 scale-100 blur-0'
                                : 'opacity-100 scale-100 blur-0'
                          }`}
                        />
                      </div>

                      {/* Normalized model cutout */}
                      <img
                        src={item.modelImage}
                        alt={`${item.title} на модели`}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className={`absolute inset-0 m-auto max-h-[96%] max-w-[90%] object-contain transition-[opacity,transform,filter] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                          showingModel
                            ? 'cutout-shadow opacity-100 scale-100 blur-0'
                            : 'opacity-0 scale-105 blur-[5px] pointer-events-none'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Centered Frosted Acrylic Editorial Info Card Below */}
          <div className="relative z-10 px-4 pt-3">
            <div
              className={`acrylic-light mx-auto max-w-[400px] rounded-2xl p-5 sm:p-6 text-center transition-all duration-300 ${
                Math.abs(dragOffsetPx) > 16 ? 'opacity-50 blur-[2px]' : 'opacity-100 blur-0'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-1.5">
                {activeMobileItem.tag} · {activeMobileItem.sku}
              </p>

              <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-[-0.02em] leading-[1.15] text-[#0B0B0B] mb-1.5">
                {activeMobileItem.title}
              </h3>

              <p className="font-display text-sm font-bold text-[#0B0B0B] mb-3">
                {activeMobileItem.priceFormatted}
              </p>

              <p className="text-xs leading-[1.6] text-[#0B0B0B]/72 mb-4">
                {activeMobileItem.description}
              </p>

              {/* Centered clickable sizes */}
              <div className="flex items-center justify-center gap-1.5 mb-5">
                {activeMobileItem.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onQuickView(activeMobileItem, size)}
                    aria-label={`Выбрать ${activeMobileItem.title}, размер ${size}`}
                    className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-black/15 bg-white/75 px-2 text-[11px] font-semibold text-[#0B0B0B] transition-colors active:bg-[#0B0B0B] active:text-[#F6F6F4]"
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Tap toggle button ("Показать на модели") + QuickView */}
              <div className="flex items-center justify-center gap-2.5 mb-5">
                <OpticalButton
                  variant={mobileShowModel ? 'dark' : 'outline'}
                  magnetic={false}
                  onClick={() => setMobileShowModel((prev) => !prev)}
                  leadingIcon={<Eye className="h-4 w-4 shrink-0" />}
                  className="flex-1 max-w-[260px] h-11 px-4 text-xs font-semibold uppercase tracking-[0.06em]"
                >
                  <span>{mobileShowModel ? 'Показать вещь' : 'Показать на модели'}</span>
                </OpticalButton>

                <OpticalButton
                  variant="icon-light"
                  magnetic={false}
                  onClick={() => onQuickView(activeMobileItem)}
                  aria-label={`Подробнее о ${activeMobileItem.title}`}
                  className="h-11 w-11 shrink-0"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </OpticalButton>
              </div>

              {/* Centered pagination dots + counter */}
              <div className="flex items-center justify-center gap-4 border-t border-black/10 pt-4">
                <div className="flex items-center gap-2">
                  {BESTSELLERS.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goToMobileRealIndex(idx)}
                      aria-label={`Показать ${idx + 1} позицию`}
                      className={`h-1.5 rounded-full transition-all duration-300 border-0 p-0 ${
                        realMobileIdx === idx ? 'w-6 bg-[#0B0B0B]' : 'w-1.5 bg-black/20'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/50">
                  0{realMobileIdx + 1} / 04
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
