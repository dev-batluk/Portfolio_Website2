import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import type { LegalDocId } from './LegalModal';

const COOKIE_CONSENT_KEY = 'nevermind_cookie_consent_v1';

interface CookieConsentRecord {
  choice: 'all' | 'essential';
  updatedAt: string;
}

function readConsentRecord(): CookieConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>;
    if (parsed.choice === 'all' || parsed.choice === 'essential') {
      return {
        choice: parsed.choice,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

interface CookieBannerProps {
  forcedOpen: boolean;
  onDismissForced: () => void;
  onOpenLegal: (doc: LegalDocId) => void;
}

export function CookieBanner({
  forcedOpen,
  onDismissForced,
  onOpenLegal,
}: CookieBannerProps) {
  const [hasSavedChoice, setHasSavedChoice] = useState<boolean>(() =>
    Boolean(readConsentRecord()),
  );
  const [visible, setVisible] = useState(false);

  const shouldRender = forcedOpen || !hasSavedChoice;

  useEffect(() => {
    if (!shouldRender) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 220);
    return () => window.clearTimeout(timer);
  }, [shouldRender]);

  if (!shouldRender) return null;

  const saveChoice = (choice: 'all' | 'essential') => {
    try {
      const payload: CookieConsentRecord = {
        choice,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(payload));
    } catch {
      // Ignore private-mode storage restrictions
    }
    setHasSavedChoice(true);
    onDismissForced();
  };

  return (
    <aside
      aria-label="Уведомление об использовании Cookie"
      className={`fixed bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-[430px] z-[65] transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="acrylic-light-strong rounded-2xl p-4 sm:p-5 shadow-[0_20px_54px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0B0B0B] text-[#F6F6F4]">
              <Cookie className="h-3.5 w-3.5" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0B0B0B]">
              Cookie & Конфиденциальность
            </p>
          </div>

          {forcedOpen && (
            <button
              type="button"
              onClick={onDismissForced}
              aria-label="Скрыть настройки Cookie"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[#0B0B0B]/70 hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="text-[11px] leading-[1.6] text-[#0B0B0B]/75 mb-3.5">
          Мы используем технические файлы Cookie и локальное хранилище для корректной работы
          корзины и сайта. Подробнее в{' '}
          <button
            type="button"
            onClick={() => onOpenLegal('cookies')}
            className="bg-transparent border-0 p-0 font-semibold text-[#0B0B0B] underline underline-offset-4 hover:opacity-70"
          >
            Политике Cookie
          </button>{' '}
          и{' '}
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="bg-transparent border-0 p-0 font-semibold text-[#0B0B0B] underline underline-offset-4 hover:opacity-70"
          >
            Политике 152-ФЗ
          </button>
          .
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => saveChoice('all')}
            className="h-9 flex-1 min-w-[130px] rounded-full bg-[#0B0B0B] px-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] transition-transform active:scale-95"
          >
            Принять все
          </button>

          <button
            type="button"
            onClick={() => saveChoice('essential')}
            className="h-9 rounded-full border border-black/15 bg-white/80 px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] transition-colors hover:border-[#0B0B0B]"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </aside>
  );
}
