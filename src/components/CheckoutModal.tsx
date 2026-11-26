import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Lock,
  MapPin,
  Package,
  Truck,
  X,
} from 'lucide-react';
import {
  formatRub,
  useCart,
  type CartLineItem,
  type DeliveryMethod,
  type DeliveryOptionMeta,
} from '../context/CartContext';
import { useStoreData } from '../context/StoreDataContext';
import { useResolvedImage } from '../lib/imageStore';
import { OpticalButton, RollingText, useSpecularPointer } from './OpticalPrimitives';
import type { LegalDocId } from './LegalModal';

interface CheckoutModalProps {
  onNavigateToCatalog: () => void;
  onNotify: (message: string) => void;
  onOpenLegal: (doc: LegalDocId) => void;
  isLegalOpen?: boolean;
}

type CheckoutStep = 'details' | 'payment' | 'receipt';

interface CheckoutFormState {
  fullName: string;
  phone: string;
  email: string;
  telegram: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  comment: string;
  city: string;
  cdekPoint: string;
  consentAccepted: boolean;
}

type FormFieldKey =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'address'
  | 'city'
  | 'cdekPoint'
  | 'consent';

type FormErrors = Partial<Record<FormFieldKey, string>>;

interface OrderReceipt {
  orderNumber: string;
  fullName: string;
  phone: string;
  email: string;
  telegram: string;
  deliveryLabel: string;
  deliveryAddressSummary: string;
  items: CartLineItem[];
  subtotal: number;
  promoCode: string | null;
  discountAmount: number;
  deliveryCost: number;
  grandTotal: number;
}

const INITIAL_FORM: CheckoutFormState = {
  fullName: '',
  phone: '',
  email: '',
  telegram: '',
  deliveryMethod: 'courier_msk',
  address: '',
  comment: '',
  city: '',
  cdekPoint: '',
  consentAccepted: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STEP_LABELS: Record<number, string> = {
  1: 'Контакты и доставка',
  2: 'Оплата',
  3: 'Подтверждение',
};

function formatPhoneRu(raw: string, prevValue: string): string {
  const rawDigits = raw.replace(/\D/g, '');
  const prevDigits = prevValue.replace(/\D/g, '');

  if (!rawDigits) return '';

  let normalized = rawDigits;
  if (normalized.startsWith('8') || normalized.startsWith('7')) {
    normalized = `7${normalized.slice(1)}`;
  } else {
    normalized = `7${normalized}`;
  }

  // If the user deleted a formatting separator (e.g. ')', '-', ' '), drop one digit cleanly
  if (
    raw.length < prevValue.length &&
    normalized.length === prevDigits.length &&
    normalized.length > 1
  ) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.length <= 1) {
    return '';
  }

  const d = normalized.slice(0, 11);
  let formatted = '+7';
  if (d.length > 1) formatted += ` (${d.slice(1, 4)}`;
  if (d.length >= 4) formatted += ')';
  if (d.length > 4) formatted += ` ${d.slice(4, 7)}`;
  if (d.length > 7) formatted += `-${d.slice(7, 9)}`;
  if (d.length > 9) formatted += `-${d.slice(9, 11)}`;
  return formatted;
}

function CheckoutItemThumb({ item }: { item: CartLineItem }) {
  const hasModel = Boolean(item.product.modelImage);
  const resolvedSrc = useResolvedImage(item.product.image);

  return (
    <div className="h-14 w-12 shrink-0 rounded-lg bg-[#ECECE8]/85 border border-black/[0.05] p-1 flex items-center justify-center">
      <img
        src={resolvedSrc || item.product.image}
        alt={item.product.title}
        draggable={false}
        className={`h-full w-full object-contain ${
          hasModel ? 'cutout-shadow' : 'studio-blend'
        }`}
      />
    </div>
  );
}

interface DeliveryOptionCardProps {
  option: DeliveryOptionMeta;
  selected: boolean;
  optionCost: number;
  onSelect: () => void;
}

function DeliveryOptionCard({
  option,
  selected,
  optionCost,
  onSelect,
}: DeliveryOptionCardProps) {
  const specularRef = useSpecularPointer<HTMLButtonElement>({ magnetic: false });
  const Icon =
    option.id === 'courier_msk'
      ? Truck
      : option.id === 'cdek_rf'
        ? Package
        : MapPin;

  return (
    <button
      ref={specularRef}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`specular-card w-full text-left rounded-2xl p-3.5 transition-all duration-250 flex items-start justify-between gap-3 hover:-translate-y-[1px] ${
        selected
          ? 'acrylic-light-strong border-[#0B0B0B]/45 ring-1 ring-[#0B0B0B]/20'
          : 'acrylic-light hover:border-black/20'
      }`}
    >
      <div className="relative z-10 flex items-start gap-3 min-w-0">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-250 ${
            selected
              ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
              : 'border-black/12 bg-white/75 text-[#0B0B0B]'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#0B0B0B]">
            {option.label}
          </p>
          <p className="text-[11px] text-[#0B0B0B]/60 mt-0.5">
            {option.eta} · {option.description}
          </p>
        </div>
      </div>

      <span className="relative z-10 text-xs font-bold text-[#0B0B0B] tabular-nums whitespace-nowrap shrink-0">
        {optionCost === 0 ? 'Бесплатно' : formatRub(optionCost)}
      </span>
    </button>
  );
}

function PaymentStubCard() {
  const specularRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });

  return (
    <div
      ref={specularRef}
      className="acrylic-light-strong specular-card rounded-2xl p-6 sm:p-8"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 mb-5">
          <span className="inline-flex items-center rounded-full bg-[#0B0B0B] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F6F6F4]">
            PORTFOLIO DEMO · PAYMENT
          </span>

          <span className="acrylic-light inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0B0B0B]">
            <Lock className="h-4 w-4" />
          </span>
        </div>

        <h3 className="font-display text-lg sm:text-xl font-black uppercase tracking-[-0.02em] leading-[1.2] text-[#0B0B0B] mb-3.5">
          ЗДЕСЬ МОЖНО ПОДКЛЮЧИТЬ ВАШ СПОСОБ ОПЛАТЫ
        </h3>

        <p className="text-xs sm:text-[13px] leading-[1.68] text-[#0B0B0B]/76 mb-4">
          На этапе запуска вместо этой заглушки интегрируется любой удобный вам способ оплаты:
          банковские карты, СБП, ЮKassa, CloudPayments, Т-Касса, Stripe, оплата при получении или
          мгновенная отправка заказа менеджеру в Telegram / CRM.
        </p>

        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/45 mb-5">
          Карты · СБП · ЮKassa · CloudPayments · Т-Касса · Stripe · Telegram
        </p>

        <p className="border-t border-black/10 pt-4 text-[11px] leading-[1.55] text-[#0B0B0B]/58">
          В портфолио-версии реальное списание средств отключено. Нажмите кнопку ниже, чтобы
          завершить демо-заказ и увидеть экран подтверждения.
        </p>
      </div>
    </div>
  );
}

interface OrderReceiptViewProps {
  receipt: OrderReceipt;
  onNotify: (message: string) => void;
  onReturnToCatalog: () => void;
}

function OrderReceiptView({
  receipt,
  onNotify,
  onReturnToCatalog,
}: OrderReceiptViewProps) {
  const receiptCardRef = useSpecularPointer<HTMLDivElement>({ magnetic: false });
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyOrderNumber = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(receipt.orderNumber);
      }
    } catch {
      // Clipboard API unavailable in restricted contexts — still show subtle confirmation
    }
    setCopied(true);
    onNotify('Номер заказа скопирован');
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  return (
    <div className="animate-optical-roll-in mx-auto max-w-[660px] py-2 sm:py-4">
      <div className="text-center mb-7">
        <div className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center">
          <span
            aria-hidden="true"
            className="animate-receipt-ring absolute inset-0 rounded-full border border-[#0B0B0B]/30"
          />
          <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#0B0B0B] text-[#F6F6F4] shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
            <Check className="h-6 w-6" />
          </span>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0B]/50 mb-2">
          ORDER CONFIRMED · DEMO
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <h3 className="font-display text-xl sm:text-2xl font-black uppercase tracking-[-0.02em] text-[#0B0B0B]">
            ЗАКАЗ #{receipt.orderNumber} ОФОРМЛЕН
          </h3>

          <button
            type="button"
            onClick={handleCopyOrderNumber}
            aria-label="Скопировать номер заказа"
            className="acrylic-light-strong inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0B0B0B] transition-colors hover:border-[#0B0B0B] active:scale-95"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>
      </div>

      <div
        ref={receiptCardRef}
        className="acrylic-light-strong specular-card rounded-2xl p-5 sm:p-7 mb-6"
      >
        <div className="relative z-10 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-black/10 pb-5 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/45 mb-1">
                Получатель
              </p>
              <p className="font-semibold text-[#0B0B0B]">{receipt.fullName}</p>
              <p className="text-[#0B0B0B]/68 mt-0.5">{receipt.phone}</p>
              <p className="text-[#0B0B0B]/68">{receipt.email}</p>
              {receipt.telegram && (
                <p className="text-[#0B0B0B]/68">{receipt.telegram}</p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/45 mb-1">
                Доставка и оплата
              </p>
              <p className="font-semibold text-[#0B0B0B]">{receipt.deliveryLabel}</p>
              <p className="text-[#0B0B0B]/68 mt-0.5">{receipt.deliveryAddressSummary}</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white/75 px-2.5 py-0.5 text-[10px] font-semibold text-[#0B0B0B]/70">
                Демо-заглушка · оплата не подключена
              </p>
            </div>
          </div>

          <div className="space-y-2.5 border-b border-black/10 pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/45 mb-2">
              Позиции заказа
            </p>
            {receipt.items.map((item) => (
              <div
                key={item.lineKey}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-[#0B0B0B]">{item.product.title}</span>
                  <span className="ml-2 text-[#0B0B0B]/55">
                    ({item.size} × {item.quantity})
                  </span>
                </div>
                <span className="font-semibold text-[#0B0B0B] tabular-nums whitespace-nowrap">
                  {formatRub(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[#0B0B0B]/65">
              <span>Товары</span>
              <span className="tabular-nums">{formatRub(receipt.subtotal)}</span>
            </div>
            {receipt.discountAmount > 0 && (
              <div className="flex items-center justify-between text-[#0B0B0B]/65">
                <span>Скидка ({receipt.promoCode})</span>
                <span className="tabular-nums">−{formatRub(receipt.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[#0B0B0B]/65">
              <span>Доставка</span>
              <span className="tabular-nums">
                {receipt.deliveryCost === 0 ? 'Бесплатно' : formatRub(receipt.deliveryCost)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-black/10 pt-3 mt-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/65">
                Итого
              </span>
              <span className="font-display text-lg font-extrabold text-[#0B0B0B] tabular-nums">
                {formatRub(receipt.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] font-medium text-[#0B0B0B]/55 mb-5">
        Демо-заказ успешно оформлен · Корзина очищена
      </p>

      <div className="flex justify-center">
        <OpticalButton
          variant="dark"
          rollingLabel="Вернуться в каталог"
          onClick={onReturnToCatalog}
          className="h-12 px-8 text-xs font-semibold uppercase tracking-[0.08em]"
        />
      </div>
    </div>
  );
}

export function CheckoutModal({
  onNavigateToCatalog,
  onNotify,
  onOpenLegal,
  isLegalOpen = false,
}: CheckoutModalProps) {
  const {
    items,
    totalItems,
    subtotal,
    promoCode,
    discountAmount,
    discountedSubtotal,
    deliveryOptions,
    getDeliveryCost,
    isCheckoutOpen,
    closeCheckout,
    returnToCartFromCheckout,
    clearCart,
  } = useCart();

  const { settings, submitCheckoutOrder } = useStoreData();

  const [isMounted, setIsMounted] = useState(isCheckoutOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('details');
  const [form, setForm] = useState<CheckoutFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const shakeTimerRef = useRef<number | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Partial<Record<FormFieldKey, HTMLInputElement | null>>>({});

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) {
        window.clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isCheckoutOpen) {
      setStep('details');
      setErrors({});
      setSubmitError(null);
      setIsShaking(false);
      setIsSubmitting(false);
      setReceipt(null);
      setIsMounted(true);

      if (prefersReduced) {
        setIsVisible(true);
        return;
      }

      setIsVisible(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setIsSubmitting(false);
    setSubmitError(null);
    setIsVisible(false);
    if (prefersReduced) {
      setIsMounted(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsMounted(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isCheckoutOpen]);

  // Smooth scroll back to top of modal body on step transitions
  useEffect(() => {
    const body = scrollBodyRef.current;
    if (!body) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    body.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  }, [step]);

  useEffect(() => {
    if (!isCheckoutOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !isLegalOpen) closeCheckout();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCheckoutOpen, isSubmitting, isLegalOpen, closeCheckout]);

  if (!isMounted) return null;

  const deliveryCost = getDeliveryCost(form.deliveryMethod);
  const grandTotal = discountedSubtotal + deliveryCost;

  const updateField = <K extends keyof CheckoutFormState>(
    key: K,
    value: CheckoutFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const errKey: FormFieldKey | undefined =
      key === 'consentAccepted' ? 'consent' : (key as FormFieldKey);
    if (errKey && errKey in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  const validateDetails = (): boolean => {
    const nextErrors: FormErrors = {};

    if (form.fullName.trim().length < 2) {
      nextErrors.fullName = 'Укажите имя и фамилию (минимум 2 символа)';
    }

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      nextErrors.phone = 'Введите корректный 11-значный номер телефона';
    }

    if (!EMAIL_RE.test(form.email.trim())) {
      nextErrors.email = 'Введите корректный email для чека';
    }

    if (form.deliveryMethod === 'courier_msk' && form.address.trim().length < 5) {
      nextErrors.address = 'Укажите улицу, дом и квартиру в Москве';
    }

    if (form.deliveryMethod === 'cdek_rf') {
      if (form.city.trim().length < 2) {
        nextErrors.city = 'Укажите город доставки';
      }
      if (form.cdekPoint.trim().length < 3) {
        nextErrors.cdekPoint = 'Укажите адрес или код пункта выдачи СДЭК';
      }
    }

    if (!form.consentAccepted) {
      nextErrors.consent =
        'Необходимо согласие на обработку персональных данных (152-ФЗ)';
    }

    setErrors(nextErrors);

    const orderedKeys: FormFieldKey[] = [
      'fullName',
      'phone',
      'email',
      'address',
      'city',
      'cdekPoint',
      'consent',
    ];
    const firstInvalid = orderedKeys.find((k) => nextErrors[k]);
    if (firstInvalid) {
      setIsShaking(false);
      requestAnimationFrame(() => {
        setIsShaking(true);
        fieldRefs.current[firstInvalid]?.focus();
      });
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => {
        shakeTimerRef.current = null;
        setIsShaking(false);
      }, 340);
      return false;
    }

    return true;
  };

  const handleDetailsSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateDetails()) return;
    setSubmitError(null);
    setStep('payment');
  };

  const handleCompleteDemoOrder = async () => {
    if (isSubmitting || items.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const itemsSnapshot = items.map((entry) => ({ ...entry }));
      const order = await submitCheckoutOrder({
        items: items.map((entry) => ({
          productId: entry.product.id,
          size: entry.size,
          quantity: entry.quantity,
        })),
        promoCode,
        deliveryMethod: form.deliveryMethod,
        customer: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          telegram: form.telegram.trim() || undefined,
        },
        delivery: {
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          cdekPoint: form.cdekPoint.trim() || undefined,
          comment: form.comment.trim() || undefined,
        },
        consentAccepted: true,
      });

      const snapshot: OrderReceipt = {
        orderNumber: order.orderNumber,
        fullName: order.customer.fullName,
        phone: order.customer.phone,
        email: order.customer.email,
        telegram: order.customer.telegram ?? '',
        deliveryLabel: order.delivery.label,
        deliveryAddressSummary: order.delivery.addressSummary,
        items: itemsSnapshot,
        subtotal: order.subtotal,
        promoCode: order.promoCode,
        discountAmount: order.discountAmount,
        deliveryCost: order.deliveryCost,
        grandTotal: order.grandTotal,
      };

      setReceipt(snapshot);
      clearCart();
      setForm(INITIAL_FORM);
      setErrors({});
      setStep('receipt');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Не удалось оформить заказ. Повторите попытку.';
      setSubmitError(msg);
      onNotify(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = step === 'details' ? 1 : step === 'payment' ? 2 : 3;

  const inputBaseClass =
    'acrylic-input h-11 w-full rounded-xl border px-3.5 text-xs sm:text-[13px] font-medium text-[#0B0B0B] placeholder:text-[#0B0B0B]/38';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) closeCheckout();
      }}
      className={`fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/45 p-0 md:p-6 backdrop-blur-md transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        data-inview={isVisible ? 'true' : 'false'}
        className={`relative flex w-full max-w-[1000px] max-h-[92svh] md:max-h-[90vh] flex-col overflow-hidden rounded-t-2xl md:rounded-2xl bg-[#F6F6F4]/92 backdrop-blur-xl border border-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_34px_96px_rgba(0,0,0,0.32)] transition-all duration-360 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:blur-none ${
          isVisible
            ? 'translate-y-0 opacity-100 md:scale-100 md:blur-0'
            : 'translate-y-8 opacity-0 md:translate-y-0 md:scale-[0.96] md:blur-[4px]'
        }`}
      >
        {/* Ambient Optical Refraction Layer inside Modal */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="studio-orb-light animate-studio-drift-a absolute -left-24 top-10 h-96 w-96 rounded-full" />
          <div className="studio-orb-dark animate-studio-drift-b absolute -right-24 bottom-8 h-96 w-96 rounded-full" />
        </div>

        {/* Top Bar with Desktop Pills, Mobile Step Badge & 2px Progress Hairline */}
        <div className="relative z-10 border-b border-black/10 px-5 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-5">
              <h2
                id="checkout-modal-title"
                className="font-display text-sm sm:text-base font-black uppercase tracking-[-0.02em] text-[#0B0B0B]"
              >
                ОФОРМЛЕНИЕ ЗАКАЗА
              </h2>

              {/* Mobile compact step badge */}
              <div className="flex sm:hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/60">
                <span className="rounded-full bg-[#0B0B0B] px-2 py-0.5 text-[#F6F6F4] tabular-nums">
                  0{stepIndex} / 03
                </span>
                <span>{STEP_LABELS[stepIndex]}</span>
              </div>

              {/* Desktop step pills */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {[1, 2, 3].map((num, idx) => {
                  const isCurrent = stepIndex === num;
                  const isDone = stepIndex > num;
                  return (
                    <div key={num} className="flex items-center gap-2">
                      {idx > 0 && <span className="h-px w-3 bg-black/15" />}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${
                          isCurrent
                            ? 'bg-[#0B0B0B] text-[#F6F6F4]'
                            : isDone
                              ? 'acrylic-light-strong text-[#0B0B0B]'
                              : 'text-[#0B0B0B]/40'
                        }`}
                      >
                        {isDone && <Check className="h-2.5 w-2.5 shrink-0" />}
                        <span>
                          0{num} {STEP_LABELS[num]}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={closeCheckout}
              disabled={isSubmitting}
              aria-label="Закрыть оформление заказа"
              className="acrylic-light-strong inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0B0B0B] transition-all duration-250 hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 2px Animated Step Progress Hairline */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/[0.06] overflow-hidden">
            <div
              style={{ transform: `scaleX(${(stepIndex / 3).toFixed(4)})` }}
              className="h-full w-full bg-[#0B0B0B] origin-left transition-transform duration-450 ease-[cubic-bezier(0.22,1,0.36,1)]"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollBodyRef}
          data-lenis-prevent="true"
          className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-8"
        >
          {step === 'receipt' && receipt ? (
            <OrderReceiptView
              receipt={receipt}
              onNotify={onNotify}
              onReturnToCatalog={() => {
                closeCheckout();
                onNavigateToCatalog();
              }}
            />
          ) : (
            /* ================= STEPS 1 & 2: TWO-COLUMN CHECKOUT ================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-9 items-start">
              {/* LEFT COLUMN (7/12): Form or Payment Stub */}
              <div className="lg:col-span-7">
                {step === 'details' ? (
                  <form onSubmit={handleDetailsSubmit} noValidate className="space-y-6">
                    {/* 01 / Contact Details */}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-3.5">
                        01 / Контактные данные
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="checkout-name"
                            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                          >
                            Имя и фамилия *
                          </label>
                          <div className={isShaking && errors.fullName ? 'animate-field-shake' : undefined}>
                            <input
                              ref={(el) => {
                                fieldRefs.current.fullName = el;
                              }}
                              id="checkout-name"
                              type="text"
                              autoComplete="name"
                              value={form.fullName}
                              onChange={(e) => updateField('fullName', e.target.value)}
                              placeholder="Александр Волков"
                              aria-invalid={Boolean(errors.fullName)}
                              className={`${inputBaseClass} ${
                                errors.fullName ? 'border-[#B42318]/55' : 'border-black/12'
                              }`}
                            />
                          </div>
                          {errors.fullName && (
                            <p className="mt-1 text-[11px] font-medium text-[#B42318]">
                              {errors.fullName}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="checkout-phone"
                            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                          >
                            Телефон *
                          </label>
                          <div className={isShaking && errors.phone ? 'animate-field-shake' : undefined}>
                            <input
                              ref={(el) => {
                                fieldRefs.current.phone = el;
                              }}
                              id="checkout-phone"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={form.phone}
                              onChange={(e) =>
                                updateField('phone', formatPhoneRu(e.target.value, form.phone))
                              }
                              placeholder="+7 (999) 000-00-00"
                              aria-invalid={Boolean(errors.phone)}
                              className={`${inputBaseClass} ${
                                errors.phone ? 'border-[#B42318]/55' : 'border-black/12'
                              }`}
                            />
                          </div>
                          {errors.phone && (
                            <p className="mt-1 text-[11px] font-medium text-[#B42318]">
                              {errors.phone}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="checkout-email"
                            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                          >
                            Email *
                          </label>
                          <div className={isShaking && errors.email ? 'animate-field-shake' : undefined}>
                            <input
                              ref={(el) => {
                                fieldRefs.current.email = el;
                              }}
                              id="checkout-email"
                              type="email"
                              autoComplete="email"
                              value={form.email}
                              onChange={(e) => updateField('email', e.target.value)}
                              placeholder="order@example.com"
                              aria-invalid={Boolean(errors.email)}
                              className={`${inputBaseClass} ${
                                errors.email ? 'border-[#B42318]/55' : 'border-black/12'
                              }`}
                            />
                          </div>
                          {errors.email && (
                            <p className="mt-1 text-[11px] font-medium text-[#B42318]">
                              {errors.email}
                            </p>
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <label
                            htmlFor="checkout-telegram"
                            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                          >
                            Telegram (необязательно)
                          </label>
                          <input
                            id="checkout-telegram"
                            type="text"
                            value={form.telegram}
                            onChange={(e) => updateField('telegram', e.target.value)}
                            placeholder="@username"
                            className={`${inputBaseClass} border-black/12`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 02 / Delivery Method */}
                    <div className="border-t border-black/10 pt-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0B0B0B]/50 mb-3.5">
                        02 / Способ доставки
                      </p>

                      <div
                        role="radiogroup"
                        aria-label="Способ доставки"
                        className="space-y-2.5 mb-4"
                      >
                        {(Object.keys(deliveryOptions) as DeliveryMethod[]).map((methodId) => (
                          <DeliveryOptionCard
                            key={methodId}
                            option={deliveryOptions[methodId]}
                            selected={form.deliveryMethod === methodId}
                            optionCost={getDeliveryCost(methodId)}
                            onSelect={() => updateField('deliveryMethod', methodId)}
                          />
                        ))}
                      </div>

                      {form.deliveryMethod === 'courier_msk' && (
                        <div className="space-y-3 animate-optical-roll-in">
                          <div>
                            <label
                              htmlFor="checkout-address"
                              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                            >
                              Адрес доставки в Москве *
                            </label>
                            <div className={isShaking && errors.address ? 'animate-field-shake' : undefined}>
                              <input
                                ref={(el) => {
                                  fieldRefs.current.address = el;
                                }}
                                id="checkout-address"
                                type="text"
                                autoComplete="street-address"
                                value={form.address}
                                onChange={(e) => updateField('address', e.target.value)}
                                placeholder="ул. Покровка, д. 18, кв. 42"
                                aria-invalid={Boolean(errors.address)}
                                className={`${inputBaseClass} ${
                                  errors.address ? 'border-[#B42318]/55' : 'border-black/12'
                                }`}
                              />
                            </div>
                            {errors.address && (
                              <p className="mt-1 text-[11px] font-medium text-[#B42318]">
                                {errors.address}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="checkout-comment"
                              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                            >
                              Комментарий курьеру (необязательно)
                            </label>
                            <input
                              id="checkout-comment"
                              type="text"
                              value={form.comment}
                              onChange={(e) => updateField('comment', e.target.value)}
                              placeholder="Домофон, удобное время доставки"
                              className={`${inputBaseClass} border-black/12`}
                            />
                          </div>
                        </div>
                      )}

                      {form.deliveryMethod === 'cdek_rf' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-optical-roll-in">
                          <div>
                            <label
                              htmlFor="checkout-city"
                              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                            >
                              Город *
                            </label>
                            <div className={isShaking && errors.city ? 'animate-field-shake' : undefined}>
                              <input
                                ref={(el) => {
                                  fieldRefs.current.city = el;
                                }}
                                id="checkout-city"
                                type="text"
                                autoComplete="address-level2"
                                value={form.city}
                                onChange={(e) => updateField('city', e.target.value)}
                                placeholder="Санкт-Петербург"
                                aria-invalid={Boolean(errors.city)}
                                className={`${inputBaseClass} ${
                                  errors.city ? 'border-[#B42318]/55' : 'border-black/12'
                                }`}
                              />
                            </div>
                            {errors.city && (
                              <p className="mt-1 text-[11px] font-medium text-[#B42318]">
                                {errors.city}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="checkout-cdek"
                              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/70 mb-1.5"
                            >
                              Адрес или код ПВЗ СДЭК *
                            </label>
                            <div className={isShaking && errors.cdekPoint ? 'animate-field-shake' : undefined}>
                              <input
                                ref={(el) => {
                                  fieldRefs.current.cdekPoint = el;
                                }}
                                id="checkout-cdek"
                                type="text"
                                value={form.cdekPoint}
                                onChange={(e) => updateField('cdekPoint', e.target.value)}
                                placeholder="Невский пр., 90 / SPB12"
                                aria-invalid={Boolean(errors.cdekPoint)}
                                className={`${inputBaseClass} ${
                                  errors.cdekPoint ? 'border-[#B42318]/55' : 'border-black/12'
                                }`}
                              />
                            </div>
                            {errors.cdekPoint && (
                              <p className="mt-1 text-[11px] font-medium text-[#B42318]">
                                {errors.cdekPoint}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {form.deliveryMethod === 'showroom' && (
                        <div className="acrylic-light-strong rounded-2xl p-4 animate-optical-roll-in">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B0B0B]/50 mb-1">
                            Шоурум NEVERMIND
                          </p>
                          <p className="text-xs font-semibold text-[#0B0B0B]">
                            {settings.showroomCity} · {settings.showroomAddress}
                          </p>
                          <p className="mt-1 text-[11px] text-[#0B0B0B]/65">
                            {settings.showroomHoursTitle}, {settings.showroomHoursSubtitle}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 03 / Legal 152-FZ Consent Checkbox */}
                    <div className="border-t border-black/10 pt-4">
                      <div
                        className={`acrylic-light rounded-2xl p-3.5 transition-colors ${
                          errors.consent ? 'border-[#B42318]/55' : ''
                        } ${isShaking && errors.consent ? 'animate-field-shake' : ''}`}
                      >
                        <label
                          htmlFor="checkout-consent"
                          className="flex items-start gap-3 cursor-pointer text-[11px] leading-[1.55] text-[#0B0B0B]/75"
                        >
                          <input
                            ref={(el) => {
                              fieldRefs.current.consent = el;
                            }}
                            id="checkout-consent"
                            type="checkbox"
                            checked={form.consentAccepted}
                            onChange={(e) =>
                              updateField('consentAccepted', e.target.checked)
                            }
                            aria-invalid={Boolean(errors.consent)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B0B0B] cursor-pointer"
                          />
                          <span>
                            Я даю{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                onOpenLegal('consent');
                              }}
                              className="bg-transparent border-0 p-0 font-semibold text-[#0B0B0B] underline underline-offset-4 hover:opacity-70"
                            >
                              согласие на обработку персональных данных (152-ФЗ)
                            </button>{' '}
                            и принимаю{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                onOpenLegal('privacy');
                              }}
                              className="bg-transparent border-0 p-0 font-semibold text-[#0B0B0B] underline underline-offset-4 hover:opacity-70"
                            >
                              Политику конфиденциальности
                            </button>{' '}
                            и{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                onOpenLegal('terms');
                              }}
                              className="bg-transparent border-0 p-0 font-semibold text-[#0B0B0B] underline underline-offset-4 hover:opacity-70"
                            >
                              Пользовательское соглашение
                            </button>
                            .
                          </span>
                        </label>
                      </div>
                      {errors.consent && (
                        <p className="mt-1.5 text-[11px] font-medium text-[#B42318]">
                          {errors.consent}
                        </p>
                      )}
                    </div>

                    <OpticalButton
                      type="submit"
                      variant="dark"
                      rollingLabel="Перейти к оплате"
                      trailingIcon={
                        <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
                      }
                      className="h-12 w-full px-6 text-xs font-semibold uppercase tracking-[0.08em]"
                    />
                  </form>
                ) : (
                  /* ================= STEP 2: STRICT PAYMENT STUB ================= */
                  <div className="animate-optical-roll-in space-y-5">
                    {/* Compact Step 1 Recap */}
                    <div className="acrylic-light rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-[#0B0B0B] truncate">
                          {form.fullName} · {form.phone}
                        </p>
                        <p className="text-[11px] text-[#0B0B0B]/60 truncate">
                          {deliveryOptions[form.deliveryMethod].label}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setStep('details')}
                        className="shrink-0 bg-transparent border-0 p-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0B0B0B]/60 underline underline-offset-4 transition-colors hover:text-[#0B0B0B] disabled:opacity-50"
                      >
                        Изменить
                      </button>
                    </div>

                    <PaymentStubCard />

                    {submitError && (
                      <div
                        role="alert"
                        className="rounded-2xl border border-[#B42318]/25 bg-[#FBEAE8] px-4 py-3 text-xs font-semibold text-[#B42318]"
                      >
                        {submitError}
                      </div>
                    )}

                    {/* Step 2 Action Row */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                      <OpticalButton
                        variant="outline"
                        onClick={() => setStep('details')}
                        disabled={isSubmitting}
                        rollingLabel="Назад"
                        leadingIcon={
                          <ArrowLeft className="h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-x-0.5" />
                        }
                        className="h-12 min-h-12 w-full sm:w-auto shrink-0 px-5 text-xs font-semibold uppercase tracking-[0.08em]"
                      />

                      <OpticalButton
                        variant="dark"
                        disabled={isSubmitting}
                        onClick={() => void handleCompleteDemoOrder()}
                        className="h-12 min-h-12 w-full sm:w-auto shrink-0 sm:flex-1 px-6 text-xs font-semibold uppercase tracking-[0.08em] disabled:opacity-70"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            <span>Оформляем демо-заказ...</span>
                          </>
                        ) : (
                          <RollingText
                            text={`Завершить демо-заказ · ${formatRub(grandTotal)}`}
                          />
                        )}
                      </OpticalButton>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN (5/12): Always-visible Order Summary */}
              <div className="lg:col-span-5 acrylic-light rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-3.5 mb-4">
                  <h3 className="font-display text-xs font-extrabold uppercase tracking-[0.06em] text-[#0B0B0B]">
                    ВАШ ЗАКАЗ ({totalItems})
                  </h3>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={returnToCartFromCheckout}
                    className="bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0B]/55 underline underline-offset-4 transition-colors hover:text-[#0B0B0B] disabled:opacity-50"
                  >
                    Изменить корзину
                  </button>
                </div>

                <div
                  data-lenis-prevent="true"
                  className="max-h-[240px] overflow-y-auto space-y-3 pr-1 mb-4"
                >
                  {items.map((item) => (
                    <div key={item.lineKey} className="flex items-center gap-3">
                      <CheckoutItemThumb item={item} />

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[11px] font-bold uppercase leading-[1.3] text-[#0B0B0B] line-clamp-1">
                          {item.product.title}
                        </p>
                        <p className="text-[11px] font-medium text-[#0B0B0B]/55 mt-0.5">
                          Размер {item.size} · ×{item.quantity}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-[#0B0B0B] tabular-nums whitespace-nowrap">
                        {formatRub(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-black/10 pt-4 text-xs">
                  <div className="flex items-center justify-between text-[#0B0B0B]/65">
                    <span>Товары</span>
                    <span className="font-semibold text-[#0B0B0B] tabular-nums">
                      {formatRub(subtotal)}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between text-[#0B0B0B]/65">
                      <span>Скидка ({promoCode})</span>
                      <span className="font-semibold text-[#0B0B0B] tabular-nums">
                        −{formatRub(discountAmount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[#0B0B0B]/65">
                    <span>Доставка</span>
                    <span className="inline-flex overflow-hidden">
                      <span
                        key={`${form.deliveryMethod}-${deliveryCost}`}
                        className="animate-optical-roll-in font-semibold text-[#0B0B0B] tabular-nums"
                      >
                        {deliveryCost === 0 ? 'Бесплатно' : formatRub(deliveryCost)}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-black/10 pt-3 mt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B0B0B]/65">
                      ИТОГО
                    </span>
                    <span className="inline-flex overflow-hidden">
                      <span
                        key={grandTotal}
                        className="animate-optical-roll-in font-display text-lg font-extrabold text-[#0B0B0B] tabular-nums"
                      >
                        {formatRub(grandTotal)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
