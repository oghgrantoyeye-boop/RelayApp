import type { Db } from "../db";
import type { ChecklistItem, Decision, Person, Status } from "../render";

/**
 * Demo pack: Larkspur Outdoor Co., a fictional outdoor-gear company. Six teams
 * hand work to each other on cross-team initiatives, and retail partners are
 * the outside party. Compliance is the bottleneck, and the demo story is the
 * Trailhead e-bike launch, where Supply chain is waiting on Compliance's
 * certification decision.
 *
 * Deterministic: the same seed produces the same initiatives every time.
 */

export const ORG = "larkspur";
export const ENTITY_TYPE = "initiative";
/** The public-unit member an initiative belongs to; partners see only their own. */
export const EXTERNAL_OWNER_FIELD = "partner";
/** "Today" in the demo: the morning after Compliance sent its findings on the Trailhead launch. */
export const DEMO_TODAY = "2027-01-16";
export const DEMO_REF = "LK-014";

export const UNITS = [
  { id: "product", name: "Product", kind: "internal", color: "#6d28d9" },
  { id: "engineering", name: "Engineering", kind: "internal", color: "#1d4ed8" },
  { id: "compliance", name: "Compliance", kind: "internal", color: "#c2410c" },
  { id: "supply", name: "Supply chain", kind: "internal", color: "#0e7490" },
  { id: "marketing", name: "Marketing", kind: "internal", color: "#a16207" },
  { id: "sales", name: "Sales", kind: "internal", color: "#64748b" },
  { id: "partners", name: "Retail partners", kind: "public", color: "#0f766e" },
] as const;
type UnitId = (typeof UNITS)[number]["id"];
const unitName = (id: UnitId) => UNITS.find((u) => u.id === id)!.name;

export const MEMBERS = [
  { id: "maya", unit: "product", kind: "person", name: "Maya Chen", role: "VP Product" },
  { id: "sam", unit: "engineering", kind: "person", name: "Sam Okafor", role: "Engineering lead" },
  { id: "omar", unit: "compliance", kind: "person", name: "Omar Haddad", role: "Head of compliance (unit admin)" },
  { id: "nina", unit: "compliance", kind: "person", name: "Nina Patel", role: "Compliance analyst", manager: "omar" },
  { id: "chris", unit: "compliance", kind: "person", name: "Chris Wu", role: "Compliance analyst", manager: "omar" },
  {
    id: "precheck",
    unit: "compliance",
    kind: "agent",
    name: "Compliance pre-check agent",
    role: "Pre-check",
    manager: "omar",
    config: {
      budget: { monthly_usd: 150, used_usd: 84 },
      approval: "member_required", // anything that leaves the unit or changes an entity
      triggers: ["design_submitted", "design_resubmitted"],
    },
  },
  { id: "lena", unit: "supply", kind: "person", name: "Lena Ortiz", role: "Supply chain manager" },
  { id: "jo", unit: "marketing", kind: "person", name: "Jo Bennett", role: "Launch marketing manager" },
  { id: "ravi", unit: "sales", kind: "person", name: "Ravi Shah", role: "Head of retail sales" },
  { id: "summit", unit: "partners", kind: "person", name: "Summit Cycles", role: "Retail partner" },
  { id: "basecamp", unit: "partners", kind: "person", name: "Basecamp Supply", role: "Retail partner" },
  { id: "ridgeway", unit: "partners", kind: "person", name: "Ridgeway Sports", role: "Retail partner" },
  { id: "tidal", unit: "partners", kind: "person", name: "Tidal Outfitters", role: "Retail partner" },
] as const;
const PARTNERS = MEMBERS.filter((m) => m.unit === "partners");
const person = (id: string): Person => {
  const m = MEMBERS.find((x) => x.id === id)!;
  return { member_id: m.id, name: m.name, role: m.role };
};

export const FIELDS: { key: string; label: string; type: string; owner: UnitId }[] = [
  // Product owns the initiative itself
  { key: "name", label: "Initiative", type: "text", owner: "product" },
  { key: "summary", label: "Summary", type: "text", owner: "product" },
  { key: "product_owner", label: "Owner", type: "person", owner: "product" },
  { key: "partner", label: "Launch partner", type: "person", owner: "product" },
  { key: "started_at", label: "Started", type: "date", owner: "product" },
  { key: "target_date", label: "Target date", type: "date", owner: "product" },
  { key: "price", label: "Retail price", type: "money", owner: "product" },
  { key: "kickoff", label: "Kickoff", type: "status", owner: "product" },
  { key: "holder", label: "Holding it now", type: "text", owner: "product" },
  { key: "revised_due", label: "Revised files due", type: "date", owner: "product" },
  { key: "handoff_rounds", label: "Handoff rounds", type: "text", owner: "product" },
  // Teams' own statuses and notes
  { key: "engineering_status", label: "Engineering", type: "status", owner: "engineering" },
  { key: "engineering_notes", label: "Engineering notes", type: "text", owner: "engineering" },
  { key: "supply_status", label: "Supply chain", type: "status", owner: "supply" },
  { key: "marketing_status", label: "Marketing", type: "status", owner: "marketing" },
  { key: "sales_status", label: "Sales", type: "status", owner: "sales" },
  // Compliance
  { key: "compliance_status", label: "Compliance", type: "status", owner: "compliance" },
  { key: "compliance_findings", label: "Compliance findings", type: "checklist", owner: "compliance" },
  { key: "certification", label: "Certification decision", type: "decision", owner: "compliance" },
  { key: "battery", label: "Battery", type: "text", owner: "compliance" },
  { key: "ip_rating", label: "Ingress rating", type: "text", owner: "compliance" },
  { key: "markets", label: "Markets", type: "text", owner: "compliance" },
  { key: "test_lab", label: "Test lab", type: "text", owner: "compliance" },
  { key: "approved_claims", label: "Claims sales can make", type: "checklist", owner: "compliance" },
  { key: "compliance_reviewer", label: "Compliance reviewer", type: "person", owner: "compliance" },
  { key: "compliance_notes", label: "Compliance internal notes", type: "text", owner: "compliance" },
];

type Iface = {
  from: UnitId;
  to: UnitId;
  key: string;
  level: "full" | "summary" | "status" | "headline";
  trigger: string;
  status?: "active" | "suggested";
  label?: string;
  example?: string;
  note?: string;
};

const TEAMS: UnitId[] = ["engineering", "compliance", "supply", "marketing", "sales"];

function interfaces(): Iface[] {
  const out: Iface[] = [];
  // Product shares the initiative basics with every team, and with the launch partner.
  for (const to of TEAMS) {
    for (const key of ["name", "summary", "started_at", "target_date", "holder", "revised_due", "handoff_rounds", "kickoff"]) {
      out.push({ from: "product", to, key, level: "full", trigger: "on_change" });
    }
    out.push({ from: "product", to, key: "product_owner", level: "full", trigger: "on_change" });
    out.push({ from: "product", to, key: "partner", level: "summary", trigger: "on_change" });
  }
  // Marketing and Sales need the price. The pricing marking caps everyone but Product and Sales.
  out.push({ from: "product", to: "marketing", key: "price", level: "full", trigger: "on_change" });
  out.push({ from: "product", to: "sales", key: "price", level: "full", trigger: "on_change" });
  for (const key of ["name", "summary", "partner", "target_date", "holder", "kickoff"]) {
    out.push({ from: "product", to: "partners", key, level: key === "summary" ? "summary" : "full", trigger: "on_change" });
  }
  out.push({ from: "product", to: "partners", key: "price", level: "full", trigger: "on_change" });

  // Each team reports a summary to Product, its status to the other teams, and a headline to the partner.
  const statusKeys: [UnitId, string][] = [
    ["engineering", "engineering_status"],
    ["supply", "supply_status"],
    ["marketing", "marketing_status"],
    ["sales", "sales_status"],
  ];
  for (const [from, key] of statusKeys) {
    out.push({ from, to: "product", key, level: "summary", trigger: "on_change" });
    out.push({ from, to: "partners", key, level: "headline", trigger: "on_change" });
    for (const to of TEAMS) if (to !== from) out.push({ from, to, key, level: "status", trigger: "on_change" });
  }

  // Compliance: what it publishes, and to whom.
  out.push(
    {
      from: "compliance",
      to: "engineering",
      key: "compliance_findings",
      level: "full",
      trigger: "on_change",
      label: "Findings to fix before certification",
      example: "Battery label is missing the UN 38.3 test summary mark",
    },
    {
      from: "compliance",
      to: "product",
      key: "compliance_status",
      level: "status",
      trigger: "on_change+daily",
      label: "Status and days in queue",
      example: "Changes requested, day 6 of 10",
    },
    {
      from: "compliance",
      to: "sales",
      key: "approved_claims",
      level: "full",
      trigger: "on_approval",
      label: "Claims sales can make",
      example: "Water resistant (IP54). Don't say waterproof",
    },
    {
      from: "compliance",
      to: "partners",
      key: "compliance_status",
      level: "headline",
      trigger: "on_change",
      label: "Compliance status",
      example: "Compliance: changes requested",
    },
    {
      from: "compliance",
      to: "marketing",
      key: "approved_claims",
      level: "summary",
      trigger: "on_approval",
      label: "Claims marketing can make",
      example: "Water resistant",
    },
    // The one seeded suggestion. Approving it turns it active; "Approve as summary" sets level to summary.
    {
      from: "compliance",
      to: "supply",
      key: "certification",
      level: "full",
      trigger: "on_decision",
      status: "suggested",
      label: "Certification decision",
      example: "UL 2849 via Intertek",
      note: "Supply chain asks about certification status on 40% of hardware launches. Send them the certification decision at full detail as soon as you make it?",
    },
  );
  return out;
}

export const MARKINGS = [
  {
    id: "mk_pricing",
    target_kind: "field",
    field: "price",
    label: "Unannounced pricing",
    rule: { allowed_units: ["product", "sales"], max_level_others: "status" },
  },
];

// ---------------------------------------------------------------------------
// Initiatives

type Holder = "product" | "engineering" | "compliance" | "supply" | "marketing" | "sales";

const NAMED: { ref: string; name: string; summary: string; holder: Holder; partner: string | null }[] = [
  {
    ref: DEMO_REF,
    name: "Trailhead e-bike spring launch",
    summary: "Launch the Trailhead commuter e-bike in 140 stores on Mar 3. First product with our own battery pack.",
    holder: "compliance",
    partner: "summit",
  },
  { ref: "LK-009", name: "Kids' balance bike refresh", summary: "New colors and a lighter frame for the Pip balance bike.", holder: "engineering", partner: "basecamp" },
  { ref: "LK-011", name: "Helmet line safety upgrade", summary: "Add rotational-impact liners across the helmet line.", holder: "compliance", partner: "ridgeway" },
  { ref: "LK-016", name: "Cargo trailer accessory", summary: "A two-wheel cargo trailer that fits every Larkspur frame.", holder: "supply", partner: null },
  { ref: "LK-012", name: "Ridgeline EU market entry", summary: "Sell the Ridgeline bike in Germany and the Netherlands.", holder: "compliance", partner: null },
  { ref: "LK-007", name: "Dealer price list update", summary: "Publish the 2027 dealer price list.", holder: "sales", partner: "tidal" },
  { ref: "LK-015", name: "Battery take-back program", summary: "Let customers return used batteries in store.", holder: "marketing", partner: "summit" },
  { ref: "LK-010", name: "Winter apparel capsule", summary: "Twelve-piece cold-weather riding collection.", holder: "product", partner: "ridgeway" },
];

/** Who holds the 64 open initiatives. Compliance holds the most: it's the bottleneck. */
const HOLDERS: Record<Holder, number> = { compliance: 18, engineering: 14, supply: 10, marketing: 9, product: 7, sales: 6 };
export const TOTAL_OPEN = 64;
/** 9 blocked between teams, 4 of them waiting on Compliance. */
const BLOCKED_ON: Partial<Record<Holder, number>> = { compliance: 4, engineering: 3, supply: 2 };
/** Handoff rounds averaging 1.9 (20×1, 33×2, 9×3, 2×4 = 121 / 64). */
const ROUNDS: [number, number][] = [
  [1, 20],
  [2, 33],
  [3, 9],
  [4, 2],
];

const NAMES = [
  "Trail shoe midsole update", "Bike light recall follow-up", "Pannier bag v2", "Store fixture refresh",
  "Spring catalog", "Tent fabric supplier switch", "Packaging plastic removal", "Kickstand redesign",
  "Warranty process update", "Canada launch for Pip", "Water bottle line extension", "E-bike charger v2",
  "Retail staff training kit", "Frame paint supplier audit", "Saddle comfort study", "Holiday bundle",
  "Repair parts program", "Size chart update", "Bike rack accessory", "Hydration pack redesign",
];
const SUMMARIES = [
  "Needs sign-off from several teams before it ships.",
  "Changes a part that other products also use.",
  "Customer-facing, so wording and claims need review.",
  "Depends on a new supplier.",
];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const addDays = (iso: string, d: number) => {
  const t = new Date(`${iso}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

/** Days open for 64 initiatives, median exactly 41 (target 30). */
function daysOpenList(): number[] {
  const lower = Array.from({ length: 32 }, (_, i) => Math.round(4 + (i * 37) / 31)); // 4..41
  const upper = Array.from({ length: 32 }, (_, i) => Math.round(41 + (i * 50) / 31)); // 41..91
  return [...lower, ...upper];
}

const TEAM_STATUS: { unit: UnitId; key: string }[] = [
  { unit: "engineering", key: "engineering_status" },
  { unit: "compliance", key: "compliance_status" },
  { unit: "supply", key: "supply_status" },
  { unit: "marketing", key: "marketing_status" },
  { unit: "sales", key: "sales_status" },
];

type Values = Record<string, unknown>;

function demoStory(): Values {
  return {
    name: "Trailhead e-bike spring launch",
    summary: NAMED[0].summary,
    product_owner: person("maya"),
    partner: person("summit"),
    started_at: "2027-01-06",
    target_date: "2027-03-03",
    price: 2499,
    kickoff: { unit: "Product", state: "done", since: "2027-01-06" } satisfies Status,
    holder: "Compliance",
    revised_due: "2027-01-19",
    handoff_rounds: 1,
    marketing_status: { unit: "Marketing", state: "approved", since: "2027-01-10", note: "Campaign brief approved after 4 days" } satisfies Status,
    sales_status: { unit: "Sales", state: "approved", since: "2027-01-12", note: "140 stores committed" } satisfies Status,
    engineering_status: {
      unit: "Engineering",
      state: "changes_requested",
      since: "2027-01-15",
      note: "Updating label artwork and the manual",
    } satisfies Status,
    engineering_notes: "Label artwork fix is ready. The manual change needs a new print run, which costs 3 days.",
    supply_status: {
      unit: "Supply chain",
      state: "waiting",
      waiting_on: "compliance",
      waiting_on_name: "Compliance",
      since: "2027-01-14",
      note: "Can't book ocean freight until the battery is certified",
    } satisfies Status,
    compliance_status: {
      unit: "Compliance",
      state: "changes_requested",
      day: 6,
      of: 10,
      since: "2027-01-15",
      note: "2 findings sent to Engineering",
    } satisfies Status,
    compliance_findings: [
      {
        n: 1,
        title: "Battery label is missing the UN 38.3 test summary mark",
        ref: "UN 38.3, 49 CFR 173.185",
        plain: "Add the UN 38.3 test summary mark to the battery label artwork.",
      },
      {
        n: 2,
        title: "User manual is missing the charging safety warnings",
        ref: "UL 2849 §16.2",
        plain: "Add the charging safety warnings to page 4 of the user manual.",
      },
    ] satisfies ChecklistItem[],
    certification: {
      subject: "Battery certification",
      state: "pending",
      proposed: "UL 2849 via Intertek",
      since: "2027-01-14",
      note: "Supply chain needs this to book ocean freight",
    } satisfies Decision,
    battery: "720 Wh lithium-ion, own pack",
    ip_rating: "IP54 (within limit)",
    markets: "US and Canada",
    test_lab: "Intertek, Plano",
    approved_claims: [
      { n: 1, title: "Water resistant (IP54). Don't say waterproof", plain: "Water resistant" },
      { n: 2, title: "Up to 60 miles per charge in eco mode, per test report TR-118", plain: "Up to 60 miles per charge" },
    ] satisfies ChecklistItem[],
    compliance_reviewer: person("nina"),
    compliance_notes:
      "Pre-check agent flagged the label on Jan 7, before review started. Intertek has a slot on Jan 21 if the fixes land by Jan 19.",
  };
}

function generated(
  i: number,
  r: () => number,
  o: { name: string; summary: string; holder: Holder; daysOpen: number; rounds: number; blockedOn: Holder | null; partner: string | null },
): Values {
  const started = addDays(DEMO_TODAY, -o.daysOpen);
  const v: Values = {
    name: o.name,
    summary: o.summary,
    product_owner: person("maya"),
    partner: o.partner ? person(o.partner) : null,
    started_at: started,
    target_date: addDays(started, 45 + Math.floor(r() * 60)),
    price: Math.round(20 + r() * 400) - 0.01,
    kickoff: { unit: "Product", state: o.holder === "product" ? "in_progress" : "done", since: started },
    holder: unitName(o.holder),
    handoff_rounds: o.rounds,
    compliance_reviewer: person(i % 2 ? "nina" : "chris"),
    markets: r() < 0.8 ? "US and Canada" : "US, Canada and EU",
  };
  for (const { unit, key } of TEAM_STATUS) {
    const name = unitName(unit);
    let s: Status;
    if (o.holder === "product") s = { unit: name, state: "not_started" };
    else if (o.holder === unit)
      s = { unit: name, state: "in_progress", day: 1 + Math.floor(r() * 9), of: 10, since: addDays(DEMO_TODAY, -Math.floor(r() * 9)) };
    else s = r() < 0.6 ? { unit: name, state: "approved" } : { unit: name, state: "in_progress", day: 1 + Math.floor(r() * 9), of: 10 };
    v[key] = s;
  }
  if (o.blockedOn) {
    // Another team is waiting on the holder. Supply chain waits on Compliance and Engineering; Marketing waits on Supply chain.
    const waiter = o.blockedOn === "supply" ? "marketing_status" : "supply_status";
    const waiterUnit = TEAM_STATUS.find((u) => u.key === waiter)!.unit;
    v[waiter] = {
      unit: unitName(waiterUnit),
      state: "waiting",
      waiting_on: o.blockedOn,
      waiting_on_name: unitName(o.blockedOn as UnitId),
      since: addDays(DEMO_TODAY, -1 - Math.floor(r() * 5)),
    } satisfies Status;
  }
  const comp = v.compliance_status as Status;
  v.compliance_findings =
    comp.state === "in_progress" && r() < 0.4
      ? [{ n: 1, title: "Country-of-origin marking missing on packaging", ref: "19 CFR 134", plain: "Add the country of origin to the packaging." }]
      : [];
  return v;
}

export function buildInitiatives(): { ref: string; values: Values }[] {
  const r = rng(14);
  const remaining = { ...HOLDERS };
  for (const n of NAMED) remaining[n.holder]--;
  const holderSlots: Holder[] = [];
  for (const [h, count] of Object.entries(remaining) as [Holder, number][]) for (let k = 0; k < count; k++) holderSlots.push(h);
  const holders = shuffle(holderSlots, r);

  const days = shuffle(daysOpenList(), r);
  days.splice(days.indexOf(10), 1); // the demo story started Jan 6: 10 days open
  const rounds = shuffle(ROUNDS.flatMap(([c, n]) => Array<number>(n).fill(c)), r);
  rounds.splice(rounds.indexOf(1), 1);

  const used = new Set(NAMED.map((n) => n.ref));
  let seq = 17;
  const nextRef = () => {
    let ref: string;
    do ref = `LK-${String(seq++).padStart(3, "0")}`;
    while (used.has(ref));
    used.add(ref);
    return ref;
  };
  const rows = [
    ...NAMED.slice(1),
    ...holders.map((holder, k) => ({
      ref: nextRef(),
      name: NAMES[k % NAMES.length] + (k >= NAMES.length ? ` (${Math.floor(k / NAMES.length) + 1})` : ""),
      summary: SUMMARIES[k % SUMMARIES.length],
      holder,
      partner: k % 3 === 0 ? PARTNERS[1 + (k % (PARTNERS.length - 1))].id : null, // Summit only on its own named launches
    })),
  ];

  const out: { ref: string; values: Values }[] = [{ ref: DEMO_REF, values: demoStory() }];
  const blockedLeft = { ...BLOCKED_ON, compliance: (BLOCKED_ON.compliance ?? 0) - 1 }; // the demo story is one of the 4
  rows.forEach((row, i) => {
    let blockedOn: Holder | null = null;
    if ((blockedLeft[row.holder] ?? 0) > 0) {
      blockedOn = row.holder;
      blockedLeft[row.holder]!--;
    }
    out.push({ ref: row.ref, values: generated(i, r, { ...row, daysOpen: days[i], rounds: rounds[i], blockedOn }) });
  });
  return out;
}

// ---------------------------------------------------------------------------

export async function seed(db: Db): Promise<void> {
  const existing = await db.query<{ n: number }>("select count(*)::int as n from org");
  if (existing.rows[0].n > 0) return;

  const q = (sql: string, params: unknown[]) => db.query(sql, params);
  await q("insert into org (id, name, config) values ($1, $2, $3)", [
    ORG,
    "Larkspur Outdoor Co.",
    JSON.stringify({ demo_today: DEMO_TODAY, targets: { days_to_ship: 30, team_days: 10 }, baselines: { handoff_rounds: 2.8 } }),
  ]);
  for (const u of UNITS) await q("insert into unit (id, org_id, name, kind, color) values ($1, $2, $3, $4, $5)", [u.id, ORG, u.name, u.kind, u.color]);
  for (const m of MEMBERS) {
    await q("insert into member (id, unit_id, kind, name, role, manager_id, config) values ($1, $2, $3, $4, $5, $6, $7)", [
      m.id,
      m.unit,
      m.kind,
      m.name,
      m.role,
      "manager" in m ? m.manager : null,
      JSON.stringify("config" in m ? m.config : {}),
    ]);
  }
  await q("insert into entity_type (id, org_id, name, schema_json) values ($1, $2, $3, $4)", [
    ENTITY_TYPE,
    ORG,
    "Initiative",
    JSON.stringify({ fields: FIELDS.map((f) => f.key), external_owner_field: EXTERNAL_OWNER_FIELD }),
  ]);
  for (const f of FIELDS) {
    await q("insert into field (id, entity_type_id, key, label, type, owner_unit_id) values ($1, $2, $3, $4, $5, $6)", [
      `f_${f.key}`,
      ENTITY_TYPE,
      f.key,
      f.label,
      f.type,
      f.owner,
    ]);
  }
  for (const [n, i] of interfaces().entries()) {
    await q(
      `insert into interface (id, from_unit_id, to_unit_id, field_id, level, trigger, status, label, example, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [`if_${n + 1}`, i.from, i.to, `f_${i.key}`, i.level, i.trigger, i.status ?? "active", i.label ?? null, i.example ?? null, i.note ?? null],
    );
  }
  for (const m of MARKINGS) {
    await q("insert into marking (id, target_kind, target_id, label, rule) values ($1, $2, $3, $4, $5)", [
      m.id,
      m.target_kind,
      `f_${m.field}`,
      m.label,
      JSON.stringify(m.rule),
    ]);
  }

  // Bulk insert: one statement per table.
  const items = buildInitiatives();
  const entityRows: { a: string; b: string; c: string; d: string }[] = [];
  const valueRows: { a: string; b: string; c: string; d: string }[] = [];
  for (const it of items) {
    const id = `e_${it.ref}`;
    entityRows.push({ a: id, b: ENTITY_TYPE, c: it.ref, d: `${it.values.started_at}T09:00:00Z` });
    for (const [key, value] of Object.entries(it.values)) {
      if (value === null) continue;
      const owner = FIELDS.find((f) => f.key === key)!.owner;
      const by = MEMBERS.find((m) => m.unit === owner && m.kind === "person")!.id;
      valueRows.push({ a: id, b: `f_${key}`, c: JSON.stringify(value), d: by });
    }
  }
  await q(
    `insert into entity (id, entity_type_id, external_ref, created_at)
     select a, b, c, d from json_to_recordset($1::json) as x(a text, b text, c text, d timestamptz)`,
    [JSON.stringify(entityRows)],
  );
  await q(
    `insert into field_value (entity_id, field_id, value_json, updated_by)
     select a, b, c::jsonb, d from json_to_recordset($1::json) as x(a text, b text, c text, d text)`,
    [JSON.stringify(valueRows)],
  );
  await q(
    `insert into audit_event (actor_member_id, action, target, detail, at)
     values ('precheck', 'agent_finding', $1, $2, '2027-01-07T09:14:00Z')`,
    [DEMO_REF, JSON.stringify({ finding: "Battery label is missing the UN 38.3 test summary mark", status: "approved", approved_by: "nina" })],
  );
}
