// T-12: answering a routed question and a teammate talking to their own team's agent both teach
// Beacon about the team. Someone from another team talking to that agent does not.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { answerCluster } from "@/lib/agent";
import { sendChat } from "@/lib/assistant";
import { listAgents } from "@/lib/agents";
import { sid } from "./helpers";

describe("learning from answers and agent chats", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("an answer to a routed question becomes context for the answering team, with the answer as its source", async () => {
    const req = (await db.one(`select * from request where cluster_key = 'ck_limits_date' limit 1`))!;
    await answerCluster(db, await v("aisha"), "ck_limits_date", {
      answer: "We own the rate limiter. The leak fix merged and we'll land the change by Dec 9.",
    });
    const rows = await db.query(`select * from context_entry where unit_id = $1`, [req.to_unit_id]);
    const knows = rows.find((e) => e.kind === "knows");
    expect(knows?.status).toBe("active");
    expect(knows?.source_refs[0]).toMatchObject({ kind: "answer", ref: req.id });
    expect(rows.find((e) => e.kind === "responsibility")?.status).toBe("pending");
  });

  it("learns from a teammate's message to their own team's agent, not from an outsider's", async () => {
    const agents = await listAgents(db);
    const aisha = await v("aisha");
    const own = agents.find((a) => aisha.reader.unitIds.includes(a.team.id))!;
    expect(own).toBeTruthy();
    await sendChat(db, aisha, { target: own.id, text: "For capacity questions, book a review in #platform-asks." });
    const mine = await db.query(`select * from context_signal where unit_id = $1 and source_kind = 'agent_chat'`, [own.team.id]);
    expect(mine.length).toBeGreaterThan(0);

    const outsider = (await db.one(
      `select u.id from app_user u join member m on m.user_id = u.id where u.kind = 'human' and m.unit_id <> $1
       and not exists (select 1 from member m2 where m2.user_id = u.id and m2.unit_id = $1) limit 1`,
      [own.team.id],
    ))!;
    const before = mine.length;
    await sendChat(db, (await loadViewer(db, outsider.id, "software"))!, {
      target: own.id,
      text: "Book a review in #random-place.",
    });
    const after = await db.query(`select * from context_signal where unit_id = $1 and source_kind = 'agent_chat'`, [own.team.id]);
    expect(after).toHaveLength(before);
  });
});
