// T-19: answers are a list of claims, each tagged with what it rests on, plus what the agent
// couldn't find. The model's shape and the offline writer's shape are the same.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, migrate, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { setNow } from "@/lib/clock";
import { FakeLLM, setLLM } from "@/lib/ai/llm";
import { loadViewer, type Viewer } from "@/lib/data";
import { askTeam, claimViews, getQuestion, publishedSourcesFor, type Source } from "@/lib/agent";
import { answerFromPublished } from "@/lib/ai/tasks";
import { learnFrom } from "@/lib/context-learn";
import { sid } from "./helpers";

const src = (ref: string, text: string, provenance: Source["provenance"], lastSeen: string): Source => ({ ref, text, provenance, lastSeen, label: ref, level: "summary", markingIds: [] });

describe("claim-by-claim answers", () => {
  let db: Db;
  const v = async (id: string): Promise<Viewer> => (await loadViewer(db, sid(id), "software"))!;

  beforeEach(async () => {
    setNow("2026-12-06T09:00:00Z");
    setLLM(new FakeLLM({}));
    db = await openDb({});
    await migrate(db);
    await seed(db, "software");
  });

  it("the offline writer answers in claims with sources, and says what it couldn't find when it can't answer", async () => {
    const out = await answerFromPublished({
      question: "Does Platform support single sign-on for merchant admin consoles?",
      teamName: "Platform",
      today: "2026-12-06",
      sources: [src("a", "Platform owns single sign-on for staff tools.", "confirmed", "2026-11-18T00:00:00Z")],
    });
    expect(out.answered).toBe(true);
    expect(out.claims).toEqual([{ text: "Platform owns single sign-on for staff tools.", refs: ["a"] }]);
    expect(out.gaps).toEqual([]);
    const when = await answerFromPublished({ question: "When will merchant sign-on ship?", teamName: "Platform", today: "2026-12-06", sources: [src("a", "Merchant sign-on is planned.", "confirmed", "2026-11-18T00:00:00Z")] });
    expect(when.answered).toBe(false);
    expect(when.gaps[0]).toMatch(/date/i);
  });

  it("keeps the model's claims, drops refs it made up, allows one inference, and an inference alone isn't an answer", async () => {
    const sources = [src("a", "Platform owns single sign-on for staff tools.", "confirmed", "2026-11-18T00:00:00Z")];
    setLLM(new FakeLLM({ answer_question: { answered: true, claims: [
      { text: "Platform owns sign-on.", refs: ["a", "made-up"] },
      { text: "Merchant sign-on is probably new work.", refs: [] },
      { text: "Another guess.", refs: [] },
    ], gaps: ["Capacity next quarter."] } }));
    const out = await answerFromPublished({ question: "Single sign-on for merchants?", teamName: "Platform", today: "2026-12-06", sources });
    expect(out.claims).toEqual([{ text: "Platform owns sign-on.", refs: ["a"] }, { text: "Merchant sign-on is probably new work.", refs: [] }]);
    expect(out.gaps).toEqual(["Capacity next quarter."]);

    setLLM(new FakeLLM({ answer_question: { answered: true, claims: [{ text: "Just a guess.", refs: [] }], gaps: [] } }));
    const guess = await answerFromPublished({ question: "Single sign-on for merchants?", teamName: "Platform", today: "2026-12-06", sources });
    expect(guess.answered).toBe(false);
  });

  it("tags each claim by its strongest source, dates it, flags old sources and drops claims whose sources the viewer can't see", () => {
    const views = claimViews(
      [
        { text: "Owns sign-on.", refs: ["a", "b"] },
        { text: "Uses an old pipeline.", refs: ["old"] },
        { text: "Probably new work.", refs: [] },
        { text: "Something secret.", refs: ["hidden"] },
      ],
      [src("a", "x", "learned", "2026-11-20T00:00:00Z"), src("b", "y", "confirmed", "2026-11-18T00:00:00Z"), src("old", "z", "seen", "2026-06-01T00:00:00Z")],
    );
    expect(views.map((c) => c.tag)).toEqual(["confirmed", "seen", "inference"]);
    expect(views[0].date).toBe("2026-11-20T00:00:00Z");
    expect(views[1].stale).toBe(true);
    expect(views[2].date).toBeUndefined();
  });

  it("the asker sees the answer claim by claim, with learned context tagged as learned", async () => {
    await learnFrom(db, { unitId: sid("platform"), kind: "answer", ref: "rq_lt", label: "Lena's answer", question: "How do I load-test a new endpoint?", text: "Use the k6 harness in platform/loadtest." });
    const priya = await v("priya");
    const { questionId } = await askTeam(db, priya, sid("platform"), "How do I load-test a new endpoint?");
    const got = (await getQuestion(db, priya, questionId))!;
    expect(got.question.outcome).toBe("answered");
    const learned = got.claims.find((c) => c.tag === "learned");
    expect(learned?.text).toMatch(/load-test/i);
    expect(learned?.source?.label).toBe("Learned");
    const sources = await publishedSourcesFor(db, sid("platform"), priya);
    expect(sources.length).toBeGreaterThan(0);
    // Every source links somewhere the reader can open it: the team page, or the meeting.
    for (const src of sources) expect(src.href).toMatch(src.ref.startsWith("meeting:") ? /^\/meetings\// : /^\/teams\/platform/);
  });
});
