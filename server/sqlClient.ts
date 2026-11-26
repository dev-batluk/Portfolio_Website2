import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from '@neondatabase/serverless';

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

let sqliteInstance: DatabaseSync | null = null;
let pgPoolInstance: Pool | null = null;

function getPostgresUrl(): string | null {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  return url.length > 0 ? url : null;
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

function getSqliteDb(): DatabaseSync {
  if (sqliteInstance) return sqliteInstance;

  const dbPath = getSqliteFilePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  sqliteInstance = db;
  return db;
}

function getPgPool(): Pool {
  if (pgPoolInstance) return pgPoolInstance;
  const conn = getPostgresUrl();
  if (!conn) {
    throw new Error('DATABASE_URL is not configured');
  }
  pgPoolInstance = new Pool({ connectionString: conn });
  return pgPoolInstance;
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

function makeSqliteExecutor(db: DatabaseSync): SqlExecutor {
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
      const res = await client.query(convertPlaceholdersToPg(sql), params);
      return res.rows as T[];
    },
    async queryOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await client.query(convertPlaceholdersToPg(sql), params);
      return (res.rows[0] as T | undefined) ?? undefined;
    },
    async execute(sql: string, params: unknown[] = []) {
      const res = await client.query(convertPlaceholdersToPg(sql), params);
      return { changes: Number(res.rowCount ?? 0) };
    },
    async execDdl(sql: string) {
      await client.query(sql);
    },
  };
}

export async function queryAll<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (isPostgresDb()) {
    return makePgExecutor(getPgPool()).queryAll<T>(sql, params);
  }
  return makeSqliteExecutor(getSqliteDb()).queryAll<T>(sql, params);
}

export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  if (isPostgresDb()) {
    return makePgExecutor(getPgPool()).queryOne<T>(sql, params);
  }
  return makeSqliteExecutor(getSqliteDb()).queryOne<T>(sql, params);
}

export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number }> {
  if (isPostgresDb()) {
    return makePgExecutor(getPgPool()).execute(sql, params);
  }
  return makeSqliteExecutor(getSqliteDb()).execute(sql, params);
}

export async function execDdl(sql: string): Promise<void> {
  if (isPostgresDb()) {
    await getPgPool().query(sql);
    return;
  }
  getSqliteDb().exec(sql);
}

export async function runTransaction<T>(
  fn: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  if (isPostgresDb()) {
    const client = await getPgPool().connect();
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
      client.release();
    }
  }

  const db = getSqliteDb();
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
}
