import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export type CrawlerDbPool = Pool;
export type CrawlerDbConnection = PoolConnection;
export type CrawlerRow = RowDataPacket;

let pool: Pool | null = null;

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export function isCrawlerDbConfigured(): boolean {
  // Intentionally do NOT require password here; some envs use socket auth.
  return Boolean(process.env.CRAWLER_DB_HOST && process.env.CRAWLER_DB_USER && process.env.CRAWLER_DB_NAME);
}

export function getCrawlerDb(): Pool {
  if (!pool) {
    // Fail fast with a clear error in production; allow boot without crawler in dev.
    const host = requiredEnv('CRAWLER_DB_HOST');
    const user = requiredEnv('CRAWLER_DB_USER');
    const database = requiredEnv('CRAWLER_DB_NAME');

    pool = mysql.createPool({
      host,
      user,
      password: process.env.CRAWLER_DB_PASSWORD,
      port: process.env.CRAWLER_DB_PORT ? Number(process.env.CRAWLER_DB_PORT) : 3306,
      database,
      waitForConnections: true,
      connectionLimit: process.env.CRAWLER_DB_POOL_SIZE ? Number(process.env.CRAWLER_DB_POOL_SIZE) : 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: 'utf8mb4',
      timezone: 'Z',
      multipleStatements: false,
    });
  }
  return pool;
}

export async function withCrawlerTx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const db = getCrawlerDb();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw e;
  } finally {
    conn.release();
  }
}

export async function closeCrawlerDb(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

