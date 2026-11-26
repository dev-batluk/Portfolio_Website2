import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/app.ts';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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
}
