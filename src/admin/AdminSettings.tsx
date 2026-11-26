import { useEffect, useState, type FormEvent } from 'react';
import { Database, Plus, RotateCcw, Tag, Trash2, X } from 'lucide-react';
import { formatRub } from '../data/adminSeed';
import { useStoreData } from '../context/StoreDataContext';
import { OpticalButton, useSpecularPointer } from '../components/OpticalPrimitives';
import { formatShortDateTime } from './AdminShared';

interface AdminSettingsProps {
  onNotify: (message: string) => void;
}

export function AdminSettings({ onNotify }: AdminSettingsProps) {
  const {
    promos,
    settings,
    dbStats,
    addPromo,
    togglePromo,
    deletePromo,
    updateSettings,
    purgeExpiredOrders,
    resetDemoData,
  } = useStoreData();

  // New promo form
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState<'percent' | 'fixed'>('percent');
  const [promoValue, setPromoValue] = useState('15');
  const [promoMin, setPromoMin] = useState('');

  // Store settings draft
  const [threshold, setThreshold] = useState(String(settings.freeDeliveryThreshold));
  const [courierPrice, setCourierPrice] = useState(String(settings.courierMskPrice));
  const [cdekPrice, setCdekPrice] = useState(String(settings.cdekRfPrice));
  const [showroomCity, setShowroomCity] = useState(settings.showroomCity);
  const [showroomAddress, setShowroomAddress] = useState(settings.showroomAddress);
  const [showroomHoursTitle, setShowroomHoursTitle] = useState(settings.showroomHoursTitle);
  const [showroomHoursSubtitle, setShowroomHoursSubtitle] = useState(
    settings.showroomHoursSubtitle,
  );

  // Ticker phrase input
  const [newTicker, setNewTicker] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [purging, setPurging] = useState(false);

  const promoCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const deliveryCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const tickerCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const dbCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  useEffect(() => {
    setThreshold(String(settings.freeDeliveryThreshold));
    setCourierPrice(String(settings.courierMskPrice));
    setCdekPrice(String(settings.cdekRfPrice));
    setShowroomCity(settings.showroomCity);
    setShowroomAddress(settings.showroomAddress);
    setShowroomHoursTitle(settings.showroomHoursTitle);
    setShowroomHoursSubtitle(settings.showroomHoursSubtitle);
  }, [settings]);

  const handleAddPromo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = Number.parseInt(promoValue.replace(/\D/g, ''), 10);
    const min = Number.parseInt(promoMin.replace(/\D/g, ''), 10);
    if (!promoCode.trim() || !Number.isFinite(val) || val <= 0) {
      onNotify('Укажите код и размер скидки');
      return;
    }

    try {
      const created = await addPromo({
        code: promoCode,
        type: promoType,
        value: promoType === 'percent' ? Math.min(90, val) : val,
        minOrderAmount: Number.isFinite(min) && min > 0 ? min : undefined,
        active: true,
      });

      if (!created) {
        onNotify('Такой промокод уже существует');
        return;
      }

      setPromoCode('');
      setPromoMin('');
      onNotify(`Промокод ${created.code} создан`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания промокода');
    }
  };

  const handleSaveSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await updateSettings({
        freeDeliveryThreshold: Math.max(
          0,
          Number.parseInt(threshold.replace(/\D/g, ''), 10) || 0,
        ),
        courierMskPrice: Math.max(
          0,
          Number.parseInt(courierPrice.replace(/\D/g, ''), 10) || 0,
        ),
        cdekRfPrice: Math.max(
          0,
          Number.parseInt(cdekPrice.replace(/\D/g, ''), 10) || 0,
        ),
        showroomCity: showroomCity.trim() || 'Москва · Центр',
        showroomAddress: showroomAddress.trim() || 'Столешников переулок',
        showroomHoursTitle: showroomHoursTitle.trim() || 'Пн — Вс',
        showroomHoursSubtitle: showroomHoursSubtitle.trim() || '12:00 — 21:00',
      });
      onNotify('Настройки доставки и шоурума сохранены в БД');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения настроек');
    }
  };

  const handleAddTicker = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleaned = newTicker.trim().toUpperCase();
    if (!cleaned) return;
    try {
      await updateSettings({
        tickerItems: [...settings.tickerItems, cleaned],
      });
      setNewTicker('');
      onNotify('Фраза добавлена в бегущую строку');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Ошибка обновления');
    }
  };

  const handleManualPurge = async () => {
    if (purging) return;
    setPurging(true);
    try {
      const deleted = await purgeExpiredOrders();
      onNotify(
        deleted > 0
          ? `Удалено выполненных заказов (> ${dbStats?.retentionDays ?? 30} дн.): ${deleted}`
          : `Устаревших заказов (> ${dbStats?.retentionDays ?? 30} дн.) не найдено`,
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Ошибка очистки БД');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-1">
          05 / Управление витриной, скидками и БД
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-[-0.03em] text-[#0B0B0B]">
          НАСТРОЙКИ И БАЗА ДАННЫХ
        </h1>
      </div>

      {/* 1. Promo Codes */}
      <div
        ref={promoCardRef}
        className="acrylic-light specular-card rounded-2xl p-4 sm:p-6"
      >
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50">
                Промокоды витрины
              </p>
              <h2 className="font-display text-sm sm:text-base font-extrabold uppercase text-[#0B0B0B]">
                Управление скидками ({promos.length})
              </h2>
            </div>
            <Tag className="h-4 w-4 text-[#0B0B0B]/45" />
          </div>

          <div className="space-y-2">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="acrylic-light-strong rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${
                      promo.active
                        ? 'bg-[#0B0B0B] text-[#F6F6F4]'
                        : 'bg-black/10 text-[#0B0B0B]/55'
                    }`}
                  >
                    {promo.code}
                  </span>
                  <span className="text-xs font-bold text-[#0B0B0B] tabular-nums">
                    {promo.type === 'percent'
                      ? `−${promo.value}%`
                      : `−${formatRub(promo.value)}`}
                  </span>
                  {promo.minOrderAmount && (
                    <span className="text-[11px] text-[#0B0B0B]/55 tabular-nums">
                      от {formatRub(promo.minOrderAmount)}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-[#0B0B0B]/48 tabular-nums">
                    · Использован: {promo.usageCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void togglePromo(promo.id)
                        .then(() =>
                          onNotify(
                            promo.active
                              ? `${promo.code} выключен`
                              : `${promo.code} включён`,
                          ),
                        )
                        .catch((err) =>
                          onNotify(
                            err instanceof Error ? err.message : 'Ошибка обновления',
                          ),
                        );
                    }}
                    className={`h-8 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      promo.active
                        ? 'border-[#1D5B34]/25 bg-[#E7EFE9] text-[#1D5B34]'
                        : 'border-black/15 bg-white/80 text-[#0B0B0B]/65'
                    }`}
                  >
                    {promo.active ? 'Активен' : 'Выкл'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void deletePromo(promo.id)
                        .then(() => onNotify(`Промокод ${promo.code} удалён`))
                        .catch((err) =>
                          onNotify(err instanceof Error ? err.message : 'Ошибка удаления'),
                        );
                    }}
                    aria-label={`Удалить ${promo.code}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#B42318]/25 bg-white/75 text-[#B42318]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddPromo}
            className="grid grid-cols-2 sm:grid-cols-12 gap-2 border-t border-black/10 pt-4"
          >
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="КОД (напр. DROP15)"
              className="col-span-2 sm:col-span-4 acrylic-input h-10 rounded-xl border border-black/12 px-3 text-xs font-semibold uppercase text-[#0B0B0B]"
            />
            <select
              value={promoType}
              onChange={(e) =>
                setPromoType(e.target.value as 'percent' | 'fixed')
              }
              className="sm:col-span-2 acrylic-input h-10 rounded-xl border border-black/12 px-2.5 text-xs font-semibold text-[#0B0B0B]"
            >
              <option value="percent">% скидка</option>
              <option value="fixed">₽ скидка</option>
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={promoValue}
              onChange={(e) => setPromoValue(e.target.value.replace(/\D/g, ''))}
              placeholder={promoType === 'percent' ? '15' : '2000'}
              className="sm:col-span-2 acrylic-input h-10 rounded-xl border border-black/12 px-3 text-xs font-bold tabular-nums text-[#0B0B0B]"
            />
            <input
              type="text"
              inputMode="numeric"
              value={promoMin}
              onChange={(e) => setPromoMin(e.target.value.replace(/\D/g, ''))}
              placeholder="Мин. ₽ (опц.)"
              className="col-span-2 sm:col-span-2 acrylic-input h-10 rounded-xl border border-black/12 px-3 text-xs tabular-nums text-[#0B0B0B]"
            />
            <button
              type="submit"
              className="col-span-2 sm:col-span-2 h-10 rounded-full bg-[#0B0B0B] px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] inline-flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Создать</span>
            </button>
          </form>
        </div>
      </div>

      {/* 2. Delivery & Showroom Settings */}
      <div
        ref={deliveryCardRef}
        className="acrylic-light specular-card rounded-2xl p-4 sm:p-6"
      >
        <form onSubmit={handleSaveSettings} className="relative z-10 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50">
              Тарифы и точки выдачи
            </p>
            <h2 className="font-display text-sm sm:text-base font-extrabold uppercase text-[#0B0B0B]">
              Доставка и шоурум
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Бесплатная доставка от (₽)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-bold tabular-nums text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Курьер по Москве (₽)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={courierPrice}
                onChange={(e) => setCourierPrice(e.target.value.replace(/\D/g, ''))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-bold tabular-nums text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                СДЭК ПВЗ по РФ (₽)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cdekPrice}
                onChange={(e) => setCdekPrice(e.target.value.replace(/\D/g, ''))}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-bold tabular-nums text-[#0B0B0B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Шоурум (заголовок)
              </label>
              <input
                type="text"
                value={showroomCity}
                onChange={(e) => setShowroomCity(e.target.value)}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-semibold text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                Шоурум (адрес)
              </label>
              <input
                type="text"
                value={showroomAddress}
                onChange={(e) => setShowroomAddress(e.target.value)}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                График работы (дни)
              </label>
              <input
                type="text"
                value={showroomHoursTitle}
                onChange={(e) => setShowroomHoursTitle(e.target.value)}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs font-semibold text-[#0B0B0B]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0B0B0B]/60 mb-1">
                График работы (часы)
              </label>
              <input
                type="text"
                value={showroomHoursSubtitle}
                onChange={(e) => setShowroomHoursSubtitle(e.target.value)}
                className="acrylic-input h-10 w-full rounded-xl border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
              />
            </div>
          </div>

          <OpticalButton
            type="submit"
            variant="dark"
            rollingLabel="Сохранить настройки"
            className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.08em]"
          />
        </form>
      </div>

      {/* 3. Storefront Ticker Phrases */}
      <div
        ref={tickerCardRef}
        className="acrylic-light specular-card rounded-2xl p-4 sm:p-6"
      >
        <div className="relative z-10 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50">
              Бегущая строка витрины (FrostedSpecTicker)
            </p>
            <h2 className="font-display text-sm sm:text-base font-extrabold uppercase text-[#0B0B0B]">
              Фразы на главной странице
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.tickerItems.map((phrase, idx) => (
              <span
                key={`${phrase}-${idx}`}
                className="acrylic-light-strong inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]"
              >
                <span>{phrase}</span>
                {settings.tickerItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      void updateSettings({
                        tickerItems: settings.tickerItems.filter((_, i) => i !== idx),
                      })
                        .then(() => onNotify('Фраза удалена'))
                        .catch((err) =>
                          onNotify(
                            err instanceof Error ? err.message : 'Ошибка удаления',
                          ),
                        );
                    }}
                    aria-label={`Удалить фразу ${phrase}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/10 text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4]"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>

          <form onSubmit={handleAddTicker} className="flex items-center gap-2">
            <input
              type="text"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              placeholder="Новая фраза (напр. WINTER CAPSULE 26)..."
              className="acrylic-input h-10 flex-1 min-w-0 rounded-full border border-black/12 px-4 text-xs font-semibold uppercase text-[#0B0B0B]"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-full bg-[#0B0B0B] px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4]"
            >
              + Добавить
            </button>
          </form>
        </div>
      </div>

      {/* 4. 30-Day Completed Order Auto-Purge */}
      <div
        ref={dbCardRef}
        className="acrylic-light specular-card rounded-2xl p-4 sm:p-6"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7EFE9] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1D5B34]">
                <Database className="h-3 w-3" />
                <span>База данных · Активна</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/50">
                Хранение: {dbStats?.retentionDays ?? 30} дней
              </span>
            </div>

            <h2 className="font-display text-sm sm:text-base font-extrabold uppercase text-[#0B0B0B]">
              Автоудаление выполненных заказов
            </h2>
            <p className="text-[11px] leading-[1.55] text-[#0B0B0B]/62">
              Выполненные заказы автоматически удаляются из базы через{' '}
              {dbStats?.retentionDays ?? 30} дней после получения статуса «Выполнен» (152-ФЗ).
              В БД: {dbStats?.totalOrders ?? 0} заказов ({dbStats?.completedOrders ?? 0}{' '}
              выполнено).
              {dbStats?.lastPurgedAt
                ? ` Последняя проверка: ${formatShortDateTime(dbStats.lastPurgedAt)} (удалено: ${dbStats.lastPurgedCount}).`
                : ''}
            </p>
          </div>

          <button
            type="button"
            disabled={purging}
            onClick={() => void handleManualPurge()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-black/15 bg-white/85 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors disabled:opacity-50"
          >
            <span>{purging ? 'Проверка...' : 'Очистить устаревшие сейчас'}</span>
          </button>
        </div>
      </div>

      {/* 5. Demo Reset */}
      <div className="acrylic-light rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#0B0B0B]">
            Сброс демо-данных БД
          </p>
          <p className="text-[11px] text-[#0B0B0B]/60">
            Вернуть каталог, разделы, бестселлеры, заказы, промокоды и медиа к стартовому
            состоянию.
          </p>
        </div>

        {confirmReset ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await resetDemoData();
                  setConfirmReset(false);
                  onNotify('База данных сброшена к демо-состоянию');
                } catch (err) {
                  onNotify(
                    err instanceof Error ? err.message : 'Ошибка сброса БД',
                  );
                }
              }}
              className="h-10 rounded-full bg-[#B42318] px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
            >
              Подтвердить сброс
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="h-10 rounded-full border border-black/15 bg-white/80 px-4 text-[11px] font-semibold text-[#0B0B0B]"
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-black/15 bg-white/80 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:border-[#B42318] hover:text-[#B42318] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Сбросить демо</span>
          </button>
        )}
      </div>
    </div>
  );
}
