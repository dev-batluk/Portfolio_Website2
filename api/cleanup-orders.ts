import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/app.ts';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  req.url = '/api/cleanup-orders';
  await handleApiRequest(req, res);
}
