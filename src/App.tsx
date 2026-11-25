import { useCallback, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Bestsellers } from './components/Bestsellers';
import { Catalog } from './components/Catalog';
import { ContactsFooter } from './components/ContactsFooter';
import { QuickViewModal } from './components/QuickViewModal';
import { lenisScrollState } from './components/OpticalPrimitives';
import type { BaseProduct } from './data/products';

gsap.registerPlugin(ScrollTrigger);

interface QuickViewState {
  product: BaseProduct;
  initialSize?: string;
}

const SECTION_IDS = ['hero', 'about', 'bestsellers', 'catalog', 'contacts'] as const;

export default function App() {
  const lenisRef = useRef<Lenis | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastClearRef = useRef<number | null>(null);
  const activeSectionRef = useRef('hero');
  const isOverDarkRef = useRef(false);

  const [activeSection, setActiveSection] = useState('hero');
  const [isOverDarkFooter, setIsOverDarkFooter] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickViewState, setQuickViewState] = useState<QuickViewState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Initialize Lenis smooth scroll synced cleanly with GSAP ScrollTrigger & ticker velocity
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.08,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', (e) => {
      lenisScrollState.velocity = e.velocity;
      ScrollTrigger.update();
    });

    const tick = (time: number) => {
      lenis.raf(time * 1000);
      if (Math.abs(lenisScrollState.velocity) > 0.01) {
        lenisScrollState.velocity *= 0.88;
      } else if (lenisScrollState.velocity !== 0) {
        lenisScrollState.velocity = 0;
      }
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
      lenisScrollState.velocity = 0;
    };
  }, []);

  // Track active nav section & footer overlap using cached section offsets (zero per-scroll layout reflows)
  useEffect(() => {
    let sectionTops: { id: string; top: number }[] = [];
    let footerTop = Infinity;
    let rafId = 0;

    const measureSectionOffsets = () => {
      const scrollY = window.scrollY;
      sectionTops = SECTION_IDS.flatMap((id) => {
        const el = document.getElementById(id);
        if (!el) return [];
        return [{ id, top: el.getBoundingClientRect().top + scrollY }];
      });

      const footerEl = document.getElementById('footer');
      footerTop = footerEl ? footerEl.getBoundingClientRect().top + scrollY : Infinity;
    };

    const evaluateScroll = () => {
      rafId = 0;
      const probeY = window.scrollY + window.innerHeight * 0.35;
      let current = 'hero';

      for (let i = 0; i < sectionTops.length; i += 1) {
        if (probeY >= sectionTops[i].top) {
          current = sectionTops[i].id;
        }
      }

      if (current !== activeSectionRef.current) {
        activeSectionRef.current = current;
        setActiveSection(current);
      }

      const nextOverDark = footerTop - window.scrollY <= 72;
      if (nextOverDark !== isOverDarkRef.current) {
        isOverDarkRef.current = nextOverDark;
        setIsOverDarkFooter(nextOverDark);
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(evaluateScroll);
      }
    };

    const onRefresh = () => {
      measureSectionOffsets();
      evaluateScroll();
    };

    measureSectionOffsets();
    evaluateScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onRefresh, { passive: true });
    ScrollTrigger.addEventListener('refresh', onRefresh);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onRefresh);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
    };
  }, []);

  // Lock page smooth-scroll cleanly while Quick View modal or mobile menu drawer is open
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (quickViewState || mobileMenuOpen) {
      lenis.stop();
      lenisScrollState.velocity = 0;
    } else {
      lenis.start();
    }
  }, [quickViewState, mobileMenuOpen]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (toastClearRef.current) window.clearTimeout(toastClearRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (toastClearRef.current) window.clearTimeout(toastClearRef.current);

    setToastMessage(message);
    requestAnimationFrame(() => setToastVisible(true));

    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
      toastClearRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 300);
    }, 2800);
  }, []);

  const handleQuickView = useCallback((product: BaseProduct, initialSize?: string) => {
    setQuickViewState({ product, initialSize });
  }, []);

  const scrollToY = useCallback((targetY: number) => {
    if (lenisRef.current) {
      lenisRef.current.start();
      lenisRef.current.scrollTo(targetY, { duration: 0.95, force: true });
    } else {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }, []);

  const navigateToSection = useCallback(
    (sectionId: string) => {
      setMobileMenuOpen(false);
      const target = document.getElementById(sectionId);
      if (!target) return;

      const targetY = target.getBoundingClientRect().top + window.scrollY;
      scrollToY(targetY);
    },
    [scrollToY],
  );

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#0B0B0B] selection:bg-[#0B0B0B] selection:text-[#F6F6F4]">
      <Header
        activeSection={activeSection}
        isOverDark={isOverDarkFooter}
        onNavigate={navigateToSection}
        onMobileMenuChange={setMobileMenuOpen}
      />

      <main>
        <Hero onScrollToBestsellers={() => navigateToSection('bestsellers')} />
        <About />
        <Bestsellers onQuickView={handleQuickView} onScrollToY={scrollToY} />
        <Catalog onQuickView={handleQuickView} onScrollToY={scrollToY} />
        <ContactsFooter onNavigate={navigateToSection} onNotify={showToast} />
      </main>

      <QuickViewModal
        product={quickViewState?.product ?? null}
        initialSize={quickViewState?.initialSize}
        onClose={() => setQuickViewState(null)}
        onNotify={showToast}
      />

      {/* Smoky frosted dark glass toast feedback */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
          toastVisible
            ? 'opacity-100 translate-y-0 blur-0'
            : 'opacity-0 translate-y-3 blur-[4px]'
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
