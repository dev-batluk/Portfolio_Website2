import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Edit3, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { BestsellerItem } from '../data/products';
import { useStoreData } from '../context/StoreDataContext';
import { OpticalButton, useSpecularPointer } from '../components/OpticalPrimitives';
import {
  AdminImagePreview,
  BottomSheet,
  GalleryManager,
  SingleImageField,
  SizeStockEditor,
} from './AdminShared';

interface AdminBestsellersProps {
  onNotify: (message: string) => void;
}

interface BestsellerFormState {
  tag: string;
  title: string;
  sku: string;
  categoryLabel: string;
  price: string;
  description: string;
  material: string;
  fit: string;
  image: string;
  modelImage: string;
  gallery: string[];
  stock: Record<string, number>;
}

function emptyBestsellerForm(nextNum: number): BestsellerFormState {
  return {
    tag: `Drop 0${nextNum} · Archive`,
    title: '',
    sku: `NVM-BS-0${nextNum}`,
    categoryLabel: 'Верхняя одежда',
    price: '24900',
    description: '',
    material: '100% плотный хлопок · 480 GSM',
    fit: 'Boxy Oversized',
    image: '',
    modelImage: '',
    gallery: [],
    stock: { S: 3, M: 4, L: 4, XL: 2 },
  };
}

function formFromBestseller(item: BestsellerItem): BestsellerFormState {
  return {
    tag: item.tag,
    title: item.title,
    sku: item.sku,
    categoryLabel: item.categoryLabel,
    price: String(item.price),
    description: item.description,
    material: item.material,
    fit: item.fit,
    image: item.image,
    modelImage: item.modelImage,
    gallery: item.gallery ? [...item.gallery] : [],
    stock: item.stock ? { ...item.stock } : { S: 3, M: 4, L: 4, XL: 2 },
  };
}

interface BestsellerAdminRowProps {
  item: BestsellerItem;
  index: number;
  totalCount: number;
  totalStock: number;
  confirmDeleteId: string | null;
  onAskDelete: (id: string | null) => void;
  onMove: (dir: 'up' | 'down') => void;
  onEdit: () => void;
  onDelete: () => void;
}

function BestsellerAdminRow({
  item,
  index,
  totalCount,
  totalStock,
  confirmDeleteId,
  onAskDelete,
  onMove,
  onEdit,
  onDelete,
}: BestsellerAdminRowProps) {
  const specularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const isConfirming = confirmDeleteId === item.id;
  const canDelete = totalCount > 2;

  return (
    <div
      ref={specularRef}
      className="acrylic-light specular-card rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
    >
      <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
        <span className="font-display text-sm font-black text-[#0B0B0B]/35 tabular-nums w-6 shrink-0">
          0{index + 1}
        </span>

        {/* Dual thumbnails: garment + model */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-16 w-13 rounded-xl bg-[#ECECE8]/85 border border-black/5 p-1 flex items-center justify-center">
            <AdminImagePreview
              src={item.image}
              alt={item.title}
              hasModel
              className="h-full w-full"
            />
          </div>
          <div className="h-16 w-13 rounded-xl bg-[#ECECE8]/85 border border-black/5 p-1 flex items-center justify-center">
            <AdminImagePreview
              src={item.modelImage}
              alt={`${item.title} на модели`}
              hasModel
              className="h-full w-full"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/50">
              {item.tag}
            </span>
            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[9px] font-semibold text-[#0B0B0B]/70 tabular-nums">
              {totalStock} шт.
            </span>
          </div>

          <h3 className="font-display text-xs sm:text-sm font-extrabold uppercase text-[#0B0B0B] line-clamp-1">
            {item.title}
          </h3>
          <p className="font-display text-xs font-bold text-[#0B0B0B] tabular-nums">
            {item.priceFormatted}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-end gap-1.5 shrink-0">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove('up')}
          aria-label="Переместить выше"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B] disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={index === totalCount - 1}
          onClick={() => onMove('down')}
          aria-label="Переместить ниже"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B] disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 bg-white/80 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
        >
          <Edit3 className="h-3 w-3" />
          <span>Изменить</span>
        </button>

        {isConfirming ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              className="h-8 rounded-full bg-[#B42318] px-3 text-[10px] font-semibold uppercase text-white"
            >
              Убрать
            </button>
            <button
              type="button"
              onClick={() => onAskDelete(null)}
              className="h-8 rounded-full border border-black/12 bg-white/80 px-2.5 text-[10px] font-semibold"
            >
              Нет
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => onAskDelete(item.id)}
            title={canDelete ? 'Убрать из бестселлеров' : 'Минимум 2 бестселлера'}
            aria-label={`Удалить ${item.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#B42318]/25 bg-white/75 text-[#B42318] hover:bg-[#FBEAE8] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminBestsellers({ onNotify }: AdminBestsellersProps) {
  const {
    bestsellers,
    catalogItems,
    getTotalStock,
    addBestseller,
    updateBestseller,
    deleteBestseller,
    reorderBestseller,
    promoteCatalogToBestseller,
  } = useStoreData();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BestsellerFormState>(() =>
    emptyBestsellerForm(bestsellers.length + 1),
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Promote from catalog sheet
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteCatalogId, setPromoteCatalogId] = useState(
    catalogItems[0]?.id ?? '',
  );
  const [promoteTag, setPromoteTag] = useState(
    `Drop 0${bestsellers.length + 1} · Featured`,
  );
  const [promoteModelImage, setPromoteModelImage] = useState('');

  const canAddMore = bestsellers.length < 8;

  const openCreate = () => {
    if (!canAddMore) return;
    setEditingId(null);
    setForm(emptyBestsellerForm(bestsellers.length + 1));
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (item: BestsellerItem) => {
    setEditingId(item.id);
    setForm(formFromBestseller(item));
    setFormError(null);
    setEditorOpen(true);
  };

  const openPromote = () => {
    if (!canAddMore) return;
    setPromoteCatalogId(catalogItems[0]?.id ?? '');
    setPromoteTag(`Drop 0${bestsellers.length + 1} · Archive`);
    setPromoteModelImage('');
    setPromoteOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numericPrice = Number.parseInt(form.price.replace(/\D/g, ''), 10);

    if (form.title.trim().length < 2) {
      setFormError('Укажите название позиции');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setFormError('Укажите корректную цену');
      return;
    }
    if (!form.image.trim()) {
      setFormError('Добавьте фото вещи');
      return;
    }

    const payload = {
      tag: form.tag || `Drop 0${bestsellers.length + 1}`,
      title: form.title,
      sku: form.sku || `NVM-BS-0${bestsellers.length + 1}`,
      categoryLabel: form.categoryLabel || 'Стритвир',
      price: numericPrice,
      description: form.description || 'Избранная позиция коллекции NEVERMIND.',
      material: form.material || '100% плотный хлопок · 480 GSM',
      fit: form.fit || 'Boxy Oversized',
      sizes: Object.keys(form.stock),
      image: form.image.trim(),
      modelImage: form.modelImage.trim() || form.image.trim(),
      gallery: form.gallery,
      stock: form.stock,
    };

    try {
      if (editingId) {
        await updateBestseller(editingId, payload);
        onNotify(`Бестселлер ${payload.title.toUpperCase()} обновлён`);
      } else {
        await addBestseller(payload);
        onNotify(`Бестселлер ${payload.title.toUpperCase()} добавлен`);
      }
      setEditorOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения бестселлера');
    }
  };

  const handlePromoteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!promoteCatalogId) return;
    try {
      const created = await promoteCatalogToBestseller(
        promoteCatalogId,
        promoteModelImage,
        promoteTag,
      );
      if (created) {
        onNotify(`${created.title} добавлен в бестселлеры`);
        setPromoteOpen(false);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Не удалось добавить бестселлер');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-1">
            04 / Главная витрина дропа (2–8 позиций)
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-[-0.03em] text-[#0B0B0B]">
            БЕСТСЕЛЛЕРЫ ({bestsellers.length} / 8)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OpticalButton
            variant="acrylic"
            disabled={!canAddMore}
            onClick={openPromote}
            leadingIcon={<Sparkles className="h-3.5 w-3.5 shrink-0" />}
            className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-45"
          >
            <span>Из каталога</span>
          </OpticalButton>

          <OpticalButton
            variant="dark"
            disabled={!canAddMore}
            onClick={openCreate}
            rollingLabel="Создать новый"
            leadingIcon={<Plus className="h-3.5 w-3.5 shrink-0" />}
            className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:opacity-45"
          />
        </div>
      </div>

      <div className="space-y-3">
        {bestsellers.map((item, idx) => (
          <BestsellerAdminRow
            key={item.id}
            item={item}
            index={idx}
            totalCount={bestsellers.length}
            totalStock={getTotalStock(item)}
            confirmDeleteId={confirmDeleteId}
            onAskDelete={setConfirmDeleteId}
            onMove={(dir) => {
              void reorderBestseller(item.id, dir)
                .then(() => onNotify('Порядок бестселлеров обновлён'))
                .catch((err) =>
                  onNotify(err instanceof Error ? err.message : 'Ошибка сортировки'),
                );
            }}
            onEdit={() => openEdit(item)}
            onDelete={() => {
              void deleteBestseller(item.id)
                .then((ok) => {
                  setConfirmDeleteId(null);
                  if (ok) onNotify(`${item.title} удалён из бестселлеров`);
                })
                .catch((err) =>
                  onNotify(err instanceof Error ? err.message : 'Ошибка удаления'),
                );
            }}
          />
        ))}
      </div>

      {/* Bestseller Editor Sheet */}
      <BottomSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        eyebrow={editingId ? 'Редактирование бестселлера' : 'Новый бестселлер'}
        title={editingId ? form.title || 'Бестселлер' : 'Добавить бестселлер'}
        maxWidthClass="lg:max-w-[640px]"
      >
        <form onSubmit={handleSave} className="space-y-5 pb-6">
          <div className="grid grid-cols-1 gap-3">
            <SingleImageField
              label="Фото вещи (отдельно)"
              value={form.image}
              onChange={(url) => {
                setForm((p) => ({ ...p, image: url }));
                setFormError(null);
              }}
              hasModel
              onNotify={onNotify}
            />
            <SingleImageField
              label="Фото на модели (для ховера)"
              value={form.modelImage}
              onChange={(url) => setForm((p) => ({ ...p, modelImage: url }))}
              hasModel
              onNotify={onNotify}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60 mb-2">
              Дополнительные фото в окне товара
            </p>
            <GalleryManager
              frames={form.gallery}
              onChange={(gallery) => setForm((p) => ({ ...p, gallery }))}
              hasModel
              onNotify={onNotify}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Drop-тег
              </label>
              <input
                type="text"
                value={form.tag}
                onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value }))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Артикул (SKU)
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-semibold uppercase text-[#0B0B0B]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-semibold uppercase text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Цена (₽) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.price}
                onChange={(e) =>
                  setForm((p) => ({ ...p, price: e.target.value.replace(/\D/g, '') }))
                }
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-bold tabular-nums text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Посадка (Fit)
              </label>
              <input
                type="text"
                value={form.fit}
                onChange={(e) => setForm((p) => ({ ...p, fit: e.target.value }))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Материал
              </label>
              <input
                type="text"
                value={form.material}
                onChange={(e) => setForm((p) => ({ ...p, material: e.target.value }))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Описание
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="acrylic-input w-full rounded-xl border border-black/12 p-3 text-xs text-[#0B0B0B]"
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60 mb-2">
              Размеры и остатки
            </p>
            <SizeStockEditor
              stock={form.stock}
              onChange={(stock) => setForm((p) => ({ ...p, stock }))}
            />
          </div>

          {formError && (
            <p className="text-xs font-semibold text-[#B42318]">{formError}</p>
          )}

          <OpticalButton
            type="submit"
            variant="dark"
            rollingLabel={editingId ? 'Сохранить бестселлер' : 'Добавить в бестселлеры'}
            className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
          />
        </form>
      </BottomSheet>

      {/* Promote Catalog Product Sheet */}
      <BottomSheet
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        eyebrow="Быстрое добавление"
        title="Вынести товар из каталога"
      >
        <form onSubmit={handlePromoteSubmit} className="space-y-4 pb-6">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1.5">
              Выберите товар каталога
            </label>
            <select
              value={promoteCatalogId}
              onChange={(e) => setPromoteCatalogId(e.target.value)}
              className="acrylic-input h-11 w-full rounded-xl border border-black/12 px-3 text-xs font-semibold text-[#0B0B0B]"
            >
              {catalogItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.priceFormatted}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1.5">
              Drop-тег на витрине
            </label>
            <input
              type="text"
              value={promoteTag}
              onChange={(e) => setPromoteTag(e.target.value)}
              className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
            />
          </div>

          <SingleImageField
            label="Фото на модели (опционально)"
            value={promoteModelImage}
            onChange={setPromoteModelImage}
            hasModel
            onNotify={onNotify}
          />

          <OpticalButton
            type="submit"
            variant="dark"
            rollingLabel="Добавить в бестселлеры"
            className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
          />
        </form>
      </BottomSheet>
    </div>
  );
}
