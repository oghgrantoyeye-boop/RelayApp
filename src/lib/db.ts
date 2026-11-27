import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { migrations } from "./migrations";

/** The small database surface the app uses. Works on embedded PGlite and on any Postgres. */
export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

const DATE_OID = 1082;
const asIs = (v: string) => v; // keep DATE columns as 'YYYY-MM-DD' strings

function wrapPglite(client: PGlite | Parameters<Parameters<PGlite["transaction"]>[0]>[0], root?: PGlite): Db {
  const db: Db = {
    async query(sql, params) {
      const r = await client.query(sql, params as unknown[]);
      return r.rows as never[];
    },
    async one(sql, params) {
      const rows = await db.query(sql, params);
      return (rows[0] as never) ?? null;
    },
    async exec(sql) {
      await client.exec(sql);
    },
    async tx(fn) {
      if (!root) return fn(db); // already inside a transaction
      return root.transaction((t) => fn(wrapPglite(t)));
    },
    async close() {
      if (root) await root.close();
    },
  };
  return db;
}

function wrapPg(pool: pg.Pool | pg.PoolClient, isPool: boolean): Db {
  const db: Db = {
    async query(sql, params) {
      const r = await pool.query(sql, params as unknown[]);
      return r.rows;
    },
    async one(sql, params) {
      const rows = await db.query(sql, params);
      return (rows[0] as never) ?? null;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      if (!isPool) return fn(db);
      const client = await (pool as pg.Pool).connect();
      try {
        await client.query("begin");
        const out = await fn(wrapPg(client, false));
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      if (isPool) await (pool as pg.Pool).end();
    },
  };
  return db;
}

export async function openDb(opts: { url?: string; dataDir?: string } = {}): Promise<Db> {
  if (opts.url) {
    pg.types.setTypeParser(DATE_OID, asIs);
    return wrapPg(new pg.Pool({ connectionString: opts.url, max: 5 }), true);
  }
  const parsers = { [DATE_OID]: asIs };
  let client: PGlite;
  if (opts.dataDir && opts.dataDir !== "memory") {
    fs.mkdirSync(opts.dataDir, { recursive: true });
    client = new PGlite(opts.dataDir, { parsers });
  } else {
    client = new PGlite({ parsers });
  }
  await client.waitReady;
  return wrapPglite(client, client);
}

export async function migrate(db: Db) {
  await db.exec(`create table if not exists _migrations (id text primary key, at timestamptz not null default now())`);
  const done = new Set((await db.query<{ id: string }>(`select id from _migrations`)).map((r) => r.id));
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await db.tx(async (t) => {
      await t.exec(m.sql);
      await t.query(`insert into _migrations (id) values ($1)`, [m.id]);
    });
  }
}

type Holder = { promise?: Promise<Db> };
const holder: Holder = ((globalThis as unknown as { __relayDb?: Holder }).__relayDb ??= {});

/** The app's shared database: migrated, and seeded with Northwind Labs on first run. */
export function getDb(): Promise<Db> {
  if (!holder.promise) {
    holder.promise = (async () => {
      const url = process.env.DATABASE_URL || undefined;
      const dataDir = process.env.RELAY_DB_DIR || path.join(process.cwd(), ".data", "pglite");
      const db = await openDb({ url, dataDir });
      await migrate(db);
      const org = await db.one(`select id from org limit 1`);
      if (!org) {
        const { seed } = await import("./seed");
        await seed(db);
      }
      return db;
    })().catch((e) => {
      holder.promise = undefined;
      throw e;
    });
  }
  return holder.promise;
}
