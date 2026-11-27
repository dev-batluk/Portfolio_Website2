import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/app.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const rewrittenRoute = parsed.searchParams.get('__route');
    if (rewrittenRoute !== null) {
      parsed.searchParams.delete('__route');
      const qs = parsed.searchParams.toString();
      const cleanRoute = rewrittenRoute.replace(/^\/+/, '');
      req.url = `/api/${cleanRoute}${qs ? `?${qs}` : ''}`;
    } else if (!parsed.pathname.startsWith('/api/')) {
      req.url = `/api${parsed.pathname}${parsed.search}`;
    }

    await handleApiRequest(req, res);
  } catch (err) {
    console.error('[VERCEL API ERROR]', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: 'Внутренняя ошибка сервера',
          code: 'INTERNAL_ERROR',
        }),
      );
    }
  }
}
