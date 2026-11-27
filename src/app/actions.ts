"use server";
// Every mutation goes through here. Each action reloads the viewer from the cookie and the library
// functions re-check permissions on the server, so hiding a button is never the only protection.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { currentViewer, PERSONA_COOKIE } from "@/lib/session";
import { ALL_KINDS, audit, loadViewer } from "@/lib/data";
import { analyzeUpdate, publishDraft, type PublishForm } from "@/lib/updates";
import { confirmCommitment, markDone, rejectCommitment } from "@/lib/commitments";
import { answerCluster, askTeam, declineCluster, sendBatch, submitRequest } from "@/lib/agent";
import { sendLeadershipDigest } from "@/lib/digest";
import { ingestCodingSession, ingestPullRequest, samplePullRequest, SAMPLE_SESSIONS } from "@/lib/sources";
import { isLevel } from "@/lib/permissions";
import { now } from "@/lib/clock";
import { seed } from "@/lib/seed";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safePath = (p: string) => (p.startsWith("/") && !p.startsWith("//") ? p : "/feed");
const withMsg = (path: string, msg: string) => `${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`;

async function run(fallback: string, fn: () => Promise<string>): Promise<never> {
  let target: string;
  try {
    target = await fn();
  } catch (e) {
    target = withMsg(fallback, `Error: ${(e as Error).message}`);
  }
  revalidatePath("/", "layout");
  redirect(target);
}

export async function setPersona(form: FormData) {
  const id = str(form, "userId");
  const { db } = await currentViewer();
  const v = await loadViewer(db, id);
  if (v && v.user.kind === "human") (await cookies()).set(PERSONA_COOKIE, id, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
  redirect(safePath(str(form, "path")));
}

export async function resetDemo(form: FormData) {
  const { db } = await currentViewer();
  const tables = await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'public' and tablename <> '_migrations'`);
  await db.exec(`truncate ${tables.map((t) => `"${t.tablename}"`).join(", ")} restart identity cascade`);
  await seed(db);
  revalidatePath("/", "layout");
  redirect(withMsg(safePath(str(form, "path")), "Demo data reset to the Dec 6 story."));
}

export async function askAgent(form: FormData) {
  const slug = str(form, "slug");
  return run(`/teams/${slug}`, async () => {
    const { db, viewer } = await currentViewer();
    const { questionId } = await askTeam(db, viewer, str(form, "unitId"), str(form, "question"), {
      blocking: form.get("blocking") === "on",
      neededBy: str(form, "neededBy") || undefined,
    });
    return `/teams/${slug}?q=${questionId}#agent`;
  });
}

export async function sendRequest(form: FormData) {
  const slug = str(form, "slug");
  return run(`/teams/${slug}`, async () => {
    const { db, viewer } = await currentViewer();
    const r = await submitRequest(db, viewer, str(form, "unitId"), {
      title: str(form, "title"),
      details: str(form, "details"),
      neededBy: str(form, "neededBy") || undefined,
      blocking: form.get("blocking") === "on",
    });
    const when = r.immediate ? "They've been notified now." : "It's in their next batch of asks.";
    return withMsg(`/teams/${slug}`, `Sent to ${r.assignee}${r.ownership ? ` (owns ${r.ownership})` : ""}. ${when}`);
  });
}

export async function toggleFollow(form: FormData) {
  const slug = str(form, "slug");
  return run(`/teams/${slug}`, async () => {
    const { db, viewer } = await currentViewer();
    const unitId = str(form, "unitId");
    const mine = viewer.team.id;
    if (unitId === mine) throw new Error("You can't follow your own team.");
    const existing = await db.one(`select 1 from follow where unit_id = $1 and follower_unit_id = $2`, [unitId, mine]);
    if (existing) {
      await db.query(`delete from follow where unit_id = $1 and follower_unit_id = $2`, [unitId, mine]);
      await db.query(`delete from interface where from_unit_id = $1 and to_unit_id = $2`, [unitId, mine]);
    } else {
      await db.query(`insert into follow (unit_id, follower_unit_id) values ($1, $2)`, [unitId, mine]);
      await db.query(
        `insert into interface (id, from_unit_id, to_unit_id, kinds, level, cadence) values ($1, $2, $3, $4, 'summary', 'weekly') on conflict (from_unit_id, to_unit_id) do nothing`,
        [`if_${unitId}_${mine}`, unitId, mine, ALL_KINDS.filter((k) => k !== "request")],
      );
    }
    await audit(db, { actorId: viewer.user.id, action: existing ? "unfollow" : "follow", targetKind: "unit", targetId: unitId, detail: { follower: mine } });
    return withMsg(`/teams/${slug}`, existing ? `${viewer.team.name} no longer follows this team.` : `${viewer.team.name} now follows this team and sees its updates at Summary.`);
  });
}

export async function analyze(form: FormData) {
  return run("/write", async () => {
    const { db, viewer } = await currentViewer();
    const source = str(form, "source") === "meeting" ? "meeting" : "manual";
    const { updateId } = await analyzeUpdate(db, viewer, { unitId: str(form, "unitId"), text: str(form, "text"), source });
    return `/write?draft=${updateId}`;
  });
}

export async function publish(form: FormData) {
  const updateId = str(form, "updateId");
  return run(`/write?draft=${updateId}`, async () => {
    const { db, viewer } = await currentViewer();
    const data: PublishForm = {
      items: form.getAll("item_ids").map(String).map((id) => ({
        id,
        include: form.get(`include_${id}`) === "on",
        kind: str(form, `kind_${id}`),
        text: str(form, `text_${id}`),
        summary: str(form, `summary_${id}`),
        headline: str(form, `headline_${id}`),
        affected: form.getAll(`affected_${id}`).map(String),
      })),
      commitments: form.getAll("c_ids").map(String).map((id) => ({
        id,
        confirm: form.get(`confirm_${id}`) === "on",
        title: str(form, `ctitle_${id}`),
        due_date: str(form, `cdue_${id}`),
      })),
    };
    const r = await publishDraft(db, viewer, updateId, data);
    const people = r.notified.reduce((n, x) => n + x.people, 0) + r.commitments.reduce((n, x) => n + x.people, 0);
    const teams = new Set([...r.notified.map((x) => x.unitId), ...r.commitments.flatMap((c) => c.teams)]);
    return withMsg("/write", `Published. ${teams.size > 0 ? `Notified ${people} people on ${teams.size} ${teams.size === 1 ? "team" : "teams"} at their level.` : "Teams that follow you will see it in their feed."}`);
  });
}

export async function discardDraft(form: FormData) {
  return run("/write", async () => {
    const { db, viewer } = await currentViewer();
    const id = str(form, "updateId");
    const u = await db.one(`select * from team_update where id = $1`, [id]);
    if (!u || u.author_id !== viewer.user.id) throw new Error("Only the author can discard a draft.");
    await db.query(`update team_update set status = 'discarded' where id = $1`, [id]);
    await db.query(`update update_item set status = 'discarded' where update_id = $1`, [id]);
    await db.query(`update commitment set status = 'rejected' where update_id = $1 and status = 'draft'`, [id]);
    return withMsg("/write", "Draft discarded. Nothing was shared.");
  });
}

export async function commitmentAction(form: FormData) {
  const back = safePath(str(form, "path") || "/commitments");
  return run(back, async () => {
    const { db, viewer } = await currentViewer();
    const id = str(form, "id");
    const op = str(form, "op");
    if (op === "confirm") await confirmCommitment(db, viewer, id, { due_date: str(form, "due") || undefined });
    else if (op === "reject") await rejectCommitment(db, viewer, id);
    else if (op === "done") await markDone(db, viewer, id);
    return withMsg(back, op === "confirm" ? "Confirmed. The waiting team was notified." : op === "done" ? "Marked done. The waiting team was notified." : "Rejected.");
  });
}

export async function answerAsk(form: FormData) {
  return run("/asks", async () => {
    const { db, viewer } = await currentViewer();
    const key = str(form, "key");
    if (form.get("decline") === "1") {
      await declineCluster(db, viewer, key, str(form, "answer"));
      return withMsg("/asks", "Declined. Everyone who asked was told.");
    }
    const lvl = str(form, "publishLevel");
    const r = await answerCluster(db, viewer, key, {
      answer: str(form, "answer"),
      publish: form.get("publish") === "on",
      publishLevel: isLevel(lvl) ? lvl : undefined,
      commitDue: form.get("commit") === "on" ? str(form, "due") || undefined : undefined,
    });
    const parts = [`Answered ${r.recipients} ${r.recipients === 1 ? "person" : "people"} at once.`];
    if (r.publishedId) parts.push("Published to your team page, so the agent can answer it next time.");
    if (r.commitmentId) parts.push("Added a commitment.");
    return withMsg("/asks", parts.join(" "));
  });
}

export async function sendMyBatch() {
  return run("/asks", async () => {
    const { db, viewer } = await currentViewer();
    const r = await sendBatch(db, viewer);
    return withMsg("/asks", r.sent ? `Sent your batch: ${r.sent} ${r.sent === 1 ? "ask" : "asks"} in one message. Check Inbox.` : "Nothing new to send.");
  });
}

export async function sendDigest() {
  return run("/digest", async () => {
    const { db, viewer } = await currentViewer();
    const r = await sendLeadershipDigest(db, viewer);
    return withMsg("/digest", `Emailed the digest to ${r.sent} Leadership members. Each send is in the audit log.`);
  });
}

export async function markInboxRead() {
  const { db, viewer } = await currentViewer();
  await db.query(`update delivery set read_at = $2 where recipient_id = $1 and read_at is null`, [viewer.user.id, now()]);
  revalidatePath("/", "layout");
  redirect("/inbox");
}

export async function simulate(form: FormData) {
  return run("/connect", async () => {
    const { db, viewer } = await currentViewer();
    if (str(form, "kind") === "pr") {
      const r = await ingestPullRequest(db, samplePullRequest(viewer));
      if ("skipped" in r) throw new Error(r.skipped);
      return `/write?draft=${r.updateId}`;
    }
    const sample = SAMPLE_SESSIONS[viewer.team.id] ?? {
      ...SAMPLE_SESSIONS.payments,
      repo: `northwind/${viewer.team.id}`,
      branch: "main",
      prompts: [`Tidy up the ${viewer.team.name} onboarding checklist and fix the broken links`],
      notes: ["Checklist updated; two links still point at the old wiki."],
      commits: ["1a2b3c4 Update onboarding checklist"],
    };
    const r = await ingestCodingSession(db, viewer, sample);
    return `/write?draft=${r.updateId}`;
  });
}

// ---- Integrations, meetings and agent work ----

export async function connectTool(form: FormData) {
  return run("/connect", async () => {
    const { db, viewer } = await currentViewer();
    const { addConnector, CONNECTOR_LABEL } = await import("@/lib/integrations");
    const kind = str(form, "kind");
    await addConnector(db, viewer, viewer.team.id, kind);
    return withMsg("/connect", `Connected ${CONNECTOR_LABEL[kind] ?? kind} for ${viewer.team.name}. Its content stays inside your team unless you share it.`);
  });
}

export async function syncTool(form: FormData) {
  return run("/connect", async () => {
    const { db, viewer } = await currentViewer();
    const { syncConnector } = await import("@/lib/integrations");
    await syncConnector(db, viewer, str(form, "id"));
    return withMsg("/connect", "Synced.");
  });
}

export async function summarizeMeetingAction(form: FormData) {
  const id = str(form, "id");
  return run(`/meetings/${id}`, async () => {
    const { db, viewer } = await currentViewer();
    const { summarizeMeeting } = await import("@/lib/meetings");
    const s = await summarizeMeeting(db, viewer, id);
    return withMsg(`/meetings/${id}`, `Summarized by ${s.by}: ${s.decisions.length} decisions, ${s.action_items.length} action items.`);
  });
}

export async function routeMeetingAction(form: FormData) {
  const id = str(form, "id");
  return run(`/meetings/${id}`, async () => {
    const { db, viewer } = await currentViewer();
    const { routeMeeting } = await import("@/lib/meetings");
    const updateId = await routeMeeting(db, viewer, id);
    return withMsg(`/write?draft=${updateId}`, "Drafted from the meeting. Review the items and publish; action items for other people stay as drafts for them to confirm.");
  });
}

export async function startTaskAction(form: FormData) {
  const slug = str(form, "slug");
  return run(`/agents/${slug}`, async () => {
    const { db, viewer } = await currentViewer();
    const { startTask, runTask } = await import("@/lib/work");
    const kind = str(form, "kind") === "draft_update" ? "draft_update" : "research";
    const id = await startTask(db, viewer, str(form, "unitId"), { kind, instructions: str(form, "instructions") });
    after(() => runTask(db, id));
    return `/agents/${slug}/tasks/${id}`;
  });
}

export async function taskAction(form: FormData) {
  const slug = str(form, "slug");
  const id = str(form, "id");
  const back = `/agents/${slug}/tasks/${id}`;
  return run(back, async () => {
    const { db, viewer } = await currentViewer();
    const w = await import("@/lib/work");
    const op = str(form, "op");
    if (op === "comment") await w.commentTask(db, viewer, id, str(form, "text"));
    else if (op === "redirect") {
      await w.redirectTask(db, viewer, id, str(form, "text"));
      after(() => w.runTask(db, id));
    } else if (op === "takeover") await w.takeOverTask(db, viewer, id);
    return back;
  });
}
