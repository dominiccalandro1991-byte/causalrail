import pg from "pg";
import { config } from "./config.js";

function poolOptions(url: string): pg.PoolConfig {
  const local = /localhost|127\.0\.0\.1/.test(url);
  return {
    connectionString: url,
    max: 8,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 10_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
  };
}

const pool = config.databaseUrl ? new pg.Pool(poolOptions(config.databaseUrl)) : null;

let lastError: string | null = null;

if (pool) {
  pool.on("error", (err) => {
    lastError = err.message;
    console.error("pg pool error", err.message);
  });
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const result = await pool.query<T>(text, params);
  lastError = null;
  return result.rows;
}

export function dbConfigured(): boolean {
  return Boolean(pool);
}

export function dbLastError(): string | null {
  return lastError;
}

export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("select 1");
    lastError = null;
    return true;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return false;
  }
}
