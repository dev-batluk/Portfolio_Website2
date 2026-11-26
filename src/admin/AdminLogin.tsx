import { useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useStoreData } from '../context/StoreDataContext';
import { OpticalButton, useSpecularPointer } from '../components/OpticalPrimitives';

export function AdminLogin() {
  const { loginAdmin } = useStoreData();
  const cardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError('Введите логин и пароль администратора');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await loginAdmin(username.trim(), password);
      if (!res.ok) {
        setError(res.error || 'Неверный логин или пароль');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-inview="true"
      className="relative min-h-screen bg-[#F6F6F4] text-[#0B0B0B] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#0B0B0B] selection:text-[#F6F6F4]"
    >
      {/* Ambient Studio Refraction Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="studio-orb-light animate-studio-drift-a absolute -left-24 top-10 h-[520px] w-[520px] rounded-full" />
        <div className="studio-orb-dark animate-studio-drift-b absolute -right-24 bottom-10 h-[520px] w-[520px] rounded-full" />
      </div>

      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-[420px] acrylic-light-strong specular-card rounded-2xl p-6 sm:p-8"
      >
        <div className="relative z-10 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0B0B0B]/50 mb-1.5">
                Admin Console
              </p>
              <h1 className="font-display text-2xl font-black uppercase tracking-[-0.02em] text-[#0B0B0B]">
                NEVERMIND
              </h1>
            </div>

            <span className="acrylic-light inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0B0B0B]">
              <Lock className="h-4 w-4" />
            </span>
          </div>

          <p className="text-xs leading-[1.6] text-[#0B0B0B]/65">
            Войдите в панель управления магазином NEVERMIND.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-login-username"
                className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60 mb-1.5"
              >
                Логин
              </label>
              <input
                id="admin-login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="admin"
                className="acrylic-input h-11 w-full rounded-xl border border-black/12 px-3.5 text-xs font-semibold text-[#0B0B0B]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-login-password"
                className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60 mb-1.5"
              >
                Пароль
              </label>
              <div className="relative">
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••••••"
                  className="acrylic-input h-11 w-full rounded-xl border border-black/12 pl-3.5 pr-11 text-xs font-semibold text-[#0B0B0B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent border-0 text-[#0B0B0B]/55 hover:text-[#0B0B0B]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-[#B42318]/25 bg-[#FBEAE8]/90 px-3.5 py-2.5 text-xs font-semibold text-[#B42318]"
              >
                {error}
              </div>
            )}

            <OpticalButton
              type="submit"
              variant="dark"
              disabled={submitting}
              rollingLabel={submitting ? 'Проверка...' : 'Войти в консоль'}
              leadingIcon={
                submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                )
              }
              className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
            />
          </form>

          {/* Client Showcase Demo Credentials Hint */}
          <div className="acrylic-light rounded-xl p-3.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/50">
              Demo Access · Для ознакомления
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#0B0B0B]">
              <span className="rounded-full border border-black/12 bg-white/85 px-2.5 py-0.5">
                Логин: <span className="font-mono font-bold">admin</span>
              </span>
              <span className="rounded-full border border-black/12 bg-white/85 px-2.5 py-0.5">
                Пароль: <span className="font-mono font-bold">admin</span>
              </span>
            </div>
            <p className="text-[11px] leading-[1.5] text-[#0B0B0B]/62">
              Данные уже заполнены — нажмите «Войти в консоль» для быстрого просмотра.
            </p>
          </div>

          <div className="border-t border-black/10 pt-4 flex items-center justify-between text-[11px] text-[#0B0B0B]/55">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 font-semibold text-[#0B0B0B]/70 hover:text-[#0B0B0B] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>На витрину</span>
            </a>

            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/45">
              NEVERMIND · 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
