import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_SIZES,
  type OrderStatus,
  type PaymentStatus,
} from '../data/adminSeed';
import {
  compressAndStoreImage,
  isSafeClientImageUrl,
  useResolvedImage,
} from '../lib/imageStore';

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  new: {
    label: 'Новый',
    badgeClass: 'bg-[#0B0B0B] text-[#F6F6F4] border-[#0B0B0B]',
  },
  confirmed: {
    label: 'Подтверждён',
    badgeClass: 'bg-white/90 text-[#0B0B0B] border-[#0B0B0B]/30',
  },
  shipping: {
    label: 'В доставке',
    badgeClass: 'bg-[#F5EEDB] text-[#6B4A14] border-[#6B4A14]/20',
  },
  completed: {
    label: 'Выполнен',
    badgeClass: 'bg-[#E7EFE9] text-[#1D5B34] border-[#1D5B34]/20',
  },
  cancelled: {
    label: 'Отменён',
    badgeClass: 'bg-[#FBEAE8] text-[#B42318] border-[#B42318]/20',
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; badgeClass: string }
> = {
  demo: {
    label: 'Демо',
    badgeClass: 'bg-black/[0.06] text-[#0B0B0B]/70 border-black/10',
  },
  pending: {
    label: 'Ожидает',
    badgeClass: 'bg-[#F5EEDB] text-[#6B4A14] border-[#6B4A14]/20',
  },
  paid: {
    label: 'Оплачен',
    badgeClass: 'bg-[#E7EFE9] text-[#1D5B34] border-[#1D5B34]/20',
  },
  refunded: {
    label: 'Возврат',
    badgeClass: 'bg-[#FBEAE8] text-[#B42318] border-[#B42318]/20',
  },
};

export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function AdminImagePreview({
  src,
  alt,
  hasModel = false,
  className = '',
}: {
  src: string | undefined;
  alt: string;
  hasModel?: boolean;
  className?: string;
}) {
  const resolved = useResolvedImage(src);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[#ECECE8]/85 text-[#0B0B0B]/30 ${className}`}
      >
        <ImagePlus className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={resolved || src}
      alt={alt}
      draggable={false}
      className={`object-contain ${hasModel ? 'cutout-shadow' : 'studio-blend'} ${className}`}
    />
  );
}

interface BottomSheetProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function BottomSheet({
  open,
  title,
  eyebrow,
  onClose,
  children,
  maxWidthClass = 'lg:max-w-[580px]',
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (open) {
      setMounted(true);
      if (prefersReduced) {
        setVisible(true);
        return;
      }
      setVisible(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    if (prefersReduced) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[75] flex items-end lg:items-stretch lg:justify-end bg-black/40 backdrop-blur-md transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`relative flex w-full ${maxWidthClass} max-h-[92svh] lg:max-h-full lg:h-full flex-col overflow-hidden rounded-t-2xl lg:rounded-t-none lg:rounded-l-2xl bg-[#F6F6F4]/94 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/70 shadow-[0_-24px_80px_rgba(0,0,0,0.22)] transition-transform duration-340 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 sm:px-6 pt-4 pb-3.5 shrink-0">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-0.5 truncate">
                {eyebrow}
              </p>
            )}
            <h3 className="font-display text-base sm:text-lg font-black uppercase tracking-[-0.02em] text-[#0B0B0B] truncate">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель"
            className="acrylic-light-strong inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0B0B0B] transition-all duration-200 hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

interface SizeStockEditorProps {
  stock: Record<string, number>;
  onChange: (nextStock: Record<string, number>) => void;
}

export function SizeStockEditor({ stock, onChange }: SizeStockEditorProps) {
  const toggleSize = (size: string) => {
    const next = { ...stock };
    if (size in next) {
      if (Object.keys(next).length <= 1) return;
      delete next[size];
    } else {
      next[size] = 3;
    }
    onChange(next);
  };

  const stepQty = (size: string, delta: number) => {
    const current = typeof stock[size] === 'number' ? stock[size] : 0;
    onChange({
      ...stock,
      [size]: Math.max(0, Math.min(999, current + delta)),
    });
  };

  const setQtyDirect = (size: string, raw: string) => {
    const parsed = Number.parseInt(raw.replace(/\D/g, ''), 10);
    onChange({
      ...stock,
      [size]: Number.isFinite(parsed) ? Math.max(0, Math.min(999, parsed)) : 0,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {ALL_SIZES.map((size) => {
          const active = size in stock;
          return (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`h-9 min-w-11 rounded-lg border px-3 text-xs font-bold uppercase tracking-[0.06em] transition-all ${
                active
                  ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                  : 'border-black/12 bg-white/75 text-[#0B0B0B]/55 hover:border-black/30'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_SIZES.filter((size) => size in stock).map((size) => {
          const qty = stock[size] ?? 0;
          return (
            <div
              key={size}
              className="acrylic-light rounded-xl px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-8 items-center justify-center rounded-md bg-white/80 border border-black/10 text-[11px] font-bold text-[#0B0B0B]">
                  {size}
                </span>
                {qty === 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#B42318]">
                    Sold Out
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-black/12 bg-white/80 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => stepQty(size, -1)}
                  aria-label={`Уменьшить остаток ${size}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-transparent border-0 text-[#0B0B0B]/70 hover:bg-black/[0.06]"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(qty)}
                  onChange={(e) => setQtyDirect(size, e.target.value)}
                  aria-label={`Остаток ${size}`}
                  className="w-9 bg-transparent border-0 text-center text-xs font-bold tabular-nums text-[#0B0B0B] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => stepQty(size, 1)}
                  aria-label={`Увеличить остаток ${size}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-transparent border-0 text-[#0B0B0B]/70 hover:bg-black/[0.06]"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface GalleryManagerProps {
  frames: string[];
  onChange: (nextFrames: string[]) => void;
  hasModel?: boolean;
  onNotify?: (msg: string) => void;
}

export function GalleryManager({
  frames,
  onChange,
  hasModel = false,
  onNotify,
}: GalleryManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const refs: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const ref = await compressAndStoreImage(file);
        refs.push(ref);
      }
      if (refs.length > 0) {
        onChange([...frames, ...refs]);
        onNotify?.(`Загружено фото на сервер: ${refs.length}`);
      }
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Ошибка загрузки изображения');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isSafeClientImageUrl(trimmed)) {
      onNotify?.('Разрешены только https:// ссылки или пути /images/...');
      return;
    }
    onChange([...frames, trimmed]);
    setUrlInput('');
  };

  const setAsMain = (idx: number) => {
    if (idx <= 0 || idx >= frames.length) return;
    const copy = [...frames];
    const [picked] = copy.splice(idx, 1);
    copy.unshift(picked);
    onChange(copy);
  };

  const moveFrame = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= frames.length) return;
    const copy = [...frames];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    onChange(copy);
  };

  const removeFrame = (idx: number) => {
    onChange(frames.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0B0B0B] px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] transition-transform active:scale-95 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          <span>{uploading ? 'Сжимаем...' : 'Загрузить с устройства'}</span>
        </button>

        <div className="flex flex-1 min-w-[200px] items-center gap-1.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Или вставьте URL фото..."
            className="acrylic-input h-10 flex-1 min-w-0 rounded-full border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="h-10 shrink-0 rounded-full border border-black/15 bg-white/80 px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
          >
            + URL
          </button>
        </div>
      </div>

      {frames.length === 0 ? (
        <div className="acrylic-light rounded-2xl p-4 text-center text-xs text-[#0B0B0B]/55">
          Добавьте главное и дополнительные фото — они сразу появятся в карточке и галерее
          витрины.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {frames.map((frame, idx) => (
            <div
              key={`${frame}-${idx}`}
              className={`acrylic-light rounded-2xl p-2 flex flex-col gap-2 ${
                idx === 0 ? 'ring-1 ring-[#0B0B0B]/35' : ''
              }`}
            >
              <div className="relative aspect-[4/5] w-full rounded-xl bg-[#ECECE8]/85 overflow-hidden flex items-center justify-center p-2">
                <AdminImagePreview
                  src={frame}
                  alt={`Фото ${idx + 1}`}
                  hasModel={hasModel}
                  className="h-full w-full"
                />

                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-[#0B0B0B] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F6F6F4]">
                    Главное
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => setAsMain(idx)}
                      title="Сделать главным фото"
                      aria-label="Сделать главным фото"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/12 bg-white/75 text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4]"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveFrame(idx, -1)}
                    aria-label="Сдвинуть влево"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/12 bg-white/75 text-[#0B0B0B] disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === frames.length - 1}
                    onClick={() => moveFrame(idx, 1)}
                    aria-label="Сдвинуть вправо"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/12 bg-white/75 text-[#0B0B0B] disabled:opacity-30"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeFrame(idx)}
                  aria-label="Удалить фото"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/12 bg-white/75 text-[#B42318] hover:bg-[#B42318] hover:text-white"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SingleImageFieldProps {
  label: string;
  value: string;
  onChange: (nextUrl: string) => void;
  hasModel?: boolean;
  onNotify?: (msg: string) => void;
}

export function SingleImageField({
  label,
  value,
  onChange,
  hasModel = false,
  onNotify,
}: SingleImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const ref = await compressAndStoreImage(file);
      onChange(ref);
      onNotify?.(`${label}: фото загружено на сервер`);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Ошибка загрузки изображения');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="acrylic-light rounded-2xl p-3 flex items-center gap-3">
      <div className="h-16 w-14 shrink-0 rounded-xl bg-[#ECECE8]/85 border border-black/5 p-1 flex items-center justify-center overflow-hidden">
        <AdminImagePreview
          src={value}
          alt={label}
          hasModel={hasModel}
          className="h-full w-full"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/55">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="h-8 shrink-0 rounded-full bg-[#0B0B0B] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] inline-flex items-center gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            <span>Фото</span>
          </button>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/images/... или URL"
            className="acrylic-input h-8 flex-1 min-w-0 rounded-full border border-black/12 px-3 text-[11px] text-[#0B0B0B]"
          />
        </div>
      </div>
    </div>
  );
}
