import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ClipboardList,
  Plus,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { formatRub, type AdminOrder } from '../data/adminSeed';
import { useStoreData } from '../context/StoreDataContext';
import { OpticalButton, useSpecularPointer } from '../components/OpticalPrimitives';
import { ORDER_STATUS_META, formatShortDateTime } from './AdminShared';

type ChartPeriod = 'day' | 'week' | '14d' | 'month';

interface AdminDashboardProps {
  onOpenOrders: (preset?: { status?: 'active' | 'new' | 'all'; orderId?: string }) => void;
  onAddProduct: () => void;
  onNotify: (message: string) => void;
}

interface KpiCardProps {
  eyebrow: string;
  value: string;
  sublabel: string;
  onClick?: () => void;
}

function KpiCard({ eyebrow, value, sublabel, onClick }: KpiCardProps) {
  const specularRef = useSpecularPointer<HTMLButtonElement>({ magnetic: false });
  const divRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  const inner = (
    <div className="relative z-10 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-2">
        {eyebrow}
      </p>
      <p className="font-display text-xl sm:text-2xl font-black tracking-[-0.03em] text-[#0B0B0B] tabular-nums mb-1">
        {value}
      </p>
      <p className="text-[11px] font-medium text-[#0B0B0B]/58">{sublabel}</p>
    </div>
  );

  if (onClick) {
    return (
      <button
        ref={specularRef}
        type="button"
        onClick={onClick}
        className="acrylic-light specular-card rounded-2xl p-4 sm:p-5 text-left transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
      >
        {inner}
      </button>
    );
  }

  return (
    <div ref={divRef} className="acrylic-light specular-card rounded-2xl p-4 sm:p-5">
      {inner}
    </div>
  );
}

const PERIOD_DAYS: Record<ChartPeriod, number> = {
  day: 1,
  week: 7,
  '14d': 14,
  month: 30,
};

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  '14d': '14 дней',
  month: 'Месяц',
};

function isInLastDays(iso: string, days: number): boolean {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  if (days === 1) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return time >= start.getTime();
  }
  const cutoff = Date.now() - days * 86400000;
  return time >= cutoff;
}

export function AdminDashboard({
  onOpenOrders,
  onAddProduct,
  onNotify,
}: AdminDashboardProps) {
  const { orders, updateOrderStatus } = useStoreData();
  const [period, setPeriod] = useState<ChartPeriod>('14d');
  const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null);

  const chartCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const catCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  // Fixed monthly KPIs required on main screen
  const monthlyStats = useMemo(() => {
    const monthOrders = orders.filter((o) => isInLastDays(o.createdAt, 30));
    const nonCancelledMonth = monthOrders.filter((o) => o.status !== 'cancelled');
    const earnedMonth = nonCancelledMonth.reduce((sum, o) => sum + o.grandTotal, 0);
    const completedMonth = monthOrders.filter((o) => o.status === 'completed').length;
    const activeOrders = orders.filter(
      (o) => o.status === 'new' || o.status === 'confirmed' || o.status === 'shipping',
    );
    const newCount = orders.filter((o) => o.status === 'new').length;

    return {
      earnedMonth,
      monthOrderCount: nonCancelledMonth.length,
      completedMonth,
      activeCount: activeOrders.length,
      newCount,
    };
  }, [orders]);

  // Period-filtered orders for revenue chart, avg check, and top categories
  const periodOrders = useMemo(() => {
    const days = PERIOD_DAYS[period];
    return orders.filter(
      (o) => o.status !== 'cancelled' && isInLastDays(o.createdAt, days),
    );
  }, [orders, period]);

  const avgCheck = useMemo(() => {
    if (periodOrders.length === 0) return 0;
    const sum = periodOrders.reduce((acc, o) => acc + o.grandTotal, 0);
    return Math.round(sum / periodOrders.length);
  }, [periodOrders]);

  // Daily / hourly bar buckets
  const chartBuckets = useMemo(() => {
    if (period === 'day') {
      const slots = [
        { label: '00–04', start: 0, end: 4 },
        { label: '04–08', start: 4, end: 8 },
        { label: '08–12', start: 8, end: 12 },
        { label: '12–16', start: 12, end: 16 },
        { label: '16–20', start: 16, end: 20 },
        { label: '20–24', start: 20, end: 24 },
      ];
      return slots.map((slot) => {
        const matching = periodOrders.filter((o) => {
          const h = new Date(o.createdAt).getHours();
          return h >= slot.start && h < slot.end;
        });
        return {
          label: slot.label,
          fullDate: `Сегодня · ${slot.label}`,
          total: matching.reduce((s, o) => s + o.grandTotal, 0),
          count: matching.length,
        };
      });
    }

    const totalDays = PERIOD_DAYS[period];
    const buckets: Array<{ label: string; fullDate: string; total: number; count: number }> =
      [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = totalDays - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);

      const dayOrders = periodOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      });

      const dayLabel = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      }).format(d);

      buckets.push({
        label: dayLabel,
        fullDate: dayLabel,
        total: dayOrders.reduce((s, o) => s + o.grandTotal, 0),
        count: dayOrders.length,
      });
    }
    return buckets;
  }, [period, periodOrders]);

  const maxBucketTotal = useMemo(
    () => Math.max(1, ...chartBuckets.map((b) => b.total)),
    [chartBuckets],
  );

  const inspectedBucket =
    selectedBarIdx !== null && chartBuckets[selectedBarIdx]
      ? chartBuckets[selectedBarIdx]
      : chartBuckets[chartBuckets.length - 1];

  // Top categories breakdown
  const topCategories = useMemo(() => {
    const map = new Map<string, { label: string; units: number; revenue: number }>();
    for (const order of periodOrders) {
      for (const item of order.items) {
        const existing = map.get(item.categoryLabel) ?? {
          label: item.categoryLabel,
          units: 0,
          revenue: 0,
        };
        existing.units += item.quantity;
        existing.revenue += item.unitPrice * item.quantity;
        map.set(item.categoryLabel, existing);
      }
    }

    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totalRev = list.reduce((s, c) => s + c.revenue, 0);
    return list.slice(0, 5).map((cat) => ({
      ...cat,
      sharePct: totalRev > 0 ? Math.round((cat.revenue / totalRev) * 100) : 0,
    }));
  }, [periodOrders]);

  const recentOrders = useMemo<AdminOrder[]>(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
    [orders],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-1">
            01 / Сводка магазина
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-[-0.03em] text-[#0B0B0B]">
            ДАШБОРД
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OpticalButton
            variant="acrylic"
            onClick={() => onOpenOrders({ status: 'active' })}
            leadingIcon={<ClipboardList className="h-3.5 w-3.5 shrink-0" />}
            className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.08em]"
          >
            <span>Активные ({monthlyStats.activeCount})</span>
          </OpticalButton>

          <OpticalButton
            variant="dark"
            onClick={onAddProduct}
            rollingLabel="Добавить товар"
            leadingIcon={<Plus className="h-3.5 w-3.5 shrink-0" />}
            className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.08em]"
          />
        </div>
      </div>

      {/* 4 Key KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          eyebrow="Заработано · 30 дн"
          value={formatRub(monthlyStats.earnedMonth)}
          sublabel={`${monthlyStats.monthOrderCount} заказов без отмен`}
        />
        <KpiCard
          eyebrow="Активные заказы"
          value={String(monthlyStats.activeCount)}
          sublabel={
            monthlyStats.newCount > 0
              ? `${monthlyStats.newCount} ждут подтверждения`
              : 'Все подтверждены'
          }
          onClick={() => onOpenOrders({ status: 'active' })}
        />
        <KpiCard
          eyebrow="Выполнено · 30 дн"
          value={String(monthlyStats.completedMonth)}
          sublabel="Успешно доставлено"
          onClick={() => onOpenOrders({ status: 'all' })}
        />
        <KpiCard
          eyebrow={`Средний чек · ${PERIOD_LABELS[period]}`}
          value={formatRub(avgCheck)}
          sublabel={`Заказов за период: ${periodOrders.length}`}
        />
      </div>

      {/* Analytics Row: Monochrome Daily Revenue Chart + Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Monochrome Interactive Revenue Chart */}
        <div
          ref={chartCardRef}
          className="lg:col-span-7 acrylic-light specular-card rounded-2xl p-4 sm:p-6"
        >
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-0.5">
                  Динамика выручки
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0B0B0B]">
                  <TrendingUp className="h-3.5 w-3.5 text-[#0B0B0B]/60" />
                  <span>
                    {inspectedBucket
                      ? `${inspectedBucket.fullDate}: ${formatRub(inspectedBucket.total)} (${inspectedBucket.count} зак.)`
                      : 'Нет данных'}
                  </span>
                </div>
              </div>

              <div className="flex items-center rounded-full border border-black/10 bg-white/65 p-0.5">
                {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map((key) => {
                  const active = period === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPeriod(key);
                        setSelectedBarIdx(null);
                      }}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                        active
                          ? 'bg-[#0B0B0B] text-[#F6F6F4]'
                          : 'bg-transparent text-[#0B0B0B]/60 hover:text-[#0B0B0B]'
                      }`}
                    >
                      {PERIOD_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Responsive Bar Chart */}
            <div className="h-44 sm:h-48 flex items-end gap-1 sm:gap-1.5 pt-4 border-b border-black/10">
              {chartBuckets.map((bucket, idx) => {
                const heightPct =
                  bucket.total > 0
                    ? Math.max(10, Math.round((bucket.total / maxBucketTotal) * 100))
                    : 4;
                const isSelected = selectedBarIdx === idx;
                return (
                  <button
                    key={`${bucket.label}-${idx}`}
                    type="button"
                    onClick={() => setSelectedBarIdx(idx)}
                    onMouseEnter={() => setSelectedBarIdx(idx)}
                    aria-label={`${bucket.fullDate}: ${formatRub(bucket.total)}`}
                    className="group relative flex-1 h-full flex flex-col justify-end items-center bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <span
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[26px] rounded-t-md transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        bucket.total === 0
                          ? 'bg-black/[0.07]'
                          : isSelected
                            ? 'bg-[#0B0B0B] shadow-[0_6px_16px_rgba(0,0,0,0.2)]'
                            : 'bg-[#0B0B0B]/30 group-hover:bg-[#0B0B0B]/70'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] font-medium text-[#0B0B0B]/48 pt-2">
              <span>{chartBuckets[0]?.label}</span>
              <span>Нажмите на столбец для детализации</span>
              <span>{chartBuckets[chartBuckets.length - 1]?.label}</span>
            </div>
          </div>
        </div>

        {/* Top Categories by Sales */}
        <div
          ref={catCardRef}
          className="lg:col-span-5 acrylic-light specular-card rounded-2xl p-4 sm:p-6"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-0.5">
                  Аналитика ассортимента
                </p>
                <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.02em] text-[#0B0B0B]">
                  Топ категорий по продажам
                </h2>
              </div>
              <ShoppingBag className="h-4 w-4 text-[#0B0B0B]/45" />
            </div>

            {topCategories.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#0B0B0B]/55">
                За выбранный период продаж ещё не было.
              </p>
            ) : (
              <div className="space-y-3.5">
                {topCategories.map((cat) => (
                  <div key={cat.label}>
                    <div className="flex items-baseline justify-between gap-2 text-xs mb-1.5">
                      <span className="font-semibold text-[#0B0B0B] truncate">
                        {cat.label}{' '}
                        <span className="text-[10px] font-medium text-[#0B0B0B]/48">
                          · {cat.units} шт.
                        </span>
                      </span>
                      <span className="font-bold text-[#0B0B0B] tabular-nums whitespace-nowrap">
                        {formatRub(cat.revenue)} ({cat.sharePct}%)
                      </span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-black/[0.08] overflow-hidden">
                      <div
                        style={{
                          transform: `scaleX(${Math.max(0.06, cat.sharePct / 100).toFixed(3)})`,
                        }}
                        className="h-full w-full rounded-full bg-[#0B0B0B] origin-left transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest Orders List with Quick 1-Tap Confirm */}
      <div className="acrylic-light rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-0.5">
              Оперативная лента
            </p>
            <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-[0.01em] text-[#0B0B0B]">
              Последние заказы
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onOpenOrders({ status: 'all' })}
            className="inline-flex items-center gap-1 bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/65 hover:text-[#0B0B0B]"
          >
            <span>Все заказы</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {recentOrders.map((order) => {
            const meta = ORDER_STATUS_META[order.status];
            const itemsQty = order.items.reduce((s, i) => s + i.quantity, 0);

            return (
              <div
                key={order.id}
                className="acrylic-light-strong rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onOpenOrders({ orderId: order.id })}
                  className="min-w-0 flex-1 text-left bg-transparent border-0 p-0"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-display text-xs font-extrabold text-[#0B0B0B] tabular-nums">
                      #{order.orderNumber}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-[#0B0B0B]/50 tabular-nums">
                      {formatShortDateTime(order.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-[#0B0B0B]/80 truncate">
                    {order.customer.fullName} · {itemsQty} шт. · {order.delivery.label}
                  </p>
                </button>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                  <span className="font-display text-sm font-extrabold text-[#0B0B0B] tabular-nums">
                    {formatRub(order.grandTotal)}
                  </span>

                  {order.status === 'new' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void updateOrderStatus(order.id, 'confirmed')
                          .then(() =>
                            onNotify(`Заказ #${order.orderNumber} подтверждён`),
                          )
                          .catch((err) =>
                            onNotify(
                              err instanceof Error ? err.message : 'Ошибка подтверждения',
                            ),
                          );
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0B0B0B] px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] transition-transform active:scale-95"
                    >
                      <Check className="h-3 w-3" />
                      <span>Подтвердить</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenOrders({ orderId: order.id })}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-black/15 bg-white/80 px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
                    >
                      <span>Открыть</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
