import { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Phone,
  Search,
  Send,
  Truck,
  X,
} from 'lucide-react';
import {
  formatRub,
  type AdminOrder,
  type OrderStatus,
  type PaymentStatus,
} from '../data/adminSeed';
import { useStoreData } from '../context/StoreDataContext';
import { useSpecularPointer } from '../components/OpticalPrimitives';
import {
  AdminImagePreview,
  BottomSheet,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  formatDateKey,
  formatShortDateTime,
} from './AdminShared';

export type OrderPeriodFilter = 'day' | 'week' | '14d' | 'month' | 'all';
export type OrderStatusFilter = 'all' | 'active' | OrderStatus;

interface AdminOrdersProps {
  initialStatusFilter?: OrderStatusFilter;
  initialOrderId?: string | null;
  onClearInitialOrder?: () => void;
  onNotify: (message: string) => void;
}

const PERIOD_OPTIONS: Array<{ id: OrderPeriodFilter; label: string }> = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: '14d', label: '14 дней' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Все' },
];

const STATUS_OPTIONS: Array<{ id: OrderStatusFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Активные' },
  { id: 'new', label: 'Новые' },
  { id: 'confirmed', label: 'Подтверждены' },
  { id: 'shipping', label: 'В доставке' },
  { id: 'completed', label: 'Выполнены' },
  { id: 'cancelled', label: 'Отменены' },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function matchesPeriod(iso: string, period: OrderPeriodFilter): boolean {
  if (period === 'all') return true;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;

  if (period === 'day') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return time >= start.getTime();
  }

  const days = period === 'week' ? 7 : period === '14d' ? 14 : 30;
  return time >= Date.now() - days * 86400000;
}

function getRemainingRetentionDays(
  completedAt: string | null | undefined,
  retentionDays: number,
): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime();
  if (Number.isNaN(ms)) return null;
  const expiresAt = ms + retentionDays * 86_400_000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
}

interface OrderCardRowProps {
  order: AdminOrder;
  retentionDays: number;
  confirmCancelId: string | null;
  onAskCancel: (id: string | null) => void;
  onOpen: () => void;
  onQuickStatus: (nextStatus: OrderStatus) => void;
}

function OrderCardRow({
  order,
  retentionDays,
  confirmCancelId,
  onAskCancel,
  onOpen,
  onQuickStatus,
}: OrderCardRowProps) {
  const specularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const statusMeta = ORDER_STATUS_META[order.status];
  const paymentMeta = PAYMENT_STATUS_META[order.paymentStatus];
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const isConfirmingCancel = confirmCancelId === order.id;
  const daysLeft =
    order.status === 'completed'
      ? getRemainingRetentionDays(order.completedAt, retentionDays)
      : null;

  return (
    <div
      ref={specularRef}
      className="acrylic-light specular-card rounded-2xl p-4 transition-transform duration-250 hover:-translate-y-[1px]"
    >
      <div className="relative z-10 space-y-3">
        <div
          onClick={onOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
          className="cursor-pointer focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs sm:text-sm font-black text-[#0B0B0B] tabular-nums">
                #{order.orderNumber}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${paymentMeta.badgeClass}`}
              >
                {paymentMeta.label}
              </span>
              {daysLeft !== null && (
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-[#0B0B0B]/60 tabular-nums">
                  Удаление через {daysLeft} дн.
                </span>
              )}
            </div>

            <span className="font-display text-sm sm:text-base font-black text-[#0B0B0B] tabular-nums">
              {formatRub(order.grandTotal)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#0B0B0B]/72">
            <p className="font-semibold text-[#0B0B0B]">
              {order.customer.fullName}{' '}
              <span className="font-normal text-[#0B0B0B]/60">· {order.customer.phone}</span>
            </p>
            <span className="text-[11px] text-[#0B0B0B]/50 tabular-nums">
              {formatShortDateTime(order.createdAt)}
            </span>
          </div>

          <p className="mt-1 text-[11px] text-[#0B0B0B]/58 line-clamp-1">
            {order.delivery.label} · {totalQty} шт. · {order.items.map((i) => i.title).join(', ')}
          </p>
        </div>

        {/* Quick 1-Tap Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.08] pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {order.status === 'new' && (
              <button
                type="button"
                onClick={() => onQuickStatus('confirmed')}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0B0B0B] px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] active:scale-95"
              >
                <Check className="h-3 w-3" />
                <span>Подтвердить</span>
              </button>
            )}

            {order.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onQuickStatus('shipping')}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0B0B0B] px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#F6F6F4] active:scale-95"
              >
                <Truck className="h-3 w-3" />
                <span>В доставку</span>
              </button>
            )}

            {order.status === 'shipping' && (
              <button
                type="button"
                onClick={() => onQuickStatus('completed')}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1D5B34] px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white active:scale-95"
              >
                <Check className="h-3 w-3" />
                <span>Выполнен</span>
              </button>
            )}

            {(order.status === 'new' || order.status === 'confirmed') &&
              (isConfirmingCancel ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onQuickStatus('cancelled');
                      onAskCancel(null);
                    }}
                    className="h-8 rounded-full bg-[#B42318] px-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-white"
                  >
                    Точно отменить
                  </button>
                  <button
                    type="button"
                    onClick={() => onAskCancel(null)}
                    className="h-8 rounded-full border border-black/15 bg-white/80 px-2.5 text-[10px] font-semibold text-[#0B0B0B]"
                  >
                    Нет
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onAskCancel(order.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#B42318]/25 bg-white/75 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#B42318] hover:bg-[#FBEAE8]"
                >
                  <X className="h-3 w-3" />
                  <span>Отменить</span>
                </button>
              ))}
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="h-8 rounded-full border border-black/12 bg-white/75 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
          >
            Детали
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminOrders({
  initialStatusFilter = 'all',
  initialOrderId = null,
  onClearInitialOrder,
  onNotify,
}: AdminOrdersProps) {
  const {
    orders,
    dbStats,
    updateOrderStatus,
    updateOrderPaymentStatus,
    updateOrderTracking,
    updateOrderNote,
  } = useStoreData();
  const retentionDays = dbStats?.retentionDays ?? 30;

  const [periodFilter, setPeriodFilter] = useState<OrderPeriodFilter>('month');
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(initialStatusFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(initialOrderId);

  // Detail sheet local inputs
  const [trackingDraft, setTrackingDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [sheetConfirmCancel, setSheetConfirmCancel] = useState(false);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialOrderId) {
      setActiveOrderId(initialOrderId);
      onClearInitialOrder?.();
    }
  }, [initialOrderId, onClearInitialOrder]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId) ?? null,
    [orders, activeOrderId],
  );

  useEffect(() => {
    if (!activeOrder) return;
    setTrackingDraft(activeOrder.delivery.trackingNumber ?? '');
    setNoteDraft(activeOrder.managerNote ?? '');
    setCancelReasonDraft(activeOrder.cancelReason ?? '');
    setSheetConfirmCancel(false);
  }, [activeOrder]);

  // Orders grouped by YYYY-MM-DD for calendar dots
  const ordersByDay = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const order of orders) {
      const d = new Date(order.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = formatDateKey(d);
      const curr = map.get(key) ?? { count: 0, total: 0 };
      curr.count += 1;
      if (order.status !== 'cancelled') curr.total += order.grandTotal;
      map.set(key, curr);
    }
    return map;
  }, [orders]);

  // Calendar grid days (Monday first)
  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6

    const cells: Array<{ key: string; day: number } | null> = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateObj = new Date(year, month, day);
      cells.push({ key: formatDateKey(dateObj), day });
    }
    return cells;
  }, [calendarMonth]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        if (selectedDayKey) {
          const d = new Date(order.createdAt);
          if (Number.isNaN(d.getTime()) || formatDateKey(d) !== selectedDayKey) {
            return false;
          }
        } else if (!matchesPeriod(order.createdAt, periodFilter)) {
          return false;
        }

        if (statusFilter === 'active') {
          if (
            order.status !== 'new' &&
            order.status !== 'confirmed' &&
            order.status !== 'shipping'
          ) {
            return false;
          }
        } else if (statusFilter !== 'all' && order.status !== statusFilter) {
          return false;
        }

        if (q) {
          const hay = [
            order.orderNumber,
            order.customer.fullName,
            order.customer.phone,
            order.customer.email,
            order.customer.telegram ?? '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, selectedDayKey, periodFilter, statusFilter, searchQuery]);

  const summaryStats = useMemo(() => {
    const completed = filteredOrders.filter((o) => o.status === 'completed').length;
    const sum = filteredOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((acc, o) => acc + o.grandTotal, 0);
    return { count: filteredOrders.length, completed, sum };
  }, [filteredOrders]);

  const handleQuickStatus = (order: AdminOrder, nextStatus: OrderStatus) => {
    void updateOrderStatus(order.id, nextStatus)
      .then(() => {
        onNotify(`#${order.orderNumber}: ${ORDER_STATUS_META[nextStatus].label}`);
      })
      .catch((err) => {
        onNotify(err instanceof Error ? err.message : 'Ошибка обновления статуса');
      });
  };

  const monthTitle = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonth);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-1">
            02 / Управление заказами
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-[-0.03em] text-[#0B0B0B]">
            ЗАКАЗЫ
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setCalendarOpen((prev) => !prev)}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
            calendarOpen || selectedDayKey
              ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
              : 'acrylic-light-strong text-[#0B0B0B]'
          }`}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>{selectedDayKey ? `Дата: ${selectedDayKey}` : 'Календарь'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              calendarOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Period Filter Pills + Summary Strip */}
      <div className="acrylic-light rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {PERIOD_OPTIONS.map((opt) => {
            const active = !selectedDayKey && periodFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedDayKey(null);
                  setPeriodFilter(opt.id);
                }}
                className={`h-8 shrink-0 rounded-full border px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  active
                    ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                    : 'border-black/10 bg-white/75 text-[#0B0B0B]/68 hover:text-[#0B0B0B]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.07] pt-2.5 text-xs text-[#0B0B0B]/70">
          <span>
            Найдено заказов:{' '}
            <strong className="font-bold text-[#0B0B0B] tabular-nums">
              {summaryStats.count}
            </strong>{' '}
            · Выполнено:{' '}
            <strong className="font-bold text-[#0B0B0B] tabular-nums">
              {summaryStats.completed}
            </strong>
          </span>
          <span className="font-display text-xs sm:text-sm font-extrabold text-[#0B0B0B] tabular-nums">
            {formatRub(summaryStats.sum)}
          </span>
        </div>
      </div>

      {/* Collapsible Interactive Orders Calendar */}
      {calendarOpen && (
        <div className="animate-optical-roll-in acrylic-light-strong rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
              aria-label="Предыдущий месяц"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <p className="font-display text-xs sm:text-sm font-extrabold uppercase tracking-[0.04em] text-[#0B0B0B]">
              {monthTitle}
            </p>

            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
              aria-label="Следующий месяц"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/45 mb-1.5">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} className="h-10" />;
              const info = ordersByDay.get(cell.key);
              const isSelected = selectedDayKey === cell.key;
              const dotCount = info ? Math.min(3, info.count) : 0;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() =>
                    setSelectedDayKey((prev) => (prev === cell.key ? null : cell.key))
                  }
                  className={`h-10 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isSelected
                      ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                      : info
                        ? 'border-black/12 bg-white/80 text-[#0B0B0B] hover:border-black/35'
                        : 'border-transparent bg-transparent text-[#0B0B0B]/45 hover:bg-white/50'
                  }`}
                >
                  <span className="text-[11px] font-bold tabular-nums leading-none">
                    {cell.day}
                  </span>
                  <span className="flex items-center gap-0.5 h-1.5">
                    {Array.from({ length: dotCount }).map((_, dIdx) => (
                      <span
                        key={dIdx}
                        className={`h-1 w-1 rounded-full ${
                          isSelected ? 'bg-[#F6F6F4]' : 'bg-[#0B0B0B]'
                        }`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedDayKey && (
            <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-2.5 text-xs">
              <span className="text-[#0B0B0B]/70">
                Фильтр по дате: <strong className="text-[#0B0B0B]">{selectedDayKey}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] underline underline-offset-4"
              >
                Сбросить день
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search & Status Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0B0B0B]/40" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру #NVM, имени, телефону или @telegram..."
            className="acrylic-input h-11 w-full rounded-full border border-black/12 pl-10 pr-4 text-xs font-medium text-[#0B0B0B] placeholder:text-[#0B0B0B]/40"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`h-8 shrink-0 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  active
                    ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                    : 'border-black/10 bg-white/70 text-[#0B0B0B]/65 hover:text-[#0B0B0B]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="acrylic-light rounded-2xl p-10 text-center">
          <p className="font-display text-sm font-extrabold uppercase text-[#0B0B0B] mb-1.5">
            Заказы не найдены
          </p>
          <p className="text-xs text-[#0B0B0B]/58">
            Попробуйте расширить период дат или сбросить фильтры.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCardRow
              key={order.id}
              order={order}
              retentionDays={retentionDays}
              confirmCancelId={confirmCancelId}
              onAskCancel={setConfirmCancelId}
              onOpen={() => setActiveOrderId(order.id)}
              onQuickStatus={(nextStatus) => handleQuickStatus(order, nextStatus)}
            />
          ))}
        </div>
      )}

      {/* Order Detail Bottom Sheet / Side Drawer */}
      <BottomSheet
        open={Boolean(activeOrder)}
        onClose={() => setActiveOrderId(null)}
        eyebrow={activeOrder ? formatShortDateTime(activeOrder.createdAt) : undefined}
        title={activeOrder ? `Заказ #${activeOrder.orderNumber}` : ''}
      >
        {activeOrder && (
          <div className="space-y-5 pb-6">
            {/* Status & Payment Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                  ORDER_STATUS_META[activeOrder.status].badgeClass
                }`}
              >
                {ORDER_STATUS_META[activeOrder.status].label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                  PAYMENT_STATUS_META[activeOrder.paymentStatus].badgeClass
                }`}
              >
                Оплата: {PAYMENT_STATUS_META[activeOrder.paymentStatus].label}
              </span>
              {activeOrder.status === 'completed' &&
                (() => {
                  const left = getRemainingRetentionDays(
                    activeOrder.completedAt,
                    retentionDays,
                  );
                  return left !== null ? (
                    <span className="inline-flex items-center rounded-full border border-black/12 bg-white/80 px-3 py-1 text-[10px] font-semibold text-[#0B0B0B]/70 tabular-nums">
                      Автоудаление через {left} дн.
                    </span>
                  ) : null;
                })()}
            </div>

            {/* Client Block */}
            <div className="acrylic-light rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/48">
                  Клиент
                </p>
                {activeOrder.consentAcceptedAt && (
                  <span className="rounded-full bg-[#E7EFE9] px-2.5 py-0.5 text-[10px] font-semibold text-[#1D5B34]">
                    152-ФЗ: согласие · {formatShortDateTime(activeOrder.consentAcceptedAt)}
                  </span>
                )}
              </div>
              <p className="font-display text-sm font-bold text-[#0B0B0B]">
                {activeOrder.customer.fullName}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`tel:${activeOrder.customer.phone.replace(/[^+\d]/g, '')}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/12 bg-white/80 px-3 text-[11px] font-semibold text-[#0B0B0B]"
                >
                  <Phone className="h-3 w-3" />
                  <span>{activeOrder.customer.phone}</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeOrder.customer.phone);
                    onNotify('Телефон скопирован');
                  }}
                  aria-label="Скопировать телефон"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/12 bg-white/80 text-[#0B0B0B]"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {activeOrder.customer.telegram && (
                  <a
                    href={`https://t.me/${activeOrder.customer.telegram.replace(/[^a-zA-Z0-9_]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/12 bg-white/80 px-3 text-[11px] font-semibold text-[#0B0B0B]"
                  >
                    <Send className="h-3 w-3" />
                    <span>{activeOrder.customer.telegram}</span>
                  </a>
                )}
              </div>
              <p className="text-[11px] text-[#0B0B0B]/65">{activeOrder.customer.email}</p>
            </div>

            {/* Delivery & Tracking Block */}
            <div className="acrylic-light rounded-2xl p-4 space-y-2.5 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/48">
                Доставка
              </p>
              <p className="font-semibold text-[#0B0B0B]">{activeOrder.delivery.label}</p>
              <p className="text-[#0B0B0B]/72">{activeOrder.delivery.addressSummary}</p>
              {activeOrder.delivery.comment && (
                <p className="text-[11px] text-[#0B0B0B]/60">
                  Комментарий: {activeOrder.delivery.comment}
                </p>
              )}

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={trackingDraft}
                  onChange={(e) => setTrackingDraft(e.target.value)}
                  placeholder="Трек-номер СДЭК / отправки..."
                  className="acrylic-input h-9 flex-1 min-w-0 rounded-full border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void updateOrderTracking(activeOrder.id, trackingDraft)
                      .then(() => onNotify('Трек-номер сохранён'))
                      .catch((err) =>
                        onNotify(err instanceof Error ? err.message : 'Ошибка сохранения'),
                      );
                  }}
                  className="h-9 shrink-0 rounded-full border border-black/15 bg-white/85 px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B] hover:bg-[#0B0B0B] hover:text-[#F6F6F4] transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>

            {/* Items & Totals */}
            <div className="acrylic-light rounded-2xl p-4 space-y-3 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/48">
                Состав заказа
              </p>
              <div className="space-y-2.5">
                {activeOrder.items.map((item, idx) => (
                  <div key={`${item.productId}-${item.size}-${idx}`} className="flex items-center gap-3">
                    <div className="h-14 w-12 shrink-0 rounded-lg bg-[#ECECE8]/85 border border-black/5 p-1 flex items-center justify-center">
                      <AdminImagePreview
                        src={item.image}
                        alt={item.title}
                        hasModel={item.hasModel}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[11px] font-bold uppercase text-[#0B0B0B] line-clamp-1">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#0B0B0B]/58">
                        {item.sku} · Размер {item.size} · ×{item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-[#0B0B0B] tabular-nums whitespace-nowrap">
                      {formatRub(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-black/10 pt-3 space-y-1">
                <div className="flex justify-between text-[#0B0B0B]/65">
                  <span>Товары</span>
                  <span className="tabular-nums">{formatRub(activeOrder.subtotal)}</span>
                </div>
                {activeOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#0B0B0B]/65">
                    <span>Скидка ({activeOrder.promoCode})</span>
                    <span className="tabular-nums">−{formatRub(activeOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#0B0B0B]/65">
                  <span>Доставка</span>
                  <span className="tabular-nums">
                    {activeOrder.deliveryCost === 0
                      ? 'Бесплатно'
                      : formatRub(activeOrder.deliveryCost)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-black/10 pt-2 mt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Итого
                  </span>
                  <span className="font-display text-base font-black tabular-nums">
                    {formatRub(activeOrder.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Status Switcher */}
            <div className="acrylic-light rounded-2xl p-4 space-y-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/48">
                Статус оплаты
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(Object.keys(PAYMENT_STATUS_META) as PaymentStatus[]).map((pStatus) => {
                  const selected = activeOrder.paymentStatus === pStatus;
                  return (
                    <button
                      key={pStatus}
                      type="button"
                      onClick={() => {
                        void updateOrderPaymentStatus(activeOrder.id, pStatus)
                          .then(() =>
                            onNotify(`Оплата: ${PAYMENT_STATUS_META[pStatus].label}`),
                          )
                          .catch((err) =>
                            onNotify(
                              err instanceof Error ? err.message : 'Ошибка обновления',
                            ),
                          );
                      }}
                      className={`h-9 rounded-xl border text-[11px] font-semibold transition-all ${
                        selected
                          ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                          : 'border-black/12 bg-white/75 text-[#0B0B0B]/70'
                      }`}
                    >
                      {PAYMENT_STATUS_META[pStatus].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Order Status Actions */}
            <div className="acrylic-light-strong rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/48">
                Управление статусом
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(['new', 'confirmed', 'shipping', 'completed'] as OrderStatus[]).map(
                  (st) => {
                    const selected = activeOrder.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleQuickStatus(activeOrder, st)}
                        className={`h-10 rounded-xl border text-xs font-semibold transition-all ${
                          selected
                            ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                            : 'border-black/12 bg-white/80 text-[#0B0B0B] hover:border-black/35'
                        }`}
                      >
                        {ORDER_STATUS_META[st].label}
                      </button>
                    );
                  },
                )}
              </div>

              {activeOrder.status !== 'cancelled' && (
                <div className="border-t border-black/10 pt-3 space-y-2">
                  <input
                    type="text"
                    value={cancelReasonDraft}
                    onChange={(e) => setCancelReasonDraft(e.target.value)}
                    placeholder="Причина отмены (необязательно)..."
                    className="acrylic-input h-9 w-full rounded-xl border border-black/12 px-3 text-xs text-[#0B0B0B]"
                  />

                  {sheetConfirmCancel ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void updateOrderStatus(
                            activeOrder.id,
                            'cancelled',
                            cancelReasonDraft,
                          )
                            .then(() => {
                              setSheetConfirmCancel(false);
                              onNotify(
                                `Заказ #${activeOrder.orderNumber} отменён · остатки возвращены`,
                              );
                            })
                            .catch((err) =>
                              onNotify(
                                err instanceof Error ? err.message : 'Ошибка отмены',
                              ),
                            );
                        }}
                        className="h-10 flex-1 rounded-full bg-[#B42318] px-4 text-xs font-semibold uppercase tracking-[0.06em] text-white"
                      >
                        Подтвердить отмену
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetConfirmCancel(false)}
                        className="h-10 rounded-full border border-black/15 bg-white/80 px-4 text-xs font-semibold text-[#0B0B0B]"
                      >
                        Назад
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSheetConfirmCancel(true)}
                      className="h-10 w-full rounded-full border border-[#B42318]/30 bg-white/75 text-xs font-semibold uppercase tracking-[0.08em] text-[#B42318] hover:bg-[#FBEAE8]"
                    >
                      Отменить заказ (вернёт остатки)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Manager Note & History */}
            <div className="acrylic-light rounded-2xl p-4 space-y-3 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/48">
                Заметка менеджера и история
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Внутренний комментарий по заказу..."
                  className="acrylic-input h-9 flex-1 min-w-0 rounded-full border border-black/12 px-3.5 text-xs text-[#0B0B0B]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void updateOrderNote(activeOrder.id, noteDraft)
                      .then(() => onNotify('Заметка сохранена'))
                      .catch((err) =>
                        onNotify(err instanceof Error ? err.message : 'Ошибка сохранения'),
                      );
                  }}
                  className="h-9 shrink-0 rounded-full border border-black/15 bg-white/80 px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                >
                  Ок
                </button>
              </div>

              <div className="space-y-1.5 border-t border-black/[0.08] pt-2.5">
                {activeOrder.history.map((entry, idx) => (
                  <div
                    key={`${entry.timestamp}-${idx}`}
                    className="flex items-start justify-between gap-2 text-[11px]"
                  >
                    <span className="text-[#0B0B0B]/75">
                      <strong className="text-[#0B0B0B]">
                        {ORDER_STATUS_META[entry.status].label}:
                      </strong>{' '}
                      {entry.note ?? ''}
                    </span>
                    <span className="text-[#0B0B0B]/45 tabular-nums shrink-0">
                      {formatShortDateTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
