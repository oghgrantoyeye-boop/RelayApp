import { rm } from "node:fs/promises";
import path from "node:path";
import { migrate, openDb } from "../src/lib/db";
import { seed } from "../src/lib/seed";

// Wipes the local PGlite database and reseeds the demo pack. With DATABASE_URL set, only migrates and seeds.
if (!process.env.DATABASE_URL) await rm(path.join(process.cwd(), ".data"), { recursive: true, force: true });
const db = await openDb();
await migrate(db);
await seed(db);
const n = (await db.query<{ n: number }>("select count(*)::int as n from entity")).rows[0].n;
console.log(`Seeded Larkspur Outdoor Co.: ${n} open initiatives.`);
process.exit(0);
