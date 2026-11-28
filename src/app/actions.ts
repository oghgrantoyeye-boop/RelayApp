"use server";
// Every mutation goes through here. Each action reloads the viewer from the cookie and the library
// functions re-check permissions on the server, so hiding a button is never the only protection.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { currentViewer, DOCK_COOKIE, GUIDE_COOKIE, PERSONA_COOKIE } from "@/lib/session";
import { ALL_KINDS, audit, loadViewer } from "@/lib/data";
import { analyzeUpdate, publishDraft, type PublishForm } from "@/lib/updates";
import { confirmCommitment, markDone, rejectCommitment } from "@/lib/commitments";
import { answerCluster, askTeam, declineCluster, sendBatch, submitRequest } from "@/lib/agent";
import { sendLeadershipDigest } from "@/lib/digest";
import { ingestCodingSession, ingestPullRequest, samplePullRequest } from "@/lib/sources";
import { isLevel } from "@/lib/permissions";
import { now } from "@/lib/clock";
import { seed } from "@/lib/seed";
import { getDemo } from "@/lib/demos";
import type { Db } from "@/lib/db";

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
  const { db, orgId } = await currentViewer();
  const { scoped } = await import("@/lib/scoped");
  const v = (await loadViewer(db, id, orgId)) || (await loadViewer(db, scoped(orgId, id), orgId));
  if (v && v.user.kind === "human") (await cookies()).set(PERSONA_COOKIE, v.user.id, { path: "/", sameSite: "lax", httpOnly: true });
  // Guide buttons carry their step number, so the guide bar can follow along on every page.
  const step = str(form, "step");
  if (step === "off") (await cookies()).delete(GUIDE_COOKIE);
  else if (step) (await cookies()).set(GUIDE_COOKIE, step, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
  redirect(safePath(str(form, "path")));
}

export async function hideGuideBar(form: FormData) {
  (await cookies()).delete(GUIDE_COOKIE);
  revalidatePath("/", "layout");
  redirect(safePath(str(form, "path")));
}

async function loadDemo(db: Db, demoId: string) {
  const { resetWorkspace } = await import("@/lib/workspace-reset");
  await resetWorkspace(db, demoId);
}

export async function resetDemo(form: FormData) {
  const { db, demo } = await currentViewer();
  await loadDemo(db, demo.id);
  (await cookies()).delete(GUIDE_COOKIE);
  revalidatePath("/", "layout");
  redirect(withMsg(safePath(str(form, "path")), "Demo data reset to the Dec 6 story."));
}

/** Open another sample workspace. Other workspaces stay in the database. */
export async function switchDemo(form: FormData) {
  const pack = getDemo(str(form, "demo"));
  const { db } = await currentViewer();
  const exists = await db.one(`select id from org where id = $1`, [pack.id]);
  if (!exists) await seed(db, pack.id);
  const { scopedPersona } = await import("@/lib/scoped");
  (await cookies()).set("relay_org", pack.id, { path: "/", sameSite: "lax", httpOnly: true });
  (await cookies()).set(PERSONA_COOKIE, scopedPersona(pack.id, pack.defaultPersona), { path: "/", sameSite: "lax", httpOnly: true });
  (await cookies()).delete(GUIDE_COOKIE);
  revalidatePath("/", "layout");
  redirect(withMsg("/guide", `Opened the ${pack.org.name} sample.`));
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

/** The asker's reply to an agent's follow-up question on the team page. */
export async function replyToAgent(form: FormData) {
  const slug = str(form, "slug");
  return run(`/teams/${slug}`, async () => {
    const { db, viewer } = await currentViewer();
    const { continueQuestion } = await import("@/lib/agent");
    const { questionId } = await continueQuestion(db, viewer, str(form, "questionId"), str(form, "reply"));
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
    return withMsg(`/teams/${slug}`, r.destination === "team_queue" ? r.reason : `Sent to ${r.assignee}${r.ownership ? ` (owns ${r.ownership})` : ""}. ${when}`);
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
    await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: existing ? "unfollow" : "follow", targetKind: "unit", targetId: unitId, detail: { follower: mine } });
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
  const back = str(form, "tab") === "team" ? "/asks?tab=team" : "/asks";
  return run(back, async () => {
    const { db, viewer } = await currentViewer();
    const key = str(form, "key");
    if (form.get("decline") === "1") {
      await declineCluster(db, viewer, key, str(form, "answer"));
      return withMsg(back, "Declined. Everyone who asked was told.");
    }
    const r = await answerCluster(db, viewer, key, {
      answer: str(form, "answer"),
      commitDue: form.get("commit") === "on" ? str(form, "due") || undefined : undefined,
    });
    const parts = [`Answered ${r.recipients} ${r.recipients === 1 ? "person" : "people"} at once. It stays private to them.`];
    if (r.commitmentId) parts.push("Added a commitment.");
    const sep = back.includes("?") ? "&" : "?";
    return withMsg(`${back}${sep}answered=${encodeURIComponent(r.requestId)}`, parts.join(" "));
  });
}

/** Team queue buttons: I'll take it, Pass to a teammate, Ask them for more detail. */
export async function queueAction(form: FormData) {
  const back = str(form, "tab") === "team" ? "/asks?tab=team" : "/asks";
  return run(back, async () => {
    const { db, viewer } = await currentViewer();
    const { claimCluster, passCluster, askForDetail } = await import("@/lib/agent");
    const key = str(form, "key");
    const op = str(form, "op");
    if (op === "claim") {
      await claimCluster(db, viewer, key);
      return withMsg("/asks", "It's yours. It's under For you now, and the team can see you picked it up.");
    }
    if (op === "pass") {
      const r = await passCluster(db, viewer, key, str(form, "to"), str(form, "note"));
      return withMsg(back, `Passed to ${r.to}. They've been told.`);
    }
    if (op === "detail") {
      const r = await askForDetail(db, viewer, key, str(form, "question"));
      return withMsg(back, `Asked ${r.recipients === 1 ? "them" : `all ${r.recipients}`} for more detail. The question stays open.`);
    }
    throw new Error("Unknown action");
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

export async function issueCodingToken() {
  return run("/connect", async () => {
    const { db, viewer, isSample } = await currentViewer();
    if (isSample) throw new Error("Personal tokens can't be issued in a sample workspace");
    const { issueApiToken, API_TOKEN_ONCE_COOKIE } = await import("@/lib/auth/api-tokens");
    const token = await issueApiToken(db, viewer.user);
    (await cookies()).set(API_TOKEN_ONCE_COOKIE, token, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 120,
    });
    return withMsg("/connect", "Issued a new Claude Code token. Copy the install command now. It won't be shown again.");
  });
}

export async function revokeCodingToken() {
  return run("/connect", async () => {
    const { db, viewer, isSample } = await currentViewer();
    if (isSample) throw new Error("Personal tokens can't be revoked in a sample workspace");
    const { revokeApiToken, API_TOKEN_ONCE_COOKIE } = await import("@/lib/auth/api-tokens");
    await revokeApiToken(db, viewer.user);
    (await cookies()).delete(API_TOKEN_ONCE_COOKIE);
    return withMsg("/connect", "Revoked your Claude Code token. Hooks using it will stop working until you issue a new one.");
  });
}

export async function simulate(form: FormData) {
  return run("/connect", async () => {
    const { db, viewer } = await currentViewer();
    if (str(form, "kind") === "pr") {
      const { demo } = await currentViewer();
      const r = await ingestPullRequest(db, samplePullRequest(viewer, demo));
      if ("skipped" in r) throw new Error(r.skipped);
      return `/write?draft=${r.updateId}`;
    }
    const { demo } = await currentViewer();
    const { localId } = await import("@/lib/scoped");
    const teamKey = localId(demo.id, viewer.team.id);
    const sample = demo.ui.sampleSessions[teamKey] ?? {
      repo: `${demo.org.domain}/${teamKey}`,
      diffstat: "2 files changed, 18 insertions(+), 6 deletions(-)",
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
    const k = str(form, "kind");
    const kind = k === "draft_update" || k === "review_doc" || k === "code" ? k : "research";
    const id = await startTask(db, viewer, str(form, "unitId"), { kind, instructions: str(form, "instructions"), agentId: str(form, "agentId") || undefined });
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

// ---- Talking to agents, and adding agent teammates ----

export async function chatSend(form: FormData) {
  const path = safePath(str(form, "path"));
  return run(path, async () => {
    const { db, viewer } = await currentViewer();
    const { sendChat, resolveMention } = await import("@/lib/assistant");
    let target = str(form, "target") || "me";
    const text = str(form, "text");
    const mention = await resolveMention(db, text);
    if (mention) target = mention.agent.id;
    await sendChat(db, viewer, { target, text, replyTo: str(form, "replyTo") || undefined });
    if (form.get("from") === "dock") (await cookies()).set(DOCK_COOKIE, target, { path: "/", sameSite: "lax", httpOnly: true });
    // The full chat view follows the conversation the message went to.
    if (path.startsWith("/messages")) return `/messages?with=${encodeURIComponent(target)}`;
    return path;
  });
}

export async function chatDecide(form: FormData) {
  const path = safePath(str(form, "path"));
  return run(path, async () => {
    const { db, viewer } = await currentViewer();
    const { decideAction } = await import("@/lib/assistant");
    const out = await decideAction(db, viewer, str(form, "messageId"), str(form, "actionId"), str(form, "op") === "approve");
    if (out.taskId) {
      const { runTask } = await import("@/lib/work");
      after(() => runTask(db, out.taskId!));
    }
    return path;
  });
}

export async function setDockTarget(form: FormData) {
  (await cookies()).set(DOCK_COOKIE, str(form, "target") || "me", { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
  redirect(safePath(str(form, "path")));
}

export async function createAgentAction(form: FormData) {
  return run("/agents/new", async () => {
    const { db, viewer } = await currentViewer();
    const { createAgent } = await import("@/lib/agents");
    const id = await createAgent(db, viewer, {
      unitId: str(form, "unitId"),
      name: str(form, "name"),
      purpose: str(form, "purpose"),
      connectorIds: form.getAll("connectors").map(String),
      actions: form.getAll("actions").map(String),
      approval: str(form, "approval"),
      schedule: str(form, "schedule"),
      budget: Number(str(form, "budget")) || 50,
    });
    (await cookies()).set(DOCK_COOKIE, id, { path: "/", sameSite: "lax", httpOnly: true });
    return withMsg(`/messages?with=${id}`, "Your new teammate is ready. Say hello, or give it its first job.");
  });
}
