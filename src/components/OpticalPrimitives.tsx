import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import gsap from 'gsap';

/**
 * Shared scroll velocity updated by Lenis in App.tsx so FrostedSpecTicker
 * reacts smoothly to scroll momentum without React re-renders.
 */
export const lenisScrollState = {
  velocity: 0,
};

/**
 * Observes whether a section/container is inside or near the viewport so
 * off-screen ambient animations and ticker writes can pause cleanly.
 */
export function useInViewport<T extends HTMLElement>(
  ref: RefObject<T | null>,
  rootMargin = '180px',
): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setInView(entry.isIntersecting);
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}

export interface SpecularPointerOptions {
  magnetic?: boolean;
  strength?: number;
}

/**
 * Tracks pointer coordinates into `--mx` / `--my` CSS variables with cached
 * bounding rect + rAF coalescing (zero per-mousemove layout reflows), and
 * optionally applies subtle GSAP magnetic pull + tactile press scale.
 */
export function useSpecularPointer<T extends HTMLElement>(
  options: SpecularPointerOptions = {},
) {
  const { magnetic = false, strength = 3.5 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const enableMotion = magnetic && !prefersReduced;
    const xTo = enableMotion
      ? gsap.quickTo(el, 'x', { duration: 0.38, ease: 'power3.out' })
      : null;
    const yTo = enableMotion
      ? gsap.quickTo(el, 'y', { duration: 0.38, ease: 'power3.out' })
      : null;

    let cachedRect: DOMRect | null = null;
    let rafId = 0;
    let pendingClientX = 0;
    let pendingClientY = 0;

    const invalidateRect = () => {
      cachedRect = null;
    };

    const flushMove = () => {
      rafId = 0;
      const rect = cachedRect ?? el.getBoundingClientRect();
      cachedRect = rect;
      if (!rect.width || !rect.height) return;

      const localX = pendingClientX - rect.left;
      const localY = pendingClientY - rect.top;
      el.style.setProperty('--mx', `${localX.toFixed(1)}px`);
      el.style.setProperty('--my', `${localY.toFixed(1)}px`);

      if (xTo && yTo) {
        const nx = (localX / rect.width - 0.5) * 2;
        const ny = (localY / rect.height - 0.5) * 2;
        const clampedX = Math.max(-strength, Math.min(strength, nx * strength));
        const clampedY = Math.max(-strength, Math.min(strength, ny * strength));
        xTo(clampedX);
        yTo(clampedY);
      }
    };

    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      cachedRect = el.getBoundingClientRect();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      pendingClientX = e.clientX;
      pendingClientY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(flushMove);
      }
    };

    const onPointerLeave = () => {
      cachedRect = null;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (xTo && yTo) {
        xTo(0);
        yTo(0);
      }
      if (enableMotion) {
        gsap.to(el, {
          scale: 1,
          duration: 0.22,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }
    };

    const onPointerDown = () => {
      if (!enableMotion) return;
      gsap.to(el, {
        scale: 0.97,
        duration: 0.14,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    const onPointerUp = () => {
      if (!enableMotion) return;
      gsap.to(el, {
        scale: 1,
        duration: 0.24,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };

    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerLeave);
    window.addEventListener('scroll', invalidateRect, { passive: true });
    window.addEventListener('resize', invalidateRect, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerLeave);
      window.removeEventListener('scroll', invalidateRect);
      window.removeEventListener('resize', invalidateRect);
      if (enableMotion) {
        gsap.set(el, { clearProps: 'x,y,scale' });
      }
    };
  }, [magnetic, strength]);

  return ref;
}

interface RollingTextProps {
  text: string;
  className?: string;
}

/**
 * Dual-layer optical rolling label that transitions bottom-to-top through a
 * subtle micro-blur on hover/focus of a parent `.optical-trigger`.
 */
export function RollingText({ text, className = '' }: RollingTextProps) {
  return (
    <span className={`btn-roll ${className}`}>
      <span className="btn-roll__inner">
        <span className="btn-roll__primary">{text}</span>
        <span aria-hidden="true" className="btn-roll__clone">
          {text}
        </span>
      </span>
    </span>
  );
}

export type OpticalButtonVariant =
  | 'dark'
  | 'acrylic'
  | 'outline'
  | 'icon-dark'
  | 'icon-light';

interface OpticalButtonBaseProps {
  variant?: OpticalButtonVariant;
  magnetic?: boolean;
  strength?: number;
  rollingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type OpticalButtonAsButton = OpticalButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof OpticalButtonBaseProps> & {
    href?: undefined;
  };

type OpticalButtonAsAnchor = OpticalButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof OpticalButtonBaseProps> & {
    href: string;
  };

export type OpticalButtonProps = OpticalButtonAsButton | OpticalButtonAsAnchor;

const VARIANT_CLASSES: Record<OpticalButtonVariant, string> = {
  dark: 'specular-dark bg-[#0B0B0B] text-[#F6F6F4] border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_28px_-10px_rgba(11,11,11,0.38)]',
  acrylic:
    'specular-light acrylic-light-strong text-[#0B0B0B] hover:border-black/25',
  outline:
    'specular-light bg-white/45 backdrop-blur-md text-[#0B0B0B] border border-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] hover:border-[#0B0B0B]',
  'icon-dark':
    'specular-dark bg-[#0B0B0B] text-[#F6F6F4] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  'icon-light':
    'specular-light acrylic-light-strong text-[#0B0B0B] hover:border-black/25',
};

/**
 * Unified button/link primitive with cursor-tracked specular sheen, subtle
 * GSAP magnetic inertia, tactile press compression, and optical rolling text.
 */
export function OpticalButton(props: OpticalButtonProps) {
  const {
    variant = 'dark',
    magnetic = true,
    strength = 3.5,
    rollingLabel,
    leadingIcon,
    trailingIcon,
    className = '',
    children,
    ...rest
  } = props;

  const buttonRef = useSpecularPointer<HTMLButtonElement>({ magnetic, strength });
  const anchorRef = useSpecularPointer<HTMLAnchorElement>({ magnetic, strength });

  const composedClass = `optical-trigger group relative inline-flex items-center justify-center rounded-full transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${VARIANT_CLASSES[variant]} ${className}`;

  const content = (
    <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
      {leadingIcon}
      {rollingLabel ? <RollingText text={rollingLabel} /> : children}
      {trailingIcon}
    </span>
  );

  if (typeof rest.href === 'string') {
    const anchorProps = rest as Omit<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof OpticalButtonBaseProps
    > & { href: string };
    return (
      <a ref={anchorRef} className={composedClass} {...anchorProps}>
        {content}
      </a>
    );
  }

  const buttonProps = rest as Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof OpticalButtonBaseProps
  >;

  return (
    <button
      ref={buttonRef}
      type={buttonProps.type ?? 'button'}
      className={composedClass}
      {...buttonProps}
    >
      {content}
    </button>
  );
}

const ARCHIVE_SPECS = [
  '480 GSM HEAVY FLEECE',
  'LIMITED DROPS',
  'MOSCOW ARCHIVE',
  'ARCHITECTURAL MONOCHROME',
  'UNISEX FIT',
  'DROP 2026',
];

/**
 * Slim 30px frosted acrylic divider ribbon that drifts continuously while
 * in-viewport using a cached track width (zero per-frame layout reflows).
 */
export function FrostedSpecTicker({ items }: { items?: string[] }) {
  const specs = items && items.length > 0 ? items : ARCHIVE_SPECS;
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let halfWidth = track.scrollWidth / 2;
    let isVisible = true;
    let offset = 0;
    let smoothedBoost = 0;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        halfWidth = track.scrollWidth / 2;
      });
      resizeObserver.observe(track);
    }

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) isVisible = entry.isIntersecting;
        },
        { rootMargin: '120px' },
      );
      io.observe(container);
    }

    const tick = (_time: number, deltaTime: number) => {
      if (!isVisible || !halfWidth) return;

      const dtFactor = Math.min(2.5, Math.max(0.5, deltaTime / 16.667));
      const targetBoost = Math.max(-3.8, Math.min(3.8, lenisScrollState.velocity * 0.14));
      smoothedBoost += (targetBoost - smoothedBoost) * 0.12;

      offset -= (0.42 + Math.abs(smoothedBoost) * 0.55 + smoothedBoost * 0.35) * dtFactor;
      if (offset <= -halfWidth) {
        offset += halfWidth;
      } else if (offset > 0) {
        offset -= halfWidth;
      }

      track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      resizeObserver?.disconnect();
      io?.disconnect();
    };
  }, [specs]);

  const renderGroup = (suffix: string) => (
    <div className="flex shrink-0 items-center">
      {specs.map((spec, idx) => (
        <span
          key={`${suffix}-${idx}`}
          className="inline-flex items-center gap-5 px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/60 whitespace-nowrap"
        >
          <span>{spec}</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#0B0B0B]/28" />
        </span>
      ))}
    </div>
  );

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ contain: 'layout paint style' }}
      className="relative z-10 h-[30px] w-full overflow-hidden border-y border-black/[0.07] bg-white/58 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] flex items-center select-none"
    >
      <div ref={trackRef} className="flex w-max items-center will-change-transform">
        {renderGroup('a')}
        {renderGroup('b')}
      </div>
    </div>
  );
}
