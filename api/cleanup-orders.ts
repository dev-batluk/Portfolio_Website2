import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/app.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    req.url = '/api/cleanup-orders';
    await handleApiRequest(req, res);
  } catch (err) {
    console.error('[VERCEL CRON ERROR]', err);
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
