import { z } from 'zod';

const SAFE_LOCAL_PATH_RE = /^\/(?:images|api\/media)\/[A-Za-z0-9._/-]+$/;
const SAFE_CATEGORY_ID_RE = /^[a-z0-9-]{2,32}$/;
const TELEGRAM_HANDLE_RE = /^[a-zA-Z0-9_]{3,32}$/;

const CYRILLIC_TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function isSafeImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1024) return false;
  if (/[\s\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.includes('..')) return false;
    return SAFE_LOCAL_PATH_RE.test(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeTelegram(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^@+/, '');
  if (!cleaned) return undefined;
  if (!TELEGRAM_HANDLE_RE.test(cleaned)) return undefined;
  return `@${cleaned}`;
}

export function slugifyCategoryLabel(label: string): string {
  const lowered = label.trim().toLowerCase();
  let transliterated = '';
  for (const ch of lowered) {
    transliterated += CYRILLIC_TRANSLIT[ch] ?? ch;
  }
  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  if (!slug || slug === 'all' || slug.length < 2) {
    return `cat-${Date.now().toString(36).slice(-4)}`;
  }
  return slug;
}

export function verifyImageMagicBytes(
  buf: Buffer,
): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

const safeImageUrlSchema = z
  .string()
  .trim()
  .min(1, 'Укажите изображение')
  .max(1024)
  .refine(isSafeImageUrl, 'Недопустимый URL изображения');

const stockMapSchema = z
  .record(
    z.string().trim().min(1).max(12),
    z.number().int().min(0).max(999),
  )
  .refine((obj) => Object.keys(obj).length >= 1 && Object.keys(obj).length <= 12, {
    message: 'Укажите хотя бы один размер',
  });

export const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
  })
  .strict();

export const validatePromoSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    subtotal: z.number().int().min(0).max(100_000_000),
  })
  .strict();

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(64),
            size: z.string().trim().min(1).max(12),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1, 'Корзина пуста')
      .max(30, 'Слишком много позиций в заказе'),
    promoCode: z.string().trim().max(32).nullable().optional(),
    deliveryMethod: z.enum(['courier_msk', 'cdek_rf', 'showroom']),
    customer: z
      .object({
        fullName: z.string().trim().min(2, 'Укажите имя и фамилию').max(120),
        phone: z
          .string()
          .trim()
          .min(10, 'Укажите корректный телефон')
          .max(30)
          .refine((val) => {
            const digits = val.replace(/\D/g, '');
            return digits.length >= 10 && digits.length <= 15;
          }, 'Введите корректный 11-значный телефон'),
        email: z.string().trim().email('Укажите корректный email').max(160),
        telegram: z.string().trim().max(40).optional(),
      })
      .strict(),
    delivery: z
      .object({
        address: z.string().trim().max(240).optional(),
        city: z.string().trim().max(80).optional(),
        cdekPoint: z.string().trim().max(160).optional(),
        comment: z.string().trim().max(300).optional(),
      })
      .strict(),
    consentAccepted: z.literal(true, {
      message: 'Необходимо согласие на обработку персональных данных (152-ФЗ)',
    }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === 'courier_msk') {
      if (!data.delivery.address || data.delivery.address.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['delivery', 'address'],
          message: 'Укажите адрес доставки по Москве',
        });
      }
    } else if (data.deliveryMethod === 'cdek_rf') {
      if (!data.delivery.city || data.delivery.city.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['delivery', 'city'],
          message: 'Укажите город доставки',
        });
      }
      if (!data.delivery.cdekPoint || data.delivery.cdekPoint.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['delivery', 'cdekPoint'],
          message: 'Укажите адрес или код ПВЗ СДЭК',
        });
      }
    }
  });

export const categoryCreateSchema = z
  .object({
    label: z.string().trim().min(2, 'Минимум 2 символа').max(40, 'Максимум 40 символов'),
    id: z
      .string()
      .trim()
      .regex(SAFE_CATEGORY_ID_RE, 'Slug должен содержать только a-z, 0-9 и дефис')
      .refine((v) => v !== 'all', 'ID "all" зарезервирован')
      .optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    label: z.string().trim().min(2, 'Минимум 2 символа').max(40, 'Максимум 40 символов'),
  })
  .strict();

export const reorderSchema = z
  .object({
    direction: z.enum(['up', 'down']),
  })
  .strict();

export const categoryDeleteSchema = z
  .object({
    reassignTo: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const productInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    sku: z.string().trim().min(2).max(40),
    category: z.string().trim().min(1).max(32),
    categoryLabel: z.string().trim().min(1).max(40).optional(),
    price: z.number().int().min(1).max(10_000_000),
    description: z.string().trim().min(1).max(1500),
    material: z.string().trim().min(1).max(240),
    fit: z.string().trim().min(1).max(120),
    sizes: z.array(z.string().trim().min(1).max(12)).min(1).max(12),
    image: safeImageUrlSchema,
    gallery: z.array(safeImageUrlSchema).max(10).optional(),
    stock: stockMapSchema,
    hidden: z.boolean().optional(),
  })
  .strict();

export const productPatchSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    sku: z.string().trim().min(2).max(40).optional(),
    category: z.string().trim().min(1).max(32).optional(),
    categoryLabel: z.string().trim().min(1).max(40).optional(),
    price: z.number().int().min(1).max(10_000_000).optional(),
    description: z.string().trim().min(1).max(1500).optional(),
    material: z.string().trim().min(1).max(240).optional(),
    fit: z.string().trim().min(1).max(120).optional(),
    sizes: z.array(z.string().trim().min(1).max(12)).min(1).max(12).optional(),
    image: safeImageUrlSchema.optional(),
    gallery: z.array(safeImageUrlSchema).max(10).optional(),
    stock: stockMapSchema.optional(),
    hidden: z.boolean().optional(),
  })
  .strict();

export const bestsellerInputSchema = z
  .object({
    tag: z.string().trim().min(1).max(60),
    title: z.string().trim().min(2).max(120),
    sku: z.string().trim().min(2).max(40),
    categoryLabel: z.string().trim().min(1).max(40),
    price: z.number().int().min(1).max(10_000_000),
    description: z.string().trim().min(1).max(1500),
    material: z.string().trim().min(1).max(240),
    fit: z.string().trim().min(1).max(120),
    sizes: z.array(z.string().trim().min(1).max(12)).min(1).max(12),
    image: safeImageUrlSchema,
    modelImage: safeImageUrlSchema,
    gallery: z.array(safeImageUrlSchema).max(10).optional(),
    stock: stockMapSchema,
    hidden: z.boolean().optional(),
  })
  .strict();

export const bestsellerPatchSchema = z
  .object({
    tag: z.string().trim().min(1).max(60).optional(),
    title: z.string().trim().min(2).max(120).optional(),
    sku: z.string().trim().min(2).max(40).optional(),
    categoryLabel: z.string().trim().min(1).max(40).optional(),
    price: z.number().int().min(1).max(10_000_000).optional(),
    description: z.string().trim().min(1).max(1500).optional(),
    material: z.string().trim().min(1).max(240).optional(),
    fit: z.string().trim().min(1).max(120).optional(),
    sizes: z.array(z.string().trim().min(1).max(12)).min(1).max(12).optional(),
    image: safeImageUrlSchema.optional(),
    modelImage: safeImageUrlSchema.optional(),
    gallery: z.array(safeImageUrlSchema).max(10).optional(),
    stock: stockMapSchema.optional(),
    hidden: z.boolean().optional(),
  })
  .strict();

export const promoteBestsellerSchema = z
  .object({
    catalogItemId: z.string().trim().min(1).max(64),
    modelImage: z.union([safeImageUrlSchema, z.literal('')]).optional(),
    tag: z.string().trim().max(60).optional(),
  })
  .strict();

export const orderPatchSchema = z
  .object({
    status: z.enum(['new', 'confirmed', 'shipping', 'completed', 'cancelled']).optional(),
    cancelReason: z.string().trim().max(300).optional(),
    paymentStatus: z.enum(['demo', 'pending', 'paid', 'refunded']).optional(),
    trackingNumber: z.string().trim().max(80).optional(),
    managerNote: z.string().trim().max(500).optional(),
  })
  .strict();

export const promoInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Только латинские буквы и цифры'),
    type: z.enum(['percent', 'fixed']),
    value: z.number().int().min(1).max(1_000_000),
    minOrderAmount: z.number().int().min(1).max(10_000_000).optional(),
    active: z.boolean(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === 'percent' && data.value > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Процентная скидка не может превышать 90%',
      });
    }
  });

export const promoPatchSchema = z
  .object({
    active: z.boolean().optional(),
  })
  .strict();

export const settingsPatchSchema = z
  .object({
    freeDeliveryThreshold: z.number().int().min(0).max(1_000_000).optional(),
    courierMskPrice: z.number().int().min(0).max(100_000).optional(),
    cdekRfPrice: z.number().int().min(0).max(100_000).optional(),
    showroomCity: z.string().trim().min(1).max(80).optional(),
    showroomAddress: z.string().trim().min(1).max(160).optional(),
    showroomHoursTitle: z.string().trim().min(1).max(60).optional(),
    showroomHoursSubtitle: z.string().trim().min(1).max(120).optional(),
    tickerItems: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
  })
  .strict();

export const mediaUploadSchema = z
  .object({
    dataBase64: z.string().min(16).max(7_200_000),
    mimeType: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  })
  .strict();
