import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FrostedSpecTicker,
  useInViewport,
  useSpecularPointer,
} from './OpticalPrimitives';

gsap.registerPlugin(ScrollTrigger);

const ABOUT_PHRASES = [
  'NEVERMIND — независимый стритвир-проект,',
  'построенный вокруг монохромной эстетики,',
  'тяжёлых тактильных тканей и графичного силуэта.',
  'Мы убираем всё лишнее, оставляя честный крой,',
  'выраженный объём и детали, которые ощущаются с первого прикосновения.',
];

const PHRASE_WORDS = ABOUT_PHRASES.map((phrase) => phrase.split(' '));

const BRAND_PILLARS = [
  { index: '01', metric: '480—500 GSM', label: 'Тяжёлый плотный трикотаж и футер 3-нитка' },
  { index: '02', metric: 'LIMITED DROPS', label: 'Лимитированные дропы без массовых перевыпусков' },
  { index: '03', metric: 'UNISEX FIT', label: 'Архитектурная посадка и чистый крой' },
];

interface AcrylicPillarCardProps {
  index: string;
  metric: string;
  label: string;
  registerRef: (el: HTMLDivElement | null) => void;
}

function AcrylicPillarCard({ index, metric, label, registerRef }: AcrylicPillarCardProps) {
  const specularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  return (
    <div
      ref={(el) => {
        specularRef.current = el;
        registerRef(el);
      }}
      className="acrylic-light specular-card rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center gap-2.5 transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 will-change-[opacity,transform]"
    >
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/40">
          {index}
        </span>
        <span className="font-display text-sm sm:text-base font-bold uppercase tracking-[0.04em] text-[#0B0B0B]">
          {metric}
        </span>
        <span className="text-xs leading-[1.55] text-[#0B0B0B]/65 max-w-[230px]">
          {label}
        </span>
      </div>
    </div>
  );
}

export function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bodyWrapRef = useRef<HTMLParagraphElement>(null);
  const phraseRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dividerRef = useRef<HTMLDivElement>(null);
  const pillarRefs = useRef<(HTMLDivElement | null)[]>([]);

  const inView = useInViewport(sectionRef, '180px');

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const lines = lineRefs.current.filter(Boolean) as HTMLSpanElement[];
      const phrases = phraseRefs.current.filter(Boolean) as HTMLSpanElement[];
      const words = wordRefs.current.filter(Boolean) as HTMLSpanElement[];
      const pillars = pillarRefs.current.filter(Boolean) as HTMLDivElement[];

      gsap.set(eyebrowRef.current, { opacity: 0, y: 16 });
      gsap.set(lines, { yPercent: 115, opacity: 0 });
      gsap.set(bodyWrapRef.current, { opacity: 0 });
      gsap.set(phrases, { filter: 'blur(3px)' });
      gsap.set(words, { opacity: 0.14, y: 8 });
      gsap.set(dividerRef.current, { scaleX: 0 });
      gsap.set(pillars, { opacity: 0, y: 26 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          end: 'center 45%',
          scrub: 0.65,
        },
      });

      tl.to(eyebrowRef.current, { opacity: 1, y: 0, duration: 0.2, ease: 'power3.out' }, 0)
        .to(
          lines,
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.35,
            stagger: 0.1,
            ease: 'power4.out',
          },
          0.08,
        )
        .to(bodyWrapRef.current, { opacity: 1, duration: 0.18, ease: 'power2.out' }, 0.22)
        .to(
          phrases,
          {
            filter: 'blur(0px)',
            duration: 0.45,
            stagger: { amount: 0.55 },
            ease: 'power2.out',
            clearProps: 'filter',
          },
          0.24,
        )
        .to(
          words,
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            stagger: { amount: 0.55 },
            ease: 'power2.out',
          },
          0.24,
        )
        .to(dividerRef.current, { scaleX: 1, duration: 0.3, ease: 'power3.inOut' }, 0.6)
        .to(
          pillars,
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.08,
            ease: 'power3.out',
          },
          0.7,
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  let globalWordIdx = 0;

  return (
    <section
      id="about"
      ref={sectionRef}
      data-inview={inView ? 'true' : 'false'}
      className="relative z-10 bg-[#F6F6F4] overflow-hidden"
    >
      {/* Top Frosted Spec Divider Ribbon */}
      <FrostedSpecTicker />

      {/* Background Optical Refraction Layer (Watermark + Pre-Softened Drifting Studio Orbs) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <p className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 font-display text-[clamp(4.5rem,14vw,12.5rem)] font-black uppercase tracking-[-0.04em] text-[#0B0B0B]/[0.035] whitespace-nowrap select-none">
          ARCHIVE // 01
        </p>
        <div className="studio-orb-light animate-studio-drift-a absolute left-[8%] bottom-[8%] h-96 w-96 rounded-full" />
        <div className="studio-orb-dark animate-studio-drift-b absolute right-[6%] bottom-[6%] h-[420px] w-[420px] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-[960px] px-5 sm:px-8 text-center py-20 sm:py-32 lg:py-40">
        <p
          ref={eyebrowRef}
          className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0B0B0B]/50 mb-6"
        >
          01 / О нас
        </p>

        <h2 className="font-display text-2xl sm:text-4xl lg:text-[44px] font-extrabold uppercase tracking-[-0.03em] leading-[1.08] text-[#0B0B0B] mb-8">
          <span className="block overflow-hidden pb-1">
            <span
              ref={(el) => {
                lineRefs.current[0] = el;
              }}
              className="block will-change-transform"
            >
              ФОРМА ГОВОРИТ
            </span>
          </span>
          <span className="block overflow-hidden pb-1">
            <span
              ref={(el) => {
                lineRefs.current[1] = el;
              }}
              className="block will-change-transform"
            >
              ГРОМЧЕ ШУМА
            </span>
          </span>
        </h2>

        <p
          ref={bodyWrapRef}
          className="mx-auto max-w-[660px] text-sm sm:text-base lg:text-[17px] font-normal leading-[1.7] text-[#0B0B0B]/82 mb-12 sm:mb-16"
        >
          {PHRASE_WORDS.map((phraseWords, phraseIdx) => (
            <span
              key={phraseIdx}
              ref={(el) => {
                phraseRefs.current[phraseIdx] = el;
              }}
              className="inline"
            >
              {phraseWords.map((word, wordIdx) => {
                const refIdx = globalWordIdx++;
                const isVeryLast =
                  phraseIdx === PHRASE_WORDS.length - 1 && wordIdx === phraseWords.length - 1;
                return (
                  <span
                    key={`${word}-${refIdx}`}
                    ref={(el) => {
                      wordRefs.current[refIdx] = el;
                    }}
                    className="inline-block will-change-[opacity,transform]"
                  >
                    {word}
                    {!isVeryLast ? '\u00A0' : ''}
                  </span>
                );
              })}
            </span>
          ))}
        </p>

        <div
          ref={dividerRef}
          className="h-px w-full bg-black/10 origin-center will-change-transform"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-8 sm:pt-10">
          {BRAND_PILLARS.map((item, idx) => (
            <AcrylicPillarCard
              key={item.metric}
              index={item.index}
              metric={item.metric}
              label={item.label}
              registerRef={(el) => {
                pillarRefs.current[idx] = el;
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
