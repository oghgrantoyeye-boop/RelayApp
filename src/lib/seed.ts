// Northwind Labs: a fictional ~300-person company that sells a payments API. The story is set
// on Dec 6, 2026 (see SPEC.md, "Seed data"). Everything here goes through normal tables, so the
// demo exercises the same permission checks as real data.
import type { Db } from "./db";
import { addDays } from "./clock";
import { levelTexts } from "./ai/offline";
import { ALL_KINDS, ORG_ID } from "./data";

type K = "progress" | "decision" | "risk" | "ask" | "answer";

const TEAMS: { id: string; name: string; parent: string | null; color: string; description: string; group?: boolean }[] = [
  { id: "leadership", name: "Leadership", parent: null, color: "#3f3f46", description: "Sets company priorities, plans and headcount." },
  { id: "engineering", name: "Engineering", parent: "leadership", color: "#1d4ed8", description: "All engineering teams.", group: true },
  { id: "product", name: "Product", parent: "leadership", color: "#6d28d9", description: "Product management and design.", group: true },
  { id: "marketing", name: "Marketing", parent: "leadership", color: "#c2410c", description: "Brand, growth and developer marketing.", group: true },
  { id: "revenue", name: "Revenue", parent: "leadership", color: "#0f766e", description: "Sales and customer success.", group: true },
  { id: "operations", name: "Operations", parent: "leadership", color: "#a16207", description: "Finance and business operations.", group: true },
  { id: "payments", name: "Payments API", parent: "engineering", color: "#1d4ed8", description: "Builds and runs Northwind's public payments API and webhooks." },
  { id: "platform", name: "Platform", parent: "engineering", color: "#0e7490", description: "Auth, infrastructure, deploys and rate limits for every other engineering team." },
  { id: "mobile", name: "Mobile", parent: "engineering", color: "#4338ca", description: "The iOS and Android merchant apps." },
  { id: "design", name: "Product design", parent: "product", color: "#7c3aed", description: "The design system, product design and user research." },
  { id: "growth", name: "Growth marketing", parent: "marketing", color: "#c2410c", description: "Launches, the website and the pricing page." },
  { id: "sales", name: "Sales", parent: "revenue", color: "#0f766e", description: "Enterprise deals, sales engineering and partnerships." },
  { id: "cs", name: "Customer success", parent: "revenue", color: "#15803d", description: "Merchant onboarding, renewals and support escalations." },
  { id: "finance", name: "Finance", parent: "operations", color: "#a16207", description: "Budgets, billing operations and vendor payments." },
];

// [user id, name, title, team, role]
const PEOPLE: [string, string, string, string, "lead" | "member"][] = [
  ["elena", "Elena Vasquez", "Chief executive officer", "leadership", "lead"],
  ["raj", "Raj Patel", "Chief technology officer", "leadership", "member"],
  ["sam", "Sam Okafor", "Chief of staff", "leadership", "member"],
  ["peter", "Peter Lindqvist", "Chief financial officer", "leadership", "member"],
  ["daniel", "Daniel Brooks", "VP of engineering", "engineering", "lead"],
  ["ava", "Ava Thompson", "VP of product", "product", "lead"],
  ["lucas", "Lucas Meyer", "Head of marketing", "marketing", "lead"],
  ["olivia", "Olivia Park", "Chief revenue officer", "revenue", "lead"],
  ["henry", "Henry Adams", "VP of operations", "operations", "lead"],
  ["priya", "Priya Raman", "Engineering manager", "payments", "lead"],
  ["diego", "Diego Alvarez", "Staff engineer", "payments", "member"],
  ["hannah", "Hannah Lee", "Senior engineer", "payments", "member"],
  ["tom", "Tom Becker", "Engineer", "payments", "member"],
  ["arjun", "Arjun Mehta", "Engineer", "payments", "member"],
  ["marcus", "Marcus Johnson", "Engineering manager", "platform", "lead"],
  ["aisha", "Aisha Bello", "Senior engineer", "platform", "member"],
  ["ken", "Ken Watanabe", "Senior engineer", "platform", "member"],
  ["lena", "Lena Fischer", "Site reliability engineer", "platform", "member"],
  ["zoe", "Zoe Clark", "Engineer", "platform", "member"],
  ["sofia", "Sofia Rossi", "Engineering manager", "mobile", "lead"],
  ["ben", "Ben Carter", "iOS engineer", "mobile", "member"],
  ["yuki", "Yuki Tanaka", "Android engineer", "mobile", "member"],
  ["mateo", "Mateo Garcia", "Engineer", "mobile", "member"],
  ["nora", "Nora Kim", "Design lead", "design", "lead"],
  ["omar", "Omar Haddad", "User researcher", "design", "member"],
  ["iris", "Iris Novak", "Product designer", "design", "member"],
  ["maya", "Maya Chen", "Growth lead", "growth", "lead"],
  ["jordan", "Jordan Ellis", "Launch manager", "growth", "member"],
  ["chloe", "Chloe Martin", "Web producer", "growth", "member"],
  ["ravi", "Ravi Shah", "Pricing and lifecycle marketer", "growth", "member"],
  ["victor", "Victor Grant", "Head of sales", "sales", "lead"],
  ["amara", "Amara Osei", "Sales engineer", "sales", "member"],
  ["liam", "Liam O'Brien", "Account executive", "sales", "member"],
  ["ella", "Ella Johansson", "Partnerships manager", "sales", "member"],
  ["grace", "Grace Liu", "Customer success lead", "cs", "lead"],
  ["noah", "Noah Silva", "Renewals manager", "cs", "member"],
  ["kofi", "Kofi Mensah", "Support escalations engineer", "cs", "member"],
  ["isabel", "Isabel Moreno", "Finance lead", "finance", "lead"],
  ["ethan", "Ethan Wright", "Billing operations analyst", "finance", "member"],
  ["mia", "Mia Delgado", "Accounts payable specialist", "finance", "member"],
];

// [id, team, title, description, owner user, keywords]
const OWNS: [string, string, string, string, string, string[]][] = [
  ["own_api", "payments", "Public API", "Endpoints, versions and API changelog", "diego", ["api", "endpoint", "version", "limit", "override", "account"]],
  ["own_webhooks", "payments", "Webhooks", "Webhook delivery, retries and event types", "priya", ["webhook", "retry", "retries", "event", "replay", "payout"]],
  ["own_idem", "payments", "Idempotency", "Duplicate protection on writes", "hannah", ["idempotency", "duplicate", "double"]],
  ["own_docs", "payments", "API docs", "Reference docs and guides", "tom", ["docs", "documentation", "guide", "reference"]],
  ["own_auth", "platform", "Auth and SSO", "Sign-in, SSO and the identity provider", "ken", ["auth", "sso", "login", "identity", "sign-in"]],
  ["own_limits", "platform", "Rate limits", "API rate limiting and per-merchant burst limits", "aisha", ["rate", "limit", "limits", "throttle", "burst", "429", "quota", "sandbox"]],
  ["own_infra", "platform", "Infrastructure and deploys", "Clusters, the deploy pipeline and the scheduler", "lena", ["infrastructure", "deploy", "pipeline", "cluster", "scheduler", "cron"]],
  ["own_oncall", "platform", "On-call and incidents", "Incident process, on-call rotations and reviews", "marcus", ["on-call", "incident", "outage", "rotation", "postmortem"]],
  ["own_ios", "mobile", "iOS app", "The iOS merchant app", "ben", ["ios", "iphone", "app store"]],
  ["own_android", "mobile", "Android app", "The Android merchant app", "yuki", ["android", "play store"]],
  ["own_release", "mobile", "Mobile release train", "Release schedule for both apps", "sofia", ["release", "train", "rollout"]],
  ["own_push", "mobile", "Push notifications", "Push delivery on iOS and Android", "mateo", ["push", "notification"]],
  ["own_ds", "design", "Design system", "Tokens, components and guidelines", "nora", ["design system", "tokens", "component"]],
  ["own_research", "design", "User research", "Merchant interviews and usability studies", "omar", ["research", "interview", "study", "usability"]],
  ["own_onboarding_ux", "design", "Onboarding UX", "The merchant onboarding flow", "iris", ["onboarding flow", "signup"]],
  ["own_launches", "growth", "Launches", "Product launches and launch calendar", "jordan", ["launch", "webinar", "campaign", "announcement"]],
  ["own_web", "growth", "Website", "Northwind's marketing site", "chloe", ["website", "landing page", "site"]],
  ["own_pricing", "growth", "Pricing page", "The pricing page and plan packaging", "ravi", ["pricing", "plan", "price"]],
  ["own_deals", "sales", "Enterprise deals", "Enterprise pipeline and contracts", "victor", ["deal", "enterprise", "contract", "pipeline"]],
  ["own_se", "sales", "Sales engineering", "Technical reviews and security questionnaires", "amara", ["security questionnaire", "soc", "technical review"]],
  ["own_partners", "sales", "Partnerships", "Referral and technology partners", "ella", ["partner", "referral"]],
  ["own_cs_onboard", "cs", "Merchant onboarding", "Getting new merchants live", "grace", ["onboarding", "go-live", "kickoff"]],
  ["own_renewals", "cs", "Renewals", "Renewal pipeline and churn risk", "noah", ["renewal", "churn"]],
  ["own_escalations", "cs", "Support escalations", "Escalated tickets and incident comms to merchants", "kofi", ["ticket", "escalation", "support"]],
  ["own_budgets", "finance", "Budgets", "Annual and quarterly budgets", "isabel", ["budget", "headcount", "spend", "forecast"]],
  ["own_billing", "finance", "Billing operations", "Invoices and billing runs", "ethan", ["invoice", "billing"]],
  ["own_ap", "finance", "Vendor payments", "Accounts payable and vendor renewals", "mia", ["vendor", "renewal", "purchase", "procurement"]],
  ["own_priorities", "leadership", "Company priorities", "Company goals and the planning cycle", "sam", ["priority", "priorities", "planning", "okr", "goal", "board"]],
];

// Who follows whom. Following creates an interface at Summary detail (SPEC.md, "Disclosure levels").
const FOLLOWS: Record<string, string[]> = {
  payments: ["growth", "cs", "mobile", "sales", "platform", "leadership"],
  platform: ["payments", "mobile", "leadership"],
  mobile: ["design", "cs", "leadership"],
  design: ["mobile", "growth", "leadership"],
  growth: ["sales", "design", "leadership"],
  sales: ["cs", "finance", "leadership"],
  cs: ["sales", "leadership"],
  finance: ["sales", "leadership"],
  leadership: ["payments", "platform", "mobile", "design", "growth", "sales", "cs", "finance"],
};

const WEEKS = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];

// Ordinary weekly items, spread across the eight weeks. [kind, text, affected teams]
const ITEMS: Record<string, [K, string, string[]][]> = {
  payments: [
    ["progress", "Shipped API version 2026-10 with expanded refund metadata; 61% of active merchants have upgraded.", ["cs"]],
    ["decision", "We're deprecating the v1 charges endpoint on March 31 and will email affected merchants in January.", ["cs", "growth", "sales"]],
    ["progress", "Webhook delivery latency at p95 dropped from 2.4s to 0.9s after moving fan-out to the new queue.", ["platform"]],
    ["risk", "Two enterprise merchants got duplicate webhooks during the Oct 28 incident. We're adding idempotency checks before any retries.", ["cs", "platform"]],
    ["ask", "We need Product design to review the new API error-message copy by Nov 20.", ["design"]],
    ["progress", "Published the webhook retries design doc for comment; Platform and Customer success reviewed it.", ["platform", "cs"]],
  ],
  platform: [
    ["progress", "Moved 70% of services to the new deploy pipeline; median deploy time is down from 14 to 6 minutes.", ["payments", "mobile"]],
    ["decision", "Internal tools move to the new identity provider on Nov 16; everyone will be asked to sign in again once.", []],
    ["risk", "The legacy auth service has had no owner since the Q3 reorg. We'll keep it running but won't take feature requests.", ["payments", "mobile"]],
    ["progress", "Incident review for the Oct 28 queue outage is published; 4 of 5 follow-ups are done.", ["payments", "cs"]],
    ["decision", "Rate limits are moving from per-API-key to per-merchant buckets, so one integration can't starve another.", ["payments", "sales"]],
    ["progress", "Per-merchant burst limits are in code review; load testing starts Nov 30.", ["payments"]],
    ["ask", "Teams with cron jobs on the old scheduler: please migrate by Dec 18 so we can turn it off.", ["payments", "mobile", "finance"]],
  ],
  mobile: [
    ["progress", "iOS 4.2 is live with saved payment methods; crash-free sessions are at 99.6%.", ["cs", "design"]],
    ["progress", "Android 4.2 reached 50% rollout with no regressions.", ["cs"]],
    ["decision", "We're moving to a two-week release train starting Nov 23.", ["design", "cs", "growth"]],
    ["risk", "Android push delivery dropped to 91% after the latest OS update; a fix is in testing.", ["cs"]],
    ["progress", "The iOS app now uses design system v3 tokens; Android follows in the next train.", ["design"]],
    ["ask", "We need webhook retry statuses documented before we can show them in the app.", ["payments"]],
    ["progress", "The mobile admin app beta has 120 merchants; their top request is SSO sign-in.", ["platform", "sales"]],
  ],
  design: [
    ["progress", "Design system v3 tokens are published; Mobile and the web team have started adopting them.", ["mobile", "growth"]],
    ["progress", "Finished 12 merchant interviews on payout timing; the top pain is not knowing when funds arrive.", ["payments", "mobile", "cs"]],
    ["decision", "Error messages will follow a 'what happened, what to do' pattern across the API docs and dashboard.", ["payments"]],
    ["risk", "Research is booked through January; new studies start in February.", ["mobile", "growth"]],
    ["progress", "Tested the new onboarding prototype with 8 merchants; time to first payment dropped from 3 days to 1.", ["cs", "growth"]],
    ["progress", "Delivered the Dec 15 launch page designs to Growth marketing.", ["growth"]],
  ],
  growth: [
    ["progress", "The pricing page test lifted trial starts by 9% with no change in paid conversion.", ["sales", "finance"]],
    ["decision", "We're merging the developer newsletter and product emails into one monthly send.", ["cs"]],
    ["progress", "Developer docs traffic is up 22% since the API version launch.", ["payments"]],
    ["progress", "A new case study with a marketplace customer is live; Sales has the one-pager.", ["sales"]],
    ["ask", "We need final retry limits from Payments API for the launch page by Dec 8.", ["payments"]],
    ["progress", "Webinar registrations for the Dec 15 launch passed 600 developers.", ["sales"]],
  ],
  sales: [
    ["progress", "Closed 3 enterprise deals in October worth $2.1M in annual contract value.", ["finance", "cs"]],
    ["risk", "Two late-stage deals are asking for higher API limits than the standard plan allows.", ["payments", "platform"]],
    ["decision", "Discounts above 20% now need Finance approval before they go to the customer.", ["finance"]],
    ["progress", "Q4 pipeline coverage is 3.2x, up from 2.6x in September.", ["finance"]],
    ["ask", "We need an owner on Platform for security questionnaires; three deals are waiting on SOC 2 answers.", ["platform"]],
    ["progress", "The partner referral program signed its first two partners.", ["growth"]],
  ],
  cs: [
    ["progress", "Merchant onboarding averaged 6 days in November, down from 9.", ["sales", "design"]],
    ["risk", "Three January renewals mention duplicate webhooks as a reason to look at other providers.", ["payments", "sales"]],
    ["progress", "The support backlog is under 40 tickets for the first time this quarter.", []],
    ["decision", "Enterprise accounts get a named support engineer starting Dec 1.", ["sales"]],
    ["ask", "Merchants keep asking when webhook retries ship; we need a date we can share.", ["payments"]],
    ["progress", "Q4 renewal rate so far is 94%.", ["sales", "finance"]],
  ],
  finance: [
    ["progress", "October close finished in 5 business days.", ["leadership"]],
    ["decision", "Software purchases above $25K now need sign-off from a budget owner.", ["platform", "sales"]],
    ["progress", "Billing operations moved invoice runs to the 1st of each month.", ["cs", "sales"]],
    ["progress", "Renegotiated payment processor fees, saving about $180K a year.", ["payments"]],
    ["risk", "Q1 budget templates are late because the headcount plan isn't final.", ["leadership"]],
    ["ask", "Team leads: please send Q1 vendor renewals over $10K by Dec 11.", ["platform", "growth", "sales"]],
  ],
  leadership: [
    ["decision", "H1 priorities: reliability first, enterprise readiness second, new markets third.", ["payments", "platform", "sales"]],
    ["decision", "Hiring stays flat in Q1, except for two reliability roles on Platform.", ["platform", "finance"]],
    ["progress", "All-hands moves to the first Thursday of each month.", []],
    ["progress", "The board meeting is set for Dec 17; team leads get the deck draft on Dec 10.", []],
  ],
};

// The demo story's items, written by hand at each level. [team, week index, kind, full, summary, headline, affected, marking, key]
const STORY: [string, number, K, string, string, string, string[], string | null, string][] = [
  ["payments", 5, "answer", "Webhook retries cover payment and refund events at launch. Payout events follow in January.",
    "Retries cover payments and refunds at launch; payouts follow in January.", "Retries cover payments and refunds first.", ["cs", "mobile"], null, "answer_payouts"],
  ["payments", 6, "decision", "We decided to ship webhook retries with exponential backoff (5 attempts over 24 hours), on by default for every account. Target is Dec 12.",
    "Webhook retries ship Dec 12, on by default for every account.", "Webhook retries planned for Dec 12.", ["growth", "cs", "mobile"], null, "retries_decision"],
  ["payments", 7, "risk", "Webhook retries are blocked on Platform's per-merchant burst limits. Without them, one merchant's retry storm can trip the global rate limit. Platform committed to Dec 5.",
    "Webhook retries are blocked on Platform's rate-limit change (due Dec 5).", "Webhook retries blocked on a dependency.", ["platform", "growth"], null, "retries_blocked"],
  ["payments", 7, "progress", "Idempotency keys are now enforced on all POST endpoints; duplicate-charge tickets are down 38% week over week.",
    "Idempotency keys are enforced on all POST endpoints; duplicate charges are down 38%.", "Duplicate charges down 38%.", ["cs"], null, "idem"],
  ["platform", 7, "risk", "Load testing found a memory leak in the new per-merchant limiter. The fix is in review, so the rate-limit change will miss Dec 5.",
    "The rate-limit change will miss Dec 5; a memory-leak fix is in review.", "Rate-limit change delayed.", ["payments"], null, "limiter_leak"],
  ["growth", 7, "risk", "The Dec 15 'Reliable payments' launch (landing page, email to 4,200 developers, webinar) depends on webhook retries being live.",
    "The Dec 15 launch depends on webhook retries being live.", "Launch planned for Dec 15.", ["payments", "sales"], null, "launch_dep"],
  ["sales", 7, "progress", "Halcyon Bank, our largest open deal, starts a pilot on Jan 11 if we can approve custom API limits for them.",
    "Our largest open deal starts a January pilot if custom API limits are approved.", "Large enterprise pilot planned for January.", ["payments", "platform"], "mk_conf", "halcyon"],
];

const at = (date: string, hour = 16) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;

export async function seed(db: Db) {
  await db.tx(async (t) => {
    const q = (sql: string, params: unknown[]) => t.query(sql, params);

    await q(`insert into org (id, name, settings) values ($1, $2, $3)`, [
      ORG_ID,
      "Northwind Labs",
      JSON.stringify({ default_level: "headline", headcount: 300 }),
    ]);

    for (const team of TEAMS) {
      await q(
        `insert into unit (id, org_id, slug, name, parent_unit_id, description, color, how_to_ask) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [team.id, ORG_ID, team.id, team.name, team.parent, team.description, team.color,
          JSON.stringify(team.group ? {} : { turnaround: team.id === "platform" ? "3 business days" : "2 business days" })],
      );
    }

    const memberId = (user: string, unit: string) => `m_${user}_${unit}`;
    for (const [id, name, title, team, role] of PEOPLE) {
      await q(
        `insert into app_user (id, org_id, kind, name, title, email, github_login, api_token) values ($1, $2, 'human', $3, $4, $5, $6, $7)`,
        [id, ORG_ID, name, title, `${id}@northwind.example`, name.toLowerCase().replace(/[^a-z]+/g, "-"), `rly_demo_${id}`],
      );
      await q(`insert into member (id, unit_id, user_id, role) values ($1, $2, $3, $4)`, [memberId(id, team), team, id, role]);
    }
    // Leaders of group teams are also on Leadership, so the org chart reads naturally.
    for (const id of ["daniel", "ava", "lucas", "olivia", "henry"]) {
      await q(`insert into member (id, unit_id, user_id, role) values ($1, 'leadership', $2, 'member')`, [memberId(id, "leadership"), id]);
    }

    // One agent per team: its front door. It reads with the asker's access.
    for (const team of TEAMS.filter((x) => !x.group)) {
      const id = `agent_${team.id}`;
      await q(`insert into app_user (id, org_id, kind, name, title, ask_cadence) values ($1, $2, 'agent', $3, $4, 'immediate')`, [
        id, ORG_ID, `${team.name} agent`, "Answers from what the team has published, and routes the rest",
      ]);
      await q(`insert into member (id, unit_id, user_id, role) values ($1, $2, $3, 'agent')`, [memberId(id, team.id), team.id, id]);
    }

    for (const [id, unit, title, description, owner, keywords] of OWNS) {
      await q(`insert into ownership_item (id, unit_id, title, description, owner_member_id, keywords) values ($1, $2, $3, $4, $5, $6)`, [
        id, unit, title, description, memberId(owner, unit), keywords,
      ]);
    }

    await q(`insert into marking (id, org_id, label, allowed_unit_ids, others_level) values ($1, $2, $3, $4, $5)`, [
      "mk_conf", ORG_ID, "Confidential: Leadership and Sales only", ["leadership", "sales"], "summary",
    ]);

    for (const [unit, followers] of Object.entries(FOLLOWS)) {
      for (const f of followers) {
        await q(`insert into follow (unit_id, follower_unit_id) values ($1, $2)`, [unit, f]);
        let level = "summary";
        let cadence = "weekly";
        let kinds = ALL_KINDS.filter((k) => k !== "request");
        if (unit === "platform" && f === "payments") { level = "full"; cadence = "immediate"; }
        if (unit === "sales" && f === "leadership") { level = "full"; kinds = ALL_KINDS; }
        if (unit === "payments" && f === "growth") cadence = "immediate";
        await q(`insert into interface (id, from_unit_id, to_unit_id, kinds, level, cadence) values ($1, $2, $3, $4, $5, $6)`, [
          `if_${unit}_${f}`, unit, f, kinds, level, cadence,
        ]);
      }
    }

    const leadOf: Record<string, string> = {};
    for (const [id, , , team, role] of PEOPLE) if (role === "lead") leadOf[team] = id;
    const membersOf = (team: string) => PEOPLE.filter((p) => p[3] === team).map((p) => p[0]);

    // Eight weeks of updates. Each team posts on Fridays.
    const storyIds: Record<string, string> = {};
    let n = 0;
    for (const team of Object.keys(ITEMS)) {
      const generic = ITEMS[team];
      for (let w = 0; w < WEEKS.length; w++) {
        const picks = generic.filter((_, i) => Math.floor((i * WEEKS.length) / generic.length) === w);
        const story = STORY.filter((s) => s[0] === team && s[1] === w);
        if (picks.length === 0 && story.length === 0) continue;
        const people = membersOf(team);
        const author = w === WEEKS.length - 1 ? leadOf[team] : people[w % people.length];
        const updateId = `up_${team}_${w}`;
        const publishedAt = at(addDays(WEEKS[w], 4));
        const all = [
          ...picks.map(([kind, text, affected]) => ({ kind, text, ...levelTexts(text), affected, marking: null as string | null, key: "" })),
          ...story.map(([, , kind, text, summary, headline, affected, marking, key]) => ({ kind, text, summary, headline, affected, marking, key })),
        ];
        await q(
          `insert into team_update (id, unit_id, author_id, period_start, body_md, source, status, created_at, published_at) values ($1, $2, $3, $4, $5, 'manual', 'published', $6, $6)`,
          [updateId, team, author, WEEKS[w], all.map((i) => `- ${i.text}`).join("\n"), publishedAt],
        );
        for (const item of all) {
          const id = item.key ? `ui_${item.key}` : `ui_${team}_${w}_${n++}`;
          if (item.key) storyIds[item.key] = id;
          await q(
            `insert into update_item (id, update_id, unit_id, author_id, kind, text, summary_text, headline_text, affected_unit_ids, marking_id, status, created_at, published_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', $11, $11)`,
            [id, updateId, team, author, item.kind, item.text, item.summary, item.headline, item.affected, item.marking, publishedAt],
          );
        }
        await q(
          `insert into audit_event (org_id, actor_id, action, target_kind, target_id, detail, at) values ($1, $2, 'publish_update', 'update', $3, $4, $5)`,
          [ORG_ID, author, updateId, JSON.stringify({ items: all.length }), publishedAt],
        );
      }
    }

    // Requests. R0 was accepted and became Platform's Dec 5 commitment.
    type Req = [string, string, string, string, string, string, string, string | null, string, string | null, string, string | null, "form" | "agent"];
    // [id, from, to, requester, title, details, created, needed_by, status, ownership, assignee, cluster, via]
    const REQS: Req[] = [
      ["rq_limits", "payments", "platform", "priya", "Per-merchant burst limits so webhook retries can't trip global limits",
        "Webhook retries (shipping Dec 12) need per-merchant burst limits first. Can Platform land them by Dec 5?", "2026-11-20", "2026-12-05", "accepted", "own_limits", "aisha", null, "form"],
      ["rq_when_1", "payments", "platform", "hannah", "When will per-merchant burst limits land now that Dec 5 is at risk?",
        "Asked the Platform agent. We need the new date to replan webhook retries.", "2026-12-04", null, "open", "own_limits", "aisha", "ck_limits_date", "agent"],
      ["rq_when_2", "growth", "platform", "jordan", "Is the rate-limit change still landing this week? Our Dec 15 launch depends on it.",
        "Asked the Platform agent.", "2026-12-05", null, "open", "own_limits", "aisha", "ck_limits_date", "agent"],
      ["rq_when_3", "cs", "platform", "grace", "Merchants keep asking about 429 errors during retries. When does the rate-limit fix land?",
        "Asked the Platform agent.", "2026-12-05", null, "open", "own_limits", "aisha", "ck_limits_date", "agent"],
      ["rq_sandbox", "payments", "platform", "arjun", "Can we get a sandbox with production-like rate limits for load tests?",
        "We'd like to load-test retries against realistic limits before Dec 12.", "2026-12-05", "2026-12-10", "open", "own_limits", "aisha", "ck_sandbox", "form"],
      ["rq_oncall", "mobile", "platform", "sofia", "Can Mobile join the Platform on-call rotation for push notification incidents?",
        "Two push incidents last month took over an hour to reach the right person.", "2026-12-03", null, "open", "own_oncall", "marcus", "ck_oncall", "form"],
      ["rq_replay", "cs", "payments", "kofi", "Can merchants replay a failed webhook from the dashboard?",
        "Asked the Payments API agent. Escalations ask for this weekly.", "2026-12-04", null, "open", "own_webhooks", "priya", "ck_replay", "agent"],
      ["rq_statuses", "mobile", "payments", "ben", "Which retry statuses will webhook events expose? We want to show them in the app.",
        "We'd like to design the app screen before Dec 12.", "2026-12-05", null, "open", "own_webhooks", "priya", "ck_statuses", "form"],
    ];
    for (const [id, from, to, requester, title, details, created, needed, status, own, assignee, cluster, via] of REQS) {
      await q(
        `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, needed_by, status, ownership_item_id, assignee_member_id, cluster_key, via, created_at, headline_text)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [id, ORG_ID, from, to, requester, title, details, needed, status, own, memberId(assignee, to), cluster, via, at(created, 15),
          `Request from ${TEAMS.find((x) => x.id === from)!.name} to ${TEAMS.find((x) => x.id === to)!.name}`],
      );
    }
    // The confidential request names the customer, so it carries versions safe for Summary and Headline.
    await q(
      `insert into request (id, org_id, from_unit_id, to_unit_id, requester_id, title, details, summary_title, summary_details, headline_text, needed_by, status, ownership_item_id, assignee_member_id, marking_id, cluster_key, via, created_at)
       values ('rq_halcyon', $1, 'sales', 'payments', 'victor', $2, $3, $4, $5, $6, '2026-12-18', 'open', 'own_api', $7, 'mk_conf', 'ck_halcyon', 'form', $8)`,
      [ORG_ID,
        "Custom rate limits for Halcyon Bank before their January pilot",
        "Halcyon Bank ($1.2M ARR, in negotiation) needs 3x the standard burst limit on the payouts API before their pilot starts Jan 11. Can Payments API support per-account overrides?",
        "Custom rate limits for an enterprise customer before a January pilot",
        "An enterprise customer in negotiation needs 3x the standard burst limit on the payouts API before a pilot in January. Can Payments API support per-account overrides?",
        "Sales asked Payments API about custom limits",
        memberId("diego", "payments"), at("2026-12-03", 14)],
    );

    // Commitments. [id, owner team, owner, waiting team, title, due, status, source kind, source id, blocked by, slip reason, done]
    type Com = [string, string, string, string | null, string, string, string, string, string | null, string | null, string | null, string | null];
    const COMS: Com[] = [
      ["cm_limits", "platform", "aisha", "payments", "Per-merchant burst rate limits for webhook retries", "2026-12-05", "open", "request", "rq_limits", null,
        "Load testing found a memory leak in the new limiter; the fix is in review (Platform's Dec 4 update).", null],
      ["cm_retries", "payments", "priya", "growth", "Webhook retries live in production", "2026-12-12", "open", "update_item", storyIds.retries_decision, "cm_limits", null, null],
      ["cm_launch", "growth", "jordan", "sales", "'Reliable payments' launch: landing page, email and webinar", "2026-12-15", "open", "manual", null, "cm_retries", null, null],
      ["cm_docs", "payments", "tom", "cs", "Publish webhook retry docs", "2026-12-10", "open", "manual", null, null, null, null],
      ["cm_budget", "finance", "isabel", "leadership", "Q1 budget templates to team leads", "2026-12-03", "open", "manual", null, null, "Waiting on the final headcount plan.", null],
      ["cm_renewals", "cs", "noah", "sales", "Q1 renewal risk list", "2026-12-08", "open", "manual", null, null, null, null],
      ["cm_designs", "design", "iris", "growth", "Launch page designs for Dec 15", "2026-12-02", "done", "manual", null, null, null, "2026-12-01"],
      ["cm_tokens", "mobile", "ben", "design", "Adopt design system v3 tokens in iOS", "2026-11-20", "done", "manual", null, null, null, "2026-11-19"],
      ["cm_sso", "platform", "ken", "mobile", "SSO for the mobile admin app", "2026-12-18", "open", "manual", null, null, null, null],
      ["cm_autoscale", "platform", "lena", "payments", "Incident follow-up: queue autoscaling", "2026-11-25", "done", "manual", null, null, null, "2026-11-24"],
    ];
    for (const [id, owner, ownerUser, waiting, title, due, status, sk, sid, blocked, reason, done] of COMS) {
      await q(
        `insert into commitment (id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, original_due_date, status, confirmed_at, done_at, slip_reason, blocked_by_id, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $10)`,
        [id, owner, memberId(ownerUser, owner), waiting, sk, sid, title, due, status, at(addDays(due, -14), 17), done ? at(done) : null, reason, blocked],
      );
    }

    // Questions people asked team agents, so agent stats and history look real.
    type Qn = [string, string, string, string, "answered" | "routed", string, string[], string | null, string];
    const QS: Qn[] = [
      ["qn_1", "grace", "payments", "Do webhook retries cover payout events?", "answered",
        "Webhook retries cover payment and refund events at launch. Payout events follow in January.", ["update_item:ui_answer_payouts"], null, "2026-11-25"],
      ["qn_2", "ravi", "payments", "Will retries be on by default?", "answered",
        "Webhook retries ship Dec 12, on by default for every account.", ["update_item:ui_retries_decision"], null, "2026-11-30"],
      ["qn_3", "liam", "platform", "Are rate limits per API key or per merchant?", "answered",
        "Rate limits are moving from per-API-key to per-merchant buckets.", [], null, "2026-11-19"],
      ["qn_4", "hannah", "platform", "When will per-merchant burst limits land now that Dec 5 is at risk?", "routed",
        "Platform hasn't published a new date. I asked Aisha Bello, who owns Rate limits.", [], "rq_when_1", "2026-12-04"],
      ["qn_5", "jordan", "platform", "Is the rate-limit change still landing this week?", "routed",
        "Platform hasn't published a new date. I asked Aisha Bello, who owns Rate limits.", [], "rq_when_2", "2026-12-05"],
      ["qn_6", "grace", "platform", "When does the rate-limit fix land?", "routed",
        "Platform hasn't published a new date. I asked Aisha Bello, who owns Rate limits.", [], "rq_when_3", "2026-12-05"],
      ["qn_7", "kofi", "payments", "Can merchants replay a failed webhook from the dashboard?", "routed",
        "Payments API hasn't published anything on this. I asked Priya Raman, who owns Webhooks.", [], "rq_replay", "2026-12-04"],
      ["qn_8", "omar", "mobile", "Is iOS 4.2 live?", "answered", "iOS 4.2 is live with saved payment methods.", [], null, "2026-11-03"],
    ];
    for (const [id, asker, unit, text, outcome, answer, refs, req, date] of QS) {
      await q(
        `insert into question (id, org_id, asker_id, unit_id, text, outcome, answer_text, source_refs, request_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, ORG_ID, asker, unit, text, outcome, answer, JSON.stringify(refs), req, at(date, 14)],
      );
      await q(
        `insert into audit_event (org_id, actor_id, on_behalf_of_id, action, target_kind, target_id, detail, at) values ($1, $2, $3, $4, 'question', $5, $6, $7)`,
        [ORG_ID, `agent_${unit}`, asker, outcome === "answered" ? "agent_answer" : "agent_route", id, JSON.stringify({ question: text }), at(date, 14)],
      );
    }
  });
}
