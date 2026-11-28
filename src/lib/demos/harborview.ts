// City of Harborview: a fictional mid-size city with about 1,100 staff. The story is set on Dec 6,
// 2026: the Elm Street water main misses Dec 5 because replacement valves arrived damaged, which
// blocks Transportation's repaving on Dec 10-12, which puts the Winter Lights festival on Dec 18 at
// risk. The City attorney is quietly negotiating a flood-damage claim over the October main break.
import type { DemoPack, Team, Person, Ownership, Item, StoryItem, Req, Com, Qn, Conn, SourceDoc, Mtg } from "./types";

const TEAMS: Team[] = [
  { id: "leadership", name: "City manager's office", parent: null, color: "#3f3f46", description: "Runs the city's departments and carries out the council's priorities." },
  { id: "infrastructure", name: "Infrastructure", parent: "leadership", color: "#1d4ed8", description: "Public works and transportation.", group: true },
  { id: "community", name: "Community services", parent: "leadership", color: "#15803d", description: "Parks, events and 311.", group: true },
  { id: "development", name: "Development services", parent: "leadership", color: "#6d28d9", description: "Planning, permits and building inspections.", group: true },
  { id: "administration", name: "Administration", parent: "leadership", color: "#a16207", description: "Finance, IT, communications and the City attorney.", group: true },
  { id: "publicworks", name: "Public works", parent: "infrastructure", color: "#1d4ed8", description: "Water mains, streets, snow removal, fleet and city facilities.", turnaround: "3 business days" },
  { id: "transport", name: "Transportation", parent: "infrastructure", color: "#0e7490", description: "Paving, traffic signals, road closures and the bike lane plan." },
  { id: "parks", name: "Parks and events", parent: "community", color: "#15803d", description: "City parks, recreation programs and special events such as Winter Lights." },
  { id: "service311", name: "311 Constituent services", parent: "community", color: "#0f766e", description: "The 311 line: resident calls, cases and answers." },
  { id: "permits", name: "Planning and permits", parent: "development", color: "#7c3aed", description: "Building permits, zoning and building inspections." },
  { id: "finance", name: "Finance and budget", parent: "administration", color: "#a16207", description: "The city budget, procurement and grants." },
  { id: "it", name: "IT", parent: "administration", color: "#4338ca", description: "City systems, the online permit portal, maps and GIS." },
  { id: "comms", name: "Communications", parent: "administration", color: "#c2410c", description: "Public notices, the website, social media and council communications." },
  { id: "legal", name: "City attorney", parent: "administration", color: "#52525b", description: "Claims, contract review and litigation." },
];

// [user id, name, title, team, role]
const PEOPLE: Person[] = [
  ["angela", "Angela Ruiz", "City manager", "leadership", "lead"],
  ["david", "David Osei", "Deputy city manager", "leadership", "member"],
  ["lin", "Lin Zhao", "Assistant to the city manager", "leadership", "member"],
  ["frank", "Frank Moreau", "Director of infrastructure", "infrastructure", "lead"],
  ["rosa", "Rosa Delgado", "Director of community services", "community", "lead"],
  ["priyanka", "Priyanka Desai", "Director of development services", "development", "lead"],
  ["gregory", "Gregory Hale", "Director of administration", "administration", "lead"],
  ["tomas", "Tomás Reyes", "Public works director", "publicworks", "lead"],
  ["nadia", "Nadia Kowalski", "Water systems engineer", "publicworks", "member"],
  ["owen", "Owen Fletcher", "Construction inspector", "publicworks", "member"],
  ["bianca", "Bianca Torres", "Fleet and facilities manager", "publicworks", "member"],
  ["jamal", "Jamal Wright", "Street maintenance supervisor", "publicworks", "member"],
  ["helen", "Helen Park", "Transportation manager", "transport", "lead"],
  ["carlos", "Carlos Mendes", "Traffic engineer", "transport", "member"],
  ["ruth", "Ruth Adeyemi", "Paving program manager", "transport", "member"],
  ["sven", "Sven Larsen", "Active transportation planner", "transport", "member"],
  ["monica", "Monica Bell", "Parks and events manager", "parks", "lead"],
  ["eli", "Eli Navarro", "Events coordinator", "parks", "member"],
  ["tara", "Tara Quinn", "Recreation programs supervisor", "parks", "member"],
  ["yusuf", "Yusuf Ali", "Parks maintenance lead", "parks", "member"],
  ["denise", "Denise Carter", "311 manager", "service311", "lead"],
  ["kevin", "Kevin Huang", "311 agent", "service311", "member"],
  ["amina", "Amina Diallo", "311 agent", "service311", "member"],
  ["paul", "Paul Novak", "Resident case specialist", "service311", "member"],
  ["sarah", "Sarah Kim", "Planning manager", "permits", "lead"],
  ["mohammed", "Mohammed Rahman", "Permit technician", "permits", "member"],
  ["julia", "Julia Brandt", "Senior planner", "permits", "member"],
  ["leo", "Leo Costa", "Building inspector", "permits", "member"],
  ["patricia", "Patricia Owens", "Finance director", "finance", "lead"],
  ["ivan", "Ivan Petrov", "Budget analyst", "finance", "member"],
  ["chen", "Chen Wei", "Procurement officer", "finance", "member"],
  ["rachel", "Rachel Stone", "IT director", "it", "lead"],
  ["ahmed", "Ahmed Farouk", "Systems administrator", "it", "member"],
  ["nina", "Nina Ivanova", "GIS analyst", "it", "member"],
  ["derek", "Derek Shaw", "Applications developer", "it", "member"],
  ["lauren", "Lauren Price", "Communications director", "comms", "lead"],
  ["ben", "Ben Ortiz", "Public information officer", "comms", "member"],
  ["hana", "Hana Sato", "Digital media specialist", "comms", "member"],
  ["victoria", "Victoria Hughes", "City attorney", "legal", "lead"],
  ["simon", "Simon Grant", "Deputy city attorney", "legal", "member"],
  ["ella", "Ella Brooks", "Risk and claims manager", "legal", "member"],
];

// [id, team, title, description, owner user, keywords]
const OWNS: Ownership[] = [
  ["own_mains", "publicworks", "Water mains", "Water main replacement, hydrants and planned shutoffs", "nadia", ["water", "main", "mains", "valve", "valves", "trench", "elm", "pipe", "hydrant", "shutoff"]],
  ["own_streets", "publicworks", "Street maintenance", "Potholes, sidewalks and snow removal", "jamal", ["pothole", "potholes", "sidewalk", "snow", "plow", "salt"]],
  ["own_inspections", "publicworks", "Inspections and asset records", "Inspection and repair history for city infrastructure", "owen", ["inspection", "records", "asset", "repair history"]],
  ["own_fleet", "publicworks", "Fleet and facilities", "City vehicles, buildings and event power hookups", "bianca", ["fleet", "vehicle", "facility", "power", "hookup", "generator"]],
  ["own_paving", "transport", "Paving program", "Street repaving and crosswalk markings", "ruth", ["paving", "repave", "repaving", "resurface", "asphalt", "crosswalk", "crosswalks"]],
  ["own_signals", "transport", "Traffic signals and closures", "Signals, road closures and detours", "carlos", ["signal", "traffic", "closure", "detour", "lane closure"]],
  ["own_bike", "transport", "Bike lane plan", "Bike lanes and pedestrian safety", "sven", ["bike", "cycling", "pedestrian", "active transportation"]],
  ["own_events", "parks", "Special events", "Winter Lights, the farmers market and event permits", "eli", ["event", "festival", "winter lights", "vendor", "vendors", "market"]],
  ["own_rec", "parks", "Recreation programs", "Classes, camps and the community pools", "tara", ["recreation", "program", "camp", "class", "pool"]],
  ["own_parks", "parks", "Parks maintenance", "Trees, playgrounds and sports fields", "yusuf", ["park", "tree", "playground", "field"]],
  ["own_cases", "service311", "Resident cases", "311 cases and follow-ups with residents", "paul", ["case", "complaint", "resident", "follow-up"]],
  ["own_kb", "service311", "311 answers", "The scripts and answers 311 agents give callers", "denise", ["script", "knowledge base", "faq", "callers"]],
  ["own_permits", "permits", "Building permits", "Permit applications and plan review", "mohammed", ["permit", "building permit", "application", "plan review"]],
  ["own_zoning", "permits", "Zoning and land use", "The zoning code, variances and rezoning", "julia", ["zoning", "land use", "variance", "rezoning"]],
  ["own_bldg", "permits", "Building inspections", "Code and occupancy inspections", "leo", ["building inspection", "occupancy", "code"]],
  ["own_budget", "finance", "City budget", "The annual budget and mid-year adjustments", "patricia", ["budget", "forecast", "overtime", "mid-year"]],
  ["own_proc", "finance", "Procurement", "Bids, purchase orders and vendor contracts", "chen", ["procurement", "purchase", "bid", "rfp", "vendor contract"]],
  ["own_grants", "finance", "Grants", "State and federal grants", "ivan", ["grant", "federal", "state funding"]],
  ["own_portal", "it", "Permit portal", "The online permit portal and contractor accounts", "derek", ["portal", "online", "accounts", "password"]],
  ["own_gis", "it", "Maps and GIS", "City maps, GIS layers and the snow route map", "nina", ["map", "gis", "layer"]],
  ["own_systems", "it", "Systems and security", "Laptops, the network and phishing protection", "ahmed", ["laptop", "network", "security", "phishing"]],
  ["own_notices", "comms", "Public notices", "Closure notices, press releases and media", "ben", ["notice", "notices", "press", "media", "announcement"]],
  ["own_web", "comms", "Website and social media", "harborview.gov, social channels and the newsletter", "hana", ["website", "social", "post", "newsletter"]],
  ["own_council", "comms", "Council communications", "Council briefings and talking points", "lauren", ["council briefing", "talking points"]],
  ["own_claims", "legal", "Claims", "Damage claims against the city", "ella", ["claim", "claims", "damage", "liability", "insurance"]],
  ["own_contracts", "legal", "Contract review", "Agreements, leases and vendor contracts", "simon", ["contract review", "agreement", "lease"]],
  ["own_litigation", "legal", "Litigation", "Lawsuits and settlements", "victoria", ["lawsuit", "litigation", "settlement", "court"]],
  ["own_priorities", "leadership", "Council priorities", "The strategic plan and council goals", "lin", ["priority", "priorities", "strategic plan", "council goals"]],
];

const FOLLOWS: Record<string, string[]> = {
  publicworks: ["transport", "parks", "service311", "comms", "finance", "legal", "leadership"],
  transport: ["parks", "publicworks", "comms", "service311", "leadership"],
  parks: ["comms", "service311", "transport", "leadership"],
  service311: ["comms", "publicworks", "leadership"],
  permits: ["it", "publicworks", "leadership"],
  finance: ["publicworks", "it", "leadership"],
  it: ["permits", "service311", "leadership"],
  comms: ["service311", "parks", "leadership"],
  legal: ["leadership"],
  leadership: ["publicworks", "transport", "parks", "service311", "permits", "finance", "it", "comms", "legal"],
};

const ITEMS: Record<string, Item[]> = {
  publicworks: [
    ["progress", "Started the Elm Street water main replacement between 3rd and 7th Avenue after the Oct 14 main break.", ["transport", "service311"]],
    ["progress", "Fall leaf collection finished a week early; 1,840 tons collected.", ["service311"]],
    ["decision", "Snow routes now put bus routes and hospital access first, then school streets.", ["transport", "service311", "comms"]],
    ["progress", "Lead service line inventory is 92% complete; 140 lead lines are scheduled for replacement next year.", ["permits", "comms"]],
    ["risk", "Two of the six plow trucks are out for repairs; we'll rent two if they aren't back before the first storm.", ["finance", "transport"]],
    ["progress", "The snow route map is published with the new priorities.", ["service311", "it"]],
  ],
  transport: [
    ["progress", "Retimed 14 signals on Harbor Boulevard; average rush-hour travel time is down 11%.", ["service311"]],
    ["decision", "The bike lane plan's first phase covers Elm Street and 5th Avenue, painted with the repaving work.", ["publicworks", "comms"]],
    ["progress", "Resurfaced 6.2 lane-miles this season, 90% of the plan.", ["publicworks"]],
    ["risk", "Paving crews are booked solid until January; any project that slips moves to the spring.", ["publicworks", "parks"]],
    ["ask", "Departments with events that close streets in December: send us dates so we can plan detours.", ["parks", "comms"]],
    ["progress", "Speed humps are installed near Lincoln Elementary.", ["service311", "comms"]],
  ],
  parks: [
    ["progress", "Fall recreation enrollment reached 3,100, up 14% from last year.", ["comms"]],
    ["decision", "Winter Lights moves from Harbor Park to Elm Street this year, so the new downtown shops get the foot traffic.", ["transport", "comms", "publicworks"]],
    ["progress", "Signed 40 vendors for Winter Lights; 12 are new downtown businesses.", ["comms", "service311"]],
    ["progress", "Replaced the playground at Cedar Park; it reopens Saturday.", ["service311"]],
    ["ask", "We need two power hookups on Elm Plaza for Winter Lights vendors.", ["publicworks"]],
    ["progress", "The holiday pool schedule is posted.", ["service311", "comms"]],
  ],
  service311: [
    ["progress", "311 answered 9,400 calls in October; 82% were resolved on the first call.", ["leadership"]],
    ["risk", "Elm Street calls doubled this month; most callers want to know when the street reopens.", ["publicworks", "transport", "comms"]],
    ["decision", "311 now answers by text message as well as phone, starting Nov 2.", ["comms", "it"]],
    ["progress", "Average wait time is under two minutes for the first time this year.", []],
    ["ask", "We need one date for Elm Street that every department gives residents.", ["publicworks", "transport", "comms"]],
    ["progress", "Published 22 new answers in the 311 knowledge base, mostly about snow and leaf pickup.", ["publicworks"]],
  ],
  permits: [
    ["progress", "Permit review times averaged 11 business days in October, down from 16.", ["it"]],
    ["decision", "Small residential projects under $10,000 no longer need plan review.", ["comms", "it"]],
    ["progress", "The downtown zoning update draft went to council on Dec 1.", ["leadership", "comms"]],
    ["risk", "Contractors can't reset their own portal passwords, so the counter spends an hour a day on resets.", ["it"]],
    ["progress", "Building inspections now take same-week bookings online.", ["it", "service311"]],
  ],
  finance: [
    ["progress", "October close finished in six business days.", ["leadership"]],
    ["decision", "Purchases above $50,000 now need a second bid, even for repeat vendors.", ["publicworks", "parks", "it"]],
    ["progress", "Won a $1.8M state grant for lead service line replacement.", ["publicworks", "comms"]],
    ["risk", "Overtime in Public works is 22% over budget after the October main break.", ["publicworks", "leadership"]],
    ["ask", "Department heads: send revised overtime and fuel forecasts for the mid-year adjustment.", ["publicworks", "transport", "parks"]],
  ],
  it: [
    ["progress", "Moved 600 staff to the new email system with no downtime.", []],
    ["progress", "The permit portal pilot has 40 contractor accounts; launch for all contractors is planned for mid-December.", ["permits"]],
    ["decision", "Every city laptop gets multi-factor sign-in by January.", []],
    ["risk", "Phishing emails pretending to be the water department rose sharply after the Elm Street news.", ["publicworks", "comms", "service311"]],
    ["progress", "Published the Elm Street work zone as a GIS layer for 311 and Communications.", ["service311", "comms"]],
  ],
  comms: [
    ["progress", "The city newsletter reached 21,000 subscribers.", []],
    ["decision", "All road closures get a notice on the website, social media and door hangers at least five days ahead.", ["transport", "publicworks", "parks"]],
    ["progress", "The Winter Lights page is live and has had 8,000 visits.", ["parks"]],
    ["ask", "We need a firm reopening date for Elm Street before we mail notices to businesses.", ["publicworks", "transport"]],
    ["progress", "Media coverage of the main break has shifted from the flooding to the repair work.", ["publicworks", "leadership"]],
  ],
  legal: [
    ["progress", "Closed 18 small claims in October, mostly pothole damage.", ["publicworks"]],
    ["progress", "Reviewed the Winter Lights vendor agreement and insurance requirements.", ["parks"]],
    ["decision", "Damage claims under $5,000 are now settled by Risk management without council approval.", ["leadership", "finance"]],
  ],
  leadership: [
    ["decision", "Council priorities for 2027: infrastructure repair first, downtown revitalization second, permit speed third.", ["publicworks", "transport", "permits"]],
    ["progress", "The council's budget workshop is set for Dec 15.", ["finance"]],
    ["progress", "Department head meetings move to Tuesday mornings.", []],
    ["decision", "Hiring stays flat in Q1 except for two water system operators.", ["publicworks", "finance"]],
  ],
};

const STORY: StoryItem[] = [
  ["publicworks", 5, "answer", "Water service on Elm Street is shut off for up to four hours, only on the day each block connects to the new main. Residents get 48 hours' notice by door hanger.",
    "Residents lose water service on Elm Street for up to four hours per block, with 48 hours' notice.", "Short water shutoffs, with notice.", ["service311", "comms"], null, "answer_shutoff"],
  ["transport", 6, "decision", "We decided to repave Elm Street from 3rd to 7th Avenue on Dec 10 to 12, with raised crosswalks at 4th and 6th and the first painted bike lanes, so the street is ready for Winter Lights on Dec 18.",
    "Elm Street repaving is set for Dec 10 to 12, ahead of Winter Lights on Dec 18.", "Elm Street repaving planned for Dec 12.", ["parks", "comms", "service311"], null, "paving_decision"],
  ["publicworks", 7, "risk", "The replacement gate valves for the last block of the Elm Street water main arrived damaged, so the main can't be finished and the trench restored by Dec 5. New valves are on order.",
    "The Elm Street water main will miss Dec 5; new valves are on order.", "Elm Street water main delayed.", ["transport", "parks"], null, "valves_late"],
  ["publicworks", 7, "progress", "Pressure tests passed on the first four blocks of the new Elm Street main, and those blocks are back on city water.",
    "Four of five Elm Street blocks are on the new main.", "Most of Elm Street is on the new main.", ["service311"], null, "pressure"],
  ["transport", 7, "risk", "Elm Street repaving depends on Public works finishing the water main and restoring the trench. If paving misses Dec 12, crews can't be rebooked before January.",
    "Elm Street repaving depends on Public works' water main; crews can't be rebooked before January.", "Repaving depends on another project.", ["publicworks", "parks"], null, "paving_dep"],
  ["parks", 7, "risk", "Winter Lights on Dec 18 (Elm Street, 40 vendors, about 12,000 visitors expected) needs the street repaved and open. Moving it back to Harbor Park would take a week of replanning.",
    "Winter Lights on Dec 18 depends on Elm Street being repaved.", "Winter Lights planned for Dec 18.", ["transport", "comms"], null, "lights_dep"],
  ["legal", 7, "progress", "Bayside Lofts filed a $480,000 flood-damage claim over the Oct 14 Elm Street main break, saying the city knew the main was failing. We're negotiating before it becomes a lawsuit; the response is due Dec 21.",
    "A property owner filed a flood-damage claim over the October main break; we're negotiating.", "Claim filed over the October main break.", ["publicworks", "leadership"], "mk_conf", "bayside"],
];

const REQS: Req[] = [
  ["rq_main", "transport", "publicworks", "helen", "Finish the Elm Street water main and restore the trench before repaving",
    "Repaving is booked for Dec 10 to 12, ahead of Winter Lights. Can Public works finish the main and restore the trench by Dec 5?", "2026-11-20", "2026-12-05", "accepted", "own_mains", "nadia", null, "form"],
  ["rq_when_1", "transport", "publicworks", "ruth", "When will the Elm Street water main be finished now that Dec 5 is at risk?",
    "Asked the Public works agent. We need the new date to hold or move the paving crew.", "2026-12-04", null, "open", "own_mains", "nadia", "ck_main_date", "agent"],
  ["rq_when_2", "parks", "publicworks", "monica", "Is the Elm Street water main still finishing this week? Winter Lights depends on it.",
    "Asked the Public works agent.", "2026-12-05", null, "open", "own_mains", "nadia", "ck_main_date", "agent"],
  ["rq_when_3", "service311", "publicworks", "denise", "Residents keep calling about Elm Street. When will the water main work be done?",
    "Asked the Public works agent.", "2026-12-05", null, "open", "own_mains", "nadia", "ck_main_date", "agent"],
  ["rq_hydrant", "parks", "publicworks", "yusuf", "Can we fill the Winter Lights ice rink from the Elm Plaza hydrant?",
    "We need about 9,000 gallons on Dec 16.", "2026-12-05", "2026-12-14", "open", "own_mains", "nadia", "ck_hydrant", "form"],
  ["rq_potholes", "service311", "publicworks", "paul", "Can 311 see pothole repair status without calling the street crew?",
    "Asked the Public works agent. Callers ask about their reported pothole several times a week.", "2026-12-04", null, "open", "own_streets", "jamal", "ck_potholes", "agent"],
  ["rq_detour", "comms", "transport", "ben", "Which detour routes should the Elm Street closure notices show?",
    "We'd like to send the notices to the printer by Dec 8.", "2026-12-05", "2026-12-08", "open", "own_signals", "carlos", "ck_detour", "form"],
  ["rq_resets", "permits", "it", "mohammed", "Can contractors reset their own permit portal passwords before launch?",
    "The counter spends an hour a day on password resets.", "2026-12-03", null, "open", "own_portal", "derek", "ck_resets", "form"],
];

const COMS: Com[] = [
  ["cm_main", "publicworks", "nadia", "transport", "Elm Street water main finished and trench restored for repaving", "2026-12-05", "open", "request", "rq_main", null,
    "The replacement gate valves arrived damaged; new valves are on order (Public works' Dec 4 update).", null],
  ["cm_paving", "transport", "ruth", "parks", "Repave Elm Street and paint the new crosswalks and bike lanes", "2026-12-12", "open", "update_item", "ui_paving_decision", "cm_main", null, null],
  ["cm_lights", "parks", "eli", "comms", "Winter Lights festival on Elm Street", "2026-12-18", "open", "manual", null, "cm_paving", null, null],
  ["cm_notices", "comms", "ben", "service311", "Mail Elm Street closure notices to businesses", "2026-12-09", "open", "manual", null, null, null, null],
  ["cm_budget", "finance", "patricia", "leadership", "Mid-year budget adjustment to council", "2026-12-03", "open", "manual", null, null, "Waiting on revised overtime and fuel forecasts from Public works.", null],
  ["cm_power", "publicworks", "bianca", "parks", "Two power hookups on Elm Plaza for Winter Lights vendors", "2026-12-15", "open", "manual", null, null, null, null],
  ["cm_portal", "it", "derek", "permits", "Permit portal open to all contractors", "2026-12-16", "open", "manual", null, null, null, null],
  ["cm_snowmap", "publicworks", "jamal", "service311", "Publish the snow route map", "2026-11-25", "done", "manual", null, null, null, "2026-11-24"],
  ["cm_zoning", "permits", "julia", "leadership", "Downtown zoning update draft to council", "2026-12-02", "done", "manual", null, null, null, "2026-12-01"],
  ["cm_layer", "it", "nina", "service311", "Elm Street work zone map layer", "2026-11-27", "done", "manual", null, null, null, "2026-11-26"],
];

const QS: Qn[] = [
  ["qn_1", "kevin", "publicworks", "Will residents lose water service during the Elm Street work?", "answered",
    "Water service on Elm Street is shut off for up to four hours, only on the day each block connects to the new main. Residents get 48 hours' notice by door hanger.", ["update_item:ui_answer_shutoff"], null, "2026-11-25"],
  ["qn_2", "hana", "transport", "Is Elm Street getting new crosswalks?", "answered",
    "Elm Street repaving is set for Dec 10 to 12, with raised crosswalks at 4th and 6th.", ["update_item:ui_paving_decision"], null, "2026-11-30"],
  ["qn_3", "amina", "publicworks", "Is the snow route map published?", "answered", "The snow route map is published with the new priorities.", [], null, "2026-11-26"],
  ["qn_4", "ruth", "publicworks", "When will the Elm Street water main be finished now that Dec 5 is at risk?", "routed",
    "Public works hasn't published a new date. I asked Nadia Kowalski, who owns Water mains.", [], "rq_when_1", "2026-12-04"],
  ["qn_5", "monica", "publicworks", "Is the Elm Street water main still finishing this week?", "routed",
    "Public works hasn't published a new date. I asked Nadia Kowalski, who owns Water mains.", [], "rq_when_2", "2026-12-05"],
  ["qn_6", "denise", "publicworks", "When will the water main work be done?", "routed",
    "Public works hasn't published a new date. I asked Nadia Kowalski, who owns Water mains.", [], "rq_when_3", "2026-12-05"],
  ["qn_7", "paul", "publicworks", "Can 311 see pothole repair status?", "routed",
    "Public works hasn't published anything on this. I asked Jamal Wright, who owns Street maintenance.", [], "rq_potholes", "2026-12-04"],
  ["qn_8", "tara", "parks", "Is the holiday pool schedule posted?", "answered", "The holiday pool schedule is posted.", [], null, "2026-11-20"],
];

const CONNECTORS: Conn[] = [
  ["cn_pw_teams", "publicworks", "teams", "Public works (Teams)", "tomas"],
  ["cn_pw_jira", "publicworks", "jira", "Jira: Work orders", "nadia"],
  ["cn_pw_conf", "publicworks", "confluence", "Field manual", "owen"],
  ["cn_tr_teams", "transport", "teams", "Transportation (Teams)", "helen"],
  ["cn_tr_jira", "transport", "jira", "Jira: Capital projects", "ruth"],
  ["cn_pk_teams", "parks", "teams", "Parks and events (Teams)", "monica"],
  ["cn_pk_notion", "parks", "notion", "Winter Lights plan", "eli"],
  ["cn_311_zd", "service311", "zendesk", "311 cases", "denise"],
  ["cn_311_teams", "service311", "teams", "311 (Teams)", "denise"],
  ["cn_pm_conf", "permits", "confluence", "Permit handbook", "sarah"],
  ["cn_it_jira", "it", "jira", "Jira: IT", "rachel"],
  ["cn_it_gh", "it", "github", "harborview/permit-portal", "derek"],
  ["cn_cm_teams", "comms", "teams", "Communications (Teams)", "lauren"],
  ["cn_cm_drive", "comms", "gdrive", "Notices and press", "ben"],
  ["cn_fin_drive", "finance", "gdrive", "Budget office", "patricia"],
  ["cn_legal_drive", "legal", "gdrive", "Claims files", "ella"],
  ["cn_lead_teams", "leadership", "teams", "City manager's office (Teams)", "lin"],
];

const DOCS: SourceDoc[] = [
  // Public works
  ["cn_pw_jira", "ticket", "WO-2231", "Elm Street water main replacement, 3rd to 7th Avenue", "Replace 2,400 feet of 1920s cast iron main with ductile iron. Blocks 1 to 4 done and pressure tested. Block 5 waits on replacement gate valves (WO-2240).", "In progress", "Nadia Kowalski", "2026-12-04T15:00:00Z"],
  ["cn_pw_jira", "ticket", "WO-2240", "Replacement gate valves for Elm Street block 5", "Two 12-inch gate valves arrived with cracked flanges. Supplier is shipping replacements; inspection at the supplier first.", "Waiting on vendor", "Nadia Kowalski", "2026-12-04T18:00:00Z"],
  ["cn_pw_jira", "ticket", "WO-2252", "Elm Plaza power hookups for Winter Lights", "Two 50-amp hookups on Elm Plaza for vendors. Electrician booked Dec 14.", "Scheduled", "Bianca Torres", "2026-12-03T10:00:00Z"],
  ["cn_pw_jira", "ticket", "WO-2205", "Plow trucks 4 and 6 out for repair", "Hydraulic lines on truck 4 and transmission on truck 6. Parts due next week.", "In progress", "Jamal Wright", "2026-11-30T10:00:00Z"],
  ["cn_pw_teams", "message", null, "Nadia Kowalski in Public works", "The block 5 valves came in cracked. Supplier says replacements ship Monday after they inspect them. Without them we can't close the trench.", null, "Nadia Kowalski", "2026-12-04T16:10:00Z"],
  ["cn_pw_teams", "message", null, "Owen Fletcher in Public works", "If the valves arrive Monday, we can install Tuesday and have the trench restored Thursday. That's Dec 10.", null, "Owen Fletcher", "2026-12-05T08:40:00Z"],
  ["cn_pw_teams", "message", null, "Tomás Reyes in Public works", "Let's not give Transportation a date until the valves pass inspection at the supplier. Tentatively Dec 10.", null, "Tomás Reyes", "2026-12-05T09:05:00Z"],
  ["cn_pw_jira", "doc", "CO-14", "Change order CO-14: replacement gate valves, Elm Street", "Supplier replaces the two damaged 12-inch gate valves at no charge; delivery Dec 8. Contractor Ridgeline Utilities asks for 2 extra crew days at $9,400 and moves substantial completion of the Elm Street main to Dec 10. Liquidated damages of $1,500 a day still apply after Dec 12. Needs the project manager's signature by Dec 7.", null, "Nadia Kowalski", "2026-12-05T10:00:00Z"],
  ["cn_pw_conf", "doc", null, "Planned water shutoff procedure", "Door hangers go out 48 hours ahead. Shutoffs last up to four hours per block. 311 gets the schedule the same day the door hangers go out.", null, "Owen Fletcher", "2026-11-10T10:00:00Z"],
  // Transportation
  ["cn_tr_jira", "ticket", "CP-118", "Elm Street repaving, 3rd to 7th Avenue", "Mill and pave Dec 10 to 12, then paint raised crosswalks and bike lanes. Can't start until Public works restores the trench (WO-2231).", "Blocked", "Ruth Adeyemi", "2026-12-05T09:00:00Z"],
  ["cn_tr_jira", "ticket", "CP-121", "Elm Street detours during repaving", "Detour via 2nd and 8th Avenue. Bus route 4 moves to 8th Avenue for three days.", "Ready", "Carlos Mendes", "2026-12-04T11:00:00Z"],
  ["cn_tr_teams", "message", null, "Ruth Adeyemi in Transportation", "The paving contractor can slide us by a day or two at most. After Dec 13 they're on the county job until January.", null, "Ruth Adeyemi", "2026-12-05T10:00:00Z"],
  ["cn_tr_teams", "message", null, "Helen Park in Transportation", "If Public works lands Dec 10 we pave Dec 11 and 12 and stripe on the 13th. Tight, but it works.", null, "Helen Park", "2026-12-05T11:30:00Z"],
  // Parks
  ["cn_pk_notion", "doc", null, "Winter Lights 2026 plan", "Dec 18, 4 to 10 pm on Elm Street between 3rd and 7th. 40 vendors, ice rink on Elm Plaza, 12,000 visitors expected. Fallback: Harbor Park, needs a week of replanning.", null, "Eli Navarro", "2026-12-02T10:00:00Z"],
  ["cn_pk_teams", "message", null, "Eli Navarro in Parks and events", "Vendors are asking if Elm Street is still on. I need a go/no-go by Dec 11 to keep the Harbor Park fallback.", null, "Eli Navarro", "2026-12-05T12:00:00Z"],
  ["cn_pk_teams", "message", null, "Monica Bell in Parks and events", "Let's hold Harbor Park as a backup until Dec 11. No announcement yet.", null, "Monica Bell", "2026-12-05T14:00:00Z"],
  // 311
  ["cn_311_zd", "ticket", "311-58812", "When does Elm Street reopen?", "Bakery owner on Elm and 5th asking for a reopening date. Says sales are down 40% since October.", "Open", "Kevin Huang", "2026-12-05T10:00:00Z"],
  ["cn_311_zd", "ticket", "311-58790", "Water shutoff notice on Elm Street", "Resident received a door hanger and wants to know how long the water will be off.", "Solved", "Amina Diallo", "2026-12-04T15:00:00Z"],
  ["cn_311_zd", "ticket", "311-58801", "Is Winter Lights still on Elm Street?", "Resident asking whether the festival moves because of the construction.", "Open", "Amina Diallo", "2026-12-05T13:00:00Z"],
  ["cn_311_teams", "message", null, "Denise Carter in 311", "We're getting about 60 Elm Street calls a day. A single date would cut that in half.", null, "Denise Carter", "2026-12-05T09:30:00Z"],
  // Permits, IT
  ["cn_pm_conf", "doc", null, "Small project permit rules", "Residential projects under $10,000 no longer need plan review; inspection still required.", null, "Sarah Kim", "2026-11-12T10:00:00Z"],
  ["cn_it_jira", "ticket", "IT-904", "Self-service password reset for contractor accounts", "Needed before the permit portal opens to all contractors on Dec 16.", "In progress", "Derek Shaw", "2026-12-04T10:00:00Z"],
  ["cn_it_gh", "pr", "#212", "Add self-service password reset to the permit portal", "Email link reset with a 30-minute expiry. Closes IT-904.", "Open, 1 approval", "Derek Shaw", "2026-12-05T16:00:00Z"],
  ["cn_it_jira", "ticket", "IT-910", "Phishing emails impersonating the water department", "Blocked 300 messages this week. Added a banner to external emails.", "Done", "Ahmed Farouk", "2026-12-03T10:00:00Z"],
  // Communications, Finance
  ["cn_cm_drive", "doc", null, "Elm Street closure notice (draft)", "Notice to 85 Elm Street businesses with repaving dates, detours and Winter Lights. Reopening date left blank until Public works confirms.", null, "Ben Ortiz", "2026-12-04T10:00:00Z"],
  ["cn_cm_teams", "message", null, "Lauren Price in Communications", "No reopening date goes out until Public works and Transportation both confirm. One date, everywhere.", null, "Lauren Price", "2026-12-05T10:00:00Z"],
  ["cn_fin_drive", "doc", null, "Mid-year adjustment (draft)", "Public works overtime is 22% over budget. Waiting on revised overtime and fuel forecasts before it goes to council.", null, "Patricia Owens", "2026-12-03T10:00:00Z"],
  // Legal and the City manager's office (confidential)
  ["cn_legal_drive", "doc", null, "Bayside Lofts claim memo", "Bayside Lofts claims $480,000 for basement flooding from the Oct 14 break. They say a 2021 inspection flagged the main. Response due Dec 21; we need the inspection history first.", null, "Ella Brooks", "2026-12-03T10:00:00Z", "mk_conf"],
  ["cn_lead_teams", "message", null, "Angela Ruiz in City manager's office", "Nothing about the Bayside Lofts claim goes in public updates or council packets until Victoria says so.", null, "Angela Ruiz", "2026-12-04T09:00:00Z", "mk_conf"],
];

const T1 = `Tomás Reyes: Thanks for joining. The topic is the Elm Street water main and what it means for repaving.
Nadia Kowalski: Status first. Blocks one to four are on the new main and passed pressure tests. The gate valves for block five arrived with cracked flanges.
Helen Park: What does that do to Dec 5? We pave Dec 10 to 12, and Winter Lights is Dec 18.
Nadia Kowalski: Dec 5 is gone. If the new valves pass inspection at the supplier and ship Monday, we can finish the main and restore the trench by Dec 10.
Tomás Reyes: Let's not promise a date until the valves pass inspection. I'll confirm the new date with Transportation by Dec 8.
Ruth Adeyemi: The paving contractor can slide one day. I'll confirm they can pave Dec 11 and 12 by Dec 8.
Helen Park: Then the decision is we keep the paving booking and shift it one day, and stripe on the 13th.
Tomás Reyes: Agreed. Parks needs to hear this before they decide on the Harbor Park fallback.
Owen Fletcher: I'll send the valve inspection results to everyone by Dec 8.
Nadia Kowalski: One more thing: Parks asked to fill the ice rink from the Elm Plaza hydrant. That's fine once block five is done.`;

const T2 = `Monica Bell: This is the Winter Lights planning check-in for Dec 18.
Eli Navarro: Forty vendors are confirmed, and the ice rink is booked for Elm Plaza.
Ruth Adeyemi: Repaving is at risk. Public works' water main slipped, so Dec 12 depends on their valves.
Eli Navarro: Then let's decide now: if Elm Street isn't repaved by Dec 13 we move Winter Lights to Harbor Park and keep the date.
Monica Bell: Agreed, that's the decision. Yusuf, can you have Harbor Park ready as a fallback?
Yusuf Ali: Yes, I'll have the Harbor Park layout ready by Dec 11.
Ben Ortiz: We'll hold the announcement until there's a decision.
Monica Bell: 311 needs to know what to tell callers. I'll brief Denise by Dec 8.`;

const T3 = `Angela Ruiz: Two topics: the budget workshop and the Bayside Lofts claim.
Victoria Hughes: Bayside Lofts filed a $480,000 claim for flooding from the October main break. They say a 2021 inspection flagged the main.
Frank Moreau: Public works has the inspection records. The main was on the replacement list but not funded until this year.
Angela Ruiz: Decision: we negotiate before it becomes a lawsuit, and nothing about the claim goes in public updates until Victoria clears it.
Victoria Hughes: I'll have the inspection history reviewed and a settlement range by Dec 14.
Lin Zhao: I'll draft the infrastructure section of the budget workshop deck by Dec 10.
David Osei: Finance still needs Public works' overtime forecast to finish the mid-year adjustment.`;

const MEETINGS: Mtg[] = [
  ["mt_elm", "publicworks", "cn_pw_teams", "Public works × Transportation: Elm Street sequencing", "2026-12-04T16:00:00Z", 30, ["tomas", "nadia", "owen", "helen", "ruth"], T1, "recorded", null, null],
  ["mt_lights", "parks", "cn_pk_teams", "Winter Lights planning check-in", "2026-12-05T17:00:00Z", 25, ["monica", "eli", "yusuf", "ben", "ruth"], T2, "summarized", null, {
    summary: "Winter Lights is ready except for Elm Street, whose repaving depends on Public works' delayed water main. If Elm Street isn't repaved by Dec 13, the festival moves to Harbor Park on the same date.",
    decisions: ["If Elm Street isn't repaved by Dec 13, move Winter Lights to Harbor Park and keep Dec 18."],
    risks: ["Repaving depends on Public works' replacement valves; Dec 12 is at risk."],
    action_items: [
      { owner: "yusuf", text: "Have the Harbor Park fallback layout ready", due: "2026-12-11" },
      { owner: "monica", text: "Brief 311 on what to tell callers", due: "2026-12-08" },
    ],
    by: "Offline writer",
  }],
  ["mt_staff", "leadership", "cn_lead_teams", "City manager's staff meeting", "2026-12-03T17:00:00Z", 45, ["angela", "david", "lin", "frank", "victoria"], T3, "summarized", "mk_conf", {
    summary: "Bayside Lofts filed a $480,000 flood-damage claim over the October main break. The city will negotiate before it becomes a lawsuit, and the claim stays out of public updates. The budget workshop deck leads with infrastructure.",
    decisions: ["Negotiate the Bayside Lofts claim before it becomes a lawsuit; keep it out of public updates until the City attorney clears it."],
    risks: ["The mid-year adjustment is blocked on Public works' overtime forecast."],
    action_items: [
      { owner: "victoria", text: "Review the inspection history and propose a settlement range", due: "2026-12-14" },
      { owner: "lin", text: "Draft the infrastructure section of the budget workshop deck", due: "2026-12-10" },
    ],
    by: "Offline writer",
  }],
];

export const harborview: DemoPack = {
  id: "cityhall",
  audience: "City hall",
  org: { name: "City of Harborview", short: "Harborview", headcount: 1100, domain: "harborview", about: "a fictional mid-size city government with about 1,100 staff" },
  summary:
    "Damaged valves make the Elm Street water main late, and the festival that depends on it is the last to know.",
  defaultPersona: "eli",
  teams: TEAMS,
  people: PEOPLE,
  alsoOnLeadership: ["frank", "rosa", "priyanka", "gregory"],
  owns: OWNS,
  follows: FOLLOWS,
  interfaceOverrides: [
    { from: "publicworks", to: "transport", level: "full", cadence: "immediate", sources: ["source:ticket"] },
    { from: "legal", to: "leadership", level: "full", allKinds: true },
    { from: "transport", to: "parks", cadence: "immediate", sources: ["source:ticket"] },
  ],
  markings: [{ id: "mk_conf", label: "Confidential: City attorney and City manager's office only", allowed: ["leadership", "legal"], othersLevel: "summary" }],
  items: ITEMS,
  story: STORY,
  requests: REQS,
  confidentialRequests: [
    {
      id: "rq_bayside", from: "legal", to: "publicworks", requester: "victoria",
      title: "Inspection history for the Elm Street main, for the Bayside Lofts claim",
      details: "Bayside Lofts ($480,000 flood-damage claim) says a 2021 inspection flagged the Elm Street main. We need five years of inspection and repair records by Dec 14.",
      summaryTitle: "Inspection history for the Elm Street main, for a pending legal matter",
      summaryDetails: "The City attorney needs five years of inspection and repair records for the Elm Street main for a pending legal matter.",
      headline: "City attorney asked Public works for records",
      neededBy: "2026-12-14", ownership: "own_inspections", assignee: "owen", marking: "mk_conf", cluster: "ck_bayside", created: "2026-12-03T14:00:00Z",
    },
  ],
  commitments: COMS,
  questions: QS,
  connectors: CONNECTORS,
  docs: DOCS,
  meetings: MEETINGS,
  agentSpend: { publicworks: 71, service311: 58, transport: 26 },
  task: {
    id: "tr_311_elm",
    unit: "service311",
    requestedBy: "denise",
    title: "What are residents asking about the Elm Street work?",
    instructions: "Pull together what residents and businesses have asked 311 about Elm Street, and what Public works and Transportation have said publicly. I need it to update the 311 script.",
    steps: [
      { at: "2026-12-05T14:00:00Z", kind: "start", text: "Started for Denise Carter." },
      { at: "2026-12-05T14:00:20Z", kind: "read", text: "Read 3 open 311 cases about Elm Street." },
      { at: "2026-12-05T14:00:40Z", kind: "read", text: "Read the 311 channel and the planned water shutoff procedure." },
      { at: "2026-12-05T14:01:30Z", kind: "read", text: "Read what Public works and Transportation have published about Elm Street (at 311's level)." },
      { at: "2026-12-05T14:02:10Z", kind: "done", text: "Wrote a brief with 3 findings." },
    ],
    result:
      "## What residents are asking\n\n- **When does Elm Street reopen?** This is most of the 60 calls a day. Businesses say sales are down since October (311-58812).\n- **How long is the water off?** Answered: up to four hours per block, with 48 hours' notice by door hanger.\n- **Is Winter Lights still on Elm Street?** Parks hasn't announced a change (311-58801).\n\n## What we can say today\n\nRepaving is planned for Dec 10 to 12, but it depends on the water main, which missed Dec 5. There's no confirmed reopening date yet.\n\n## Recommendation\n\nAdd the shutoff answer to the script now. Hold the reopening date until Public works and Transportation confirm one.",
    sources: [{ title: "311-58812: When does Elm Street reopen?" }, { title: "311-58801: Is Winter Lights still on Elm Street?" }, { title: "Planned water shutoff procedure" }],
    at: "2026-12-05T14:00:00Z",
    doneAt: "2026-12-05T14:02:10Z",
  },
  ui: {
    writeExamples: {
      publicworks: `Public works field update, Dec 6
- The replacement gate valves passed inspection at the supplier and ship Monday.
- We'll finish the Elm Street water main by Dec 10.
- Trench restoration happens the same day, so Transportation can pave Dec 11 and 12.
- Can Transportation confirm the paving contractor can shift by one day?`,
      transport: `Transportation weekly
- Detours for Elm Street repaving are approved.
- We still need Public works to finish the water main before we can pave.
- We'll confirm the new paving dates with the contractor by Dec 8.`,
      parks: `Parks and events weekly
- Forty Winter Lights vendors are confirmed.
- If Elm Street isn't repaved by Dec 13 we'll move Winter Lights to Harbor Park and keep the date.`,
    },
    askExamples: {
      publicworks: "When will the Elm Street water main be done?",
      transport: "Is Elm Street getting new crosswalks?",
      parks: "Is Winter Lights still on Elm Street?",
    },
    searchHint: 'Try "water mains", "permits" or a name',
    researchHint: "How do other cities tell residents about planned water shutoffs and road closures?",
    sampleSessions: {
      it: {
        repo: "harborview/permit-portal",
        branch: "feat/password-reset",
        prompts: ["Add self-service password reset to the contractor permit portal", "Make reset links expire after 30 minutes"],
        notes: ["Password reset by email link is done and tested.", "Ready for the Dec 16 launch to all contractors."],
        commits: ["3c4d5e6 Add self-service password reset", "7f8a9b0 Expire reset links after 30 minutes"],
        diffstat: "9 files changed, 318 insertions(+), 22 deletions(-)",
      },
    },
  },
  intro: {
    problem:
      "Transportation can't repave Elm Street until Public works finishes the water main under it, and the Winter Lights festival on Dec 18 needs the repaved street. The valves for the last block arrived damaged, so the water main missed Dec 5.",
    cast: [
      { as: "eli", note: "Runs Winter Lights on Dec 18, and is waiting on work two departments away." },
      { as: "nadia", note: "Owns the Elm Street water main that's running late." },
      { as: "angela", note: "Wants every department's week on one page." },
    ],
  },
  agentTemplate: {
    team: "publicworks",
    name: "Change order reviewer",
    firstJob: "Review change order CO-14 for the valves",
    purpose: "Review contractor change orders and supplier documents against the contract and specs, flag cost and schedule changes for the project manager, and draft Public works' weekly field update.",
    actions: ["documents", "draft_update", "answer"],
  },
  guide: [
    { title: "See what's at risk", as: "eli", href: "/feed",
      text: "Under Needs your attention, Winter Lights is marked At risk. Beacon shows why: it waits on Transportation's repaving, which waits on the water main, which missed Dec 5.",
      why: "Eli hears about a delay two departments away the day it happens, not when vendors start calling." },
    { title: "Ask your agent instead of chasing", as: "eli", href: "/feed?agent=When+will+the+Elm+Street+water+main+be+done%3F&to=me",
      text: "The agent panel on the right has the question filled in. Press Send. Your agent sees that Public works owns it and asks Public works's agent. There's no new date yet, so it goes to Nadia, and 3 others asked too.",
      why: "Nobody has to find the right engineer, and Nadia gets one question instead of four separate calls." },
    { title: "Add an agent teammate", as: "nadia", href: "/agents/new?template=demo",
      text: "Nadia adds Change order reviewer, a Worker for Public works. It's filled in: what it can read, what it can do and what needs Nadia's OK. Click Add, then click \"Review change order CO-14 for the valves\" in the chat and Approve.",
      why: "Nadia gets a first pass on every contractor document, so cost and schedule changes don't slip past before a deadline." },
    { title: "Post the new date", as: "nadia", href: "/write?example=1",
      text: "Nadia's field notes are filled in. Click Split into items. At the top, Beacon flags that one line moves the Dec 5 promise to Dec 10. Scroll down and click Publish.",
      why: "Nadia writes the notes once. Beacon works out which departments are affected and updates the promise." },
    { title: "Everyone waiting hears about it", as: "eli", href: "/feed?agent=When+will+the+Elm+Street+water+main+be+done%3F&to=me",
      text: "Back as Eli, the panel has the same question ready. Send it. This time your agent answers straight from Nadia's update, with the source. The Inbox in the sidebar has the new date too.",
      why: "Transportation, Parks and 311 all get the same date at once, so residents hear one answer." },
    { title: "See the week on one page", as: "angela", href: "/digest", compare: "eli",
      text: "Angela sees one short paragraph per department, plus every commitment that slipped. The City attorney's paragraph mentions a pending flood-damage claim, so it's marked confidential. Open the page as Eli: that paragraph isn't there.",
      why: "The city manager gets the whole picture, and legal matters stay with the people cleared to see them." },
  ],
  explore: [
    { title: "Answer four people at once", as: "nadia", href: "/asks", text: "Four questions about the same date, merged into one. Answer once and everyone who asked gets the reply." },
    { title: "Turn a meeting into updates", as: "nadia", href: "/meetings/mt_elm", text: "Summarize the Public works × Transportation meeting. Beacon writes the decisions and turns each action item into a commitment for its owner." },
    { title: "Meet every agent teammate", as: "nadia", href: "/agents", text: "Every team's built-in agent plus the teammates teams added: Q&A agents that answer, and Workers that research, review documents or change code. Message any of them." },
    { title: "See how departments depend on each other", as: "angela", href: "/map", text: "Who owes whom, and who is asking whom, across city hall." },
    { title: "Check who saw what", as: "angela", href: "/audit", text: "Every read, share and answer, including what each agent read and for whom. Useful for public records requests." },
  ],
  checks: {
    search: { q: "water mains", team: "publicworks", owns: "Water mains" },
    feed: { as: "eli", decision: "ui_paving_decision", atRisk: "cm_lights" },
    slipped: { as: "ruth", team: "transport", commitment: "cm_main", reason: "valves" },
    revise: { as: "nadia", team: "publicworks", commitment: "cm_main", due: "2026-12-10", notify: ["ruth", "eli"] },
    digest: { allowed: "angela", denied: "eli", marking: "mk_conf", slipped: ["cm_main", "cm_budget"] },
    route: { as: "eli", team: "publicworks", question: "When will the Elm Street water main be done?", owner: "nadia", cluster: "ck_main_date", askers: 4 },
    answer: { as: "kevin", team: "publicworks", question: "Will residents lose water service during the Elm Street work?", contains: "four hours", source: "update_item:ui_answer_shutoff" },
    leak: { as: "nadia", team: "legal", question: "Is the city settling the Bayside Lofts claim?", secret: "Bayside" },
  },
};
