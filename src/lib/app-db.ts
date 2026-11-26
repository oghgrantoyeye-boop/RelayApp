import { setup } from "./bootstrap";
import { type Db, openDb } from "./db";

let ready: Promise<Db> | undefined;

/** The app's database, migrated and seeded on first use so a fresh checkout just runs. */
export function appDb(): Promise<Db> {
  ready ??= (async () => {
    const db = await openDb();
    await setup(db);
    return db;
  })();
  return ready;
}
