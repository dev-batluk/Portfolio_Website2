import { api } from './api';

const SAFE_LOCAL_PATH_RE = /^\/(?:images|api\/media)\/[A-Za-z0-9._/-]+$/;

export function isSafeClientImageUrl(value: string | undefined): boolean {
  if (!value) return false;
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

export function sanitizeImageUrl(src: string | undefined): string {
  if (!src) return '';
  return isSafeClientImageUrl(src) ? src.trim() : '';
}

async function loadImageSource(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => bitmap.close(),
    };
  }

  const tempUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Не удалось декодировать изображение'));
    el.src = tempUrl;
  });

  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(tempUrl),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

async function compressFileToUploadBlob(
  file: File,
  maxDim: number,
  quality: number,
): Promise<{ blob: Blob; mimeType: 'image/webp' | 'image/jpeg' | 'image/png' }> {
  try {
    const source = await loadImageSource(file);
    try {
      const maxSide = Math.max(source.width, source.height, 1);
      const scale = Math.min(1, maxDim / maxSide);
      const targetW = Math.max(1, Math.round(source.width * scale));
      const targetH = Math.max(1, Math.round(source.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallbackMime =
          file.type === 'image/png'
            ? 'image/png'
            : file.type === 'image/webp'
              ? 'image/webp'
              : 'image/jpeg';
        return { blob: file, mimeType: fallbackMime };
      }

      source.draw(ctx, targetW, targetH);

      const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
      if (webpBlob && webpBlob.size > 0) {
        return { blob: webpBlob, mimeType: 'image/webp' };
      }

      const fallbackMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const fallbackBlob = await canvasToBlob(canvas, fallbackMime, quality);
      if (fallbackBlob && fallbackBlob.size > 0) {
        return { blob: fallbackBlob, mimeType: fallbackMime };
      }
      return { blob: file, mimeType: fallbackMime };
    } finally {
      source.cleanup();
    }
  } catch {
    const fallbackMime =
      file.type === 'image/png'
        ? 'image/png'
        : file.type === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';
    return { blob: file, mimeType: fallbackMime };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('Не удалось прочитать файл изображения'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(blob);
  });
}

export async function compressAndStoreImage(
  file: File,
  maxDim = 1200,
  quality = 0.84,
): Promise<string> {
  const { blob, mimeType } = await compressFileToUploadBlob(file, maxDim, quality);
  const dataBase64 = await blobToBase64(blob);
  const uploaded = await api.uploadMedia(dataBase64, mimeType);
  return uploaded.url;
}

export function useResolvedImage(src: string | undefined): string {
  return sanitizeImageUrl(src);
}
