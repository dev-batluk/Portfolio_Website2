import { Fragment, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowDown } from 'lucide-react';
import { HERO_VARIANTS } from '../data/products';
import { OpticalButton, useInViewport } from './OpticalPrimitives';

interface HeroProps {
  onScrollToBestsellers: () => void;
}

const BRAND_LETTERS = 'NEVERMIND'.split('');

export function Hero({ onScrollToBestsellers }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const modelWrapRef = useRef<HTMLDivElement>(null);
  const titleWrapRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cornerLeftRef = useRef<HTMLDivElement>(null);
  const cornerRightRef = useRef<HTMLDivElement>(null);
  const cursorBadgeRef = useRef<HTMLDivElement>(null);
  const badgeQuickRef = useRef<{
    x: gsap.QuickToFunc;
    y: gsap.QuickToFunc;
  } | null>(null);
  const stageRectRef = useRef<DOMRect | null>(null);
  const lastPointerMoveRef = useRef<number>(Date.now());
  const lastShimmerRef = useRef<number>(0);
  const shimmerTlRef = useRef<gsap.core.Timeline | null>(null);

  const inView = useInViewport(sectionRef, '120px');
  const inViewRef = useRef(inView);
  inViewRef.current = inView;

  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isHoveringModel, setIsHoveringModel] = useState(false);

  const activeVariant = HERO_VARIANTS[activeVariantIdx];

  // Choreographed entrance: Model sweeps in first, then NEVERMIND reveals behind it, then corner UI
  useEffect(() => {
    const ctx = gsap.context(() => {
      const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];

      gsap.set(modelWrapRef.current, { opacity: 0, y: 42, scale: 0.96 });
      gsap.set(letters, { yPercent: 110, opacity: 0 });
      gsap.set([cornerLeftRef.current, cornerRightRef.current], { opacity: 0, y: 20 });

      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

      tl.to(modelWrapRef.current, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.78,
      })
        .to(
          letters,
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.85,
            ease: 'expo.out',
            stagger: { amount: 0.28, from: 'center' },
          },
          0.32,
        )
        .to(
          [cornerLeftRef.current, cornerRightRef.current],
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.1,
          },
          0.62,
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Gentle auto-cycle on touch/mobile screens until the user taps a swatch or the model
  useEffect(() => {
    if (hasUserInteracted) return;
    const isTouchDevice =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none), (max-width: 1023px)').matches;
    if (!isTouchDevice) return;

    const timer = window.setInterval(() => {
      if (!inViewRef.current) return;
      setActiveVariantIdx((prev) => (prev + 1) % HERO_VARIANTS.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [hasUserInteracted]);

  // Smooth 60fps mouse-reactive distortion + parallax with cached geometry (zero per-move reflows)
  useEffect(() => {
    const section = sectionRef.current;
    const titleWrap = titleWrapRef.current;
    const modelWrap = modelWrapRef.current;
    if (!section || !titleWrap || !modelWrap) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const titleX = gsap.quickTo(titleWrap, 'x', { duration: 0.6, ease: 'power3.out' });
    const titleY = gsap.quickTo(titleWrap, 'y', { duration: 0.6, ease: 'power3.out' });
    const modelX = gsap.quickTo(modelWrap, 'x', { duration: 0.75, ease: 'power3.out' });

    if (cursorBadgeRef.current) {
      badgeQuickRef.current = {
        x: gsap.quickTo(cursorBadgeRef.current, 'x', { duration: 0.28, ease: 'power3.out' }),
        y: gsap.quickTo(cursorBadgeRef.current, 'y', { duration: 0.28, ease: 'power3.out' }),
      };
    }

    const letterQuick = letterRefs.current.map((el) => {
      if (!el) return null;
      return {
        y: gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' }),
        scaleY: gsap.quickTo(el, 'scaleY', { duration: 0.45, ease: 'power3.out' }),
        scaleX: gsap.quickTo(el, 'scaleX', { duration: 0.45, ease: 'power3.out' }),
        skewX: gsap.quickTo(el, 'skewX', { duration: 0.45, ease: 'power3.out' }),
      };
    });

    let cachedSectionRect: DOMRect | null = null;
    let cachedLetterCenters: number[] = [];
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;

    const refreshGeometry = () => {
      cachedSectionRect = section.getBoundingClientRect();
      cachedLetterCenters = letterRefs.current.map((el) => {
        if (!el) return 0;
        const lRect = el.getBoundingClientRect();
        return lRect.left + lRect.width / 2;
      });
    };

    refreshGeometry();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(refreshGeometry);
      resizeObserver.observe(section);
    }

    const flushPointerMove = () => {
      rafId = 0;
      if (!cachedSectionRect || cachedLetterCenters.length === 0) {
        refreshGeometry();
      }
      const rect = cachedSectionRect;
      if (!rect || !rect.width || !rect.height) return;

      const nx = ((pendingX - rect.left) / rect.width) * 2 - 1;
      const ny = ((pendingY - rect.top) / rect.height) * 2 - 1;

      titleX(-nx * 28);
      titleY(-ny * 12);
      modelX(nx * 10);

      const invSpan = 1 / (rect.width * 0.24);
      const len = letterRefs.current.length;
      for (let idx = 0; idx < len; idx += 1) {
        const q = letterQuick[idx];
        if (!q) continue;
        const dist = (pendingX - cachedLetterCenters[idx]) * invSpan;
        const proximity = Math.max(0, 1 - Math.abs(dist));

        q.y(-proximity * 10 * (ny >= 0 ? 1 : -0.6));
        q.scaleY(1 + proximity * 0.11);
        q.scaleX(1 - proximity * 0.045);
        q.skewX(Math.max(-7, Math.min(7, dist * -4.5 * proximity)));
      }
    };

    const handlePointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      refreshGeometry();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      lastPointerMoveRef.current = Date.now();

      if (shimmerTlRef.current) {
        shimmerTlRef.current.kill();
        shimmerTlRef.current = null;
        const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];
        gsap.set(letters, { clearProps: 'color,textShadow' });
      }

      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(flushPointerMove);
      }
    };

    const handlePointerLeave = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      titleX(0);
      titleY(0);
      modelX(0);
      letterQuick.forEach((q) => {
        if (!q) return;
        q.y(0);
        q.scaleY(1);
        q.scaleX(1);
        q.skewX(0);
      });
    };

    // Idle silver light wave across NEVERMIND letters after >= 3.5s of cursor rest (every ~7.5s)
    const idleInterval = window.setInterval(() => {
      if (!inViewRef.current) return;
      const now = Date.now();
      if (
        document.visibilityState !== 'visible' ||
        now - lastPointerMoveRef.current < 3500 ||
        now - lastShimmerRef.current < 7500
      ) {
        return;
      }
      const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];
      if (!letters.length) return;

      lastShimmerRef.current = now;
      shimmerTlRef.current?.kill();

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(letters, { clearProps: 'color,textShadow' });
          shimmerTlRef.current = null;
        },
      });

      tl.to(letters, {
        color: '#575753',
        textShadow: '0 0 22px rgba(255, 255, 255, 0.72)',
        y: -2.5,
        duration: 0.36,
        stagger: 0.055,
        ease: 'sine.inOut',
      }).to(
        letters,
        {
          color: '#0D0D0D',
          textShadow: '0 0 0px rgba(255, 255, 255, 0)',
          y: 0,
          duration: 0.44,
          stagger: 0.055,
          ease: 'sine.out',
        },
        0.28,
      );

      shimmerTlRef.current = tl;
    }, 1500);

    section.addEventListener('pointerenter', handlePointerEnter);
    section.addEventListener('pointermove', handlePointerMove);
    section.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('resize', refreshGeometry, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.clearInterval(idleInterval);
      shimmerTlRef.current?.kill();
      badgeQuickRef.current = null;
      resizeObserver?.disconnect();
      section.removeEventListener('pointerenter', handlePointerEnter);
      section.removeEventListener('pointermove', handlePointerMove);
      section.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', refreshGeometry);
    };
  }, []);

  const selectVariant = (idx: number) => {
    setHasUserInteracted(true);
    setActiveVariantIdx(idx);
  };

  const handleModelTap = () => {
    setHasUserInteracted(true);
    setActiveVariantIdx((prev) => (prev + 1) % HERO_VARIANTS.length);
  };

  const handleModelZoneEnter = () => {
    setIsHoveringModel(true);
    stageRectRef.current = modelWrapRef.current?.getBoundingClientRect() ?? null;
  };

  const handleModelZoneLeave = () => {
    setIsHoveringModel(false);
    stageRectRef.current = null;
  };

  const handleModelZonePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const quick = badgeQuickRef.current;
    if (!quick) return;

    const rect = stageRectRef.current ?? modelWrapRef.current?.getBoundingClientRect() ?? null;
    if (!rect) return;
    stageRectRef.current = rect;

    quick.x(e.clientX - rect.left + 16);
    quick.y(e.clientY - rect.top - 24);
  };

  return (
    <section
      id="hero"
      ref={sectionRef}
      data-inview={inView ? 'true' : 'false'}
      className="studio-backdrop relative min-h-[100svh] lg:h-[100svh] w-full overflow-hidden pt-16 sm:pt-[72px] pb-5 sm:pb-8 flex flex-col justify-between select-none"
    >
      {/* Adaptive Studio Backlight & Subtle Drifting Ambient Orbs (pre-softened gradients, 0ms blur cost) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          style={{
            background: `radial-gradient(circle, ${
              activeVariant.id === 'chalk-white'
                ? 'rgba(255, 255, 255, 0.88)'
                : `${activeVariant.hex}38`
            } 0%, ${activeVariant.hex}14 42%, transparent 72%)`,
          }}
          className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 h-[66vh] w-[66vh] max-w-[740px] max-h-[740px] rounded-full opacity-90 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        />
        <div className="studio-orb-dark animate-studio-drift-a absolute -bottom-24 right-[6%] h-96 w-96 rounded-full" />
      </div>

      {/* Center Stage: Monumental NEVERMIND behind pixel-aligned hoverable model */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center w-full max-w-[1600px] mx-auto px-3 sm:px-8 pt-2">
        {/* Background Monumental Wordmark with Optical Depth-of-Field blur on model hover */}
        <div
          ref={titleWrapRef}
          aria-label="NEVERMIND"
          className="pointer-events-none absolute inset-x-0 top-[29%] sm:top-[44%] -translate-y-1/2 z-10 flex items-center justify-center overflow-hidden px-2"
        >
          <h1
            className={`font-display font-black uppercase text-[#0D0D0D] tracking-[-0.04em] leading-[0.88] text-[clamp(3.25rem,17.2vw,4.6rem)] sm:text-[clamp(3.8rem,9.5vw,11.2rem)] flex flex-wrap sm:flex-nowrap items-baseline justify-center sm:whitespace-nowrap transition-[filter,opacity,transform] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
              isHoveringModel ? 'blur-[2.5px] opacity-85 scale-[0.992]' : 'blur-0 opacity-100 scale-100'
            }`}
          >
            {BRAND_LETTERS.map((char, idx) => (
              <Fragment key={`${char}-${idx}`}>
                <span
                  ref={(el) => {
                    letterRefs.current[idx] = el;
                  }}
                  className="inline-block will-change-transform origin-bottom"
                >
                  {char}
                </span>
                {idx === 4 && <span aria-hidden="true" className="basis-full h-0 sm:hidden" />}
              </Fragment>
            ))}
          </h1>
        </div>

        {/* Foreground Model Cutout with 3-Color Hover Zones */}
        <div
          ref={modelWrapRef}
          className="relative z-20 flex flex-col items-center justify-end h-[50vh] sm:h-[62vh] lg:h-[71vh] w-full max-w-[400px] sm:max-w-[480px] lg:max-w-[530px]"
        >
          {/* Dual-Layer Studio Floor Shadow (pure CSS radial gradients, 0ms blur) */}
          <div
            aria-hidden="true"
            className="floor-shadow-contact pointer-events-none absolute bottom-1 h-4 w-[44%] rounded-full"
          />
          <div
            aria-hidden="true"
            className="floor-shadow-ambient pointer-events-none absolute -bottom-1 h-12 w-[78%] rounded-full"
          />

          {/* Floating Frosted Acrylic Cursor Badge (Desktop) */}
          <div
            ref={cursorBadgeRef}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 z-40 hidden lg:block will-change-transform"
          >
            <div
              className={`acrylic-light-strong inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B] whitespace-nowrap transition-[opacity,transform,filter] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                isHoveringModel
                  ? 'opacity-100 scale-100 blur-0'
                  : 'opacity-0 scale-95 blur-[3px]'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0"
                style={{ backgroundColor: activeVariant.hex }}
              />
              <span>
                {activeVariant.index} / 03 · {activeVariant.colorName}
              </span>
            </div>
          </div>

          {/* Pixel-aligned model layers with blur-morph transition */}
          <div
            onClick={handleModelTap}
            className="relative h-full w-full flex items-end justify-center cursor-pointer lg:cursor-default"
          >
            {HERO_VARIANTS.map((variant, idx) => {
              const isActive = activeVariantIdx === idx;
              return (
                <img
                  key={variant.id}
                  src={variant.image}
                  alt={`Модель NEVERMIND — ${variant.colorName}`}
                  loading="eager"
                  decoding="async"
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                  draggable={false}
                  className={`absolute inset-0 h-full w-full object-contain object-bottom transition-[opacity,transform,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                    isActive
                      ? 'cutout-shadow opacity-100 scale-100 blur-0'
                      : 'opacity-0 scale-[0.988] blur-[4px] pointer-events-none'
                  }`}
                />
              );
            })}

            {/* Desktop 3 interactive hover zones directly over the model */}
            <div
              onMouseEnter={handleModelZoneEnter}
              onMouseLeave={handleModelZoneLeave}
              onPointerMove={handleModelZonePointerMove}
              className="hidden lg:grid grid-cols-3 absolute inset-x-[12%] inset-y-[4%] z-30"
            >
              {HERO_VARIANTS.map((variant, idx) => (
                <div
                  key={variant.id}
                  onMouseEnter={() => selectVariant(idx)}
                  aria-label={`Выбрать цвет: ${variant.colorName}`}
                  className="h-full w-full cursor-ew-resize"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Corner UI */}
      <div className="relative z-30 mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-5 pt-2">
        {/* Bottom-Left: Minimalist manifesto + single unified Optical CTA button */}
        <div ref={cornerLeftRef} className="max-w-[360px]">
          <p className="text-xs sm:text-[13px] font-medium leading-[1.55] text-[#0B0B0B]/78 mb-3.5 sm:mb-4">
            Индустриальный минимализм и тяжёлый трикотаж без компромиссов. Выверенные формы,
            честная фактура и характер в каждой детали.
          </p>

          <OpticalButton
            variant="dark"
            onClick={onScrollToBestsellers}
            rollingLabel="К бестселлерам"
            trailingIcon={
              <ArrowDown className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0.5" />
            }
            className="h-11 sm:h-12 px-6 sm:px-7 text-xs sm:text-[13px] font-semibold tracking-[0.03em]"
          />
        </div>

        {/* Bottom-Right: Frosted Acrylic Swatch Lens */}
        <div
          ref={cornerRightRef}
          className="acrylic-light-strong flex items-center justify-between sm:justify-start gap-4 rounded-2xl p-2.5 pr-4"
        >
          <div className="relative h-12 w-10 sm:h-14 sm:w-12 rounded-xl bg-[#F0F0ED]/80 border border-black/[0.06] overflow-hidden shrink-0 flex items-end justify-center">
            {HERO_VARIANTS.map((variant, idx) => (
              <img
                key={variant.id}
                src={variant.image}
                alt=""
                decoding="async"
                draggable={false}
                className={`absolute inset-0 h-full w-full object-contain object-bottom scale-125 translate-y-1 transition-[opacity,filter] duration-320 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
                  activeVariantIdx === idx ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px]'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/55">
              <span className="tabular-nums">{activeVariant.index} / 03</span>
              <span>·</span>
              <span className="inline-flex overflow-hidden">
                <span
                  key={activeVariant.id}
                  className="animate-optical-roll-in inline-block text-[#0B0B0B]"
                >
                  {activeVariant.label}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {HERO_VARIANTS.map((variant, idx) => {
                const selected = idx === activeVariantIdx;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => selectVariant(idx)}
                    aria-label={`Показать цвет ${variant.colorName}`}
                    aria-pressed={selected}
                    className={`relative h-5 w-5 rounded-full border transition-all duration-300 ${
                      selected
                        ? 'scale-110 border-[#0B0B0B] ring-2 ring-[#0B0B0B]/20'
                        : 'border-black/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: variant.hex }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
