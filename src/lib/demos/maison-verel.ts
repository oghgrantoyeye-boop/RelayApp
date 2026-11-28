// Maison Verel: a fictional 400-person fashion house with eight boutiques. The story is set on
// Dec 6, 2026: the recycled wool for the Pre-Fall '27 coat capsule fails a color-fastness test and
// misses Dec 5. That delays Production's samples, which puts the wholesale buyer appointments on
// Dec 12 and the lookbook shoot on Dec 15 at risk. Design and the Executive team are quietly
// working on an unannounced collaboration.
import type { DemoPack, Team, Person, Ownership, Item, StoryItem, Req, Com, Qn, Conn, SourceDoc, Mtg } from "./types";

const TEAMS: Team[] = [
  { id: "leadership", name: "Executive", parent: null, color: "#3f3f46", description: "Sets the brand's direction, the collections calendar and budgets." },
  { id: "creative", name: "Creative", parent: "leadership", color: "#7c3aed", description: "Design, marketing and PR.", group: true },
  { id: "product", name: "Product and supply", parent: "leadership", color: "#0e7490", description: "Sourcing and production.", group: true },
  { id: "commercial", name: "Commercial", parent: "leadership", color: "#c2410c", description: "Merchandising, e-commerce and retail.", group: true },
  { id: "design", name: "Design studio", parent: "creative", color: "#7c3aed", description: "Womenswear and menswear design, from sketches to tech packs." },
  { id: "brand", name: "Marketing and PR", parent: "creative", color: "#be123c", description: "Campaigns, the lookbook, press and social media." },
  { id: "sourcing", name: "Sourcing", parent: "product", color: "#0e7490", description: "Fabric mills, trims and materials certification.", turnaround: "3 business days" },
  { id: "production", name: "Production", parent: "product", color: "#1d4ed8", description: "The Porto sample atelier, factories, quality and delivery dates." },
  { id: "merch", name: "Merchandising", parent: "commercial", color: "#b45309", description: "The range plan, buys, pricing and wholesale appointments." },
  { id: "ecom", name: "E-commerce", parent: "commercial", color: "#c2410c", description: "verel.com, pre-orders and the online customer experience." },
  { id: "retail", name: "Retail stores", parent: "commercial", color: "#15803d", description: "Eight boutiques and their teams." },
  { id: "finance", name: "Finance", parent: "leadership", color: "#a16207", description: "Budgets, costing and margins." },
];

// [user id, name, title, team, role]
const PEOPLE: Person[] = [
  ["isabelle", "Isabelle Verel", "Chief executive officer", "leadership", "lead"],
  ["helena", "Helena Vos", "Chief operating officer", "leadership", "member"],
  ["thomas", "Thomas Keller", "Chief financial officer", "leadership", "member"],
  ["antoine", "Antoine Mercier", "Creative director", "creative", "lead"],
  ["pieter", "Pieter de Wit", "VP of product and supply", "product", "lead"],
  ["sofia", "Sofia Lund", "Chief commercial officer", "commercial", "lead"],
  ["margaux", "Margaux Lefèvre", "Head of design", "design", "lead"],
  ["kenji", "Kenji Mori", "Senior womenswear designer", "design", "member"],
  ["ava", "Ava Lindqvist", "Menswear designer", "design", "member"],
  ["tess", "Tess Morgan", "Technical designer", "design", "member"],
  ["camille", "Camille Roux", "Marketing and PR director", "brand", "lead"],
  ["jules", "Jules Bernard", "Creative producer", "brand", "member"],
  ["amara", "Amara Nwosu", "PR manager", "brand", "member"],
  ["leo", "Leo Fontaine", "Social media manager", "brand", "member"],
  ["giulia", "Giulia Conti", "Sourcing director", "sourcing", "lead"],
  ["matteo", "Matteo Ricci", "Fabric sourcing manager", "sourcing", "member"],
  ["hana", "Hana Kim", "Trims and technical fabrics buyer", "sourcing", "member"],
  ["oscar", "Oscar Lindgren", "Materials sustainability lead", "sourcing", "member"],
  ["lucia", "Lucía Herrera", "Head of production", "production", "lead"],
  ["tiago", "Tiago Sousa", "Porto atelier manager", "production", "member"],
  ["mira", "Mira Shah", "Quality manager", "production", "member"],
  ["ben", "Ben Adler", "Production planner", "production", "member"],
  ["sienna", "Sienna Clarke", "Head of merchandising", "merch", "lead"],
  ["ravi", "Ravi Kapoor", "Wholesale manager", "merch", "member"],
  ["noemie", "Noémie Blanc", "Merchandise planner", "merch", "member"],
  ["daniel", "Daniel Frost", "Head of e-commerce", "ecom", "lead"],
  ["yara", "Yara Haddad", "E-commerce merchandiser", "ecom", "member"],
  ["finn", "Finn O'Connor", "Developer", "ecom", "member"],
  ["charlotte", "Charlotte Webb", "Retail director", "retail", "lead"],
  ["luca", "Luca Moretti", "Store manager, Milan", "retail", "member"],
  ["aiko", "Aiko Tanaka", "Store manager, Paris", "retail", "member"],
  ["rafael", "Rafael Duarte", "Finance director", "finance", "lead"],
  ["ingrid", "Ingrid Holm", "Costing analyst", "finance", "member"],
];

// [id, team, title, description, owner user, keywords]
const OWNS: Ownership[] = [
  ["own_womens", "design", "Womenswear", "Womenswear design, including the Pre-Fall '27 coat capsule", "kenji", ["womenswear", "women's", "coat", "coats", "capsule"]],
  ["own_mens", "design", "Menswear", "Menswear design", "ava", ["menswear", "men's"]],
  ["own_tech", "design", "Tech packs and fit", "Tech packs, fittings and grading", "tess", ["tech pack", "fit", "fitting", "measurements", "grading"]],
  ["own_shoot", "brand", "Lookbook and campaign shoots", "The lookbook, campaign shoots and photographers", "jules", ["lookbook", "shoot", "photographer", "campaign", "models"]],
  ["own_pr", "brand", "Press and PR", "Press samples, editors and embargoes", "amara", ["press", "pr", "editor", "embargo"]],
  ["own_social", "brand", "Social media", "Instagram, TikTok and creator partnerships", "leo", ["instagram", "social", "tiktok", "creator"]],
  ["own_fabrics", "sourcing", "Fabric mills", "Fabric orders, mills, dye lots and delivery dates", "matteo", ["fabric", "fabrics", "wool", "mill", "mills", "yarn", "dye", "lot", "recycled"]],
  ["own_trims", "sourcing", "Trims and technical fabrics", "Buttons, zips and technical fabrics", "hana", ["trims", "buttons", "zips", "nylon", "technical", "waterproof"]],
  ["own_materials", "sourcing", "Materials certification", "Certifications, traceability and material claims", "oscar", ["certification", "certified", "grs", "traceability", "sustainability"]],
  ["own_atelier", "production", "Porto sample atelier", "Sample making in the Porto atelier", "tiago", ["sample", "samples", "atelier", "porto", "sampling"]],
  ["own_quality", "production", "Quality control", "Testing, inspections and defects", "mira", ["quality", "qc", "defect", "testing", "inspection"]],
  ["own_schedule", "production", "Production calendar", "Factory slots, bulk production and delivery dates", "ben", ["calendar", "factory", "bulk", "delivery dates"]],
  ["own_wholesale", "merch", "Wholesale and buyer appointments", "Showroom appointments and wholesale orders", "ravi", ["wholesale", "buyer", "buyers", "appointments", "showroom"]],
  ["own_range", "merch", "Range plan and buys", "The range plan, buy depth and open-to-buy", "noemie", ["range plan", "buy", "depth", "assortment"]],
  ["own_pricing", "merch", "Pricing", "Retail and wholesale prices", "sienna", ["price", "pricing", "retail price"]],
  ["own_site", "ecom", "verel.com", "The online store and checkout", "daniel", ["website", "site", "checkout", "online store"]],
  ["own_preorder", "ecom", "Pre-orders", "Pre-order pages, waitlists and drops", "yara", ["pre-order", "preorder", "waitlist", "drop"]],
  ["own_dev", "ecom", "Site development", "Features, integrations and fixes for verel.com", "finn", ["developer", "integration", "bug", "feature"]],
  ["own_stores", "retail", "Boutiques", "The eight boutiques, windows and store staff", "charlotte", ["store", "stores", "boutique", "boutiques", "windows"]],
  ["own_milan", "retail", "Milan boutique", "The Milan flagship", "luca", ["milan"]],
  ["own_paris", "retail", "Paris boutique", "The Paris boutique", "aiko", ["paris"]],
  ["own_costing", "finance", "Costing and margins", "Product costing and margin targets", "ingrid", ["costing", "margin", "margins", "cost", "landed cost"]],
  ["own_budget", "finance", "Budgets", "Budgets and forecasts", "rafael", ["budget", "forecast", "spend"]],
  ["own_calendar", "leadership", "Collections calendar", "Seasons, drops and company priorities", "helena", ["calendar", "season", "priorities", "strategy"]],
];

const FOLLOWS: Record<string, string[]> = {
  sourcing: ["production", "design", "merch", "finance", "leadership"],
  production: ["brand", "merch", "design", "ecom", "leadership"],
  design: ["production", "sourcing", "brand", "leadership"],
  brand: ["ecom", "retail", "leadership"],
  merch: ["retail", "ecom", "finance", "leadership"],
  ecom: ["brand", "retail", "leadership"],
  retail: ["merch", "brand", "leadership"],
  finance: ["merch", "leadership"],
  leadership: ["design", "brand", "sourcing", "production", "merch", "ecom", "retail", "finance"],
};

const ITEMS: Record<string, Item[]> = {
  design: [
    ["progress", "The Pre-Fall '27 range is locked at 64 styles, including an 8-style recycled wool coat capsule.", ["merch", "production", "sourcing"]],
    ["decision", "Pre-Fall '27 drops the second colorway on knitwear to cut sample costs.", ["production", "merch", "finance"]],
    ["progress", "Tech packs for all coat styles are with the Porto atelier.", ["production"]],
    ["risk", "Two menswear jackets need a second fitting; tech packs follow next week.", ["production"]],
    ["ask", "We need Sourcing to confirm the coat capsule wool shade before sampling.", ["sourcing"]],
    ["progress", "Finished the Autumn '27 mood boards.", ["brand"]],
  ],
  brand: [
    ["progress", "The Winter campaign reached 4.1M people; engagement is up 30% on last year.", ["ecom", "retail"]],
    ["decision", "The Pre-Fall '27 lookbook is shot in Lisbon in one day, with six models.", ["production", "ecom"]],
    ["progress", "Vogue Italia featured the Winter coat in its December issue.", ["ecom", "retail"]],
    ["ask", "Retail: send window photos from all eight boutiques by Dec 10.", ["retail"]],
    ["progress", "Signed three creators for the Pre-Fall '27 launch.", ["ecom"]],
  ],
  sourcing: [
    ["progress", "Booked all Pre-Fall '27 fabric with five mills; 62% is recycled or certified organic.", ["production", "design"]],
    ["decision", "New mills need a social compliance audit before the first order.", ["production", "finance"]],
    ["progress", "Trims for the coat capsule are approved, including recycled horn buttons.", ["production", "design"]],
    ["risk", "Cotton poplin prices rose 7%; we're holding quotes until Dec 15.", ["finance", "merch"]],
    ["ask", "Design: send any shade changes for Pre-Fall '27 by Nov 20.", ["design"]],
  ],
  production: [
    ["progress", "Autumn '26 deliveries reached stores 96% on time.", ["merch", "retail"]],
    ["decision", "The Porto atelier makes every Pre-Fall '27 sample this season; outside sampling stops.", ["design", "finance"]],
    ["progress", "Knitwear samples for Pre-Fall '27 are finished.", ["merch", "brand"]],
    ["risk", "The Porto atelier is booked solid until Jan 12 after the coat capsule.", ["design", "merch"]],
    ["progress", "Defect rate on Autumn '26 outerwear is down to 1.2%.", ["retail"]],
  ],
  merch: [
    ["progress", "Autumn '26 full-price sell-through is 68%, ahead of plan.", ["leadership", "finance"]],
    ["decision", "Pre-Fall '27 coats are priced between €690 and €1,150.", ["ecom", "retail", "finance"]],
    ["progress", "Booked 22 wholesale buyers for the Pre-Fall '27 showroom.", ["production"]],
    ["ask", "Production: we need the coat samples in the showroom before buyers arrive.", ["production"]],
    ["progress", "The Pre-Fall '27 range plan is final at 64 styles.", ["design", "production"]],
  ],
  ecom: [
    ["progress", "verel.com sales are up 18% this quarter; mobile is 71% of orders.", ["brand", "leadership"]],
    ["decision", "Pre-Fall '27 coats open for pre-order the week after the lookbook shoot.", ["brand", "merch"]],
    ["progress", "The new checkout cut abandoned carts by 12%.", []],
    ["risk", "The pre-order page needs lookbook images; product shots alone convert half as well.", ["brand"]],
    ["progress", "The Winter coat waitlist has 3,400 sign-ups.", ["merch", "brand"]],
  ],
  retail: [
    ["progress", "Holiday windows are installed in all eight boutiques.", ["brand"]],
    ["decision", "Boutiques open until 9 pm from Dec 14 to 23.", ["ecom"]],
    ["progress", "Milan's sales are up 22% since the renovation.", ["leadership", "merch"]],
    ["ask", "We need the Pre-Fall '27 coat story for staff training by January.", ["merch", "brand"]],
  ],
  finance: [
    ["progress", "Q3 gross margin was 64%, two points above plan.", ["leadership"]],
    ["decision", "Sample budgets are capped at €2,500 per style for Pre-Fall '27.", ["design", "production"]],
    ["risk", "Pre-Fall '27 costing sign-off is late because fabric prices aren't final.", ["leadership", "sourcing"]],
    ["ask", "Sourcing: send final Pre-Fall '27 fabric prices so we can close costing.", ["sourcing"]],
  ],
  leadership: [
    ["decision", "Priorities for 2027: sustainable materials first, e-commerce growth second, a new Copenhagen boutique third.", ["sourcing", "ecom", "retail"]],
    ["decision", "Hiring stays flat in Q1 except for two e-commerce roles.", ["ecom", "finance"]],
    ["progress", "The company offsite is set for Jan 20 in Porto.", []],
  ],
};

const STORY: StoryItem[] = [
  ["sourcing", 5, "answer", "The recycled wool is GRS certified and made from 70% post-consumer wool, spun and dyed at our partner mill in Biella.",
    "The recycled wool is GRS certified and made from 70% post-consumer wool.", "Recycled wool is certified.", ["production", "design", "merch"], null, "answer_grs"],
  ["production", 6, "decision", "We decided to make the Pre-Fall '27 coat capsule samples (8 styles) in the Porto atelier from Dec 8 to 11, so they're in the showroom for buyer appointments on Dec 12 and on set for the lookbook shoot on Dec 15.",
    "Coat capsule samples are made Dec 8 to 11, ready for buyers Dec 12 and the shoot Dec 15.", "Coat samples planned for Dec 11.", ["brand", "merch", "design"], null, "samples_decision"],
  ["sourcing", 7, "risk", "The first dye lot of recycled wool for the Pre-Fall '27 coats failed color-fastness testing, so it won't reach the sample room by Dec 5. The mill is re-dyeing.",
    "The recycled wool for the coats will miss Dec 5; the mill is re-dyeing.", "Coat wool delayed.", ["production", "design"], null, "wool_late"],
  ["sourcing", 7, "progress", "Linen for the Pre-Fall '27 dresses arrived early and passed testing.",
    "Pre-Fall '27 linen arrived early and passed testing.", "Linen arrived.", ["production"], null, "linen"],
  ["production", 7, "risk", "The coat samples depend on Sourcing's recycled wool. The Porto atelier has no open slots after Dec 11 until January.",
    "Coat samples depend on Sourcing's wool; the atelier is full after Dec 11.", "Coat samples depend on a delivery.", ["sourcing", "brand", "merch"], null, "samples_dep"],
  ["brand", 7, "risk", "The Dec 15 lookbook shoot in Lisbon (photographer, six models, studio) needs the finished coat samples. Rebooking costs about €18,000.",
    "The Dec 15 lookbook shoot depends on the coat samples.", "Lookbook shoot planned for Dec 15.", ["production", "ecom"], null, "shoot_dep"],
  ["design", 7, "progress", "We signed a capsule collaboration with Kestrel Outdoor: 12 waterproof pieces launching March 4, announced Feb 10. Nothing about it goes outside Design and the Executive team until then.",
    "We signed a capsule collaboration launching in March; details stay confidential until the announcement.", "New collaboration capsule in progress.", ["leadership"], "mk_conf", "kestrel"],
];

const REQS: Req[] = [
  ["rq_wool", "production", "sourcing", "lucia", "Recycled wool for the coat capsule in the sample room by Dec 5",
    "Coat samples are booked in the Porto atelier from Dec 8. Can Sourcing get the wool to the sample room by Dec 5?", "2026-11-20", "2026-12-05", "accepted", "own_fabrics", "matteo", null, "form"],
  ["rq_when_1", "production", "sourcing", "tiago", "When will the recycled wool arrive now that Dec 5 is at risk?",
    "Asked the Sourcing agent. We need the date to keep the atelier slot.", "2026-12-04", null, "open", "own_fabrics", "matteo", "ck_wool_date", "agent"],
  ["rq_when_2", "brand", "sourcing", "camille", "Is the recycled wool still arriving this week? The lookbook shoot depends on it.",
    "Asked the Sourcing agent.", "2026-12-05", null, "open", "own_fabrics", "matteo", "ck_wool_date", "agent"],
  ["rq_when_3", "merch", "sourcing", "ravi", "Buyers are asking about the coat capsule. When does the recycled wool land?",
    "Asked the Sourcing agent.", "2026-12-05", null, "open", "own_fabrics", "matteo", "ck_wool_date", "agent"],
  ["rq_swatch", "merch", "sourcing", "noemie", "Can we get wool swatch cards for the showroom in case samples are late?",
    "Ten cards, one per buyer table.", "2026-12-05", "2026-12-11", "open", "own_fabrics", "matteo", "ck_swatch", "form"],
  ["rq_grs", "ecom", "sourcing", "yara", "Can we say 'recycled wool' on the product page, or do we need the certificate number?",
    "Asked the Sourcing agent.", "2026-12-04", null, "open", "own_materials", "oscar", "ck_grs", "agent"],
  ["rq_press", "brand", "production", "amara", "Can press get one coat sample the week of Dec 15?",
    "Two editors asked for the coat for January issues.", "2026-12-05", "2026-12-15", "open", "own_atelier", "tiago", "ck_press", "form"],
  ["rq_sizes", "retail", "merch", "luca", "Which coat sizes will Milan get in the first delivery?",
    "Customers are asking about XS and XL.", "2026-12-03", null, "open", "own_range", "noemie", "ck_sizes", "form"],
];

const COMS: Com[] = [
  ["cm_wool", "sourcing", "matteo", "production", "Recycled wool for the coat capsule delivered to the sample room", "2026-12-05", "open", "request", "rq_wool", null,
    "The first dye lot failed the color-fastness test; the mill is re-dyeing (Sourcing's Dec 4 update).", null],
  ["cm_samples", "production", "lucia", "brand", "Pre-Fall '27 coat capsule samples (8 styles) finished", "2026-12-11", "open", "update_item", "ui_samples_decision", "cm_wool", null, null],
  ["cm_shoot", "brand", "jules", "ecom", "Pre-Fall '27 lookbook shoot in Lisbon", "2026-12-15", "open", "manual", null, "cm_samples", null, null],
  ["cm_costing", "finance", "ingrid", "leadership", "Pre-Fall '27 costing sign-off", "2026-12-03", "open", "manual", null, null, "Waiting on final fabric prices from Sourcing.", null],
  ["cm_preorder", "ecom", "yara", "brand", "Pre-Fall '27 coat pre-order page", "2026-12-21", "open", "manual", null, null, null, null],
  ["cm_showroom", "merch", "ravi", "leadership", "Pre-Fall '27 showroom set for buyer appointments", "2026-12-11", "open", "manual", null, null, null, null],
  ["cm_trims", "sourcing", "hana", "production", "Coat capsule trims approved", "2026-11-25", "done", "manual", null, null, null, "2026-11-24"],
  ["cm_windows", "retail", "charlotte", "brand", "Holiday windows in all eight boutiques", "2026-12-02", "done", "manual", null, null, null, "2026-12-01"],
];

const QS: Qn[] = [
  ["qn_1", "sienna", "sourcing", "Is the recycled wool certified?", "answered",
    "The recycled wool is GRS certified and made from 70% post-consumer wool.", ["update_item:ui_answer_grs"], null, "2026-11-25"],
  ["qn_2", "leo", "production", "When are the coat samples ready?", "answered",
    "Coat capsule samples are made Dec 8 to 11, ready for buyers Dec 12 and the shoot Dec 15.", ["update_item:ui_samples_decision"], null, "2026-11-30"],
  ["qn_3", "aiko", "merch", "What's the price range for Pre-Fall '27 coats?", "answered", "Pre-Fall '27 coats are priced between €690 and €1,150.", [], null, "2026-11-19"],
  ["qn_4", "tiago", "sourcing", "When will the recycled wool arrive now that Dec 5 is at risk?", "routed",
    "Sourcing hasn't published a new date. I asked Matteo Ricci, who owns Fabric mills.", [], "rq_when_1", "2026-12-04"],
  ["qn_5", "camille", "sourcing", "Is the recycled wool still arriving this week?", "routed",
    "Sourcing hasn't published a new date. I asked Matteo Ricci, who owns Fabric mills.", [], "rq_when_2", "2026-12-05"],
  ["qn_6", "ravi", "sourcing", "When does the recycled wool land?", "routed",
    "Sourcing hasn't published a new date. I asked Matteo Ricci, who owns Fabric mills.", [], "rq_when_3", "2026-12-05"],
  ["qn_7", "yara", "sourcing", "Can we say recycled wool on the product page?", "routed",
    "Sourcing hasn't published anything on this. I asked Oscar Lindgren, who owns Materials certification.", [], "rq_grs", "2026-12-04"],
  ["qn_8", "noemie", "retail", "Are boutiques open late in December?", "answered", "Boutiques open until 9 pm from Dec 14 to 23.", [], null, "2026-11-28"],
];

const CONNECTORS: Conn[] = [
  ["cn_src_slack", "sourcing", "slack", "#sourcing", "giulia"],
  ["cn_src_drive", "sourcing", "gdrive", "Mill orders and test reports", "matteo"],
  ["cn_src_zoom", "sourcing", "zoom", "Zoom", "giulia"],
  ["cn_prd_slack", "production", "slack", "#production", "lucia"],
  ["cn_prd_notion", "production", "notion", "Atelier schedule", "tiago"],
  ["cn_brd_slack", "brand", "slack", "#marketing", "camille"],
  ["cn_brd_notion", "brand", "notion", "Lookbook production", "jules"],
  ["cn_brd_zoom", "brand", "zoom", "Zoom", "camille"],
  ["cn_des_figma", "design", "figma", "Figma: Pre-Fall '27 boards", "margaux"],
  ["cn_des_slack", "design", "slack", "#design-studio", "margaux"],
  ["cn_mer_drive", "merch", "gdrive", "Range plan", "sienna"],
  ["cn_mer_slack", "merch", "slack", "#merchandising", "sienna"],
  ["cn_eco_jira", "ecom", "jira", "Jira: WEB", "daniel"],
  ["cn_eco_gh", "ecom", "github", "maisonverel/storefront", "finn"],
  ["cn_eco_zd", "ecom", "zendesk", "Customer care", "yara"],
  ["cn_ret_slack", "retail", "slack", "#boutiques", "charlotte"],
  ["cn_fin_drive", "finance", "gdrive", "Costing", "rafael"],
  ["cn_lead_drive", "leadership", "gdrive", "Executive", "helena"],
  ["cn_lead_zoom", "leadership", "zoom", "Zoom", "helena"],
];

const DOCS: SourceDoc[] = [
  // Sourcing
  ["cn_src_drive", "doc", null, "Color-fastness report: recycled wool, lot 1", "Lot 1 (camel, 1,200 meters) scored 2-3 on rubbing fastness against a minimum of 4. The mill is re-dyeing with a new fixative. Retest at the mill before shipping.", null, "Matteo Ricci", "2026-12-04T15:00:00Z"],
  ["cn_src_drive", "doc", null, "Recycled wool certificate", "GRS certificate for the Biella mill's recycled wool, 70% post-consumer content. Valid through August 2027.", null, "Oscar Lindgren", "2026-11-10T10:00:00Z"],
  ["cn_src_slack", "message", null, "Matteo Ricci in #sourcing", "The mill re-dyed lot 1 overnight. Their lab retest is Monday; if it passes they ship by courier the same day.", null, "Matteo Ricci", "2026-12-04T21:10:00Z"],
  ["cn_src_slack", "message", null, "Oscar Lindgren in #sourcing", "Retest booked for Monday morning. Courier from Biella to Porto is one day.", null, "Oscar Lindgren", "2026-12-05T08:40:00Z"],
  ["cn_src_slack", "message", null, "Giulia Conti in #sourcing", "Let's not give Production a date until the retest passes. Tentatively Dec 9.", null, "Giulia Conti", "2026-12-05T09:05:00Z"],
  // Production
  ["cn_prd_notion", "doc", null, "Porto atelier schedule, December", "Coat capsule Dec 8 to 11 (8 styles, 2 sizes each). Menswear jackets Dec 14 to 18. Fully booked until Jan 12.", null, "Tiago Sousa", "2026-12-02T10:00:00Z"],
  ["cn_prd_slack", "message", null, "Tiago Sousa in #production", "If the wool lands Dec 9 we can cut that afternoon and finish the eight coats by Dec 12 if we run a Saturday shift.", null, "Tiago Sousa", "2026-12-05T10:00:00Z"],
  ["cn_prd_slack", "message", null, "Lucía Herrera in #production", "I'd rather have samples a day late than skip the fit check. Mira, can QC check the coats as they come off the line?", null, "Lucía Herrera", "2026-12-05T11:30:00Z"],
  // Marketing
  ["cn_brd_notion", "doc", null, "Pre-Fall '27 lookbook: production plan", "Lisbon, Dec 15. Photographer, six models, studio and hair and makeup booked. The eight coats are the opening looks. Rebooking costs about €18,000.", null, "Jules Bernard", "2026-12-02T10:00:00Z"],
  ["cn_brd_slack", "message", null, "Jules Bernard in #marketing", "If the coats aren't ready we can shoot everything else on the 15th and do coats in a half day in January.", null, "Jules Bernard", "2026-12-05T12:00:00Z"],
  ["cn_brd_slack", "message", null, "Camille Roux in #marketing", "A January half day costs about €7,000. Better than moving the whole shoot.", null, "Camille Roux", "2026-12-05T14:00:00Z"],
  // Merchandising, e-commerce, retail
  ["cn_mer_drive", "doc", null, "Pre-Fall '27 showroom schedule", "22 buyers on Dec 12 and 13. Coat capsule is the opening rail. Swatch cards as a fallback.", null, "Ravi Kapoor", "2026-12-03T10:00:00Z"],
  ["cn_mer_slack", "message", null, "Ravi Kapoor in #merchandising", "Two department store buyers said the coats are why they're coming. Swatches won't land the same orders.", null, "Ravi Kapoor", "2026-12-05T13:00:00Z"],
  ["cn_eco_jira", "ticket", "WEB-512", "Pre-Fall '27 coat pre-order page", "Pre-order for 8 coat styles with a waitlist import. Needs lookbook images. Ships in June.", "In progress", "Yara Haddad", "2026-12-04T10:00:00Z"],
  ["cn_eco_gh", "pr", "#377", "Pre-order support for made-to-order styles", "Adds a pre-order badge, delivery estimate and deposit option to product pages.", "Open, 1 approval", "Finn O'Connor", "2026-12-05T16:00:00Z"],
  ["cn_eco_zd", "ticket", "CARE-2210", "When can I order the camel recycled wool coat?", "Waitlist customer asking for the pre-order date.", "Open", "Yara Haddad", "2026-12-05T10:00:00Z"],
  ["cn_ret_slack", "message", null, "Luca Moretti in #boutiques", "Milan clients keep asking about the camel coat they saw on Instagram.", null, "Luca Moretti", "2026-12-04T17:00:00Z"],
  // Finance
  ["cn_fin_drive", "doc", null, "Pre-Fall '27 costing (draft)", "Coat capsule costing waits on the final recycled wool price after re-dyeing.", null, "Ingrid Holm", "2026-12-03T10:00:00Z"],
  // Confidential
  ["cn_des_figma", "doc", null, "Kestrel Outdoor capsule: first boards", "12 waterproof pieces in recycled nylon with Kestrel Outdoor. Launch March 4, announcement Feb 10.", null, "Margaux Lefèvre", "2026-12-02T10:00:00Z", "mk_conf"],
  ["cn_lead_drive", "doc", null, "Kestrel Outdoor term sheet", "Co-branded capsule, 50/50 revenue split, exclusive for six months. Announcement embargoed until Feb 10.", null, "Helena Vos", "2026-12-01T10:00:00Z", "mk_conf"],
];

const T1 = `Giulia Conti: Thanks for joining. The topic is the recycled wool for the coat capsule.
Matteo Ricci: Status first. Lot one failed rubbing fastness. The mill re-dyed it overnight with a new fixative, and the retest is Monday.
Lucía Herrera: What does that do to Dec 5? The atelier starts the coats Dec 8, buyers come Dec 12 and the shoot is Dec 15.
Matteo Ricci: Dec 5 is gone. If the retest passes Monday, the courier gets it to Porto and we can deliver the wool to the sample room by Dec 9.
Giulia Conti: Let's not promise a date until the retest passes. I'll confirm the new date with Production by Dec 8.
Tiago Sousa: The atelier can run a Saturday shift. I'll confirm the coats can still be finished by Dec 12.
Lucía Herrera: Then the decision is we keep the atelier slot, start cutting Dec 9, and run the Saturday shift if we need it.
Giulia Conti: Agreed. Marketing and Merchandising should hear this before they plan fallbacks.
Oscar Lindgren: I'll send the retest results to everyone by Dec 8.
Matteo Ricci: One more thing: Merchandising wants swatch cards for the showroom. We can send those with the wool.`;

const T2 = `Camille Roux: This is prep for the Pre-Fall '27 lookbook shoot in Lisbon on Dec 15.
Jules Bernard: Photographer, models and studio are confirmed. The eight coats open the lookbook.
Lucía Herrera: The coats are at risk. Sourcing's wool slipped, so the samples depend on Monday's retest.
Jules Bernard: Then let's decide now: if the coats aren't on set Dec 15, we shoot everything else and do the coats in a half day in January.
Camille Roux: Agreed, that's the decision. Leo, can you plan social content that works either way?
Leo Fontaine: Yes, I'll have both content plans ready by Dec 11.
Yara Haddad: The pre-order page can launch with product shots and swap in lookbook images later.
Camille Roux: Merchandising needs to know before the showroom. I'll tell Sienna by Dec 8.`;

const T3 = `Isabelle Verel: Two topics: the 2027 plan and Kestrel Outdoor.
Antoine Mercier: The Kestrel capsule is signed. Twelve waterproof pieces, launching March 4, announced Feb 10.
Helena Vos: The term sheet is a 50/50 split with six months' exclusivity. Sourcing needs recycled nylon, but we can't tell them why yet.
Isabelle Verel: Decision: nothing about Kestrel goes beyond Design and this team until the announcement. Sourcing gets a request without the name.
Antoine Mercier: I'll have the first samples reviewed with Kestrel by Jan 15.
Thomas Keller: I'll have the capsule's margin model ready by Dec 18.
Helena Vos: Pre-Fall '27 costing is still waiting on fabric prices.`;

const MEETINGS: Mtg[] = [
  ["mt_wool", "sourcing", "cn_src_zoom", "Sourcing × Production: recycled wool and coat samples", "2026-12-04T16:00:00Z", 30, ["giulia", "matteo", "oscar", "lucia", "tiago"], T1, "recorded", null, null],
  ["mt_shoot", "brand", "cn_brd_zoom", "Pre-Fall '27 lookbook shoot prep", "2026-12-05T17:00:00Z", 25, ["camille", "jules", "leo", "lucia", "yara"], T2, "summarized", null, {
    summary: "The Lisbon shoot is ready except for the eight coats, which wait on Sourcing's delayed wool. If the coats aren't on set Dec 15, the rest is shot as planned and the coats get a half day in January.",
    decisions: ["If the coats aren't on set Dec 15, shoot everything else and do the coats in a half day in January."],
    risks: ["The coat samples depend on Monday's wool retest; Dec 11 is at risk."],
    action_items: [
      { owner: "leo", text: "Plan social content for both outcomes", due: "2026-12-11" },
      { owner: "camille", text: "Tell Merchandising about the shoot plan", due: "2026-12-08" },
    ],
    by: "Offline writer",
  }],
  ["mt_exec", "leadership", "cn_lead_zoom", "Executive committee", "2026-12-03T17:00:00Z", 45, ["isabelle", "helena", "thomas", "antoine", "pieter"], T3, "summarized", "mk_conf", {
    summary: "The Kestrel Outdoor capsule is signed: 12 waterproof pieces launching March 4. Nothing about it leaves Design and the Executive team before the Feb 10 announcement.",
    decisions: ["Keep the Kestrel Outdoor collaboration within Design and the Executive team until Feb 10; Sourcing gets an unnamed request."],
    risks: ["Pre-Fall '27 costing is blocked on final fabric prices."],
    action_items: [
      { owner: "antoine", text: "Review first samples with Kestrel", due: "2027-01-15" },
      { owner: "thomas", text: "Build the capsule's margin model", due: "2026-12-18" },
    ],
    by: "Offline writer",
  }],
];

export const maisonVerel: DemoPack = {
  id: "fashion",
  audience: "Mid-size fashion house",
  org: { name: "Maison Verel", short: "Verel", headcount: 400, domain: "maisonverel", about: "a fictional 400-person fashion house with a Porto sample atelier and eight boutiques" },
  summary:
    "A failed dye test makes the coat wool late, and the lookbook shoot that depends on it is the last to know.",
  defaultPersona: "jules",
  teams: TEAMS,
  people: PEOPLE,
  alsoOnLeadership: ["antoine", "pieter", "sofia"],
  owns: OWNS,
  follows: FOLLOWS,
  interfaceOverrides: [
    { from: "sourcing", to: "production", level: "full", cadence: "immediate" },
    { from: "design", to: "leadership", level: "full", allKinds: true },
    { from: "production", to: "brand", cadence: "immediate" },
  ],
  markings: [{ id: "mk_conf", label: "Confidential: Executive and Design only", allowed: ["leadership", "design"], othersLevel: "summary" }],
  items: ITEMS,
  story: STORY,
  requests: REQS,
  confidentialRequests: [
    {
      id: "rq_kestrel", from: "design", to: "sourcing", requester: "margaux",
      title: "Waterproof recycled nylon for the Kestrel Outdoor capsule",
      details: "The Kestrel Outdoor collaboration (12 pieces, launching March 4) needs a waterproof recycled nylon in three colors. Sample yardage needed by Dec 18.",
      summaryTitle: "Waterproof recycled nylon for an unannounced capsule",
      summaryDetails: "Design needs a waterproof recycled nylon in three colors for an unannounced capsule. Sample yardage needed by Dec 18.",
      headline: "Design asked Sourcing about a technical fabric",
      neededBy: "2026-12-18", ownership: "own_trims", assignee: "hana", marking: "mk_conf", cluster: "ck_kestrel", created: "2026-12-03T14:00:00Z",
    },
  ],
  commitments: COMS,
  questions: QS,
  connectors: CONNECTORS,
  docs: DOCS,
  meetings: MEETINGS,
  agentSpend: { sourcing: 52, production: 44, ecom: 37 },
  task: {
    id: "tr_merch_buyers",
    unit: "merch",
    requestedBy: "ravi",
    title: "What have buyers said about the Pre-Fall '27 coat capsule?",
    instructions: "Pull together what wholesale buyers have said about the coat capsule, and what Production and Sourcing have published about the samples. I need it to plan the showroom.",
    steps: [
      { at: "2026-12-05T14:00:00Z", kind: "start", text: "Started for Ravi Kapoor." },
      { at: "2026-12-05T14:00:20Z", kind: "read", text: "Read the showroom schedule and range plan." },
      { at: "2026-12-05T14:00:40Z", kind: "read", text: "Read #merchandising from the last two weeks." },
      { at: "2026-12-05T14:01:30Z", kind: "read", text: "Read what Production and Sourcing have published about the coats (at Merchandising's level)." },
      { at: "2026-12-05T14:02:10Z", kind: "done", text: "Wrote a brief with 3 findings." },
    ],
    result:
      "## What buyers are saying\n\n- **The coats are the draw.** Two department store buyers said the coat capsule is why they're coming.\n- **Swatches are a weak fallback.** Buyers order deeper from finished samples.\n- **Price is accepted.** No pushback on €690 to €1,150.\n\n## Where the samples stand\n\nProduction plans the coats Dec 8 to 11, but the wool missed Dec 5 and Sourcing hasn't published a new date.\n\n## Recommendation\n\nMove the two department store appointments to Dec 13, the second showroom day, to give the samples an extra day.",
    sources: [{ title: "Pre-Fall '27 showroom schedule" }, { title: "#merchandising" }, { title: "Production's sample decision" }],
    at: "2026-12-05T14:00:00Z",
    doneAt: "2026-12-05T14:02:10Z",
  },
  ui: {
    writeExamples: {
      sourcing: `Sourcing weekly, Dec 6
- The mill re-dyed the recycled wool and the new lot passed color-fastness testing.
- We'll deliver the recycled wool to the sample room by Dec 9.
- Trims for all eight coat styles are approved.
- Can Production confirm the Porto atelier can start cutting a day later?`,
      production: `Production weekly
- Tech packs for the coat capsule are checked and patterns are cut in paper.
- We still need Sourcing's recycled wool before we can cut the coats.
- We'll finish the coat samples by Dec 12 with a Saturday shift.`,
      brand: `Marketing and PR weekly
- Lisbon shoot crew and models are confirmed.
- If the coats aren't on set Dec 15 we'll shoot them in a half day in January.`,
    },
    askExamples: {
      sourcing: "When will the recycled wool arrive?",
      production: "When are the coat samples ready?",
      merch: "What's the price range for Pre-Fall '27 coats?",
    },
    searchHint: 'Try "fabric mills", "pre-orders" or a name',
    researchHint: "How are other fashion brands describing recycled wool on product pages?",
    sampleSessions: {
      ecom: {
        repo: "maisonverel/storefront",
        branch: "feat/preorder",
        prompts: ["Add pre-order support for made-to-order coat styles", "Show a delivery estimate and take a deposit"],
        notes: ["Pre-order badge, delivery estimate and deposit are done and tested.", "Ready for the Pre-Fall '27 coat page once lookbook images are in."],
        commits: ["4d5e6f7 Add pre-order support for made-to-order styles", "8a9b0c1 Take a deposit on pre-orders"],
        diffstat: "11 files changed, 402 insertions(+), 37 deletions(-)",
      },
    },
  },
  intro: {
    problem:
      "The Pre-Fall '27 coats can't be sampled until the recycled wool arrives, and the Dec 15 lookbook shoot needs the samples. The first dye lot failed its color test, so the wool missed Dec 5 while the mill re-dyes it.",
    cast: [
      { as: "jules", note: "Produces the Dec 15 lookbook shoot, and is waiting on work two teams away." },
      { as: "matteo", note: "Owns the wool order with the mill." },
      { as: "isabelle", note: "Wants the house's week on one page." },
    ],
  },
  agentTemplate: {
    team: "sourcing",
    name: "Materials researcher",
    firstJob: "Review the color-fastness report for lot 1",
    purpose: "Research recycled and certified fabric suppliers, review mill test reports and certificates for failures or gaps, and draft Sourcing's weekly update.",
    actions: ["research", "documents", "draft_update"],
  },
  guide: [
    { title: "See what's at risk", as: "jules", href: "/feed",
      text: "Under Needs your attention, the lookbook shoot is marked At risk. Beacon shows why: it waits on Production's coat samples, which wait on the recycled wool, which missed Dec 5.",
      why: "Jules hears about a delay two teams away the day it happens, before the photographer's cancellation deadline." },
    { title: "Ask your agent instead of chasing", as: "jules", href: "/feed?agent=When+will+the+recycled+wool+arrive%3F&to=me",
      text: "The agent panel on the right has the question filled in. Press Send. Your agent sees that Sourcing owns it and asks Sourcing's agent. There's no new date yet, so it goes to Matteo, and 3 others asked too.",
      why: "Nobody has to find who's talking to the mill, and Matteo gets one question instead of four separate messages." },
    { title: "Add an agent teammate", as: "matteo", href: "/agents/new?template=demo",
      text: "Matteo adds Materials researcher, a Worker for Sourcing. It's filled in: what it can read, what it can do and what needs Matteo's OK. Click Add, then click \"Review the color-fastness report for lot 1\" in the chat and Approve.",
      why: "Matteo gets a teammate that reads every mill report the day it lands, so failed lots surface before samples are booked." },
    { title: "Post the new date", as: "matteo", href: "/write?example=1",
      text: "Matteo's notes are filled in. Click Split into items. At the top, Beacon flags that one line moves the Dec 5 promise to Dec 9. Scroll down and click Publish.",
      why: "Matteo writes the notes once. Beacon works out who's affected and updates the promise." },
    { title: "Everyone waiting hears about it", as: "jules", href: "/feed?agent=When+will+the+recycled+wool+arrive%3F&to=me",
      text: "Back as Jules, the panel has the same question ready. Send it. This time your agent answers straight from Matteo's update, with the source. The Inbox in the sidebar has the new date too.",
      why: "Production, Marketing and Merchandising all get the news at once, so nobody plans around an old date." },
    { title: "See the week on one page", as: "isabelle", href: "/digest", compare: "jules",
      text: "Isabelle sees one short paragraph per team, plus every commitment that slipped. The Design paragraph mentions an unannounced collaboration, so it's marked confidential. Open the page as Jules: that paragraph isn't there.",
      why: "Leaders get the whole picture, and embargoed work stays with the people cleared to see it." },
  ],
  explore: [
    { title: "Answer four people at once", as: "matteo", href: "/asks", text: "Four questions about the same date, merged into one. Answer once and everyone who asked gets the reply." },
    { title: "Turn a meeting into updates", as: "matteo", href: "/meetings/mt_wool", text: "Summarize the Sourcing × Production meeting. Beacon writes the decisions and turns each action item into a commitment for its owner." },
    { title: "Meet every agent teammate", as: "matteo", href: "/agents", text: "Every team's built-in agent plus the teammates teams added: Q&A agents that answer, and Workers that research, review documents or change code. Message any of them." },
    { title: "See how teams depend on each other", as: "isabelle", href: "/map", text: "Who owes whom, and who is asking whom, across the house." },
    { title: "Check who saw what", as: "isabelle", href: "/audit", text: "Every read, share and answer, including what each agent read and for whom." },
  ],
  checks: {
    search: { q: "fabric mills", team: "sourcing", owns: "Fabric mills" },
    feed: { as: "jules", decision: "ui_samples_decision", atRisk: "cm_shoot" },
    slipped: { as: "lucia", team: "production", commitment: "cm_wool", reason: "dye lot" },
    revise: { as: "matteo", team: "sourcing", commitment: "cm_wool", due: "2026-12-09", notify: ["lucia", "jules"] },
    digest: { allowed: "isabelle", denied: "jules", marking: "mk_conf", slipped: ["cm_wool", "cm_costing"] },
    route: { as: "jules", team: "sourcing", question: "When will the recycled wool arrive?", owner: "matteo", cluster: "ck_wool_date", askers: 4 },
    answer: { as: "noemie", team: "sourcing", question: "Is the recycled wool certified?", contains: "GRS", source: "update_item:ui_answer_grs" },
    leak: { as: "tiago", team: "design", question: "Is the Kestrel Outdoor collaboration happening?", secret: "Kestrel" },
  },
};
