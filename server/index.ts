import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { handleApiRequest } from './app.ts';
import {
  getDbLocationDescription,
  getRetentionDays,
  purgeExpiredCompletedOrders,
} from './db.ts';
import { applySecurityHeaders, getAuthBannerMeta } from './security.ts';

function loadDotEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore unreadable .env
  }
}

loadDotEnv();

const args = process.argv.slice(2);
const portArgIdx = args.indexOf('--port');
const parsedPortArg =
  portArgIdx >= 0 && args[portArgIdx + 1]
    ? Number.parseInt(args[portArgIdx + 1], 10)
    : Number.NaN;
const apiOnly = args.includes('--api-only');

const PORT = Number.isFinite(parsedPortArg)
  ? parsedPortArg
  : Number.parseInt(process.env.PORT || '4173', 10) || 4173;
const HOST = process.env.HOST?.trim() || '127.0.0.1';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function serveStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  filePath: string,
  urlPath: string,
  cacheControl: string,
): void {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  applySecurityHeaders(req, res, { urlPath });
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', cacheControl);

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  stream.pipe(res);
}

function handleStaticRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    applySecurityHeaders(req, res, { urlPath: req.url });
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  let pathname = '/';
  try {
    pathname = decodeURIComponent(
      new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname,
    );
  } catch {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  if (pathname.includes('\0')) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  // Block hidden files, dotfiles, and sqlite files unconditionally
  const segments = pathname.split('/').filter(Boolean);
  if (
    segments.some((seg) => seg.startsWith('.') || seg.endsWith('.sqlite')) ||
    pathname.startsWith('/data/')
  ) {
    applySecurityHeaders(req, res, { urlPath: pathname });
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(DIST_DIR, relativePath);

  if (
    resolved !== DIST_DIR &&
    !resolved.startsWith(`${DIST_DIR}${path.sep}`)
  ) {
    applySecurityHeaders(req, res, { urlPath: pathname });
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    const isImmutable =
      pathname.startsWith('/assets/') || pathname.startsWith('/images/');
    serveStaticFile(
      req,
      res,
      resolved,
      pathname,
      isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    return;
  }

  // Missing static asset files return 404 instead of SPA HTML
  if (pathname.startsWith('/assets/') || pathname.startsWith('/images/') || /\.[a-z0-9]{2,6}$/i.test(pathname)) {
    applySecurityHeaders(req, res, { urlPath: pathname });
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    applySecurityHeaders(req, res, { urlPath: pathname });
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('dist/index.html not built yet. Run "npm run build" first.');
    return;
  }

  serveStaticFile(req, res, indexHtml, pathname, 'no-cache');
}

const startupPurge = await purgeExpiredCompletedOrders(true);

// Background hourly cleanup for 30-day completed order retention
setInterval(() => {
  void purgeExpiredCompletedOrders(true);
}, 3_600_000).unref();

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';
  if (urlPath.startsWith('/api/')) {
    void handleApiRequest(req, res);
    return;
  }

  if (apiOnly) {
    applySecurityHeaders(req, res, { urlPath });
    res.statusCode = 404;
    res.end('API server only');
    return;
  }

  handleStaticRequest(req, res);
});

server.listen(PORT, HOST, () => {
  const authBanner = getAuthBannerMeta();
  console.log(
    `[NEVERMIND] ${apiOnly ? 'API' : 'Fullstack'} server listening on http://${HOST}:${PORT}`,
  );
  console.log(
    `[NEVERMIND] DB: ${getDbLocationDescription()} (retention: ${getRetentionDays()}d, purged at startup: ${startupPurge.purgedCount})`,
  );
  if (authBanner.usingDevDefault) {
    console.log(
      `[NEVERMIND] Admin login (${authBanner.username}): using default demo password (configure ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in .env)`,
    );
  }
});
