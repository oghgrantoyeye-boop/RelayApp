import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** The only database surface the app uses, so PGlite and hosted Postgres are interchangeable. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/** An in-memory PGlite database, used by tests. */
export async function memoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  return wrapPglite(new PGlite());
}

function wrapPglite(pg: import("@electric-sql/pglite").PGlite): Db {
  return {
    query: async (sql, params) => pg.query(sql, params) as never,
    exec: async (sql) => {
      await pg.exec(sql);
    },
  };
}

/**
 * The app database: hosted Postgres when DATABASE_URL is set, otherwise an
 * embedded PGlite in ./.data so `npm i && npm run dev` works with no setup.
 */
export async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url });
    return {
      query: async (sql, params) => pool.query(sql, params as unknown[]) as never,
      exec: async (sql) => {
        await pool.query(sql);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dir, { recursive: true });
  return wrapPglite(new PGlite(dir));
}

/** Applies plain SQL migrations in filename order, once each. */
export async function migrate(db: Db): Promise<void> {
  await db.exec(
    "create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migration")).rows.map((r) => r.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.exec(`begin; ${sql}; insert into schema_migration (name) values ('${file}'); commit;`);
  }
}
