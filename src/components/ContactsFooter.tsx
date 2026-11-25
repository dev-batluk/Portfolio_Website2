import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Mail, Send } from 'lucide-react';
import {
  FrostedSpecTicker,
  OpticalButton,
  useInViewport,
  useSpecularPointer,
} from './OpticalPrimitives';

gsap.registerPlugin(ScrollTrigger);

interface ContactsFooterProps {
  onNavigate: (sectionId: string) => void;
  onNotify: (message: string) => void;
}

interface AcrylicContactCardProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

function AcrylicContactCard({ eyebrow, title, subtitle }: AcrylicContactCardProps) {
  const specularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  return (
    <div
      ref={specularRef}
      className="acrylic-light specular-card rounded-2xl p-6 transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5"
    >
      <div className="relative z-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0B0B0B]/45 mb-2">
          {eyebrow}
        </p>
        <p className="text-sm font-semibold text-[#0B0B0B]">{title}</p>
        <p className="mt-1.5 text-xs leading-[1.55] text-[#0B0B0B]/62">{subtitle}</p>
      </div>
    </div>
  );
}

export function ContactsFooter({ onNavigate, onNotify }: ContactsFooterProps) {
  const contactsRef = useRef<HTMLElement>(null);
  const footerWrapRef = useRef<HTMLDivElement>(null);
  const footerWordmarkRef = useRef<HTMLParagraphElement>(null);
  const wordmarkRectRef = useRef<DOMRect | null>(null);
  const wordmarkRafRef = useRef<number>(0);
  const wordmarkPosRef = useRef({ x: 0, y: 0 });
  const [wordmarkHovered, setWordmarkHovered] = useState(false);

  const inView = useInViewport(contactsRef, '200px');

  // Smooth bottom reveal of the monumental NEVERMIND footer wordmark
  useEffect(() => {
    const wordmark = footerWordmarkRef.current;
    const wrap = footerWrapRef.current;
    if (!wordmark || !wrap) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        wordmark,
        { yPercent: 105, opacity: 0.25, filter: 'blur(6px)' },
        {
          yPercent: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.9,
          ease: 'expo.out',
          clearProps: 'filter',
          scrollTrigger: {
            trigger: wrap,
            start: 'top 94%',
            once: true,
          },
        },
      );
    }, wrap);

    return () => {
      if (wordmarkRafRef.current) cancelAnimationFrame(wordmarkRafRef.current);
      ctx.revert();
    };
  }, []);

  const handleWordmarkPointerEnter = (e: React.PointerEvent<HTMLParagraphElement>) => {
    if (e.pointerType === 'touch') return;
    wordmarkRectRef.current = footerWordmarkRef.current?.getBoundingClientRect() ?? null;
    setWordmarkHovered(true);
  };

  const handleWordmarkPointerMove = (e: React.PointerEvent<HTMLParagraphElement>) => {
    if (e.pointerType === 'touch') return;
    wordmarkPosRef.current.x = e.clientX;
    wordmarkPosRef.current.y = e.clientY;
    if (wordmarkRafRef.current) return;

    wordmarkRafRef.current = requestAnimationFrame(() => {
      wordmarkRafRef.current = 0;
      const el = footerWordmarkRef.current;
      if (!el) return;
      const rect = wordmarkRectRef.current ?? el.getBoundingClientRect();
      wordmarkRectRef.current = rect;
      el.style.setProperty('--mx', `${(wordmarkPosRef.current.x - rect.left).toFixed(1)}px`);
      el.style.setProperty('--my', `${(wordmarkPosRef.current.y - rect.top).toFixed(1)}px`);
    });
  };

  const handleWordmarkPointerLeave = () => {
    wordmarkRectRef.current = null;
    if (wordmarkRafRef.current) {
      cancelAnimationFrame(wordmarkRafRef.current);
      wordmarkRafRef.current = 0;
    }
    setWordmarkHovered(false);
  };

  return (
    <>
      {/* Contacts Section (Clean Studio Light with Frosted Spec Ribbon & Acrylic Cards) */}
      <section
        id="contacts"
        ref={contactsRef}
        data-inview={inView ? 'true' : 'false'}
        className="relative z-20 bg-[#F6F6F4] overflow-hidden"
      >
        <FrostedSpecTicker />

        {/* Pre-Softened Ambient Studio Refraction Orbs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          <div className="studio-orb-light animate-studio-drift-a absolute right-[10%] top-[20%] h-80 w-80 rounded-full" />
          <div className="studio-orb-dark animate-studio-drift-b absolute right-[22%] bottom-[12%] h-72 w-72 rounded-full" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12 pt-20 sm:pt-28 pb-16 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-end">
            <div className="lg:col-span-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-4">
                04 / Контакты
              </p>
              <h2 className="font-display text-3xl sm:text-5xl lg:text-[54px] font-black uppercase tracking-[-0.03em] leading-[1.04] text-[#0B0B0B] mb-6">
                СВЯЗЬ С АРХИВОМ
              </h2>
              <p className="max-w-[520px] text-sm sm:text-base leading-[1.65] text-[#0B0B0B]/70 mb-10">
                По вопросам примерки, предзаказа лимитированных дропов и стилистических коллабораций
                — пишите напрямую в студию NEVERMIND.
              </p>

              {/* Optical Contact Links */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 sm:gap-3.5">
                <OpticalButton
                  variant="dark"
                  href="https://t.me/devbatluk"
                  target="_blank"
                  rel="noopener noreferrer"
                  rollingLabel="Telegram"
                  leadingIcon={<Send className="h-4 w-4 shrink-0" />}
                  trailingIcon={
                    <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  }
                  className="h-12 sm:h-13 px-4 sm:px-7 text-xs sm:text-[13px] font-semibold uppercase tracking-[0.08em]"
                />

                <OpticalButton
                  variant="acrylic"
                  href="#contacts"
                  onClick={(e) => {
                    e.preventDefault();
                    onNotify('Email: демо-ссылка (заглушка для портфолио)');
                  }}
                  rollingLabel="Email"
                  leadingIcon={<Mail className="h-4 w-4 shrink-0" />}
                  trailingIcon={
                    <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  }
                  className="h-12 sm:h-13 px-4 sm:px-7 text-xs sm:text-[13px] font-semibold uppercase tracking-[0.08em]"
                />
              </div>
            </div>

            {/* Right Studio Metadata as Frosted Acrylic Cards */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 border-t border-black/10 pt-8 lg:border-t-0 lg:pt-0">
              <AcrylicContactCard
                eyebrow="Шоурум"
                title="Москва · Центр"
                subtitle="Столешников переулок, приватная запись"
              />
              <AcrylicContactCard
                eyebrow="Время работы"
                title="Пн — Вс"
                subtitle="12:00 — 21:00 по предварительному запросу"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Smooth Perceptual Fade Strip with Cached 64x64 Anti-Banding Micro-Dither Tile */}
      <div
        aria-hidden="true"
        className="relative z-20 h-36 sm:h-48 lg:h-56 w-full overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, #F6F6F4 0%, #EFEFEC 10%, #DCDCD8 22%, #BEBEBA 34%, #91918E 47%, #636360 60%, #3A3A38 73%, #1F1F1E 85%, #111111 94%, #0A0A0A 100%)',
        }}
      >
        <div className="fade-dither-tile pointer-events-none absolute inset-0" />
      </div>

      {/* Dark Contrast Footer */}
      <footer id="footer" className="relative z-20 bg-[#0A0A0A] text-[#F6F6F4] pt-12 pb-6 sm:pb-10">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 border-b border-white/10 pb-12 mb-10 text-xs">
            <div className="md:col-span-5">
              <p className="font-display text-sm font-bold uppercase tracking-[0.14em] mb-3">
                NEVERMIND
              </p>
              <p className="max-w-[340px] leading-[1.6] text-white/55">
                Архитектурная уличная одежда малыми тиражами. Фокус на плотности ткани, чистоте
                формы и монохромном балансе.
              </p>
            </div>

            <div className="md:col-span-4 flex flex-wrap gap-x-8 gap-y-3 items-start text-white/70">
              {[
                { id: 'hero', label: 'Главная' },
                { id: 'about', label: 'О нас' },
                { id: 'bestsellers', label: 'Бестселлеры' },
                { id: 'catalog', label: 'Каталог' },
                { id: 'contacts', label: 'Контакты' },
              ].map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate(link.id)}
                  className="bg-transparent border-0 p-0 text-xs font-medium uppercase tracking-[0.1em] text-white/65 transition-colors hover:text-white"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="md:col-span-3 md:text-right text-white/50 space-y-1.5">
              <p>© 2026 NEVERMIND. Все права защищены.</p>
              <p>Streetwear Portfolio Archive</p>
              <p className="text-white/70 font-semibold tracking-[0.08em]">/dev/batluk</p>
            </div>
          </div>

          {/* Monumental Edge-to-Edge Wordmark with Scroll Rise & Silver Cursor Sheen */}
          <div ref={footerWrapRef} className="overflow-hidden pt-2 select-none">
            <p
              ref={footerWordmarkRef}
              onPointerEnter={handleWordmarkPointerEnter}
              onPointerMove={handleWordmarkPointerMove}
              onPointerLeave={handleWordmarkPointerLeave}
              style={
                wordmarkHovered
                  ? {
                      backgroundImage:
                        'radial-gradient(280px circle at var(--mx, 50%) var(--my, 50%), #FFFFFF 0%, rgba(246, 246, 244, 0.92) 45%, rgba(246, 246, 244, 0.68) 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }
                  : undefined
              }
              className="font-display text-center font-black uppercase tracking-[-0.04em] leading-[0.86] text-[#F6F6F4]/92 whitespace-nowrap text-[clamp(2rem,9.6vw,11.4rem)] will-change-transform transition-colors duration-300"
            >
              NEVERMIND
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
