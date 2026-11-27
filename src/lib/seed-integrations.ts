// Northwind Labs' connected tools and what they synced. All fictional, consistent with the Dec 6
// story in seed.ts: Platform's limiter leak, Payments' webhook retries, Growth's Dec 15 launch and
// the confidential Halcyon Bank deal.
import type { Db } from "./db";

type Conn = [id: string, unit: string, kind: string, name: string, by: string];
const CONNECTORS: Conn[] = [
  ["cn_plat_slack", "platform", "slack", "#platform-eng", "marcus"],
  ["cn_plat_jira", "platform", "jira", "Jira: PLAT", "marcus"],
  ["cn_plat_gh", "platform", "github", "northwind/platform", "lena"],
  ["cn_plat_notion", "platform", "notion", "Platform runbooks", "lena"],
  ["cn_plat_meet", "platform", "gmeet", "Google Meet", "marcus"],
  ["cn_pay_slack", "payments", "slack", "#payments-api", "priya"],
  ["cn_pay_linear", "payments", "linear", "Linear: PAY", "priya"],
  ["cn_pay_gh", "payments", "github", "northwind/payments-api", "diego"],
  ["cn_pay_drive", "payments", "gdrive", "Payments specs", "priya"],
  ["cn_pay_zoom", "payments", "zoom", "Zoom", "priya"],
  ["cn_growth_slack", "growth", "slack", "#growth", "maya"],
  ["cn_growth_notion", "growth", "notion", "Launch hub", "jordan"],
  ["cn_growth_zoom", "growth", "zoom", "Zoom", "maya"],
  ["cn_mobile_slack", "mobile", "slack", "#mobile", "sofia"],
  ["cn_mobile_jira", "mobile", "jira", "Jira: MOB", "sofia"],
  ["cn_sales_slack", "sales", "slack", "#sales", "victor"],
  ["cn_sales_drive", "sales", "gdrive", "Deal desk", "victor"],
  ["cn_cs_zendesk", "cs", "zendesk", "Zendesk escalations", "grace"],
  ["cn_cs_slack", "cs", "slack", "#cs-escalations", "grace"],
  ["cn_design_figma", "design", "figma", "Figma: Design system", "nora"],
  ["cn_design_notion", "design", "notion", "Research repository", "omar"],
  ["cn_fin_drive", "finance", "gdrive", "FP&A", "isabel"],
  ["cn_lead_drive", "leadership", "gdrive", "Leadership", "sam"],
  ["cn_lead_meet", "leadership", "gmeet", "Google Meet", "sam"],
];

type Doc = [connector: string, kind: "message" | "ticket" | "doc" | "pr", ref: string | null, title: string, body: string, status: string | null, author: string, at: string, marking?: string];
const DOCS: Doc[] = [
  // Platform
  ["cn_plat_jira", "ticket", "PLAT-142", "Per-merchant burst limits", "Token buckets per merchant so one merchant's traffic (including webhook retry storms) can't trip the global limit. Blocks Payments' webhook retries (PAY-311). Load test found a memory leak, tracked in PLAT-151.", "In review", "Aisha Bello", "2026-12-04T15:00:00Z"],
  ["cn_plat_jira", "ticket", "PLAT-151", "Limiter leaks memory under load", "Idle merchant buckets are never evicted, so memory grows with the number of merchants seen. Fix in PR #1840; overnight soak test running.", "In review", "Aisha Bello", "2026-12-04T18:00:00Z"],
  ["cn_plat_jira", "ticket", "PLAT-138", "SSO for the mobile admin app", "SAML login for the mobile admin app via the new identity provider. Requested by Mobile; due Dec 18.", "In progress", "Ken Watanabe", "2026-12-03T10:00:00Z"],
  ["cn_plat_jira", "ticket", "PLAT-160", "Turn off the old cron scheduler", "All teams must migrate cron jobs by Dec 18. Finance and Mobile still have jobs on the old scheduler.", "To do", "Lena Fischer", "2026-11-30T10:00:00Z"],
  ["cn_plat_gh", "pr", "#1840", "Evict idle merchant buckets from the limiter", "Adds an LRU eviction pass for buckets idle more than 10 minutes. Fixes PLAT-151.", "Open, 2 approvals", "Aisha Bello", "2026-12-04T20:00:00Z"],
  ["cn_plat_slack", "message", null, "Aisha Bello in #platform-eng", "Found the leak: idle merchant buckets are never evicted. Fix is up in #1840, soak test running overnight.", null, "Aisha Bello", "2026-12-04T21:10:00Z"],
  ["cn_plat_slack", "message", null, "Lena Fischer in #platform-eng", "Overnight soak test on #1840: memory flat for 9 hours at 3x peak traffic. I'd be comfortable shipping early next week.", null, "Lena Fischer", "2026-12-05T08:30:00Z"],
  ["cn_plat_slack", "message", null, "Marcus Johnson in #platform-eng", "Let's not give Payments a date until the soak test has run 48 hours. Tentatively Dec 9.", null, "Marcus Johnson", "2026-12-05T09:05:00Z"],
  ["cn_plat_slack", "message", null, "Ken Watanabe in #platform-eng", "Mobile admin SSO: the identity provider's SAML metadata is in. Testing with Mobile tomorrow.", null, "Ken Watanabe", "2026-12-05T16:40:00Z"],
  ["cn_plat_notion", "doc", null, "Rate limits runbook", "Default limits are 100 requests per second per API key. Per-merchant burst buckets allow 200 requests in a burst, refilling at 50 per second. Overrides for a single account need Platform approval and a capacity check. Alerts fire at 80% of the global limit.", null, "Lena Fischer", "2026-11-18T10:00:00Z"],
  // Payments
  ["cn_pay_linear", "ticket", "PAY-311", "Webhook retries with exponential backoff", "Five attempts over 24 hours, on by default. Built behind a flag. Production rollout is blocked on Platform's PLAT-142.", "In progress", "Hannah Lee", "2026-12-04T12:00:00Z"],
  ["cn_pay_linear", "ticket", "PAY-318", "Expose retry status in the events API", "Mobile wants to show retry status in the app. Statuses: pending, retrying, delivered, failed.", "Todo", "Priya Raman", "2026-12-05T11:00:00Z"],
  ["cn_pay_linear", "ticket", "PAY-320", "Per-account limit overrides for Halcyon Bank", "Sales request: Halcyon Bank needs 3x the standard burst limit on the payouts API before their Jan 11 pilot. Doable as per-account config once PLAT-142 ships, about 3 days of work.", "Triage", "Diego Alvarez", "2026-12-03T16:00:00Z", "mk_conf"],
  ["cn_pay_gh", "pr", "#2210", "Retry scheduler with exponential backoff", "Retry queue and scheduler behind the webhook_retries flag. Respects per-merchant limits when present.", "Merged", "Hannah Lee", "2026-12-03T19:00:00Z"],
  ["cn_pay_slack", "message", null, "Priya Raman in #payments-api", "If burst limits slip past Dec 9 we can't hit Dec 12 for retries. We need two days of soak testing on our side too.", null, "Priya Raman", "2026-12-05T10:15:00Z"],
  ["cn_pay_slack", "message", null, "Hannah Lee in #payments-api", "Retry scheduler is done behind the flag. A stopgap of 10 per second per merchant on our side is possible but risky at peak.", null, "Hannah Lee", "2026-12-05T10:40:00Z"],
  ["cn_pay_slack", "message", null, "Diego Alvarez in #payments-api", "Halcyon overrides are about 3 days of work once Platform's buckets exist. Keeping it quiet until Sales says we can talk about it.", null, "Diego Alvarez", "2026-12-04T17:20:00Z", "mk_conf"],
  ["cn_pay_drive", "doc", null, "Webhook retries spec", "Retries use exponential backoff: 1 minute, 5 minutes, 30 minutes, 2 hours and 24 hours. They cover payment and refund events at launch; payout events follow in January. Merchants can see each attempt in the dashboard. Retries respect per-merchant burst limits.", null, "Priya Raman", "2026-11-20T10:00:00Z"],
  // Growth
  ["cn_growth_notion", "doc", null, "'Reliable payments' launch plan", "Launch on Dec 15: landing page, email to 4,200 developers, and a webinar (640 registered). Depends on webhook retries being live by Dec 12. Fallback: move the email to Dec 17 and keep the webinar.", null, "Jordan Ellis", "2026-12-01T10:00:00Z"],
  ["cn_growth_slack", "message", null, "Jordan Ellis in #growth", "If retries slip we move the email but keep the webinar. We need a go/no-go by Dec 10.", null, "Jordan Ellis", "2026-12-05T12:00:00Z"],
  ["cn_growth_slack", "message", null, "Chloe Martin in #growth", "Both landing page versions (with and without retries) will be ready by Dec 10.", null, "Chloe Martin", "2026-12-05T18:00:00Z"],
  // Mobile
  ["cn_mobile_jira", "ticket", "MOB-88", "Show webhook retry status in the merchant app", "Design ready. Blocked on Payments' PAY-318 for the status field.", "Blocked", "Ben Carter", "2026-12-05T09:00:00Z"],
  ["cn_mobile_slack", "message", null, "Yuki Tanaka in #mobile", "Android push fix is at 100% rollout. Delivery is back to 98.7%.", null, "Yuki Tanaka", "2026-12-04T14:00:00Z"],
  // Sales
  ["cn_sales_drive", "doc", null, "Halcyon Bank deal memo", "Halcyon Bank: $1.2M ARR, in negotiation. Pilot starts Jan 11 if we can offer 3x burst limits on payouts. Their security review is Dec 18.", null, "Victor Grant", "2026-12-02T10:00:00Z", "mk_conf"],
  ["cn_sales_slack", "message", null, "Victor Grant in #sales", "Halcyon wants an answer on custom limits before their Dec 18 security review.", null, "Victor Grant", "2026-12-04T15:30:00Z", "mk_conf"],
  ["cn_sales_slack", "message", null, "Liam O'Brien in #sales", "Two mid-market prospects asked about webhook retries this week. A date would help.", null, "Liam O'Brien", "2026-12-05T13:00:00Z"],
  // Customer success
  ["cn_cs_zendesk", "ticket", "ZD-4471", "Duplicate webhooks during the Oct 28 incident", "Marketplace merchant received each payment.succeeded event twice for 40 minutes. Asked when retries and idempotency will prevent this.", "Solved", "Kofi Mensah", "2026-11-02T10:00:00Z"],
  ["cn_cs_zendesk", "ticket", "ZD-4610", "429 errors when replaying failed webhooks", "Merchant replays failed webhooks in bulk and hits rate limits. Asks whether retries will be rate-limited per merchant.", "Open", "Kofi Mensah", "2026-12-04T11:00:00Z"],
  ["cn_cs_zendesk", "ticket", "ZD-4622", "When do webhook retries ship?", "Third merchant this week asking for a retries date for their own release planning.", "Pending", "Grace Liu", "2026-12-05T15:00:00Z"],
  ["cn_cs_slack", "message", null, "Grace Liu in #cs-escalations", "Three January renewals mention duplicate webhooks. Retries plus a replay button would take that off the table.", null, "Grace Liu", "2026-12-03T17:00:00Z"],
  // Design, Finance, Leadership
  ["cn_design_notion", "doc", null, "Payout timing interviews: synthesis", "12 merchant interviews. Top pain: not knowing when funds arrive. Merchants also want to see webhook delivery attempts without asking support.", null, "Omar Haddad", "2026-11-12T10:00:00Z"],
  ["cn_design_figma", "doc", null, "Retry status screens", "Designs for showing webhook retry status in the dashboard and merchant app, using design system v3 tokens.", null, "Iris Novak", "2026-12-02T10:00:00Z"],
  ["cn_fin_drive", "doc", null, "Q1 budget template (draft)", "Team budget templates waiting on the final headcount plan from Leadership.", null, "Isabel Moreno", "2026-12-03T10:00:00Z"],
  ["cn_lead_drive", "doc", null, "Board deck outline, Dec 17", "Reliability first: webhook retries and per-merchant limits. Enterprise readiness: Halcyon Bank pilot.", null, "Sam Okafor", "2026-12-04T10:00:00Z", "mk_conf"],
];

const T1 = `Marcus Johnson: Thanks for joining. The main topic is the per-merchant burst limits that webhook retries depend on.
Aisha Bello: Status first. Load testing found a memory leak in the new limiter: idle merchant buckets were never evicted. The fix is in PR 1840 and the overnight soak test looks flat.
Priya Raman: What does that do to the Dec 5 date? Retries are due to ship Dec 12 and Growth's launch is Dec 15.
Aisha Bello: Dec 5 is gone. If the soak test stays clean we can land the change by Dec 9.
Marcus Johnson: Let's not promise a date until the soak test finishes. I'll confirm the new date with Payments by Dec 8.
Hannah Lee: As a fallback, I can throttle retries to 10 per second per merchant on our side. I'll have that ready by Dec 9.
Priya Raman: Then the decision is that we keep retries behind the flag until the burst limits are live, and use Hannah's throttle only if Dec 9 slips.
Marcus Johnson: Agreed. Growth should hear about this before their launch review.
Aisha Bello: I'll post the soak test results in the platform channel by Dec 8.
Priya Raman: One more thing: Mobile wants retry statuses in the events API. That's on us and isn't blocked by this.`;

const T2 = `Maya Chen: This is the launch review for 'Reliable payments' on Dec 15.
Jordan Ellis: The landing page and webinar are ready. 640 developers have registered for the webinar.
Priya Raman: Retries are at risk. Platform's rate-limit change slipped, so Dec 12 depends on their soak test.
Jordan Ellis: Then let's decide now: if retries aren't live by Dec 12 we move the email to Dec 17 but keep the webinar on Dec 15.
Maya Chen: Agreed, that's the decision. Chloe, can you prepare both versions of the landing page?
Chloe Martin: Yes, I'll have both versions ready by Dec 10.
Ravi Shah: Pricing page copy doesn't change either way.
Maya Chen: Sales needs to know before their enterprise calls next week. I'll tell Victor by Dec 8.`;

const T3 = `Elena Vasquez: Two topics: the board deck and the Halcyon Bank deal.
Olivia Park: Halcyon Bank is our largest open deal at $1.2M ARR. They need 3x burst limits on payouts before a Jan 11 pilot.
Raj Patel: That depends on Platform's per-merchant limits, which slipped to around Dec 9. Payments estimates three days of work after that.
Elena Vasquez: Decision: we offer Halcyon per-account overrides, but only after Platform's burst limits are live. No commitments to them before then.
Olivia Park: I'll update Halcyon by Dec 10 with that position.
Sam Okafor: I'll put reliability first in the board deck and send the draft to team leads by Dec 10.
Peter Lindqvist: Finance still needs the headcount plan to finish Q1 budgets.`;

type Mtg = [id: string, unit: string, connector: string, title: string, at: string, minutes: number, attendees: string[], transcript: string, status: string, marking: string | null, summary: object | null];
const MEETINGS: Mtg[] = [
  ["mt_limits", "platform", "cn_plat_meet", "Platform × Payments: rate-limit dependency", "2026-12-04T16:00:00Z", 30, ["marcus", "aisha", "priya", "hannah"], T1, "recorded", null, null],
  ["mt_launch", "growth", "cn_growth_zoom", "'Reliable payments' launch review", "2026-12-05T17:00:00Z", 25, ["maya", "jordan", "chloe", "ravi", "priya"], T2, "summarized", null, {
    summary: "The Dec 15 launch is ready except for webhook retries, which depend on Platform's slipped rate-limit change. If retries aren't live by Dec 12, the email moves to Dec 17 and the webinar stays on Dec 15.",
    decisions: ["If webhook retries aren't live by Dec 12, move the launch email to Dec 17 and keep the webinar on Dec 15."],
    risks: ["Retries depend on Platform's soak test; Dec 12 is at risk."],
    action_items: [
      { owner: "chloe", text: "Prepare both versions of the landing page", due: "2026-12-10" },
      { owner: "maya", text: "Tell Sales (Victor) about the launch plan", due: "2026-12-08" },
    ],
    by: "Offline writer",
  }],
  ["mt_staff", "leadership", "cn_lead_meet", "Leadership staff meeting", "2026-12-03T17:00:00Z", 45, ["elena", "raj", "sam", "peter", "olivia"], T3, "summarized", "mk_conf", {
    summary: "Halcyon Bank (largest open deal) needs 3x burst limits before a Jan 11 pilot. Leadership will offer per-account overrides only after Platform's burst limits are live. The board deck leads with reliability.",
    decisions: ["Offer Halcyon Bank per-account overrides only after Platform's burst limits are live; no commitments before then."],
    risks: ["Q1 budgets are blocked on the headcount plan."],
    action_items: [
      { owner: "olivia", text: "Update Halcyon Bank with Leadership's position", due: "2026-12-10" },
      { owner: "sam", text: "Send the board deck draft to team leads", due: "2026-12-10" },
    ],
    by: "Offline writer",
  }],
];

export async function seedIntegrations(db: Db) {
  const q = (sql: string, params: unknown[]) => db.query(sql, params);
  for (const [id, unit, kind, name, by] of CONNECTORS) {
    await q(`insert into connector (id, unit_id, kind, name, connected_by, last_sync_at, created_at) values ($1, $2, $3, $4, $5, $6, $7)`, [
      id, unit, kind, name, by, "2026-12-06T08:55:00Z", "2026-10-05T10:00:00Z",
    ]);
  }
  let n = 0;
  for (const [conn, kind, ref, title, body, status, author, at, marking] of DOCS) {
    const unit = CONNECTORS.find((c) => c[0] === conn)![1];
    await q(
      `insert into source_doc (id, connector_id, unit_id, kind, external_ref, title, body, status, author_name, marking_id, occurred_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [`sd_${++n}`, conn, unit, kind, ref, title, body, status, author, marking ?? null, at],
    );
  }
  for (const [id, unit, conn, title, at, minutes, attendees, transcript, status, marking, summary] of MEETINGS) {
    await q(
      `insert into meeting (id, unit_id, connector_id, title, starts_at, duration_min, attendee_ids, transcript, summary, status, marking_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $5)`,
      [id, unit, conn, title, at, minutes, attendees, transcript, summary ? JSON.stringify(summary) : null, status, marking],
    );
  }
  // Platform's leads read Payments' tickets and PRs closely: share them at full detail.
  await q(`update interface set kinds = array_cat(kinds, array['source:ticket', 'source:pr']) where id = 'if_platform_payments'`, []);
  await q(`update interface set kinds = array_cat(kinds, array['source:ticket']) where id = 'if_payments_mobile'`, []);

  // Agents' monthly budgets ($ of Claude usage), and one finished task to show how runs look.
  await q(`update app_user set monthly_budget_usd = 150, spent_usd = 12 where kind = 'agent'`, []);
  await q(`update app_user set spent_usd = 84 where id = 'agent_platform'`, []);
  await q(`update app_user set spent_usd = 61 where id = 'agent_payments'`, []);
  await q(`update app_user set spent_usd = 23 where id = 'agent_cs'`, []);
  const steps = [
    { at: "2026-12-05T14:00:00Z", kind: "start", text: "Started for Grace Liu." },
    { at: "2026-12-05T14:00:20Z", kind: "read", text: "Read 3 Zendesk escalations about webhooks." },
    { at: "2026-12-05T14:00:40Z", kind: "read", text: "Read #cs-escalations and the payout timing research synthesis." },
    { at: "2026-12-05T14:01:30Z", kind: "read", text: "Read what Payments API has published about retries (at Customer success's level)." },
    { at: "2026-12-05T14:02:10Z", kind: "done", text: "Wrote a brief with 3 findings." },
  ];
  await q(
    `insert into task_run (id, unit_id, agent_id, requested_by, kind, title, instructions, status, steps, result_md, sources, input_tokens, output_tokens, cost_usd, created_at, updated_at)
     values ('tr_cs_dupes', 'cs', 'agent_cs', 'grace', 'research', $1, $2, 'done', $3, $4, $5, 48200, 2100, 0.23, '2026-12-05T14:00:00Z', '2026-12-05T14:02:10Z')`,
    [
      "What are merchants saying about duplicate webhooks and retries?",
      "Pull together what merchants have told us about duplicate webhooks and retries, and what Payments API has said publicly about the fix. I need it for the January renewal calls.",
      JSON.stringify(steps),
      "## What merchants are saying\n\n- **Duplicates are the top complaint.** The Oct 28 incident sent duplicate events for 40 minutes (ZD-4471), and three January renewals cite it.\n- **They want a date.** Three merchants this week asked when retries ship (ZD-4622). Payments API has published Dec 12 as the target, but it depends on Platform's rate-limit change.\n- **Replays hit rate limits.** Bulk replays of failed webhooks return 429 errors (ZD-4610). Retries will respect per-merchant limits once Platform ships them.\n\n## For the renewal calls\n\nLead with idempotency keys (duplicate charges down 38%) and the retries plan. Avoid promising Dec 12 until Platform confirms its new date.",
      JSON.stringify([{ title: "ZD-4471: Duplicate webhooks during the Oct 28 incident" }, { title: "ZD-4610: 429 errors when replaying failed webhooks" }, { title: "ZD-4622: When do webhook retries ship?" }, { title: "Payments API: webhook retries decision (Nov 27)" }]),
    ],
  );
}
