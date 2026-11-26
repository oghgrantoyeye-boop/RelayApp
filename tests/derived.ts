import type { Db } from "../src/lib/db";
import { summarizeFor } from "../src/lib/derive";
import { fakeLlm } from "../src/lib/llm/fake";

export const derivedFor = (db: Db, reader: string, ref: string, keys: string[]) =>
  summarizeFor(db, fakeLlm(), reader, ref, { audience: "test", keys });
