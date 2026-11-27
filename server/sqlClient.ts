import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import { Client, Pool, neonConfig } from '@neondatabase/serverless';

// Use stateless HTTP fetch for single-statement Pool queries in serverless environments
neonConfig.poolQueryViaFetch = true;

export interface SqlExecutor {
  queryAll: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<T[]>;
  queryOne: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<T | undefined>;
  execute: (sql: string, params?: unknown[]) => Promise<{ changes: number }>;
  execDdl: (sql: string) => Promise<void>;
}

let sqliteInstance: NodeDatabaseSync | null = null;
let sqlitePromise: Promise<NodeDatabaseSync> | null = null;
let sqliteTxQueue: Promise<void> = Promise.resolve();
let pgPoolInstance: Pool | null = null;

export function normalizePostgresUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed.length > 0 ? trimmed : null;
}

function getPostgresUrl(): string | null {
  return (
    normalizePostgresUrl(process.env.DATABASE_URL) ||
    normalizePostgresUrl(process.env.POSTGRES_URL)
  );
}

export function isPostgresDb(): boolean {
  return Boolean(getPostgresUrl());
}

export function getDbEngineLabel(): string {
  return isPostgresDb() ? 'postgres' : 'sqlite';
}

export function getDbLocationDescription(): string {
  if (isPostgresDb()) {
    return 'Neon Postgres (DATABASE_URL)';
  }
  return getSqliteFilePath();
}

export function getSqliteFilePath(): string {
  if (process.env.SQLITE_PATH?.trim()) {
    return path.resolve(process.env.SQLITE_PATH.trim());
  }
  if (process.env.VERCEL) {
    return '/tmp/nevermind.sqlite';
  }
  return path.join(process.cwd(), 'data', 'nevermind.sqlite');
}

async function getSqliteDb(): Promise<NodeDatabaseSync> {
  if (sqliteInstance) return sqliteInstance;
  if (!sqlitePromise) {
    sqlitePromise = (async () => {
      let DatabaseSyncCtor: typeof NodeDatabaseSync;
      try {
        ({ DatabaseSync: DatabaseSyncCtor } = await import('node:sqlite'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Built-in node:sqlite is unavailable on Node ${process.version} (${msg}). Set Node.js Version to 24.x in Vercel Project Settings or configure DATABASE_URL (Neon Postgres).`,
        );
      }

      const dbPath = getSqliteFilePath();
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      const db = new DatabaseSyncCtor(dbPath);
      try {
        db.exec('PRAGMA journal_mode = WAL;');
      } catch {
        // Fallback cleanly if WAL is unsupported on a restricted filesystem
      }
      db.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
      `);
      sqliteInstance = db;
      return db;
    })().catch((err) => {
      sqlitePromise = null;
      throw err;
    });
  }
  return sqlitePromise;
}

function getPgPool(): Pool {
  if (pgPoolInstance) return pgPoolInstance;
  const conn = getPostgresUrl();
  if (!conn) {
    throw new Error('DATABASE_URL is not configured');
  }
  const pool = new Pool({ connectionString: conn });
  pool.on('error', (err: Error) => {
    console.error('[DB POOL ERROR]', err);
  });
  pgPoolInstance = pool;
  return pgPoolInstance;
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (!inSingleQuote && ch === '-' && next === '-') {
      inLineComment = true;
      current += ch;
      continue;
    }

    if (ch === "'") {
      if (inSingleQuote && next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === ';' && !inSingleQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }
  return statements;
}

function convertPlaceholdersToPg(sql: string): string {
  let idx = 0;
  let inSingleQuote = false;
  let out = '';

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      if (inSingleQuote && sql[i + 1] === "'") {
        out += "''";
        i += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      out += ch;
      continue;
    }
    if (ch === '?' && !inSingleQuote) {
      idx += 1;
      out += `$${idx}`;
      continue;
    }
    out += ch;
  }

  return out;
}

function normalizePgParams(params: unknown[]): unknown[] {
  return params.map((p) => (p === undefined ? null : p));
}

function normalizeSqliteParams(params: unknown[]): Array<string | number | null | Uint8Array> {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'number' || typeof p === 'string' || p instanceof Uint8Array) {
      return p;
    }
    return JSON.stringify(p);
  });
}

function makeSqliteExecutor(db: NodeDatabaseSync): SqlExecutor {
  return {
    async queryAll<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const rows = db.prepare(sql).all(...normalizeSqliteParams(params));
      return rows as unknown as T[];
    },
    async queryOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const row = db.prepare(sql).get(...normalizeSqliteParams(params));
      return (row as unknown as T | undefined) ?? undefined;
    },
    async execute(sql: string, params: unknown[] = []) {
      const res = db.prepare(sql).run(...normalizeSqliteParams(params));
      return { changes: Number(res.changes ?? 0) };
    },
    async execDdl(sql: string) {
      db.exec(sql);
    },
  };
}

interface PgQueryable {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}

function makePgExecutor(client: PgQueryable): SqlExecutor {
  return {
    async queryAll<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await client.query(convertPlaceholdersToPg(sql), normalizePgParams(params));
      return res.rows as T[];
    },
    async queryOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await client.query(convertPlaceholdersToPg(sql), normalizePgParams(params));
      return (res.rows[0] as T | undefined) ?? undefined;
    },
    async execute(sql: string, params: unknown[] = []) {
      const res = await client.query(convertPlaceholdersToPg(sql), normalizePgParams(params));
      return { changes: Number(res.rowCount ?? 0) };
    },
    async execDdl(sql: string) {
      for (const stmt of splitSqlStatements(sql)) {
        await client.query(stmt);
      }
    },
  };
}

async function runSerializedSqliteTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const prev = sqliteTxQueue;
  let release!: () => void;
  sqliteTxQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function queryAll<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (isPostgresDb()) {
    return makePgExecutor(getPgPool()).queryAll<T>(sql, params);
  }
  return makeSqliteExecutor(await getSqliteDb()).queryAll<T>(sql, params);
}

export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  if (isPostgresDb()) {
    return makePgExecutor(getPgPool()).queryOne<T>(sql, params);
  }
  return makeSqliteExecutor(await getSqliteDb()).queryOne<T>(sql, params);
}

export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number }> {
  if (isPostgresDb()) {
    return makePgExecutor(getPgPool()).execute(sql, params);
  }
  return makeSqliteExecutor(await getSqliteDb()).execute(sql, params);
}

export async function execDdl(sql: string): Promise<void> {
  if (isPostgresDb()) {
    const pool = getPgPool();
    for (const stmt of splitSqlStatements(sql)) {
      await pool.query(stmt);
    }
    return;
  }
  (await getSqliteDb()).exec(sql);
}

export async function runTransaction<T>(
  fn: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  if (isPostgresDb()) {
    const conn = getPostgresUrl();
    if (!conn) {
      throw new Error('DATABASE_URL is not configured');
    }
    const client = new Client({ connectionString: conn });
    client.on('error', (err: Error) => {
      console.error('[DB CLIENT ERROR]', err);
    });
    await client.connect();
    const tx = makePgExecutor(client);
    try {
      await client.query('BEGIN');
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw err;
    } finally {
      await client.end().catch(() => {});
    }
  }

  return runSerializedSqliteTransaction(async () => {
    const db = await getSqliteDb();
    const tx = makeSqliteExecutor(db);
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(tx);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
      throw err;
    }
  });
}
