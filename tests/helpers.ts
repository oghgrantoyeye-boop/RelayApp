import { type Db, memoryDb, migrate } from "../src/lib/db";
import { seed } from "../src/lib/seed/harborview";

export async function seededDb(): Promise<Db> {
  const db = await memoryDb();
  await migrate(db);
  await seed(db);
  return db;
}
