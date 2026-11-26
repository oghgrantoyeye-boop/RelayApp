import { type Db, migrate, openDb } from "./db";
import { seed } from "./seed";

let ready: Promise<Db> | undefined;

/** The app's database, migrated and seeded on first use so a fresh checkout just runs. */
export function appDb(): Promise<Db> {
  ready ??= (async () => {
    const db = await openDb();
    await migrate(db);
    await seed(db);
    return db;
  })();
  return ready;
}
