// Meetings the team's agent attended. The transcript stays with the host team and the attendees.
// The agent summarizes it; the host routes decisions and risks to affected teams (at their level)
// and turns action items into draft commitments for their owners, who confirm them.
import type { Db, Row } from "./db";
import { now, today } from "./clock";
import { audit, loadPolicy, newId, refMeeting, type Viewer } from "./data";
import { PermissionError, visibleLevel } from "./permissions";
import { getLLM } from "./ai/llm";
import { classify, findDate, levelTexts, overlap, tokens } from "./ai/offline";
import { suggestAffected } from "./ai/tasks";
import { teamInfos } from "./updates";

export interface MeetingSummary {
  summary: string;
  decisions: string[];
  risks: string[];
  action_items: { owner: string; text: string; due: string | null }[];
  by: string;
}

export async function listMeetings(db: Db, viewer: Viewer) {
  const policy = await loadPolicy(db, viewer.orgId);
  const rows = await db.query(
    `select m.*, u.name as unit_name, u.slug as unit_slug, u.color as unit_color, c.kind as source_kind
     from meeting m join unit u on u.id = m.unit_id left join connector c on c.id = m.connector_id order by m.starts_at desc`,
  );
  return rows.filter((m) => visibleLevel(policy, viewer.reader, refMeeting(m)).level === "full");
}

export async function getMeeting(db: Db, viewer: Viewer, id: string) {
  const m = await db.one(
    `select m.*, u.name as unit_name, u.slug as unit_slug, u.color as unit_color, c.kind as source_kind, mk.label as marking_label
     from meeting m join unit u on u.id = m.unit_id left join connector c on c.id = m.connector_id left join marking mk on mk.id = m.marking_id where m.id = $1`,
    [id],
  );
  if (!m) return null;
  const policy = await loadPolicy(db, viewer.orgId);
  if (visibleLevel(policy, viewer.reader, refMeeting(m)).level !== "full") return null;
  const people = await db.query(
    `select a.id, a.name, a.title, (select u.name from member mm join unit u on u.id = mm.unit_id where mm.user_id = a.id and u.how_to_ask <> '{}'::jsonb limit 1) as team
     from app_user a where a.id = any($1)`,
    [m.attendee_ids],
  );
  return { meeting: m, attendees: people, canRoute: viewer.reader.unitIds.includes(m.unit_id) };
}

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "decisions", "risks", "action_items"],
  properties: {
    summary: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    action_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["owner", "text", "due"],
        properties: { owner: { type: "string", description: "Attendee user id" }, text: { type: "string" }, due: { type: "string", description: "YYYY-MM-DD or empty" } },
      },
    },
  },
};

export async function summarizeMeeting(db: Db, viewer: Viewer, id: string): Promise<MeetingSummary> {
  const got = await getMeeting(db, viewer, id);
  if (!got) throw new PermissionError("Only the host team and attendees can summarize this meeting.");
  const { meeting, attendees } = got;
  const llm = getLLM();
  const out = await llm.json<Omit<MeetingSummary, "by">>("summarize_meeting", {
    system:
      "You summarize a work meeting for people who weren't there. Use only the transcript. summary: 2-3 sentences, lead with what changed. " +
      "decisions: each decision as one self-contained sentence. risks: things that could slip. action_items: only explicit commitments, " +
      "with owner = the attendee's id from the list and due = YYYY-MM-DD if a date was said, else empty.",
    prompt: `Today is ${today()}. Meeting: ${meeting.title}.\nAttendees:\n${attendees.map((a) => `- ${a.id}: ${a.name} (${a.team})`).join("\n")}\n\nTranscript:\n${meeting.transcript}`,
    schema: SUMMARY_SCHEMA,
    maxTokens: 3000,
  });
  const ids = new Set(attendees.map((a) => a.id));
  const summary: MeetingSummary =
    out && typeof out.summary === "string"
      ? {
          summary: out.summary,
          decisions: out.decisions ?? [],
          risks: out.risks ?? [],
          action_items: (out.action_items ?? []).filter((a) => ids.has(a.owner)).map((a) => ({ ...a, due: /^\d{4}-\d{2}-\d{2}$/.test(a.due ?? "") ? a.due : null })),
          by: llm.name,
        }
      : { ...offlineSummary(meeting.transcript, attendees), by: "Offline writer" };
  await db.query(`update meeting set summary = $2, status = case when status = 'recorded' then 'summarized' else status end where id = $1`, [id, JSON.stringify(summary)]);
  const agent = await db.one(`select a.id from app_user a join member m on m.user_id = a.id where m.unit_id = $1 and a.kind = 'agent' and a.id = 'agent_' || $1`, [meeting.unit_id]);
  await audit(db, { orgId: viewer.orgId, actorId: agent?.id ?? null, onBehalfOfId: viewer.user.id, action: "summarize_meeting", targetKind: "meeting", targetId: id, detail: { decisions: summary.decisions.length, actions: summary.action_items.length, by: summary.by } });
  return summary;
}

/** Heuristic summary from "Name: text" transcript lines. */
export function offlineSummary(transcript: string, attendees: Row[]): Omit<MeetingSummary, "by"> {
  const decisions: string[] = [];
  const risks: string[] = [];
  const actions: MeetingSummary["action_items"] = [];
  for (const line of transcript.split("\n")) {
    const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (!m) continue;
    const speaker = attendees.find((a) => a.name === m[1].trim());
    const sentences = m[2].match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
    sentences.forEach((s, i) => {
      if (/\b(the decision is|decision:|we decided|let's decide|that's the decision)\b/i.test(s) || /^decision\b/i.test(s)) {
        decisions.push(s.replace(/^(then |so )?(the )?decision is( that)?\s*/i, "").replace(/^./, (c) => c.toUpperCase()));
      } else if (/\b(I'll|I will)\b/.test(s) && speaker) {
        let text = s;
        if (/\b(that|it) (ready|done)\b/i.test(s) && i > 0) text = sentences[i - 1].replace(/^(as a fallback, )?i can /i, "");
        text = text.replace(/^(yes, )?(I'll|I will)\s+/i, "").replace(/\s+(by|before|on)\s+[A-Z][a-z]{2,8}\.? \d{1,2}\.?$/, "").replace(/[.]$/, "");
        actions.push({ owner: speaker.id, text: text.charAt(0).toUpperCase() + text.slice(1), due: findDate(s, today()) });
      } else if (classify(s) === "risk" && !/\?$/.test(s)) {
        risks.push(s);
      }
    });
  }
  const summary = [risks[0], decisions[0] ? `Decision: ${decisions[0]}` : null, actions.length ? `${actions.length} follow-ups were agreed.` : null].filter(Boolean).join(" ");
  return { summary: summary || "No decisions or follow-ups were recorded.", decisions, risks: risks.slice(0, 4), action_items: actions };
}

/**
 * Route a summarized meeting: decisions and risks become a draft update for the host to review and
 * publish (affected teams then see them at their level), and each action item becomes a draft
 * commitment that only its owner can see until they confirm it.
 */
export async function routeMeeting(db: Db, viewer: Viewer, id: string): Promise<string> {
  const got = await getMeeting(db, viewer, id);
  if (!got || !got.canRoute) throw new PermissionError("Only the host team can route this meeting.");
  const { meeting, attendees } = got;
  const s = meeting.summary as MeetingSummary | null;
  if (!s) throw new Error("Summarize the meeting first.");
  if (meeting.update_id) {
    const u = await db.one(`select status from team_update where id = $1`, [meeting.update_id]);
    if (u && u.status !== "discarded") return meeting.update_id;
  }
  const teams = await teamInfos(db);
  const named = teams.filter((t) => t.id !== meeting.unit_id && overlap(tokens(meeting.transcript), tokens(t.name)) >= Math.min(2, tokens(t.name).length)).map((t) => t.id);
  const attendeeTeams = (await db.query(`select distinct m.unit_id from member m join unit u on u.id = m.unit_id where m.user_id = any($1) and u.how_to_ask <> '{}'::jsonb`, [meeting.attendee_ids]))
    .map((r) => r.unit_id)
    .filter((u) => u !== meeting.unit_id);
  const updateId = newId("up");
  const author = viewer.user.id;
  await db.tx(async (t) => {
    await t.query(
      `insert into team_update (id, unit_id, author_id, period_start, body_md, source, status, created_at) values ($1, $2, $3, $4, $5, 'meeting', 'draft', $6)`,
      [updateId, meeting.unit_id, author, today(), `From the meeting "${meeting.title}":\n${s.summary}`, now()],
    );
    const items = [...s.decisions.map((d) => ({ kind: "decision", text: d })), ...s.risks.map((r) => ({ kind: "risk", text: r }))];
    for (const it of items) {
      const { summary, headline } = levelTexts(it.text);
      const affected = [...new Set([...suggestAffected(it.text, meeting.unit_id, teams), ...attendeeTeams, ...(it.kind === "decision" ? named : [])])];
      await t.query(
        `insert into update_item (id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, marking_id, status, source_kind, source_ref, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', 'meeting', $11, $12)`,
        [newId("ui"), updateId, meeting.unit_id, author, it.kind, it.text, summary, headline, affected, meeting.marking_id, meeting.id, now()],
      );
    }
    for (const a of s.action_items) {
      const owner = await t.one(
        `select m.id as member_id, m.unit_id from member m join unit u on u.id = m.unit_id where m.user_id = $1 and u.how_to_ask <> '{}'::jsonb order by (m.unit_id = $2) desc limit 1`,
        [a.owner, meeting.unit_id],
      );
      if (!owner) continue;
      await t.query(
        `insert into commitment (id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, original_due_date, status, update_id, marking_id, created_at)
         values ($1, $2, $3, $4, 'manual', $5, $6, $7, $7, 'draft', $8, $9, $10)`,
        [newId("cm"), owner.unit_id, owner.member_id, owner.unit_id === meeting.unit_id ? attendeeTeams[0] ?? null : meeting.unit_id, meeting.id, a.text, a.due ?? today(), updateId, meeting.marking_id, now()],
      );
    }
    await t.query(`update meeting set status = 'routed', update_id = $2 where id = $1`, [meeting.id, updateId]);
  });
  await audit(db, { orgId: viewer.orgId, actorId: viewer.user.id, action: "route_meeting", targetKind: "meeting", targetId: id, detail: { update: updateId, actions: s.action_items.length } });
  return updateId;
}

export function attendeeName(attendees: Row[], id: string) {
  return attendees.find((a) => a.id === id)?.name ?? id;
}
