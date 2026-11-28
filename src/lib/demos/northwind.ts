// Northwind Labs: a fictional ~300-person company that sells a payments API. The story is set
// on Dec 6, 2026 (see SPEC.md, "Seed data"): Platform's rate-limit change slips, which blocks
// Payments API's webhook retries, which puts Growth marketing's Dec 15 launch at risk.
import type { DemoPack, Team, Person, Ownership, Item, StoryItem, Req, Com, Qn, Conn, SourceDoc, Mtg } from "./types";

const TEAMS: Team[] = [
  { id: "leadership", name: "Leadership", parent: null, color: "#3f3f46", description: "Sets company priorities, plans and headcount." },
  { id: "engineering", name: "Engineering", parent: "leadership", color: "#1d4ed8", description: "All engineering teams.", group: true },
  { id: "product", name: "Product", parent: "leadership", color: "#6d28d9", description: "Product management and design.", group: true },
  { id: "marketing", name: "Marketing", parent: "leadership", color: "#c2410c", description: "Brand, growth and developer marketing.", group: true },
  { id: "revenue", name: "Revenue", parent: "leadership", color: "#0f766e", description: "Sales and customer success.", group: true },
  { id: "operations", name: "Operations", parent: "leadership", color: "#a16207", description: "Finance and business operations.", group: true },
  { id: "payments", name: "Payments API", parent: "engineering", color: "#1d4ed8", description: "Builds and runs Northwind's public payments API and webhooks." },
  { id: "platform", name: "Platform", parent: "engineering", color: "#0e7490", description: "Auth, infrastructure, deploys and rate limits for every other engineering team.", turnaround: "3 business days" },
  { id: "mobile", name: "Mobile", parent: "engineering", color: "#4338ca", description: "The iOS and Android merchant apps." },
  { id: "design", name: "Product design", parent: "product", color: "#7c3aed", description: "The design system, product design and user research." },
  { id: "growth", name: "Growth marketing", parent: "marketing", color: "#c2410c", description: "Launches, the website and the pricing page." },
  { id: "sales", name: "Sales", parent: "revenue", color: "#0f766e", description: "Enterprise deals, sales engineering and partnerships." },
  { id: "cs", name: "Customer success", parent: "revenue", color: "#15803d", description: "Merchant onboarding, renewals and support escalations." },
  { id: "finance", name: "Finance", parent: "operations", color: "#a16207", description: "Budgets, billing operations and vendor payments." },
];

// [user id, name, title, team, role]
const PEOPLE: Person[] = [
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
const OWNS: Ownership[] = [
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

// Ordinary weekly items, spread across the eight weeks. [kind, text, affected teams]
const ITEMS: Record<string, Item[]> = {
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

// The demo story's items, written by hand at each level.
const STORY: StoryItem[] = [
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

// Requests. R0 was accepted and became Platform's Dec 5 commitment.
const REQS: Req[] = [
      ["rq_limits", "payments", "platform", "priya", "Per-merchant burst limits so webhook retries can't trip global limits",
        "Webhook retries (shipping Dec 12) need per-merchant burst limits first. Can Platform land them by Dec 5?", "2026-11-20", "2026-12-05", "accepted", "own_limits", "aisha", null, "form"],
      ["rq_when_1", "payments", "platform", "hannah", "When will per-merchant burst limits land now that Dec 5 is at risk?",
        "Asked the Platform agent. We need the new date to replan webhook retries.", "2026-12-04", null, "open", "own_limits", "aisha", "ck_limits_date", "agent"],
      ["rq_when_2", "growth", "platform", "maya", "Is the rate-limit change still landing this week? Our Dec 15 launch depends on it.",
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

const COMS: Com[] = [
      ["cm_limits", "platform", "aisha", "payments", "Per-merchant burst rate limits for webhook retries", "2026-12-05", "open", "request", "rq_limits", null,
        "Load testing found a memory leak in the new limiter; the fix is in review (Platform's Dec 4 update).", null],
      ["cm_retries", "payments", "priya", "growth", "Webhook retries live in production", "2026-12-12", "open", "update_item", "ui_retries_decision", "cm_limits", null, null],
      ["cm_launch", "growth", "jordan", "sales", "'Reliable payments' launch: landing page, email and webinar", "2026-12-15", "open", "manual", null, "cm_retries", null, null],
      ["cm_docs", "payments", "tom", "cs", "Publish webhook retry docs", "2026-12-10", "open", "manual", null, null, null, null],
      ["cm_budget", "finance", "isabel", "leadership", "Q1 budget templates to team leads", "2026-12-03", "open", "manual", null, null, "Waiting on the final headcount plan.", null],
      ["cm_renewals", "cs", "noah", "sales", "Q1 renewal risk list", "2026-12-08", "open", "manual", null, null, null, null],
      ["cm_designs", "design", "iris", "growth", "Launch page designs for Dec 15", "2026-12-02", "done", "manual", null, null, null, "2026-12-01"],
      ["cm_tokens", "mobile", "ben", "design", "Adopt design system v3 tokens in iOS", "2026-11-20", "done", "manual", null, null, null, "2026-11-19"],
      ["cm_sso", "platform", "ken", "mobile", "SSO for the mobile admin app", "2026-12-18", "open", "manual", null, null, null, null],
      ["cm_autoscale", "platform", "lena", "payments", "Incident follow-up: queue autoscaling", "2026-11-25", "done", "manual", null, null, null, "2026-11-24"],
];

// Questions people asked team agents, so agent stats and history look real.
const QS: Qn[] = [
      ["qn_1", "grace", "payments", "Do webhook retries cover payout events?", "answered",
        "Webhook retries cover payment and refund events at launch. Payout events follow in January.", ["update_item:ui_answer_payouts"], null, "2026-11-25"],
      ["qn_2", "ravi", "payments", "Will retries be on by default?", "answered",
        "Webhook retries ship Dec 12, on by default for every account.", ["update_item:ui_retries_decision"], null, "2026-11-30"],
      ["qn_3", "liam", "platform", "Are rate limits per API key or per merchant?", "answered",
        "Rate limits are moving from per-API-key to per-merchant buckets.", [], null, "2026-11-19"],
      ["qn_4", "hannah", "platform", "When will per-merchant burst limits land now that Dec 5 is at risk?", "routed",
        "Platform hasn't published a new date. I asked Aisha Bello, who owns Rate limits.", [], "rq_when_1", "2026-12-04"],
      ["qn_5", "maya", "platform", "Is the rate-limit change still landing this week?", "routed",
        "Platform hasn't published a new date. I asked Aisha Bello, who owns Rate limits.", [], "rq_when_2", "2026-12-05"],
      ["qn_6", "grace", "platform", "When does the rate-limit fix land?", "routed",
        "Platform hasn't published a new date. I asked Aisha Bello, who owns Rate limits.", [], "rq_when_3", "2026-12-05"],
      ["qn_7", "kofi", "payments", "Can merchants replay a failed webhook from the dashboard?", "routed",
        "Payments API hasn't published anything on this. I asked Priya Raman, who owns Webhooks.", [], "rq_replay", "2026-12-04"],
      ["qn_8", "omar", "mobile", "Is iOS 4.2 live?", "answered", "iOS 4.2 is live with saved payment methods.", [], null, "2026-11-03"],
];

// Connected tools and what they synced. All fictional, consistent with the story above.
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

const DOCS: SourceDoc[] = [
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

export const northwind: DemoPack = {
  id: "software",
  audience: "Mid-size software company",
  org: { name: "Northwind Labs", short: "Northwind", headcount: 300, domain: "northwind", about: "a fictional 300-person company that sells a payments API" },
  summary:
    "A slipped infrastructure change quietly puts a marketing launch at risk, two teams away.",
  defaultPersona: "jordan",
  teams: TEAMS,
  people: PEOPLE,
  alsoOnLeadership: ["daniel", "ava", "lucas", "olivia", "henry"],
  owns: OWNS,
  follows: FOLLOWS,
  interfaceOverrides: [
    { from: "platform", to: "payments", level: "full", cadence: "immediate", sources: ["source:ticket", "source:pr"] },
    { from: "sales", to: "leadership", level: "full", allKinds: true },
    { from: "payments", to: "growth", cadence: "immediate" },
    { from: "payments", to: "mobile", sources: ["source:ticket"] },
  ],
  markings: [{ id: "mk_conf", label: "Confidential: Leadership and Sales only", allowed: ["leadership", "sales"], othersLevel: "summary" }],
  items: ITEMS,
  story: STORY,
  requests: REQS,
  confidentialRequests: [
    {
      id: "rq_halcyon", from: "sales", to: "payments", requester: "victor",
      title: "Custom rate limits for Halcyon Bank before their January pilot",
      details: "Halcyon Bank ($1.2M ARR, in negotiation) needs 3x the standard burst limit on the payouts API before their pilot starts Jan 11. Can Payments API support per-account overrides?",
      summaryTitle: "Custom rate limits for an enterprise customer before a January pilot",
      summaryDetails: "An enterprise customer in negotiation needs 3x the standard burst limit on the payouts API before a pilot in January. Can Payments API support per-account overrides?",
      headline: "Sales asked Payments API about custom limits",
      neededBy: "2026-12-18", ownership: "own_api", assignee: "diego", marking: "mk_conf", cluster: "ck_halcyon", created: "2026-12-03T14:00:00Z",
    },
  ],
  commitments: COMS,
  questions: QS,
  connectors: CONNECTORS,
  docs: DOCS,
  meetings: MEETINGS,
  agentSpend: { platform: 84, payments: 61, cs: 23 },
  task: {
    id: "tr_cs_dupes",
    unit: "cs",
    requestedBy: "grace",
    title: "What are merchants saying about duplicate webhooks and retries?",
    instructions: "Pull together what merchants have told us about duplicate webhooks and retries, and what Payments API has said publicly about the fix. I need it for the January renewal calls.",
    steps: [
    { at: "2026-12-05T14:00:00Z", kind: "start", text: "Started for Grace Liu." },
    { at: "2026-12-05T14:00:20Z", kind: "read", text: "Read 3 Zendesk escalations about webhooks." },
    { at: "2026-12-05T14:00:40Z", kind: "read", text: "Read #cs-escalations and the payout timing research synthesis." },
    { at: "2026-12-05T14:01:30Z", kind: "read", text: "Read what Payments API has published about retries (at Customer success's level)." },
    { at: "2026-12-05T14:02:10Z", kind: "done", text: "Wrote a brief with 3 findings." },
    ],
    result: "## What merchants are saying\n\n- **Duplicates are the top complaint.** The Oct 28 incident sent duplicate events for 40 minutes (ZD-4471), and three January renewals cite it.\n- **They want a date.** Three merchants this week asked when retries ship (ZD-4622). Payments API has published Dec 12 as the target, but it depends on Platform's rate-limit change.\n- **Replays hit rate limits.** Bulk replays of failed webhooks return 429 errors (ZD-4610). Retries will respect per-merchant limits once Platform ships them.\n\n## For the renewal calls\n\nLead with idempotency keys (duplicate charges down 38%) and the retries plan. Avoid promising Dec 12 until Platform confirms its new date.",
    sources: [{ title: "ZD-4471: Duplicate webhooks during the Oct 28 incident" }, { title: "ZD-4610: 429 errors when replaying failed webhooks" }, { title: "ZD-4622: When do webhook retries ship?" }, { title: "Payments API: webhook retries decision (Nov 27)" }],
    at: "2026-12-05T14:00:00Z",
    doneAt: "2026-12-05T14:02:10Z",
  },
  ui: {
    writeExamples: {
  platform: `Platform sync, Dec 6
- The limiter memory leak fix is merged and load tests have been stable for 2 hours.
- We'll land the rate-limit change by Dec 9.
- SSO for the mobile admin app is on track for Dec 18.
- Can Payments API share expected retry volume per merchant so we can size the burst buckets?`,
  payments: `Payments API weekly
- Retry scheduler is done and tested behind a flag.
- We still need Platform's per-merchant burst limits before we turn retries on.
- We'll publish the retry docs for Customer success by Dec 10.`,
  growth: `Growth marketing weekly
- Launch page and webinar for the 'Reliable payments' launch are ready.
- If webhook retries slip past Dec 12 we'll move the launch email, but keep the webinar.`,
    },
    askExamples: {
      platform: "When will the rate-limit change land?",
      payments: "Do webhook retries cover payout events?",
    },
    searchHint: 'Try "rate limits", "webhooks" or a name',
    researchHint: "How do other payment APIs limit webhook retry traffic per merchant?",
    sampleSessions: {
  payments: {
    repo: "northwind/payments-api",
    branch: "feat/webhook-retries",
    prompts: ["Add exponential backoff to webhook retries with 5 attempts over 24 hours", "Make retries respect the per-merchant burst limit once Platform ships it"],
    notes: ["Backoff and the retry queue are done and tested.", "Still blocked on Platform's per-merchant burst limits before we can turn retries on."],
    commits: ["a1b2c3d Add retry scheduler with exponential backoff", "d4e5f6a Respect per-merchant limits when present"],
    diffstat: "14 files changed, 612 insertions(+), 88 deletions(-)",
  },
  platform: {
    repo: "northwind/platform",
    branch: "fix/limiter-leak",
    prompts: ["Find the memory leak in the per-merchant limiter under load"],
    notes: ["Fixed the leak: buckets for idle merchants were never evicted. Load test is stable for 2 hours."],
    commits: ["9f8e7d6 Evict idle merchant buckets from the limiter"],
    diffstat: "3 files changed, 74 insertions(+), 12 deletions(-)",
  },
    },
  },
  intro: {
    problem:
      "Growth marketing's Dec 15 launch needs Payments API's webhook retries, and the retries need Platform's rate-limit change. Load testing found a memory leak, so that change missed Dec 5. Nobody has told the launch team yet.",
    cast: [
      { as: "jordan", note: "Runs the Dec 15 launch, and is waiting on work two teams away." },
      { as: "aisha", note: "Owns the rate-limit change that's running late." },
      { as: "elena", note: "Wants the whole company's week on one page." },
    ],
  },
  agentTemplate: {
    team: "platform",
    name: "Platform coding agent",
    firstJob: "Fix the memory leak in the per-merchant limiter",
    purpose: "Check out northwind/platform in a sandbox, pick up small bugs and load-test fixes from Jira, run the tests and open a pull request for an engineer to review. Drafts Platform's weekly update from Jira and GitHub.",
    actions: ["code", "draft_update", "answer"],
  },
  guide: [
    { title: "See what's at risk", as: "jordan", href: "/feed",
      text: "Under Needs your attention, the Dec 15 launch is marked At risk. Beacon shows why: it waits on Payments API's retries, which wait on Platform's rate-limit change, which missed Dec 5.",
      why: "Jordan hears about a delay two teams away the day it happens, not the week of the launch." },
    { title: "Ask your agent instead of chasing", as: "jordan", href: "/feed?agent=When+will+the+rate-limit+change+land%3F&to=me",
      text: "The agent panel on the right has the question filled in. Press Send. Your agent sees that Platform owns it and asks Platform's agent. There's no new date yet, so it goes to Aisha, and 3 others asked too.",
      why: "Nobody has to find the right person, and Aisha gets one question instead of four separate messages." },
    { title: "Add an agent teammate", as: "aisha", href: "/agents/new?template=demo",
      text: "Aisha adds Platform coding agent, a Worker for Platform. It's filled in: what it can read, what it can do and what needs Aisha's OK. Click Add, then click \"Fix the memory leak in the per-merchant limiter\" in the chat and Approve.",
      why: "Aisha's team gets a coding teammate that works in a sandbox and opens pull requests, so engineers review instead of type." },
    { title: "Post the new date", as: "aisha", href: "/write?example=1",
      text: "Aisha's notes are filled in. Click Split into items. At the top, Beacon flags that one line moves the Dec 5 promise to Dec 9. Scroll down and click Publish.",
      why: "Aisha writes the notes once. Beacon works out who's affected and updates the promise." },
    { title: "Everyone waiting hears about it", as: "jordan", href: "/feed?agent=When+will+the+rate-limit+change+land%3F&to=me",
      text: "Back as Jordan, the panel has the same question ready. Send it. This time your agent answers straight from Aisha's update, with the source. The Inbox in the sidebar has the new date too.",
      why: "Payments API and Growth marketing both get the news without a meeting or a reply-all thread." },
    { title: "See the week on one page", as: "elena", href: "/digest", compare: "jordan",
      text: "Elena sees one short paragraph per team, plus every commitment that slipped. The Sales paragraph mentions the Halcyon Bank deal, so it's marked confidential. Open the page as Jordan: that paragraph isn't there.",
      why: "Leaders get the whole picture, and confidential work stays with the people cleared to see it." },
  ],
  explore: [
    { title: "Answer four people at once", as: "aisha", href: "/asks", text: "Four questions about the same date, merged into one. Answer once and everyone who asked gets the reply." },
    { title: "Turn a meeting into updates", as: "aisha", href: "/meetings/mt_limits", text: "Summarize the Platform × Payments meeting. Beacon writes the decisions and turns each action item into a commitment for its owner." },
    { title: "Meet every agent teammate", as: "aisha", href: "/agents", text: "Every team's built-in agent plus the teammates teams added: Q&A agents that answer, and Workers that research, review documents or change code. Message any of them." },
    { title: "See how teams depend on each other", as: "elena", href: "/map", text: "Who owes whom, and who is asking whom, across the company." },
    { title: "Check who saw what", as: "elena", href: "/audit", text: "Every read, share and answer, including what each agent read and for whom." },
  ],
  checks: {
    search: { q: "rate limits", team: "platform", owns: "Rate limits" },
    feed: { as: "jordan", decision: "ui_retries_decision", atRisk: "cm_launch" },
    slipped: { as: "priya", team: "payments", commitment: "cm_limits", reason: "memory leak" },
    revise: { as: "aisha", team: "platform", commitment: "cm_limits", due: "2026-12-09", notify: ["priya", "jordan"] },
    digest: { allowed: "elena", denied: "jordan", marking: "mk_conf", slipped: ["cm_limits", "cm_budget"] },
    route: { as: "jordan", team: "platform", question: "When will the rate-limit change land?", owner: "aisha", cluster: "ck_limits_date", askers: 4 },
    answer: { as: "grace", team: "payments", question: "Do webhook retries cover payout events?", contains: "January", source: "update_item:ui_answer_payouts" },
    leak: { as: "ben", team: "payments", question: "Is Payments API giving Halcyon Bank custom rate limits?", secret: "Halcyon" },
  },
};
