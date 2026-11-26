import { setup } from "../src/lib/bootstrap";
import { type Db, memoryDb } from "../src/lib/db";

export async function seededDb(): Promise<Db> {
  const db = await memoryDb();
  await setup(db);
  return db;
}
