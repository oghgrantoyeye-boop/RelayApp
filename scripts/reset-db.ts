// npm run db:reset: wipe the embedded database and reseed Northwind Labs.
import fs from "node:fs";
import path from "node:path";
import { openDb, migrate } from "../src/lib/db";
import { seed } from "../src/lib/seed";

const url = process.env.DATABASE_URL;
if (url) {
  const db = await openDb({ url });
  await db.exec(`drop schema public cascade; create schema public;`);
  await migrate(db);
  await seed(db);
  await db.close();
} else {
  const dir = process.env.RELAY_DB_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.rmSync(dir, { recursive: true, force: true });
  const db = await openDb({ dataDir: dir });
  await migrate(db);
  await seed(db);
  await db.close();
}
console.log("Reset Northwind Labs demo data.");
