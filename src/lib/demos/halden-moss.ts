// Halden & Moss Architects: a fictional 200-person architecture firm. The story is set on Dec 6,
// 2026: the Riverside Library facade changed to terracotta fins, so Sustainability's energy model
// misses Dec 5. That holds up the Civic studio's design package to the client on Dec 12, which
// puts Visualization's renders for the library board on Dec 15 at risk. The principals are
// quietly in talks to acquire a landscape architecture firm.
import type { DemoPack, Team, Person, Ownership, Item, StoryItem, Req, Com, Qn, Conn, SourceDoc, Mtg } from "./types";

const TEAMS: Team[] = [
  { id: "leadership", name: "Principals", parent: null, color: "#3f3f46", description: "Set the firm's direction, win work and sign off on fees." },
  { id: "studios", name: "Studios", parent: "leadership", color: "#1d4ed8", description: "The design studios.", group: true },
  { id: "practice", name: "Practice", parent: "leadership", color: "#0e7490", description: "Sustainability, design technology and visualization.", group: true },
  { id: "business", name: "Business", parent: "leadership", color: "#a16207", description: "Business development and operations.", group: true },
  { id: "civic", name: "Civic studio", parent: "studios", color: "#1d4ed8", description: "Libraries, schools and public buildings, including the Riverside Library." },
  { id: "workplace", name: "Workplace studio", parent: "studios", color: "#4338ca", description: "Offices, headquarters and interiors." },
  { id: "healthcare", name: "Healthcare studio", parent: "studios", color: "#be123c", description: "Clinics, hospitals and medical planning." },
  { id: "sustain", name: "Sustainability", parent: "practice", color: "#15803d", description: "Energy and daylight modeling, LEED and embodied carbon.", turnaround: "3 business days" },
  { id: "dtech", name: "Design technology", parent: "practice", color: "#0e7490", description: "BIM standards, Revit, computational design and software." },
  { id: "viz", name: "Visualization", parent: "practice", color: "#7c3aed", description: "Renderings, animations and VR walkthroughs." },
  { id: "bd", name: "Business development", parent: "business", color: "#c2410c", description: "Proposals, interviews, awards and marketing." },
  { id: "ops", name: "Operations", parent: "business", color: "#a16207", description: "Project accounting, IT, people and the firm's offices." },
];

// [user id, name, title, team, role]
const PEOPLE: Person[] = [
  ["claire", "Claire Halden", "Founding principal", "leadership", "lead"],
  ["james", "James Moss", "Principal", "leadership", "member"],
  ["anika", "Anika Rao", "Managing principal", "leadership", "member"],
  ["robert", "Robert Lindgren", "Design principal", "studios", "lead"],
  ["mei", "Mei Tan", "Director of practice", "practice", "lead"],
  ["sophie", "Sophie Laurent", "Director of business", "business", "lead"],
  ["tobias", "Tobias Weber", "Civic studio leader", "civic", "lead"],
  ["laura", "Laura Chen", "Project architect", "civic", "member"],
  ["kwame", "Kwame Asante", "Architect", "civic", "member"],
  ["ines", "Inès Moreau", "Designer", "civic", "member"],
  ["daniel", "Daniel Cho", "Workplace studio leader", "workplace", "lead"],
  ["fatima", "Fatima Rahimi", "Interior designer", "workplace", "member"],
  ["ryan", "Ryan Gallagher", "Project architect", "workplace", "member"],
  ["margaret", "Margaret Doyle", "Healthcare studio leader", "healthcare", "lead"],
  ["arjun", "Arjun Nair", "Healthcare planner", "healthcare", "member"],
  ["olga", "Olga Petrova", "Project architect", "healthcare", "member"],
  ["hugo", "Hugo Berg", "Sustainability director", "sustain", "lead"],
  ["priya", "Priya Venkat", "Building performance analyst", "sustain", "member"],
  ["sam", "Sam Whitaker", "Sustainability consultant", "sustain", "member"],
  ["noor", "Noor Haddad", "Design technology lead", "dtech", "lead"],
  ["felix", "Felix Wagner", "BIM manager", "dtech", "member"],
  ["kai", "Kai Yamamoto", "Computational designer", "dtech", "member"],
  ["elise", "Elise Martin", "Visualization lead", "viz", "lead"],
  ["marco", "Marco Bianchi", "3D artist", "viz", "member"],
  ["zara", "Zara Ahmed", "Visualization artist", "viz", "member"],
  ["rebecca", "Rebecca Stone", "Business development director", "bd", "lead"],
  ["omar", "Omar Farid", "Proposal manager", "bd", "member"],
  ["lily", "Lily Evans", "Marketing coordinator", "bd", "member"],
  ["nathan", "Nathan Cole", "Operations director", "ops", "lead"],
  ["paula", "Paula Jensen", "Project accountant", "ops", "member"],
  ["victor", "Victor Lam", "IT manager", "ops", "member"],
  ["chloe", "Chloe Adams", "People and HR manager", "ops", "member"],
];

// [id, team, title, description, owner user, keywords]
const OWNS: Ownership[] = [
  ["own_riverside", "civic", "Riverside Library", "The Riverside Library project, from design development to permit", "laura", ["riverside", "library", "design development", "dd package"]],
  ["own_schools", "civic", "School projects", "K-12 schools and the Harbor School addition", "kwame", ["school", "classroom", "k-12"]],
  ["own_specs", "civic", "Specifications", "Specifications and product selections", "ines", ["specification", "specs", "product", "materials"]],
  ["own_hq", "workplace", "Headquarters projects", "Corporate headquarters and office fit-outs", "daniel", ["headquarters", "office", "fit-out", "workplace"]],
  ["own_interiors", "workplace", "Interiors and furniture", "Finishes, furniture and interior packages", "fatima", ["interiors", "furniture", "finishes"]],
  ["own_ca", "workplace", "Construction administration", "Site visits, RFIs and submittals", "ryan", ["construction administration", "site visit", "rfi", "submittal"]],
  ["own_clinics", "healthcare", "Clinic and hospital planning", "Medical planning for clinics and hospitals", "arjun", ["hospital", "clinic", "patient", "medical planning"]],
  ["own_hc_codes", "healthcare", "Healthcare codes", "Infection control and healthcare code reviews", "olga", ["infection control", "healthcare code", "fgi"]],
  ["own_energy", "sustain", "Energy modeling", "Energy and daylight models and facade performance", "priya", ["energy", "model", "modeling", "eui", "daylight", "facade performance"]],
  ["own_leed", "sustain", "LEED and certifications", "LEED, WELL and green building certifications", "sam", ["leed", "certification", "well", "gold"]],
  ["own_carbon", "sustain", "Embodied carbon", "Whole-building life-cycle assessments", "hugo", ["carbon", "embodied", "lca"]],
  ["own_bim", "dtech", "BIM standards and Revit", "Revit templates, families and model standards", "felix", ["bim", "revit", "template", "families", "model standards"]],
  ["own_comp", "dtech", "Computational design", "Grasshopper and Dynamo scripts and tools", "kai", ["grasshopper", "dynamo", "computational", "script", "parametric"]],
  ["own_licenses", "dtech", "Software and licenses", "Design software, licenses and the file server", "noor", ["software", "license", "licenses", "rhino", "server"]],
  ["own_renders", "viz", "Renderings", "Still renderings for clients, boards and competitions", "marco", ["render", "renders", "rendering", "still", "image"]],
  ["own_anim", "viz", "Animations and VR", "Flythroughs and VR walkthroughs", "zara", ["animation", "flythrough", "vr", "walkthrough"]],
  ["own_farm", "viz", "Render farm", "The render farm and its queue", "elise", ["render farm", "gpu", "queue"]],
  ["own_proposals", "bd", "Proposals and interviews", "RFQs, RFPs, shortlists and interviews", "omar", ["proposal", "rfp", "rfq", "interview", "shortlist"]],
  ["own_awards", "bd", "Awards and publications", "Award submissions and press", "lily", ["award", "awards", "publication", "press"]],
  ["own_clients", "bd", "Client relationships", "Key clients and the pursuit pipeline", "rebecca", ["client relationship", "pursuit", "pipeline"]],
  ["own_fees", "ops", "Project accounting", "Fees, invoices, utilization and fee burn", "paula", ["fee", "fees", "invoice", "billing", "utilization"]],
  ["own_it", "ops", "IT", "Laptops, VPN, printers and plotters", "victor", ["laptop", "vpn", "printer", "plotter"]],
  ["own_hr", "ops", "People and hiring", "Hiring, benefits and licensure support", "chloe", ["hiring", "hr", "benefits", "licensure", "onboarding"]],
  ["own_firm", "ops", "Offices and firm growth", "Office leases and the firm's growth plan", "nathan", ["acquisition", "merger", "lease", "growth plan"]],
  ["own_strategy", "leadership", "Firm priorities", "The firm's strategy and markets", "anika", ["priority", "priorities", "strategy", "markets"]],
];

const FOLLOWS: Record<string, string[]> = {
  sustain: ["civic", "workplace", "healthcare", "viz", "leadership"],
  civic: ["viz", "sustain", "bd", "dtech", "leadership"],
  workplace: ["sustain", "bd", "leadership"],
  healthcare: ["bd", "sustain", "leadership"],
  dtech: ["civic", "workplace", "healthcare", "viz", "leadership"],
  viz: ["bd", "civic", "leadership"],
  bd: ["civic", "workplace", "healthcare", "leadership"],
  ops: ["bd", "leadership"],
  leadership: ["civic", "workplace", "healthcare", "sustain", "dtech", "viz", "bd", "ops"],
};

const ITEMS: Record<string, Item[]> = {
  civic: [
    ["progress", "Riverside Library schematic design was approved by the client on Oct 16.", ["sustain", "viz", "bd"]],
    ["progress", "The Harbor School addition reached 50% construction documents.", ["dtech"]],
    ["decision", "The client chose terracotta fins over the glass facade after the November review.", ["sustain", "viz"]],
    ["risk", "The client's cost consultant flagged the terracotta as 4% over the facade budget; we're looking at fin spacing.", ["sustain", "leadership"]],
    ["ask", "We need Visualization to hold render farm time for the library board presentation.", ["viz"]],
    ["progress", "Community open house for the library drew 220 residents; the reading room was the favorite space.", ["bd", "viz"]],
  ],
  workplace: [
    ["progress", "The Calder headquarters fit-out is 70% through construction administration.", ["bd"]],
    ["decision", "We're standardizing on three furniture dealers to cut lead times.", ["ops"]],
    ["progress", "Won the Ashby Group office renovation, 60,000 square feet.", ["bd", "leadership"]],
    ["ask", "We need a daylight study for the Calder HQ open office.", ["sustain"]],
    ["progress", "Punch list for floors 3 and 4 at Calder is closed.", []],
  ],
  healthcare: [
    ["progress", "The Westside clinic opened on schedule; patient wait areas tested well in the first survey.", ["bd"]],
    ["decision", "Every healthcare project now gets an infection control review at 50% design development.", ["sustain"]],
    ["progress", "Finished the medical planning study for the county's urgent care network.", ["bd", "leadership"]],
    ["risk", "Two experienced healthcare planners are needed for next year's work; hiring hasn't started.", ["ops", "leadership"]],
    ["progress", "Published our healthcare design guide internally.", ["dtech"]],
  ],
  sustain: [
    ["progress", "Embodied carbon for the Harbor School addition is 28% below our baseline.", ["civic", "leadership"]],
    ["decision", "Every project over 50,000 square feet gets an energy model at schematic design.", ["civic", "workplace", "healthcare"]],
    ["progress", "Two staff passed the LEED AP exam this month.", ["ops"]],
    ["ask", "Studios: send facade changes to Sustainability as soon as the client approves them.", ["civic", "workplace", "healthcare"]],
    ["progress", "The September energy model for Riverside Library met the targets with the glass facade.", ["civic"]],
  ],
  dtech: [
    ["progress", "Moved all active projects to the cloud model server; opening large models is 3x faster.", ["civic", "workplace", "healthcare"]],
    ["decision", "Revit 2027 becomes the firm standard for new projects starting in January.", ["civic", "workplace", "healthcare", "viz"]],
    ["progress", "Kai's facade fin script cut Riverside Library fin modeling from two days to two hours.", ["civic", "sustain"]],
    ["risk", "Rhino licenses run out in February; renewal needs a budget owner's sign-off.", ["ops"]],
    ["progress", "Published the new Revit template and families for 2027.", ["civic", "workplace", "healthcare"]],
  ],
  viz: [
    ["progress", "Delivered 14 renders for the Ashby Group interview; we won the project.", ["bd", "workplace"]],
    ["decision", "Board and client presentations get render farm priority over competitions.", ["bd", "civic"]],
    ["progress", "The render farm upgrade halved average render times.", ["civic", "workplace", "healthcare"]],
    ["ask", "Studios: book render farm time at least two weeks before a presentation.", ["civic", "workplace", "healthcare"]],
    ["progress", "Started a VR walkthrough library for client reviews.", ["civic", "healthcare"]],
  ],
  bd: [
    ["progress", "Submitted 6 proposals in October; 3 shortlisted.", ["leadership"]],
    ["decision", "We only chase public RFQs where we have a relevant project in the last five years.", ["civic", "healthcare"]],
    ["progress", "The Harbor School project was published in Architectural Review Weekly.", ["civic"]],
    ["ask", "Studios: send project photos for the 2027 awards season by Dec 11.", ["civic", "workplace", "healthcare"]],
    ["progress", "Pipeline for 2027 is $14M in fees, up from $11M last year.", ["leadership", "ops"]],
  ],
  ops: [
    ["progress", "Firm-wide utilization was 78% in October.", ["leadership"]],
    ["decision", "Expense reports now go through the new app; paper receipts end Dec 31.", []],
    ["progress", "Moved the plotter room to the 4th floor.", []],
    ["risk", "The Q4 fee forecast is late because two studios haven't updated fee burn.", ["leadership", "civic", "healthcare"]],
    ["ask", "Project architects: update fee burn for every active project by Dec 8.", ["civic", "workplace", "healthcare"]],
  ],
  leadership: [
    ["decision", "Priorities for 2027: civic and healthcare growth first, design technology second, a second office third.", ["civic", "healthcare", "dtech"]],
    ["decision", "Hiring stays flat in Q1 except for two healthcare planners.", ["healthcare", "ops"]],
    ["progress", "The firm retreat is set for Jan 22.", []],
    ["progress", "All-staff design review moves to the last Friday of each month.", []],
  ],
};

const STORY: StoryItem[] = [
  ["sustain", 5, "answer", "Riverside Library is targeting LEED Gold and an energy use intensity of 38, which the original glass facade met in the September model.",
    "Riverside Library is targeting LEED Gold and an energy use intensity of 38.", "Library targets LEED Gold.", ["civic", "bd"], null, "answer_leed"],
  ["civic", 6, "decision", "We decided the Riverside Library design development package goes to the client on Dec 12 with the terracotta fin facade, so the library board sees the final design on Dec 15.",
    "The Riverside Library design package goes to the client Dec 12, with the terracotta facade.", "Library design package planned for Dec 12.", ["viz", "sustain", "bd"], null, "dd_decision"],
  ["sustain", 7, "risk", "The facade moved to terracotta fins after the client review, so the Riverside Library energy and daylight model has to be rebuilt and will miss Dec 5. The September results no longer apply.",
    "The Riverside Library energy model will miss Dec 5; it's being rebuilt for the new facade.", "Library energy model delayed.", ["civic", "viz"], null, "model_late"],
  ["sustain", 7, "progress", "Daylight results for the Harbor School addition are in: every classroom meets the daylight target.",
    "Every Harbor School classroom meets the daylight target.", "School daylight targets met.", ["civic"], null, "school_daylight"],
  ["civic", 7, "risk", "The Riverside design package depends on the new energy model: the client's sustainability consultant won't sign off on the facade without it.",
    "The Riverside design package depends on Sustainability's energy model.", "Library package depends on another team.", ["sustain", "viz"], null, "dd_dep"],
  ["viz", 7, "risk", "The Dec 15 board presentation renders (6 stills and a 90-second flythrough) need the final facade, and each render takes two days on the farm.",
    "The Dec 15 board renders depend on the final library facade.", "Board renders planned for Dec 15.", ["civic", "bd"], null, "renders_dep"],
  ["ops", 7, "progress", "Talks to acquire Fernhill Landscape, a 35-person landscape architecture firm, are in due diligence. If they close, Fernhill's team joins on April 1 and keeps its studio.",
    "Talks to bring a landscape architecture team into the firm are in due diligence.", "Exploring a new landscape practice.", ["leadership"], "mk_conf", "fernhill"],
];

const REQS: Req[] = [
  ["rq_energy", "civic", "sustain", "tobias", "Rebuild the Riverside Library energy and daylight model for the terracotta facade",
    "The client approved terracotta fins. The design package goes out Dec 12. Can Sustainability rerun the model by Dec 5?", "2026-11-20", "2026-12-05", "accepted", "own_energy", "priya", null, "form"],
  ["rq_when_1", "civic", "sustain", "laura", "When will the energy model be ready now that the date is moving?",
    "Asked the Sustainability agent. The client's consultant is waiting on it.", "2026-12-04", null, "open", "own_energy", "priya", "ck_model_date", "agent"],
  ["rq_when_2", "viz", "sustain", "elise", "Is the library energy model still landing this week? Our board renders depend on the facade.",
    "Asked the Sustainability agent.", "2026-12-05", null, "open", "own_energy", "priya", "ck_model_date", "agent"],
  ["rq_when_3", "bd", "sustain", "rebecca", "The library board chair asked about energy performance. When will the model be done?",
    "Asked the Sustainability agent.", "2026-12-05", null, "open", "own_energy", "priya", "ck_model_date", "agent"],
  ["rq_daylight", "workplace", "sustain", "fatima", "Can Sustainability run a daylight study for the Calder HQ open office?",
    "We'd like results before the furniture layout is final.", "2026-12-05", "2026-12-16", "open", "own_energy", "priya", "ck_daylight", "form"],
  ["rq_areas", "bd", "dtech", "omar", "Can we get a script that exports area schedules into the proposal template?",
    "Asked the Design technology agent. We retype areas for every proposal.", "2026-12-04", null, "open", "own_comp", "kai", "ck_areas", "agent"],
  ["rq_vr", "civic", "viz", "kwame", "Can we get a VR walkthrough of the library reading room for the board?",
    "The board chair asked to stand in the reading room.", "2026-12-05", "2026-12-15", "open", "own_anim", "zara", "ck_vr", "form"],
  ["rq_rhino", "dtech", "ops", "noor", "Who signs off on the Rhino license renewal?",
    "Licenses run out in February.", "2026-12-03", null, "open", "own_fees", "paula", "ck_rhino", "form"],
];

const COMS: Com[] = [
  ["cm_energy", "sustain", "priya", "civic", "Riverside Library energy and daylight model for the new facade", "2026-12-05", "open", "request", "rq_energy", null,
    "The facade changed to terracotta fins, so the model is being rebuilt (Sustainability's Dec 4 update).", null],
  ["cm_dd", "civic", "laura", "viz", "Riverside Library design development package to the client", "2026-12-12", "open", "update_item", "ui_dd_decision", "cm_energy", null, null],
  ["cm_renders", "viz", "elise", "bd", "Renders and flythrough for the library board presentation", "2026-12-15", "open", "manual", null, "cm_dd", null, null],
  ["cm_fees", "ops", "paula", "leadership", "Q4 fee forecast to the principals", "2026-12-03", "open", "manual", null, null, "Waiting on updated fee burn from two studios.", null],
  ["cm_awards", "bd", "lily", "leadership", "Awards submission for the Harbor School addition", "2026-12-11", "open", "manual", null, null, null, null],
  ["cm_revit", "dtech", "felix", "civic", "Revit 2027 template rollout", "2026-12-18", "open", "manual", null, null, null, null],
  ["cm_farm", "dtech", "noor", "viz", "Render farm GPU upgrade", "2026-11-25", "done", "manual", null, null, null, "2026-11-24"],
  ["cm_urgent", "healthcare", "arjun", "bd", "Urgent care network planning study", "2026-12-02", "done", "manual", null, null, null, "2026-12-01"],
];

const QS: Qn[] = [
  ["qn_1", "kwame", "sustain", "What LEED rating is the Riverside Library targeting?", "answered",
    "Riverside Library is targeting LEED Gold and an energy use intensity of 38.", ["update_item:ui_answer_leed"], null, "2026-11-25"],
  ["qn_2", "zara", "civic", "Is the library facade terracotta or glass?", "answered",
    "The client chose terracotta fins over the glass facade after the November review.", [], null, "2026-11-30"],
  ["qn_3", "ryan", "dtech", "Which Revit version should new projects use?", "answered", "Revit 2027 becomes the firm standard for new projects starting in January.", [], null, "2026-11-19"],
  ["qn_4", "laura", "sustain", "When will the energy model be ready now that the date is moving?", "routed",
    "Sustainability hasn't published a new date. I asked Priya Venkat, who owns Energy modeling.", [], "rq_when_1", "2026-12-04"],
  ["qn_5", "elise", "sustain", "Is the library energy model still landing this week?", "routed",
    "Sustainability hasn't published a new date. I asked Priya Venkat, who owns Energy modeling.", [], "rq_when_2", "2026-12-05"],
  ["qn_6", "rebecca", "sustain", "When will the model be done?", "routed",
    "Sustainability hasn't published a new date. I asked Priya Venkat, who owns Energy modeling.", [], "rq_when_3", "2026-12-05"],
  ["qn_7", "omar", "dtech", "Can we export area schedules into the proposal template?", "routed",
    "Design technology hasn't published anything on this. I asked Kai Yamamoto, who owns Computational design.", [], "rq_areas", "2026-12-04"],
  ["qn_8", "arjun", "viz", "How far ahead should we book the render farm?", "answered", "Book render farm time at least two weeks before a presentation.", [], null, "2026-11-12"],
];

const CONNECTORS: Conn[] = [
  ["cn_sus_slack", "sustain", "slack", "#sustainability", "hugo"],
  ["cn_sus_drive", "sustain", "gdrive", "Energy models", "priya"],
  ["cn_sus_zoom", "sustain", "zoom", "Zoom", "hugo"],
  ["cn_civ_slack", "civic", "slack", "#civic-studio", "tobias"],
  ["cn_civ_drive", "civic", "gdrive", "Riverside Library project files", "laura"],
  ["cn_civ_zoom", "civic", "zoom", "Zoom", "tobias"],
  ["cn_viz_slack", "viz", "slack", "#viz", "elise"],
  ["cn_viz_notion", "viz", "notion", "Render schedule", "elise"],
  ["cn_viz_zoom", "viz", "zoom", "Zoom", "elise"],
  ["cn_dt_conf", "dtech", "confluence", "BIM standards", "felix"],
  ["cn_dt_gh", "dtech", "github", "haldenmoss/design-tools", "kai"],
  ["cn_bd_hubspot", "bd", "hubspot", "Pursuits pipeline", "rebecca"],
  ["cn_bd_slack", "bd", "slack", "#bd", "rebecca"],
  ["cn_wp_slack", "workplace", "slack", "#workplace-studio", "daniel"],
  ["cn_hc_slack", "healthcare", "slack", "#healthcare-studio", "margaret"],
  ["cn_ops_drive", "ops", "gdrive", "Operations", "nathan"],
  ["cn_lead_drive", "leadership", "gdrive", "Principals", "anika"],
  ["cn_lead_zoom", "leadership", "zoom", "Zoom", "anika"],
];

const DOCS: SourceDoc[] = [
  // Sustainability
  ["cn_sus_drive", "doc", null, "Riverside Library energy model, v3 (terracotta)", "Rebuilding the facade with 300 terracotta fins at 450 mm spacing. Early runs show cooling load down about 9% against the glass facade. Glazing schedule still needed from Civic studio.", null, "Priya Venkat", "2026-12-04T15:00:00Z"],
  ["cn_sus_drive", "doc", null, "Riverside Library targets", "LEED Gold, energy use intensity 38, daylight autonomy of 55% in the reading room.", null, "Sam Whitaker", "2026-11-02T10:00:00Z"],
  ["cn_sus_slack", "message", null, "Priya Venkat in #sustainability", "Kai's fin script got the facade into the model in two hours instead of two days. Running the full annual simulation overnight.", null, "Priya Venkat", "2026-12-04T21:10:00Z"],
  ["cn_sus_slack", "message", null, "Sam Whitaker in #sustainability", "Overnight run finished. Reading room daylight is 58%, above target. Energy use looks like it lands near 36.", null, "Sam Whitaker", "2026-12-05T08:40:00Z"],
  ["cn_sus_slack", "message", null, "Hugo Berg in #sustainability", "Let's not give Civic a date until we have the final glazing schedule. Tentatively Dec 9.", null, "Hugo Berg", "2026-12-05T09:05:00Z"],
  // Civic
  ["cn_civ_drive", "doc", null, "Riverside Library DD package checklist", "Drawings 85% done. Outstanding: energy model sign-off, facade cost check, final glazing schedule. Package due to the client Dec 12.", null, "Laura Chen", "2026-12-04T10:00:00Z"],
  ["cn_civ_slack", "message", null, "Laura Chen in #civic-studio", "The client's consultant won't sign off on the facade until they see the new energy numbers. Everything else in the package is on track.", null, "Laura Chen", "2026-12-05T10:00:00Z"],
  ["cn_civ_slack", "message", null, "Tobias Weber in #civic-studio", "If the model lands Dec 9 we can still send the package Dec 12. Inès, can you finish the glazing schedule by Monday?", null, "Tobias Weber", "2026-12-05T11:30:00Z"],
  // Visualization
  ["cn_viz_notion", "doc", null, "Render schedule: Riverside board presentation", "6 stills and a 90-second flythrough for the board on Dec 15. Farm booked Dec 12 to 14. Needs the final facade model by Dec 11.", null, "Elise Martin", "2026-12-02T10:00:00Z"],
  ["cn_viz_slack", "message", null, "Marco Bianchi in #viz", "I can start the interior stills now. The exterior shots need the final fins.", null, "Marco Bianchi", "2026-12-05T12:00:00Z"],
  ["cn_viz_slack", "message", null, "Elise Martin in #viz", "If the facade isn't final by Dec 11 we show the board interiors plus one exterior and send the rest after.", null, "Elise Martin", "2026-12-05T14:00:00Z"],
  // Design technology
  ["cn_dt_conf", "doc", null, "Revit 2027 template notes", "New template with updated families and view standards. Projects starting in January use it.", null, "Felix Wagner", "2026-11-20T10:00:00Z"],
  ["cn_dt_gh", "pr", "#48", "Facade fin generator for Riverside Library", "Grasshopper definition that places terracotta fins from a spacing rule and exports them to Revit and the energy model.", "Merged", "Kai Yamamoto", "2026-12-03T19:00:00Z"],
  // BD, ops
  ["cn_bd_hubspot", "doc", null, "Riverside Library board presentation", "Board of trustees meeting Dec 15, 6 pm. The chair wants to see the reading room and energy performance.", null, "Rebecca Stone", "2026-12-03T10:00:00Z"],
  ["cn_bd_slack", "message", null, "Omar Farid in #bd", "Two new library RFQs came in this week. Riverside will be our lead reference.", null, "Omar Farid", "2026-12-05T13:00:00Z"],
  ["cn_ops_drive", "doc", null, "Q4 fee forecast (draft)", "Waiting on fee burn updates from the Civic and Healthcare studios.", null, "Paula Jensen", "2026-12-03T10:00:00Z"],
  // Confidential
  ["cn_ops_drive", "doc", null, "Fernhill Landscape due diligence", "35 people, $6.2M revenue. Due diligence on finances and leases through January. If it closes, the team joins April 1.", null, "Nathan Cole", "2026-12-02T10:00:00Z", "mk_conf"],
  ["cn_lead_drive", "doc", null, "Fernhill integration plan (draft)", "Keep Fernhill's studio and name for a year. Their team moves onto our Revit standards by June.", null, "Anika Rao", "2026-12-04T10:00:00Z", "mk_conf"],
];

const T1 = `Hugo Berg: Thanks for joining. The topic is the Riverside Library energy model and the terracotta facade.
Priya Venkat: Status first. Kai's script got the fins into the model, and last night's run looks good. Reading room daylight is above target.
Tobias Weber: What does that do to Dec 5? The package goes to the client Dec 12, and the board meets Dec 15.
Priya Venkat: Dec 5 is gone. If we get the final glazing schedule on Monday, we can deliver the model by Dec 9.
Hugo Berg: Let's not promise a date until we have the glazing schedule. I'll confirm the new date with Civic by Dec 8.
Inès Moreau: I'll send the final glazing schedule by Dec 7.
Tobias Weber: Then the decision is we keep Dec 12 for the package, and only move it if the model slips past Dec 9.
Hugo Berg: Agreed. Visualization should hear this before they lock the render schedule.
Laura Chen: I'll tell the client's consultant the new numbers are coming by Dec 9.
Priya Venkat: One more thing: Workplace wants a daylight study for Calder. That can start after Riverside.`;

const T2 = `Elise Martin: This is prep for the Riverside Library board presentation on Dec 15.
Marco Bianchi: Interior stills are underway. Exterior shots wait on the final fins.
Laura Chen: The facade is waiting on a new date. Sustainability's model moved, so the package date depends on it.
Elise Martin: Then let's decide now: if the facade isn't final by Dec 11 we show interiors and one exterior, and send the rest after.
Rebecca Stone: Agreed, that's the decision. Zara, can you have the reading room walkthrough ready either way?
Zara Ahmed: Yes, I'll have the walkthrough ready by Dec 13.
Marco Bianchi: Farm time is booked Dec 12 to 14.
Rebecca Stone: The board chair asked about energy. I'll brief her by Dec 10.`;

const T3 = `Claire Halden: Two topics: the 2027 plan and Fernhill.
Anika Rao: Fernhill Landscape is in due diligence. 35 people, about $6.2 million in revenue.
Nathan Cole: Their lease runs to 2029, so they'd keep their studio. Finance and lease review runs through January.
Claire Halden: Decision: we go ahead with due diligence, and nothing about Fernhill goes beyond the principals and operations until we sign.
James Moss: I'll meet Fernhill's founders again by Dec 18.
Anika Rao: I'll draft the integration plan for the retreat by Jan 15.
Nathan Cole: We still need the Q4 fee forecast before we can model the combined firm.`;

const MEETINGS: Mtg[] = [
  ["mt_facade", "sustain", "cn_sus_zoom", "Sustainability × Civic: Riverside facade and energy model", "2026-12-04T16:00:00Z", 30, ["hugo", "priya", "tobias", "laura", "ines"], T1, "recorded", null, null],
  ["mt_board", "viz", "cn_viz_zoom", "Riverside board presentation prep", "2026-12-05T17:00:00Z", 25, ["elise", "marco", "zara", "laura", "rebecca"], T2, "summarized", null, {
    summary: "The board presentation is on track except for exterior renders, which wait on the final facade and Sustainability's energy model rerun. If the facade isn't final by Dec 11, the board sees interiors and one exterior.",
    decisions: ["If the facade isn't final by Dec 11, show the board interiors and one exterior, and send the rest after."],
    risks: ["Exterior renders depend on Sustainability's energy model; Dec 12 may move."],
    action_items: [
      { owner: "zara", text: "Finish the reading room walkthrough", due: "2026-12-13" },
      { owner: "rebecca", text: "Brief the board chair on energy performance", due: "2026-12-10" },
    ],
    by: "Offline writer",
  }],
  ["mt_principals", "leadership", "cn_lead_zoom", "Principals' meeting", "2026-12-03T17:00:00Z", 45, ["claire", "james", "anika", "nathan"], T3, "summarized", "mk_conf", {
    summary: "Fernhill Landscape (35 people) is in due diligence through January. Nothing about it goes beyond the principals and operations until signing.",
    decisions: ["Continue due diligence on Fernhill Landscape; keep it within the principals and operations until signing."],
    risks: ["Modeling the combined firm is blocked on the Q4 fee forecast."],
    action_items: [
      { owner: "james", text: "Meet Fernhill's founders", due: "2026-12-18" },
      { owner: "anika", text: "Draft the integration plan for the retreat", due: "2027-01-15" },
    ],
    by: "Offline writer",
  }],
];

export const haldenMoss: DemoPack = {
  id: "architecture",
  hidden: true,
  audience: "Architecture firm",
  org: { name: "Halden & Moss Architects", short: "Halden & Moss", headcount: 200, domain: "haldenmoss", about: "a fictional 200-person architecture firm with civic, workplace and healthcare studios" },
  summary:
    "Sustainability reruns the energy model for a new facade, and the visualization team two teams away hears the new date the same day.",
  defaultPersona: "zara",
  teams: TEAMS,
  people: PEOPLE,
  alsoOnLeadership: ["robert", "mei", "sophie"],
  owns: OWNS,
  follows: FOLLOWS,
  interfaceOverrides: [
    { from: "sustain", to: "civic", level: "full", cadence: "immediate" },
    { from: "ops", to: "leadership", level: "full", allKinds: true },
    { from: "civic", to: "viz", cadence: "immediate" },
  ],
  markings: [{ id: "mk_conf", label: "Confidential: Principals and Operations only", allowed: ["leadership", "ops"], othersLevel: "summary" }],
  items: ITEMS,
  story: STORY,
  requests: REQS,
  confidentialRequests: [
    {
      id: "rq_fernhill", from: "ops", to: "dtech", requester: "nathan",
      title: "Software licenses and server space for 35 people from Fernhill Landscape",
      details: "If the Fernhill Landscape acquisition closes, 35 people join April 1. What would Revit, Rhino and file server capacity cost for them? Needed for due diligence by Dec 18.",
      summaryTitle: "Software licenses and server space for about 35 more people",
      summaryDetails: "Operations needs the cost of Revit, Rhino and file server capacity for about 35 more people from April, by Dec 18.",
      headline: "Operations asked Design technology about license costs",
      neededBy: "2026-12-18", ownership: "own_licenses", assignee: "noor", marking: "mk_conf", cluster: "ck_fernhill", created: "2026-12-03T14:00:00Z",
    },
  ],
  commitments: COMS,
  questions: QS,
  connectors: CONNECTORS,
  docs: DOCS,
  meetings: MEETINGS,
  agentSpend: { sustain: 64, civic: 47, bd: 31 },
  task: {
    id: "tr_civic_client",
    unit: "civic",
    requestedBy: "laura",
    title: "What has the client said about the facade and energy targets?",
    instructions: "Pull together what the library client and their consultant have said about the facade, cost and energy targets, and what Sustainability has published. I need it for the package cover letter.",
    steps: [
      { at: "2026-12-05T14:00:00Z", kind: "start", text: "Started for Laura Chen." },
      { at: "2026-12-05T14:00:20Z", kind: "read", text: "Read the Riverside Library package checklist and project files." },
      { at: "2026-12-05T14:00:40Z", kind: "read", text: "Read #civic-studio from the last two weeks." },
      { at: "2026-12-05T14:01:30Z", kind: "read", text: "Read what Sustainability has published about Riverside (at Civic studio's level)." },
      { at: "2026-12-05T14:02:10Z", kind: "done", text: "Wrote a brief with 3 findings." },
    ],
    result:
      "## What the client has said\n\n- **They chose terracotta.** The client picked terracotta fins over glass at the November review.\n- **Cost is close.** Their cost consultant flagged the facade at 4% over budget; fin spacing is being studied.\n- **Energy sign-off is the gate.** Their sustainability consultant won't approve the facade without the new model.\n\n## What Sustainability has published\n\nThe targets are LEED Gold and an energy use intensity of 38. The new model missed Dec 5 and has no published date yet.\n\n## Recommendation\n\nSay in the cover letter that energy results follow under separate cover if the model isn't final by Dec 12.",
    sources: [{ title: "Riverside Library DD package checklist" }, { title: "#civic-studio" }, { title: "Riverside Library targets" }],
    at: "2026-12-05T14:00:00Z",
    doneAt: "2026-12-05T14:02:10Z",
  },
  ui: {
    writeExamples: {
      sustain: `Sustainability weekly, Dec 6
- Rebuilt the Riverside Library facade in the energy model with the terracotta fins.
- First results show the fins cut cooling load by 9%, so LEED Gold still holds.
- We'll deliver the Riverside Library energy model by Dec 9.
- Can Civic studio send the final glazing schedule by Monday?`,
      civic: `Civic studio weekly
- Riverside Library drawings are 85% done.
- We still need Sustainability's energy model before the client's consultant signs off on the facade.
- We'll send the design development package to the client by Dec 12.`,
      viz: `Visualization weekly
- Interior stills for the library board are underway.
- If the facade isn't final by Dec 11 we'll show interiors and one exterior, and send the rest after.`,
    },
    askExamples: {
      sustain: "When will the library energy model be ready?",
      civic: "Is the library facade terracotta or glass?",
      viz: "How far ahead should we book the render farm?",
    },
    searchHint: 'Try "energy modeling", "Revit" or a name',
    researchHint: "How have other libraries used terracotta fins to cut cooling loads?",
    sampleSessions: {
      dtech: {
        repo: "haldenmoss/design-tools",
        branch: "feat/area-export",
        prompts: ["Write a script that exports Revit area schedules into the proposal template", "Handle gross and net areas separately"],
        notes: ["Area export works for gross and net areas and writes straight into the proposal template.", "Business development can try it on the next RFQ."],
        commits: ["2b3c4d5 Export Revit area schedules to the proposal template", "6e7f8a9 Split gross and net areas"],
        diffstat: "6 files changed, 241 insertions(+), 15 deletions(-)",
      },
    },
  },
  intro: {
    problem:
      "The client chose terracotta fins for the Riverside Library facade, so Sustainability is rerunning its energy model. The design package due Dec 12 uses that model, and the renders for the library board on Dec 15 use the package. Here's how the firm stays in step.",
    cast: [
      { as: "zara", note: "Makes the board renders due Dec 15, and builds on work from two other teams." },
      { as: "priya", note: "Owns the energy model and its new date." },
      { as: "claire", note: "Wants the firm's week on one page." },
    ],
  },
  agentTemplate: {
    team: "sustain",
    name: "Energy code researcher",
    firstJob: "Review the energy model inputs for the terracotta facade",
    purpose: "Research energy code and LEED requirements for each project, check model inputs against the targets, and draft the weekly Sustainability update.",
    actions: ["research", "documents", "draft_update"],
  },
  guide: [
    { title: "Start the day in your feed", as: "zara", href: "/feed",
      text: "Under Dates that are changing, the board renders show Waiting on a change. Beacon traces them to the energy model, which is being rerun for the new facade. Below are decisions from teams Zara follows.",
      why: "Zara sees what changed for the renders the day it changes, without asking around." },
    { title: "Ask your agent", as: "zara", href: "/feed?agent=When+will+the+library+energy+model+be+ready%3F&to=me",
      text: "The agent panel on the right has the question filled in. Press Send. Your agent sees that Sustainability owns it and asks Sustainability's agent. The new date isn't posted yet, so it goes to Priya, and 3 others asked too.",
      why: "Nobody has to find the right analyst, and Priya gets one question instead of four separate messages." },
    { title: "Add an agent teammate", as: "priya", href: "/agents/new?template=demo",
      text: "Priya adds Energy code researcher, a Worker for Sustainability. It's filled in: what it can read, what it can do and what needs Priya's OK. Click Add, then click \"Review the energy model inputs for the terracotta facade\" in the chat and Approve.",
      why: "Priya's team gets a researcher that checks model inputs against the targets, so reruns start from the right numbers." },
    { title: "Post the new date", as: "priya", href: "/write?example=1",
      text: "Priya's notes are filled in. Click Split into items. At the top, Beacon flags that one line moves the Dec 5 promise to Dec 9. Scroll down and click Publish.",
      why: "Priya writes the notes once. Beacon works out who's affected and updates the promise." },
    { title: "Everyone gets the new date", as: "zara", href: "/feed?agent=When+will+the+library+energy+model+be+ready%3F&to=me",
      text: "Back as Zara, the panel has the same question ready. Send it. This time your agent answers straight from Priya's update, with the source. The Inbox in the sidebar has the new date too.",
      why: "Civic studio and Visualization both get the news without a coordination meeting." },
    { title: "See the week on one page", as: "claire", href: "/digest", compare: "zara",
      text: "Claire sees one short paragraph per team, plus every date that is changing. The Operations paragraph mentions a possible acquisition, so it's marked confidential. Open the page as Zara: that paragraph isn't there.",
      why: "Principals get the whole picture, and confidential work stays with the people cleared to see it." },
  ],
  explore: [
    { title: "Answer four people at once", as: "priya", href: "/asks", text: "Four questions about the same date, merged into one. Answer once and everyone who asked gets the reply." },
    { title: "Turn a meeting into updates", as: "priya", href: "/meetings/mt_facade", text: "Summarize the Sustainability × Civic meeting. Beacon writes the decisions and turns each action item into a commitment for its owner." },
    { title: "Meet every agent teammate", as: "priya", href: "/agents", text: "Every team's built-in agent plus the teammates teams added: Q&A agents that answer, and Workers that research, review documents or change code. Message any of them." },
    { title: "See how teams depend on each other", as: "claire", href: "/map", text: "Who owes whom, and who is asking whom, across the firm." },
    { title: "Check who saw what", as: "claire", href: "/audit", text: "Every read, share and answer, including what each agent read and for whom." },
  ],
  checks: {
    search: { q: "energy modeling", team: "sustain", owns: "Energy modeling" },
    feed: { as: "zara", decision: "ui_dd_decision", atRisk: "cm_renders" },
    slipped: { as: "laura", team: "civic", commitment: "cm_energy", reason: "terracotta" },
    revise: { as: "priya", team: "sustain", commitment: "cm_energy", due: "2026-12-09", notify: ["laura", "zara"] },
    digest: { allowed: "claire", denied: "zara", marking: "mk_conf", slipped: ["cm_energy", "cm_fees"] },
    route: { as: "zara", team: "sustain", question: "When will the library energy model be ready?", owner: "priya", cluster: "ck_model_date", askers: 4 },
    answer: { as: "kwame", team: "sustain", question: "What LEED rating is the Riverside Library targeting?", contains: "LEED Gold", source: "update_item:ui_answer_leed" },
    leak: { as: "felix", team: "ops", question: "Is the firm acquiring Fernhill Landscape?", secret: "Fernhill" },
  },
};
