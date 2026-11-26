import type { Db } from "../db";
import { PERMIT_TYPE } from "../entities";
import type { Correction, Determination, Person, ReviewStatus } from "../render";

/**
 * Demo seed for the fictional City of Harborview. All values come from the
 * brief's "Implementation details" section (SPEC.md). Deterministic: the same
 * seed produces the same 186 applications every time.
 */

export const ORG = "harborview";
/** "Today" in the demo: the morning after Fire prevention sent corrections on BP-2027-0418. */
export const DEMO_TODAY = "2027-01-16";
export const DEMO_REF = "BP-2027-0418";

export const UNITS = [
  { id: "permit", name: "Permit center", kind: "internal", color: "#6d28d9" },
  { id: "zoning", name: "Zoning", kind: "internal", color: "#a16207" },
  { id: "fire", name: "Fire prevention", kind: "internal", color: "#c2410c" },
  { id: "building", name: "Building plan review", kind: "internal", color: "#1d4ed8" },
  { id: "utilities", name: "Utilities", kind: "internal", color: "#0e7490" },
  { id: "inspections", name: "Inspections", kind: "internal", color: "#64748b" },
  { id: "public", name: "Public portal", kind: "public", color: "#0f766e" },
] as const;
type UnitId = (typeof UNITS)[number]["id"];
const unitName = (id: UnitId) => UNITS.find((u) => u.id === id)!.name;

export const MEMBERS = [
  { id: "dana", unit: "permit", kind: "person", name: "Dana Brooks", role: "Permit center manager" },
  { id: "ep", unit: "zoning", kind: "person", name: "EP", role: "Zoning reviewer" },
  { id: "leo", unit: "fire", kind: "person", name: "Leo Grant", role: "Deputy fire marshal (unit admin)" },
  { id: "marcus", unit: "fire", kind: "person", name: "Marcus Hill", role: "Fire plans examiner", manager: "leo" },
  { id: "rosa", unit: "fire", kind: "person", name: "Rosa Kim", role: "Fire plans examiner", manager: "leo" },
  {
    id: "precheck",
    unit: "fire",
    kind: "agent",
    name: "Plan pre-check agent",
    role: "Plan pre-check",
    manager: "leo",
    config: {
      budget: { monthly_usd: 150, used_usd: 84 },
      approval: "member_required", // anything that leaves the unit or changes an entity
      triggers: ["submission", "resubmission"],
    },
  },
  { id: "jt", unit: "building", kind: "person", name: "JT", role: "Building reviewer" },
  { id: "priya", unit: "utilities", kind: "person", name: "Priya Nair", role: "Utilities reviewer" },
  { id: "tom", unit: "inspections", kind: "person", name: "Tom Reyes", role: "Building inspector" },
  { id: "northline", unit: "public", kind: "person", name: "Northline Homes", role: "Applicant" },
  { id: "cedarco", unit: "public", kind: "person", name: "Cedar & Co. Builders", role: "Applicant" },
  { id: "harborpoint", unit: "public", kind: "person", name: "Harbor Point Development", role: "Applicant" },
  { id: "quaypartners", unit: "public", kind: "person", name: "Quay Street Partners", role: "Applicant" },
  { id: "alvarez", unit: "public", kind: "person", name: "R. Alvarez", role: "Applicant" },
  { id: "birchwood", unit: "public", kind: "person", name: "Birchwood Contracting", role: "Applicant" },
] as const;
const APPLICANTS = MEMBERS.filter((m) => m.unit === "public");
const person = (id: string): Person => {
  const m = MEMBERS.find((x) => x.id === id)!;
  return { member_id: m.id, name: m.name, role: m.role };
};

export const FIELDS: { key: string; label: string; type: string; owner: UnitId }[] = [
  // Permit center
  { key: "project", label: "Project", type: "text", owner: "permit" },
  { key: "address", label: "Address", type: "text", owner: "permit" },
  { key: "applicant", label: "Applicant", type: "person", owner: "permit" },
  { key: "submitted_at", label: "Submitted", type: "date", owner: "permit" },
  { key: "valuation", label: "Valuation", type: "money", owner: "permit" },
  { key: "fees", label: "Fees", type: "text", owner: "permit" },
  { key: "intake_review", label: "Intake", type: "review_status", owner: "permit" },
  { key: "holder", label: "Holding it now", type: "text", owner: "permit" },
  { key: "resubmit_by", label: "Resubmit by", type: "date", owner: "permit" },
  { key: "review_cycle", label: "Review cycle", type: "text", owner: "permit" },
  // Review units
  { key: "zoning_review", label: "Zoning review", type: "review_status", owner: "zoning" },
  { key: "utilities_review", label: "Utilities review", type: "review_status", owner: "utilities" },
  { key: "building_review", label: "Building review", type: "review_status", owner: "building" },
  { key: "building_notes", label: "Building reviewer notes", type: "text", owner: "building" },
  { key: "inspections_status", label: "Inspections", type: "review_status", owner: "inspections" },
  // Fire prevention
  { key: "fire_review", label: "Fire review", type: "review_status", owner: "fire" },
  { key: "fire_corrections", label: "Fire corrections", type: "corrections", owner: "fire" },
  { key: "sprinkler_determination", label: "Sprinkler determination", type: "determination", owner: "fire" },
  { key: "fire_flow", label: "Fire flow", type: "text", owner: "fire" },
  { key: "hydrant_distance", label: "Nearest hydrant", type: "text", owner: "fire" },
  { key: "occupancy", label: "Occupancy", type: "text", owner: "fire" },
  { key: "storeys", label: "Storeys", type: "text", owner: "fire" },
  { key: "fire_code", label: "Fire code", type: "text", owner: "fire" },
  { key: "fire_site_conditions", label: "Fire conditions to verify on site", type: "corrections", owner: "fire" },
  { key: "fire_reviewer", label: "Fire reviewer", type: "person", owner: "fire" },
  { key: "fire_notes", label: "Fire internal notes", type: "text", owner: "fire" },
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

const INTERNAL_REVIEWERS: UnitId[] = ["zoning", "fire", "building", "utilities", "inspections"];

function interfaces(): Iface[] {
  const out: Iface[] = [];
  // Permit center shares the application basics with every reviewing unit and the applicant.
  for (const to of INTERNAL_REVIEWERS) {
    for (const key of ["project", "address", "submitted_at", "holder", "resubmit_by", "review_cycle", "intake_review"]) {
      out.push({ from: "permit", to, key, level: "full", trigger: "on_change" });
    }
    out.push({ from: "permit", to, key: "applicant", level: "summary", trigger: "on_change" });
    out.push({ from: "permit", to, key: "fees", level: "status", trigger: "on_change" });
  }
  // Fees depend on valuation, so Building gets it at full detail. The financial marking caps that.
  out.push({ from: "permit", to: "building", key: "valuation", level: "full", trigger: "on_change" });
  for (const key of ["project", "address", "applicant", "submitted_at", "holder", "resubmit_by", "fees", "intake_review"]) {
    out.push({ from: "permit", to: "public", key, level: "full", trigger: "on_change" });
  }
  out.push({ from: "permit", to: "public", key: "valuation", level: "full", trigger: "on_change" });

  // Zoning, Utilities, Building and Inspections report status to the Permit center and a headline to the applicant.
  const reviewKeys: [UnitId, string][] = [
    ["zoning", "zoning_review"],
    ["utilities", "utilities_review"],
    ["building", "building_review"],
    ["inspections", "inspections_status"],
  ];
  for (const [from, key] of reviewKeys) {
    out.push({ from, to: "permit", key, level: "summary", trigger: "on_change" });
    out.push({ from, to: "public", key, level: "headline", trigger: "on_change" });
    for (const to of INTERNAL_REVIEWERS) if (to !== from) out.push({ from, to, key, level: "status", trigger: "on_change" });
  }

  // Fire prevention: exactly the brief's seed table.
  out.push(
    {
      from: "fire",
      to: "public",
      key: "fire_corrections",
      level: "summary",
      trigger: "review_complete",
      label: "Corrections to pass fire review",
      example: "Show a second exit stairway for floors 3 and 4 on your plans",
    },
    {
      from: "fire",
      to: "building",
      key: "fire_corrections",
      level: "full",
      trigger: "on_change",
      label: "Items that overlap the building code",
      example: "Sprinkler system NFPA 13R; egress width per comment 4",
    },
    {
      from: "fire",
      to: "permit",
      key: "fire_review",
      level: "status",
      trigger: "on_change+daily",
      label: "Status and days in queue",
      example: "In review, day 6 of 10",
    },
    {
      from: "fire",
      to: "inspections",
      key: "fire_site_conditions",
      level: "full",
      trigger: "on_approval",
      label: "Fire conditions to verify on site",
      example: "Verify alarm panel location at rough-in",
    },
    {
      from: "fire",
      to: "public",
      key: "fire_review",
      level: "headline",
      trigger: "on_change",
      label: "Fire review status",
      example: "Fire review: changes requested",
    },
    // The one seeded suggestion. Approving it turns it active; "Approve as summary" sets level to summary.
    {
      from: "fire",
      to: "building",
      key: "sprinkler_determination",
      level: "full",
      trigger: "on_change",
      status: "suggested",
      label: "Sprinkler determination",
      example: "Sprinkler system NFPA 13R",
      note: "Building plan review asks about sprinkler requirements on 40% of mid-rise applications. Send them the sprinkler determination at full detail as soon as you make it?",
    },
  );
  return out;
}

export const MARKINGS = [
  {
    id: "mk_financial",
    target_kind: "field",
    field: "valuation",
    label: "Contains applicant financial data",
    rule: { allowed_units: ["permit"], max_level_others: "status" },
  },
];

// ---------------------------------------------------------------------------
// Applications

const NAMED: { ref: string; project: string; address: string; holder: Holder }[] = [
  { ref: DEMO_REF, project: "12-unit apartment building", address: "1840 Alder St", holder: "fire" },
  { ref: "BP-2027-0369", project: "Warehouse addition", address: "1200 Industrial Way", holder: "building" },
  { ref: "BP-2027-0381", project: "Restaurant fit-out", address: "88 Front St", holder: "fire" },
  { ref: "BP-2027-0402", project: "Tenant improvement, suite 300", address: "220 Harbor Ave", holder: "zoning" },
  { ref: "BP-2027-0397", project: "Single-family home", address: "77 Cedar Ln", holder: "applicant" },
  { ref: "BP-2027-0390", project: "4-storey mixed use", address: "510 Quay St", holder: "fire" },
  { ref: "BP-2027-0375", project: "Duplex", address: "302 Spruce Ave", holder: "utilities" },
  { ref: "BP-2027-0388", project: "Detached garage", address: "19 Birch Pl", holder: "permit" },
];

type Holder = "permit" | "zoning" | "fire" | "building" | "utilities" | "applicant";
/** Who holds the 186 open applications. Fire prevention holds the most: it's the bottleneck. */
const HOLDERS: Record<Holder, number> = { fire: 52, building: 41, zoning: 33, permit: 24, utilities: 20, applicant: 16 };
/** 14 blocked between units, 6 of them waiting on Fire prevention. */
const BLOCKED_ON: Partial<Record<Holder, number>> = { fire: 6, building: 4, zoning: 2, utilities: 2 };
/** Review cycles averaging 1.9 (58×1, 96×2, 26×3, 6×4 = 352 / 186). */
const CYCLES: [number, number][] = [
  [1, 58],
  [2, 96],
  [3, 26],
  [4, 6],
];
export const TOTAL_OPEN = 186;

const PROJECTS = [
  "Single-family home", "Duplex", "Detached garage", "Deck and stairs", "Kitchen remodel", "Basement suite",
  "Tenant improvement", "Restaurant fit-out", "Retail fit-out", "Warehouse addition", "Office renovation",
  "Townhouse row (6 units)", "4-storey mixed use", "Daycare conversion", "Medical clinic fit-out",
  "Solar array, rooftop", "Accessory dwelling unit", "Church hall addition", "Brewery taproom", "Self-storage building",
];
const STREETS = [
  "Alder St", "Cedar Ln", "Spruce Ave", "Birch Pl", "Harbor Ave", "Front St", "Quay St", "Industrial Way",
  "Maple Dr", "Ferry Rd", "Lighthouse Rd", "Pier St", "Dockside Blvd", "Kelp Ct", "Gull Way", "Tidewater Ave",
];
const MIDRISE = new Set(["12-unit apartment building", "4-storey mixed use", "Townhouse row (6 units)"]);

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

/** Days open for 186 applications, median exactly 38 (target is 30). */
function daysOpenList(): number[] {
  const lower = Array.from({ length: 93 }, (_, i) => Math.round(3 + (i * 35) / 92)); // 3..38
  const upper = Array.from({ length: 93 }, (_, i) => Math.round(38 + (i * 40) / 92)); // 38..78
  return [...lower, ...upper];
}

const REVIEW_UNITS: { unit: UnitId; key: string }[] = [
  { unit: "zoning", key: "zoning_review" },
  { unit: "utilities", key: "utilities_review" },
  { unit: "fire", key: "fire_review" },
  { unit: "building", key: "building_review" },
];

type Values = Record<string, unknown>;

function demoStory(): Values {
  return {
    project: "12-unit apartment building",
    address: "1840 Alder St",
    applicant: person("northline"),
    submitted_at: "2027-01-06",
    valuation: 4_200_000,
    fees: "Paid in full",
    intake_review: { unit: "Permit center", state: "complete", since: "2027-01-06" } satisfies ReviewStatus,
    holder: "Fire prevention",
    resubmit_by: "2027-01-19",
    review_cycle: 1,
    zoning_review: { unit: "Zoning", state: "approved", since: "2027-01-10", note: "Approved after 4 days" } satisfies ReviewStatus,
    utilities_review: { unit: "Utilities", state: "approved", since: "2027-01-12" } satisfies ReviewStatus,
    building_review: {
      unit: "Building plan review",
      state: "waiting",
      waiting_on: "fire",
      waiting_on_name: "Fire prevention",
      since: "2027-01-14",
      note: "Egress width depends on the sprinkler determination",
    } satisfies ReviewStatus,
    building_notes: "Egress width per comment 4 can't be confirmed until Fire decides on NFPA 13R. Everything else is ready to approve.",
    inspections_status: { unit: "Inspections", state: "not_started" } satisfies ReviewStatus,
    fire_review: {
      unit: "Fire prevention",
      state: "changes_requested",
      day: 6,
      of: 10,
      since: "2027-01-15",
      note: "2 corrections sent to the applicant",
    } satisfies ReviewStatus,
    fire_corrections: [
      {
        n: 1,
        title: "Second exit stairway required for floors 3 and 4",
        code: "Fire code 1006.3.4",
        plain: "Show a second exit stairway for floors 3 and 4 on your plans.",
      },
      {
        n: 2,
        title: "Fire alarm control panel location does not meet local amendment",
        code: "Local amendment 907.6",
        plain: "Move the fire alarm panel next to the main entrance and show it on your plans.",
      },
    ] satisfies Correction[],
    sprinkler_determination: {
      subject: "Sprinkler system",
      state: "pending",
      proposed: "NFPA 13R",
      since: "2027-01-14",
      note: "Building plan review needs this to confirm egress width",
    } satisfies Determination,
    fire_flow: "1,750 gal/min",
    hydrant_distance: "48 m (within limit)",
    occupancy: "R-2",
    storeys: "4",
    fire_code: "2024 fire code plus local amendments",
    fire_site_conditions: [
      { n: 1, title: "Verify alarm panel location at rough-in", plain: "An inspector will check the alarm panel location at rough-in." },
    ] satisfies Correction[],
    fire_reviewer: person("marcus"),
    fire_notes:
      "Pre-check agent flagged the exit count on Jan 7, before review started. Applicant's architect says the revised stair layout is ready.",
  };
}

function generated(
  i: number,
  r: () => number,
  o: { project: string; address: string; holder: Holder; daysOpen: number; cycle: number; blockedOn: Holder | null },
): Values {
  const submitted = addDays(DEMO_TODAY, -o.daysOpen);
  const applicant = APPLICANTS[1 + (i % (APPLICANTS.length - 1))]; // Northline owns only the demo story
  const v: Values = {
    project: o.project,
    address: o.address,
    applicant: person(applicant.id),
    submitted_at: submitted,
    valuation: Math.round((20_000 + r() * (MIDRISE.has(o.project) ? 6_000_000 : 900_000)) / 1000) * 1000,
    fees: r() < 0.9 ? "Paid in full" : "Balance due",
    intake_review: { unit: "Permit center", state: o.holder === "permit" ? "in_review" : "complete", since: submitted },
    holder: o.holder === "applicant" ? "Applicant" : unitName(o.holder),
    review_cycle: o.cycle,
    inspections_status: { unit: "Inspections", state: "not_started" },
    fire_reviewer: person(i % 2 ? "marcus" : "rosa"),
    fire_flow: `${(1000 + Math.round(r() * 15) * 100).toLocaleString("en-US")} gal/min`,
    hydrant_distance: `${20 + Math.round(r() * 70)} m`,
    storeys: String(MIDRISE.has(o.project) ? 3 + Math.round(r() * 2) : 1 + Math.round(r())),
  };
  const changesFrom = REVIEW_UNITS[Math.floor(r() * REVIEW_UNITS.length)].unit;
  for (const { unit, key } of REVIEW_UNITS) {
    const name = unitName(unit);
    let s: ReviewStatus;
    if (o.holder === "permit") s = { unit: name, state: "not_started" };
    else if (o.holder === unit) s = { unit: name, state: "in_review", day: 1 + Math.floor(r() * 9), of: 10, since: addDays(DEMO_TODAY, -Math.floor(r() * 9)) };
    else if (o.holder === "applicant") s = unit === changesFrom ? { unit: name, state: "changes_requested", since: addDays(DEMO_TODAY, -2) } : { unit: name, state: "approved" };
    else s = r() < 0.6 ? { unit: name, state: "approved" } : { unit: name, state: "in_review", day: 1 + Math.floor(r() * 9), of: 10 };
    v[key] = s;
  }
  if (o.blockedOn) {
    // Someone else is waiting on the holder. Building waits on Fire; everyone else waits on Building.
    const waiter = o.blockedOn === "fire" ? "building_review" : o.blockedOn === "building" ? "fire_review" : "building_review";
    const waiterUnit = REVIEW_UNITS.find((u) => u.key === waiter)!.unit;
    v[waiter] = {
      unit: unitName(waiterUnit),
      state: "waiting",
      waiting_on: o.blockedOn,
      waiting_on_name: unitName(o.blockedOn as UnitId),
      since: addDays(DEMO_TODAY, -1 - Math.floor(r() * 5)),
    } satisfies ReviewStatus;
  }
  if (o.holder === "applicant") v.resubmit_by = addDays(DEMO_TODAY, 3 + Math.floor(r() * 7));
  const fire = v.fire_review as ReviewStatus;
  v.fire_corrections =
    fire.state === "changes_requested"
      ? [{ n: 1, title: "Exit signage missing on egress plan", code: "Fire code 1013.1", plain: "Add exit signs to your egress plan." }]
      : [];
  if (MIDRISE.has(o.project)) {
    v.sprinkler_determination = { subject: "Sprinkler system", state: r() < 0.5 ? "pending" : "decided", proposed: "NFPA 13R", decision: "NFPA 13R required" };
    v.occupancy = "R-2";
  } else {
    v.occupancy = o.project.includes("home") || o.project.includes("Duplex") ? "R-3" : "B";
  }
  return v;
}

export function buildApplications(): { ref: string; values: Values }[] {
  const r = rng(418);
  // One holder slot per application, named ones first.
  const holderSlots: Holder[] = [];
  const remaining = { ...HOLDERS };
  for (const n of NAMED) remaining[n.holder]--;
  for (const [h, count] of Object.entries(remaining) as [Holder, number][]) for (let k = 0; k < count; k++) holderSlots.push(h);
  const holders = shuffle(holderSlots, r);

  let days = shuffle(daysOpenList(), r);
  // The demo story was submitted Jan 6: 10 days open.
  days.splice(days.indexOf(10), 1);
  let cycles = shuffle(CYCLES.flatMap(([c, n]) => Array<number>(n).fill(c)), r);
  cycles.splice(cycles.indexOf(1), 1);

  const apps: { ref: string; values: Values }[] = [{ ref: DEMO_REF, values: demoStory() }];
  const blockedLeft = { ...BLOCKED_ON, fire: (BLOCKED_ON.fire ?? 0) - 1 }; // the demo story is one of Fire's 6
  let seq = 0;
  const next = () => {
    const ref = `BP-2027-${String(200 + seq * 1).padStart(4, "0")}`;
    seq++;
    return ref;
  };
  const used = new Set(NAMED.map((n) => n.ref));
  const rows = [
    ...NAMED.slice(1).map((n) => ({ ...n })),
    ...holders.map((holder, k) => {
      let ref = next();
      while (used.has(ref)) ref = next();
      used.add(ref);
      return {
        ref,
        project: PROJECTS[Math.floor(r() * PROJECTS.length)],
        address: `${10 + Math.floor(r() * 2400)} ${STREETS[(k * 7) % STREETS.length]}`,
        holder,
      };
    }),
  ];
  rows.forEach((row, i) => {
    let blockedOn: Holder | null = null;
    if ((blockedLeft[row.holder] ?? 0) > 0) {
      blockedOn = row.holder;
      blockedLeft[row.holder]!--;
    }
    apps.push({
      ref: row.ref,
      values: generated(i, r, { ...row, daysOpen: days[i], cycle: cycles[i], blockedOn }),
    });
  });
  days = [];
  cycles = [];
  return apps;
}

// ---------------------------------------------------------------------------

export async function seed(db: Db): Promise<void> {
  const existing = await db.query<{ n: number }>("select count(*)::int as n from org");
  if (existing.rows[0].n > 0) return;

  const q = (sql: string, params: unknown[]) => db.query(sql, params);
  await q("insert into org (id, name, config) values ($1, $2, $3)", [
    ORG,
    "City of Harborview",
    JSON.stringify({ demo_today: DEMO_TODAY, targets: { days_to_permit: 30, review_days: 10 }, baselines: { review_cycles: 2.8 } }),
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
    PERMIT_TYPE,
    ORG,
    "Permit application",
    JSON.stringify({ fields: FIELDS.map((f) => f.key) }),
  ]);
  for (const f of FIELDS) {
    await q("insert into field (id, entity_type_id, key, label, type, owner_unit_id) values ($1, $2, $3, $4, $5, $6)", [
      `f_${f.key}`,
      PERMIT_TYPE,
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

  // Bulk insert applications: one statement per table.
  const apps = buildApplications();
  const entityRows: unknown[] = [];
  const valueRows: unknown[] = [];
  for (const a of apps) {
    const id = `e_${a.ref}`;
    entityRows.push([id, PERMIT_TYPE, a.ref, `${a.values.submitted_at}T09:00:00Z`]);
    for (const [key, value] of Object.entries(a.values)) {
      const owner = FIELDS.find((f) => f.key === key)!.owner;
      const by = MEMBERS.find((m) => m.unit === owner && m.kind === "person")!.id;
      valueRows.push([id, `f_${key}`, JSON.stringify(value), by]);
    }
  }
  await q(
    `insert into entity (id, entity_type_id, external_ref, created_at)
     select a, b, c, d from json_to_recordset($1::json) as x(a text, b text, c text, d timestamptz)`,
    [JSON.stringify(entityRows.map(([a, b, c, d]: any) => ({ a, b, c, d })))],
  );
  await q(
    `insert into field_value (entity_id, field_id, value_json, updated_by)
     select a, b, c::jsonb, d from json_to_recordset($1::json) as x(a text, b text, c text, d text)`,
    [JSON.stringify(valueRows.map(([a, b, c, d]: any) => ({ a, b, c, d })))],
  );
  await q(
    `insert into audit_event (actor_member_id, action, target, detail, at)
     values ('precheck', 'agent_finding', $1, $2, '2027-01-07T09:14:00Z')`,
    [DEMO_REF, JSON.stringify({ finding: "Exit count: floors 3 and 4 have one exit stairway", status: "approved", approved_by: "marcus" })],
  );
}
