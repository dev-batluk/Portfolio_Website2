import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Eye,
  EyeOff,
  FolderKanban,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CatalogItem, CategoryId } from '../data/products';
import { useStoreData } from '../context/StoreDataContext';
import { OpticalButton, useSpecularPointer } from '../components/OpticalPrimitives';
import {
  AdminImagePreview,
  BottomSheet,
  GalleryManager,
  SizeStockEditor,
} from './AdminShared';

interface AdminCatalogProps {
  initialCreateOpen?: boolean;
  onClearInitialCreate?: () => void;
  onNotify: (message: string) => void;
}

interface ProductFormState {
  title: string;
  sku: string;
  category: string;
  price: string;
  description: string;
  material: string;
  fit: string;
  frames: string[];
  stock: Record<string, number>;
  hidden: boolean;
}

function createEmptyProductForm(
  nextIndex: number,
  defaultCategoryId: string,
): ProductFormState {
  return {
    title: '',
    sku: `NVM-NEW-${String(nextIndex).padStart(2, '0')}`,
    category: defaultCategoryId,
    price: '14900',
    description: '',
    material: '100% плотный хлопок-футер · 480 GSM',
    fit: 'Boxy Oversized Fit',
    frames: [],
    stock: { S: 4, M: 5, L: 4, XL: 3 },
    hidden: false,
  };
}

function formFromCatalogItem(item: CatalogItem): ProductFormState {
  return {
    title: item.title,
    sku: item.sku,
    category: item.category,
    price: String(item.price),
    description: item.description,
    material: item.material,
    fit: item.fit,
    frames: [item.image, ...(item.gallery ?? [])].filter(Boolean),
    stock: item.stock ? { ...item.stock } : { S: 4, M: 5, L: 4, XL: 3 },
    hidden: Boolean(item.hidden),
  };
}

interface CatalogAdminRowProps {
  item: CatalogItem;
  totalStock: number;
  confirmDeleteId: string | null;
  onAskDelete: (id: string | null) => void;
  onToggleHidden: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CatalogAdminRow({
  item,
  totalStock,
  confirmDeleteId,
  onAskDelete,
  onToggleHidden,
  onEdit,
  onDelete,
}: CatalogAdminRowProps) {
  const specularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const extraPhotos = item.gallery?.length ?? 0;
  const isConfirming = confirmDeleteId === item.id;

  return (
    <div
      ref={specularRef}
      className={`acrylic-light specular-card rounded-2xl p-3.5 flex items-center gap-3.5 ${
        item.hidden ? 'opacity-65' : ''
      }`}
    >
      <div className="relative z-10 h-20 w-16 shrink-0 rounded-xl bg-[#ECECE8]/85 border border-black/5 p-1.5 flex items-center justify-center overflow-hidden">
        <AdminImagePreview
          src={item.image}
          alt={item.title}
          className="h-full w-full"
        />
      </div>

      <div className="relative z-10 min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/50">
            {item.sku}
          </span>
          <span className="rounded-full border border-black/10 bg-white/75 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#0B0B0B]/70">
            {item.categoryLabel}
          </span>
          {extraPhotos > 0 && (
            <span className="rounded-full border border-black/10 bg-white/75 px-2 py-0.5 text-[9px] font-semibold text-[#0B0B0B]/70">
              +{extraPhotos} фото
            </span>
          )}
          {totalStock === 0 ? (
            <span className="rounded-full bg-[#FBEAE8] px-2 py-0.5 text-[9px] font-bold uppercase text-[#B42318]">
              Sold Out
            </span>
          ) : (
            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[9px] font-semibold text-[#0B0B0B]/70 tabular-nums">
              {totalStock} шт.
            </span>
          )}
          {item.hidden && (
            <span className="rounded-full bg-[#0B0B0B] px-2 py-0.5 text-[9px] font-semibold uppercase text-[#F6F6F4]">
              Скрыт
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-xs sm:text-sm font-bold uppercase text-[#0B0B0B] line-clamp-1">
            {item.title}
          </h3>
          <span className="font-display text-xs sm:text-sm font-extrabold text-[#0B0B0B] tabular-nums">
            {item.priceFormatted}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 bg-white/80 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
          >
            <Edit3 className="h-3 w-3" />
            <span>Изменить</span>
          </button>

          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={item.hidden ? 'Показать на витрине' : 'Скрыть с витрины'}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/12 bg-white/75 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/75 hover:text-[#0B0B0B]"
          >
            {item.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{item.hidden ? 'Показать' : 'Скрыть'}</span>
          </button>

          {isConfirming ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={onDelete}
                className="h-8 rounded-full bg-[#B42318] px-3 text-[10px] font-semibold uppercase text-white"
              >
                Удалить
              </button>
              <button
                type="button"
                onClick={() => onAskDelete(null)}
                className="h-8 rounded-full border border-black/12 bg-white/80 px-2.5 text-[10px] font-semibold"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAskDelete(item.id)}
              aria-label={`Удалить ${item.title}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#B42318]/25 bg-white/75 text-[#B42318] hover:bg-[#FBEAE8]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminCatalog({
  initialCreateOpen = false,
  onClearInitialCreate,
  onNotify,
}: AdminCatalogProps) {
  const {
    categories,
    catalogItems,
    getTotalStock,
    addCategory,
    updateCategory,
    reorderCategory,
    deleteCategory,
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    toggleCatalogItemHidden,
  } = useStoreData();

  const [categoryFilter, setCategoryFilter] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(() =>
    createEmptyProductForm(catalogItems.length + 1, categories[0]?.id ?? 'hoodies'),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Category manager sheet state
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatLabel, setEditingCatLabel] = useState('');
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [catBusy, setCatBusy] = useState(false);

  useEffect(() => {
    if (
      categoryFilter !== 'all' &&
      !categories.some((c) => c.id === categoryFilter)
    ) {
      setCategoryFilter('all');
    }
  }, [categoryFilter, categories]);

  useEffect(() => {
    if (initialCreateOpen) {
      setEditingId(null);
      setForm(
        createEmptyProductForm(
          catalogItems.length + 1,
          categories[0]?.id ?? 'hoodies',
        ),
      );
      setFormError(null);
      setEditorOpen(true);
      onClearInitialCreate?.();
    }
  }, [initialCreateOpen, onClearInitialCreate, catalogItems.length, categories]);

  const filterTabs = useMemo(
    () => [
      { id: 'all', label: 'Все вещи', count: catalogItems.length },
      ...categories.map((c) => ({
        id: c.id,
        label: c.label,
        count: catalogItems.filter((i) => i.category === c.id).length,
      })),
    ],
    [categories, catalogItems],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q) {
        const hay = `${item.title} ${item.sku} ${item.categoryLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catalogItems, categoryFilter, searchQuery]);

  const openCreate = () => {
    setEditingId(null);
    setForm(
      createEmptyProductForm(
        catalogItems.length + 1,
        categories[0]?.id ?? 'hoodies',
      ),
    );
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm(formFromCatalogItem(item));
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingProduct) return;

    const numericPrice = Number.parseInt(form.price.replace(/\D/g, ''), 10);

    if (form.title.trim().length < 2) {
      setFormError('Укажите название товара');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setFormError('Укажите корректную цену в рублях');
      return;
    }
    if (form.frames.length === 0) {
      setFormError('Добавьте хотя бы одно фото товара');
      return;
    }

    const catMeta =
      categories.find((c) => c.id === form.category) ?? categories[0];
    if (!catMeta) {
      setFormError('Сначала создайте хотя бы один раздел каталога');
      return;
    }

    const [mainImage, ...gallery] = form.frames;
    const payload = {
      title: form.title,
      sku: form.sku || `NVM-${catMeta.id.slice(0, 2).toUpperCase()}-01`,
      category: catMeta.id,
      categoryLabel: catMeta.label,
      price: numericPrice,
      description: form.description || 'Лимитированная позиция архива NEVERMIND.',
      material: form.material || '100% плотный хлопок · 460 GSM',
      fit: form.fit || 'Oversized Fit',
      sizes: Object.keys(form.stock),
      image: mainImage,
      gallery,
      stock: form.stock,
      hidden: form.hidden,
    };

    setSavingProduct(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateCatalogItem(editingId, payload);
        onNotify(`Товар ${payload.title.toUpperCase()} обновлён`);
      } else {
        await addCatalogItem(payload);
        onNotify(`Товар ${payload.title.toUpperCase()} добавлен в каталог`);
      }
      setEditorOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения товара');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleCreateCategory = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (catBusy) return;
    const label = newCategoryLabel.trim();
    if (label.length < 2) {
      onNotify('Название раздела — минимум 2 символа');
      return;
    }
    setCatBusy(true);
    try {
      const created = await addCategory(label);
      setNewCategoryLabel('');
      onNotify(`Раздел «${created.label}» добавлен`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Не удалось создать раздел');
    } finally {
      setCatBusy(false);
    }
  };

  const handleSaveRenameCategory = async (id: string) => {
    if (catBusy) return;
    const label = editingCatLabel.trim();
    if (label.length < 2) {
      onNotify('Название раздела — минимум 2 символа');
      return;
    }
    setCatBusy(true);
    try {
      const updated = await updateCategory(id, label);
      setEditingCatId(null);
      onNotify(`Раздел переименован в «${updated.label}»`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Не удалось переименовать раздел');
    } finally {
      setCatBusy(false);
    }
  };

  const handleConfirmDeleteCategory = async (id: string) => {
    if (catBusy) return;
    const itemsInCat = catalogItems.filter((i) => i.category === id).length;
    setCatBusy(true);
    try {
      await deleteCategory(id, itemsInCat > 0 ? reassignTargetId : undefined);
      setDeletingCatId(null);
      onNotify('Раздел каталога удалён');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Не удалось удалить раздел');
    } finally {
      setCatBusy(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-1">
            03 / Ассортимент и разделы
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-[-0.03em] text-[#0B0B0B]">
            КАТАЛОГ ({catalogItems.length})
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OpticalButton
            variant="acrylic"
            onClick={() => setCategoriesOpen(true)}
            leadingIcon={<FolderKanban className="h-3.5 w-3.5 shrink-0" />}
            className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.08em]"
          >
            <span>Разделы ({categories.length})</span>
          </OpticalButton>

          <OpticalButton
            variant="dark"
            onClick={openCreate}
            rollingLabel="Добавить товар"
            leadingIcon={<Plus className="h-3.5 w-3.5 shrink-0" />}
            className="h-10 px-5 text-[11px] font-semibold uppercase tracking-[0.08em]"
          />
        </div>
      </div>

      {/* Search & Category Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0B0B0B]/40" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или SKU..."
            className="acrylic-input h-11 w-full rounded-full border border-black/12 pl-10 pr-4 text-xs font-medium text-[#0B0B0B]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {filterTabs.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`h-8 shrink-0 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  active
                    ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                    : 'border-black/10 bg-white/70 text-[#0B0B0B]/65 hover:text-[#0B0B0B]'
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {filteredItems.map((item) => (
          <CatalogAdminRow
            key={item.id}
            item={item}
            totalStock={getTotalStock(item)}
            confirmDeleteId={confirmDeleteId}
            onAskDelete={setConfirmDeleteId}
            onToggleHidden={() => {
              void toggleCatalogItemHidden(item.id)
                .then(() =>
                  onNotify(
                    item.hidden ? `${item.title} показан на витрине` : `${item.title} скрыт`,
                  ),
                )
                .catch((err) =>
                  onNotify(err instanceof Error ? err.message : 'Ошибка обновления'),
                );
            }}
            onEdit={() => openEdit(item)}
            onDelete={() => {
              void deleteCatalogItem(item.id)
                .then(() => {
                  setConfirmDeleteId(null);
                  onNotify(`${item.title} удалён`);
                })
                .catch((err) =>
                  onNotify(err instanceof Error ? err.message : 'Ошибка удаления'),
                );
            }}
          />
        ))}
      </div>

      {/* Dynamic Categories CRUD Bottom Sheet */}
      <BottomSheet
        open={categoriesOpen}
        onClose={() => {
          setCategoriesOpen(false);
          setEditingCatId(null);
          setDeletingCatId(null);
        }}
        eyebrow="Живое управление витриной"
        title="Разделы каталога"
      >
        <div className="space-y-5 pb-6">
          <p className="text-xs leading-[1.6] text-[#0B0B0B]/65">
            Добавляйте, переименовывайте, меняйте порядок или удаляйте разделы. Все изменения
            мгновенно синхронизируются с фильтром витрины.
          </p>

          <div className="space-y-2.5">
            {categories.map((cat, idx) => {
              const itemsCount = catalogItems.filter((i) => i.category === cat.id).length;
              const isEditing = editingCatId === cat.id;
              const isDeleting = deletingCatId === cat.id;
              const otherCategories = categories.filter((c) => c.id !== cat.id);

              return (
                <div
                  key={cat.id}
                  className="acrylic-light rounded-2xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-1.5 min-w-0">
                        <input
                          type="text"
                          value={editingCatLabel}
                          onChange={(e) => setEditingCatLabel(e.target.value)}
                          aria-label="Новое название раздела"
                          className="acrylic-input h-9 flex-1 min-w-0 rounded-xl border border-black/15 px-3 text-xs font-semibold text-[#0B0B0B]"
                        />
                        <button
                          type="button"
                          disabled={catBusy}
                          onClick={() => void handleSaveRenameCategory(cat.id)}
                          aria-label="Сохранить название"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B0B0B] text-[#F6F6F4]"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          aria-label="Отменить переименование"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-xs sm:text-sm font-bold uppercase text-[#0B0B0B] truncate">
                              {cat.label}
                            </span>
                            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[#0B0B0B]/65 tabular-nums">
                              {itemsCount} шт.
                            </span>
                          </div>
                          <p className="text-[10px] font-medium text-[#0B0B0B]/45">
                            slug: {cat.id}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0 || catBusy}
                            onClick={() =>
                              void reorderCategory(cat.id, 'up').catch((err) =>
                                onNotify(
                                  err instanceof Error ? err.message : 'Ошибка сортировки',
                                ),
                              )
                            }
                            aria-label={`Поднять ${cat.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B] disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === categories.length - 1 || catBusy}
                            onClick={() =>
                              void reorderCategory(cat.id, 'down').catch((err) =>
                                onNotify(
                                  err instanceof Error ? err.message : 'Ошибка сортировки',
                                ),
                              )
                            }
                            aria-label={`Опустить ${cat.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B] disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditingCatLabel(cat.label);
                              setDeletingCatId(null);
                            }}
                            aria-label={`Переименовать ${cat.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={categories.length <= 1 || catBusy}
                            onClick={() => {
                              setDeletingCatId(isDeleting ? null : cat.id);
                              setEditingCatId(null);
                              setReassignTargetId(otherCategories[0]?.id ?? '');
                            }}
                            title={
                              categories.length <= 1
                                ? 'Должен остаться минимум 1 раздел'
                                : 'Удалить раздел'
                            }
                            aria-label={`Удалить раздел ${cat.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#B42318]/25 bg-white/80 text-[#B42318] hover:bg-[#FBEAE8] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {isDeleting && (
                    <div className="border-t border-black/10 pt-2.5 space-y-2">
                      {itemsCount > 0 ? (
                        <>
                          <p className="text-[11px] font-medium text-[#0B0B0B]/75">
                            В разделе {itemsCount} товаров. Перенести их перед удалением в:
                          </p>
                          <select
                            value={reassignTargetId}
                            onChange={(e) => setReassignTargetId(e.target.value)}
                            className="acrylic-input h-9 w-full rounded-xl border border-black/15 px-3 text-xs font-semibold text-[#0B0B0B]"
                          >
                            {otherCategories.map((other) => (
                              <option key={other.id} value={other.id}>
                                {other.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <p className="text-[11px] text-[#0B0B0B]/70">
                          Удалить пустой раздел «{cat.label}»?
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={catBusy}
                          onClick={() => void handleConfirmDeleteCategory(cat.id)}
                          className="h-9 flex-1 rounded-full bg-[#B42318] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-white"
                        >
                          {itemsCount > 0 ? 'Перенести и удалить' : 'Удалить раздел'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCatId(null)}
                          className="h-9 rounded-full border border-black/15 bg-white/80 px-3 text-[10px] font-semibold text-[#0B0B0B]"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleCreateCategory}
            className="acrylic-light-strong rounded-2xl p-4 space-y-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/55">
              Новый раздел каталога
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                placeholder="Например: Верхняя одежда"
                className="acrylic-input h-10 flex-1 min-w-0 rounded-full border border-black/12 px-4 text-xs font-semibold text-[#0B0B0B]"
              />
              <button
                type="submit"
                disabled={catBusy}
                className="h-10 shrink-0 rounded-full bg-[#0B0B0B] px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Добавить</span>
              </button>
            </div>
          </form>
        </div>
      </BottomSheet>

      {/* Product Editor Bottom Sheet */}
      <BottomSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        eyebrow={editingId ? 'Редактирование карточки' : 'Новый товар витрины'}
        title={editingId ? form.title || 'Товар' : 'Добавить товар'}
        maxWidthClass="lg:max-w-[640px]"
      >
        <form onSubmit={handleSave} className="space-y-5 pb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60 mb-2">
              Фотографии товара (основное + дополнительные)
            </p>
            <GalleryManager
              frames={form.frames}
              onChange={(nextFrames) => {
                setForm((prev) => ({ ...prev, frames: nextFrames }));
                setFormError(null);
              }}
              onNotify={onNotify}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="VOID ARCHIVE ZIP HOODIE"
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-semibold uppercase text-[#0B0B0B]"
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

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Категория
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    category: e.target.value,
                  }))
                }
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3 text-xs font-semibold text-[#0B0B0B]"
              >
                {categories.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                placeholder="Плотный силуэт, спущенное плечо и фирменная отделка..."
                className="acrylic-input w-full rounded-xl border border-black/12 p-3 text-xs text-[#0B0B0B]"
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60 mb-2">
              Размеры и остатки на складе
            </p>
            <SizeStockEditor
              stock={form.stock}
              onChange={(nextStock) => setForm((p) => ({ ...p, stock: nextStock }))}
            />
          </div>

          <label className="acrylic-light rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-xs font-semibold text-[#0B0B0B]">
              Показывать товар на витрине
            </span>
            <input
              type="checkbox"
              checked={!form.hidden}
              onChange={(e) => setForm((p) => ({ ...p, hidden: !e.target.checked }))}
              className="h-4 w-4 accent-[#0B0B0B]"
            />
          </label>

          {formError && (
            <p className="text-xs font-semibold text-[#B42318]">{formError}</p>
          )}

          <OpticalButton
            type="submit"
            variant="dark"
            disabled={savingProduct}
            rollingLabel={
              savingProduct
                ? 'Сохраняем...'
                : editingId
                  ? 'Сохранить изменения'
                  : 'Добавить на витрину'
            }
            className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
          />
        </form>
      </BottomSheet>
    </div>
  );
}
