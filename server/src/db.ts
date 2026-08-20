import pg from "pg";
import { config } from "./config.js";

const pool = config.databaseUrl
  ? new pg.Pool({ connectionString: config.databaseUrl, max: 8 })
  : null;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export function dbConfigured(): boolean {
  return Boolean(pool);
}

export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  await pool.query("select 1");
  return true;
}
