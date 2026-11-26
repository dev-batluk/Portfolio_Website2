import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const SESSION_COOKIE_NAME = 'nvm_admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

interface StoredPasswordRecord {
  salt: string;
  hashHex: string;
  secretMaterial: string;
}

let cachedCreds:
  | {
      username: string;
      record: StoredPasswordRecord;
      usingDevDefault: boolean;
      sessionKey: Buffer;
    }
  | null = null;

function parseScryptHash(raw: string): Omit<StoredPasswordRecord, 'secretMaterial'> | null {
  const parts = raw.trim().split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return null;
  if (!parts[1] || !/^[0-9a-fA-F]{32,128}$/.test(parts[2])) return null;
  return { salt: parts[1], hashHex: parts[2].toLowerCase() };
}

function getAdminCredentials() {
  if (cachedCreds) return cachedCreds;

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const envHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const explicitSessionSecret = process.env.SESSION_SECRET?.trim();

  if (envHash) {
    const parsed = parseScryptHash(envHash);
    if (parsed) {
      const keyMaterial = explicitSessionSecret || `${username}:${envHash}`;
      const sessionKey = crypto
        .createHash('sha256')
        .update(`nvm-session-v1:${keyMaterial}`, 'utf8')
        .digest();
      cachedCreds = {
        username,
        record: { ...parsed, secretMaterial: envHash },
        usingDevDefault: false,
        sessionKey,
      };
      return cachedCreds;
    }
  }

  const rawPassword = process.env.ADMIN_PASSWORD?.trim();
  const effectivePassword = rawPassword || 'admin';
  const salt = crypto.randomBytes(16).toString('hex');
  const hashHex = crypto.scryptSync(effectivePassword, salt, 64).toString('hex');

  const keyMaterial = explicitSessionSecret || `${username}:${effectivePassword}`;
  const sessionKey = crypto
    .createHash('sha256')
    .update(`nvm-session-v1:${keyMaterial}`, 'utf8')
    .digest();

  cachedCreds = {
    username,
    record: { salt, hashHex, secretMaterial: effectivePassword },
    usingDevDefault: !rawPassword && !envHash,
    sessionKey,
  };
  return cachedCreds;
}

export function getAuthBannerMeta(): { username: string; usingDevDefault: boolean } {
  const creds = getAdminCredentials();
  return { username: creds.username, usingDevDefault: creds.usingDevDefault };
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  const eq = crypto.timingSafeEqual(paddedA, paddedB);
  return eq && bufA.length === bufB.length;
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const creds = getAdminCredentials();
  const derived = crypto.scryptSync(password, creds.record.salt, 64);
  const expected = Buffer.from(creds.record.hashHex, 'hex');
  const passwordMatches =
    derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  const usernameMatches = timingSafeEqualUtf8(username.trim(), creds.username);
  return usernameMatches && passwordMatches;
}

interface SignedSessionPayload {
  u: string;
  exp: number;
  jti: string;
}

export function createSignedSessionToken(
  username: string,
  ttlSeconds = SESSION_TTL_SECONDS,
): { token: string; tokenHash: string; expiresAt: string } {
  const { sessionKey } = getAdminCredentials();
  const expMs = Date.now() + ttlSeconds * 1000;
  const payload: SignedSessionPayload = {
    u: username,
    exp: expMs,
    jti: crypto.randomBytes(12).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', sessionKey)
    .update(encodedPayload, 'utf8')
    .digest('base64url');
  const token = `${encodedPayload}.${signature}`;
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(expMs).toISOString(),
  };
}

export function verifySignedSessionToken(
  rawToken: string,
): { username: string; expiresAt: string; tokenHash: string } | null {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 512) return null;
  const dotIdx = rawToken.indexOf('.');
  if (dotIdx <= 0 || dotIdx === rawToken.length - 1) return null;

  const encodedPayload = rawToken.slice(0, dotIdx);
  const sigB64 = rawToken.slice(dotIdx + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encodedPayload) || !/^[A-Za-z0-9_-]+$/.test(sigB64)) {
    return null;
  }

  const { sessionKey } = getAdminCredentials();
  const expectedSigB64 = crypto
    .createHmac('sha256', sessionKey)
    .update(encodedPayload, 'utf8')
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expBuf = Buffer.from(expectedSigB64, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<SignedSessionPayload>;
    if (
      typeof parsed.u !== 'string' ||
      !parsed.u ||
      typeof parsed.exp !== 'number' ||
      !Number.isFinite(parsed.exp)
    ) {
      return null;
    }
    if (Date.now() >= parsed.exp) {
      return null;
    }
    return {
      username: parsed.u,
      expiresAt: new Date(parsed.exp).toISOString(),
      tokenHash: hashSessionToken(rawToken),
    };
  } catch {
    return null;
  }
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isRequestHttps(req: IncomingMessage): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') {
    return true;
  }
  return Boolean((req.socket as { encrypted?: boolean } | undefined)?.encrypted);
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(val);
    } catch {
      result[name] = val;
    }
  }
  return result;
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function buildClearSessionCookie(secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

function normalizeHostPort(hostValue: string): string {
  return hostValue.trim().toLowerCase().replace(/^127\.0\.0\.1(?=:|$)/, 'localhost');
}

export function verifySameOrigin(req: IncomingMessage): boolean {
  const rawHost =
    (typeof req.headers['x-forwarded-host'] === 'string' &&
      req.headers['x-forwarded-host'].split(',')[0].trim()) ||
    req.headers.host;
  if (!rawHost) return false;
  const expectedHost = normalizeHostPort(rawHost);

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      const originHost = normalizeHostPort(new URL(origin).host);
      if (originHost !== expectedHost) return false;
    } catch {
      return false;
    }
  } else {
    const referer = req.headers.referer;
    if (typeof referer === 'string' && referer.length > 0) {
      try {
        const refHost = normalizeHostPort(new URL(referer).host);
        if (refHost !== expectedHost) return false;
      } catch {
        return false;
      }
    }
  }

  return true;
}

export function hasFetchCsrfHeader(req: IncomingMessage): boolean {
  const requestedWith = req.headers['x-requested-with'];
  if (typeof requestedWith === 'string' && requestedWith.toLowerCase() === 'fetch') {
    return true;
  }
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string' && contentType.toLowerCase().includes('application/json')) {
    return true;
  }
  return false;
}

export function getClientIp(req: IncomingMessage): string {
  if (process.env.VERCEL === '1') {
    const vff = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'];
    if (typeof vff === 'string' && vff.trim()) {
      return vff.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

interface RateBucketState {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucketState>();

export function checkRateLimit(
  bucket: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const fullKey = `${bucket}:${key}`;
  const cutoff = now - windowMs;

  if (rateBuckets.size > 4000) {
    for (const [k, state] of rateBuckets.entries()) {
      if (state.timestamps.length === 0 || state.timestamps[state.timestamps.length - 1] < cutoff) {
        rateBuckets.delete(k);
      }
    }
  }

  const current = rateBuckets.get(fullKey) ?? { timestamps: [] };
  const active = current.timestamps.filter((t) => t > cutoff);

  if (active.length >= maxRequests) {
    const oldest = active[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(fullKey, { timestamps: active });
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, maxRequests - active.length),
  };
}

export function recordRateLimitHit(bucket: string, key: string, windowMs: number): void {
  const now = Date.now();
  const fullKey = `${bucket}:${key}`;
  const cutoff = now - windowMs;
  const current = rateBuckets.get(fullKey) ?? { timestamps: [] };
  const active = current.timestamps.filter((t) => t > cutoff);
  active.push(now);
  rateBuckets.set(fullKey, { timestamps: active });
}

export function resetRateLimitBucket(bucket: string, key: string): void {
  rateBuckets.delete(`${bucket}:${key}`);
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https: data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function applySecurityHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  opts?: { noStore?: boolean; isMedia?: boolean; urlPath?: string },
): void {
  const pathStr = opts?.urlPath || req.url || '/';
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (opts?.isMedia) {
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  } else {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  }

  if (isRequestHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (pathStr.startsWith('/admin') || pathStr.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  if (opts?.noStore) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
}
