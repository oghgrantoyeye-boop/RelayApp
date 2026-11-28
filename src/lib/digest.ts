// The leadership digest: one paragraph per team per week, plus slipped commitments across the org.
// Each paragraph is a derived output: built only from what the reader may see, and carrying every
// marking of its inputs, so a confidential input makes the paragraph confidential.
import type { Db, Row } from "./db";
import { addDays, fmt, now, today } from "./clock";
import { audit, loadPolicy, markingIdsOf, refRequest, refUpdateItem, teamMembers, type Viewer } from "./data";
import { commitmentViews, type CommitmentView } from "./commitments";
import { deliver } from "./deliver";
import { canSeeDerived, deriveMarkings, visibleLevel, type Reader } from "./permissions";
import { showRequest, showUpdateItem } from "./render";
import { teamHeadline } from "./ai/tasks";

export interface DigestParagraph {
  team: Row;
  text: string;
  markingIds: string[];
  markingLabels: string[];
  inputs: number;
  visible: boolean;
}

export interface Digest {
  weekOf: string;
  paragraphs: DigestParagraph[];
  hidden: number;
  slipped: CommitmentView[];
  by: string;
}

export async function buildDigest(db: Db, reader: Reader): Promise<Digest> {
  const user = await db.one(`select org_id from app_user where id = $1`, [reader.userId]);
  if (!user) throw new Error("No person for digest");
  const orgId = user.org_id as string;
  const policy = await loadPolicy(db, orgId);
  const since = addDays(today(), -7);
  const teams = await db.query(`select * from unit where org_id = $1 and how_to_ask <> '{}'::jsonb order by name`, [orgId]);
  const items = await db.query(`select * from update_item where org_id = $1 and status = 'published' and published_at >= $2 order by published_at`, [orgId, since]);
  const requests = await db.query(
    `select r.*, fu.name as from_name, tu.name as to_name from request r join unit fu on fu.id = r.from_unit_id join unit tu on tu.id = r.to_unit_id where r.org_id = $1 and r.status = 'open'`,
    [orgId],
  );
  const paragraphs: DigestParagraph[] = [];
  let by = "Offline writer";
  for (const team of teams) {
    const inputs: { kind: string; text: string; markingIds: string[] }[] = [];
    for (const i of items.filter((x) => x.unit_id === team.id)) {
      const shown = showUpdateItem(i, visibleLevel(policy, reader, refUpdateItem(i)).level);
      if (shown) inputs.push({ kind: i.kind, text: shown.text, markingIds: markingIdsOf(i) });
    }
    for (const r of requests.filter((x) => x.from_unit_id === team.id)) {
      const shown = showRequest(r, visibleLevel(policy, reader, refRequest(r)).level, { from: r.from_name, to: r.to_name });
      if (shown && shown.details) inputs.push({ kind: "ask", text: `Open request to ${r.to_name}: ${shown.title}`, markingIds: markingIdsOf(r) });
    }
    const markingIds = deriveMarkings(inputs);
    const h = await teamHeadline(team.name, inputs);
    if (h.by !== "Offline writer") by = h.by;
    paragraphs.push({
      team,
      text: h.text,
      markingIds,
      markingLabels: markingIds.map((id) => policy.markings[id]?.label ?? id),
      inputs: inputs.length,
      visible: canSeeDerived(policy, reader, markingIds),
    });
  }
  const slipped = (await commitmentViews(db, reader, (r) => r.status === "open" && r.due_date < today())).sort((a, b) => a.due.localeCompare(b.due));
  return {
    weekOf: since,
    paragraphs: paragraphs.filter((p) => p.visible),
    hidden: paragraphs.filter((p) => !p.visible).length,
    slipped,
    by,
  };
}

/** Email the digest to Leadership. Every send writes an audit event. */
export async function sendLeadershipDigest(db: Db, viewer: Viewer) {
  const leadership = await db.one(`select id from unit where org_id = $1 and slug = 'leadership'`, [viewer.orgId]);
  const members = await teamMembers(db, leadership ? [leadership.id] : []);
  let sent = 0;
  for (const m of members) {
    const units = await db.query(`select unit_id from member where user_id = $1`, [m.id]);
    const reader: Reader = { userId: m.id, unitIds: units.map((u) => u.unit_id) };
    const d = await buildDigest(db, reader);
    const body = [
      ...d.paragraphs.map((p) => `${p.team.name}${p.markingLabels.length ? ` [${p.markingLabels.join(", ")}]` : ""}: ${p.text}`),
      "",
      `Dates that are changing (${d.slipped.length}):`,
      ...d.slipped.map((c) => `• ${c.ownerUnit.name}: ${c.shown.title}, due ${fmt(c.due)}${c.shown.reason ? `. ${c.shown.reason}` : ""}`),
    ].join("\n");
    sent += await deliver(db, [m.id], { kind: "leadership_digest", subject: `Leadership digest, week of ${fmt(d.weekOf)}`, body, refs: [{ type: "digest", id: d.weekOf, href: "/digest" }] });
    await audit(db, { orgId: viewer.orgId,
      actorId: viewer.user.id,
      action: "digest_send",
      targetKind: "digest",
      targetId: d.weekOf,
      detail: { recipient: m.id, paragraphs: d.paragraphs.length, markings: deriveMarkings(d.paragraphs), at: now().toISOString() },
    });
  }
  return { sent };
}
