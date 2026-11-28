// The Lakeport Courier: a fictional regional daily in a mid-size Canadian city, with about 140
// staff. The story is set on Dec 6, 2026: the care home operator's lawyer sends a letter disputing
// four points in the paper's investigation, so the legal read misses Dec 5. That puts the
// investigation's final edit, the Saturday Dec 12 front page and the 6 am digital launch at risk.
// The masthead and business office are quietly planning a change to the print schedule.
//
// The workflow follows how dailies run a big story: a story budget and afternoon news meeting,
// a pre-publication legal read, a right of reply to everyone named (the Canadian "responsible
// communication" defence, Grant v. Torstar, 2009), a front page planned days ahead, and a
// coordinated web, newsletter and push launch.
import type { DemoPack, Team, Person, Ownership, Item, StoryItem, Req, Com, Qn, Conn, SourceDoc, Mtg } from "./types";

const TEAMS: Team[] = [
  { id: "leadership", name: "Masthead", parent: null, color: "#3f3f46", description: "The editor-in-chief, managing editor and publisher. Sets coverage priorities and budgets." },
  { id: "news", name: "News", parent: "leadership", color: "#1d4ed8", description: "Reporting desks.", group: true },
  { id: "digital", name: "Visuals and audience", parent: "leadership", color: "#7c3aed", description: "Photo, video, web, social and newsletters.", group: true },
  { id: "editing", name: "Editing and standards", parent: "leadership", color: "#0e7490", description: "The copy and presentation desk, standards and legal.", group: true },
  { id: "city", name: "City desk", parent: "news", color: "#1d4ed8", description: "City hall, courts, health, schools and breaking news." },
  { id: "investigations", name: "Investigations", parent: "news", color: "#b91c1c", description: "Long-form investigative and data reporting." },
  { id: "sports", name: "Sports", parent: "news", color: "#15803d", description: "Local, junior and university sports." },
  { id: "photo", name: "Photo and video", parent: "digital", color: "#7c3aed", description: "Photojournalists, video and the photo archive." },
  { id: "audience", name: "Audience", parent: "digital", color: "#c2410c", description: "The website, social media, newsletters, push alerts and the podcast." },
  { id: "desk", name: "Copy and presentation desk", parent: "editing", color: "#0e7490", description: "Copy editing, headlines, page design and the front page." },
  { id: "standards", name: "Standards and legal", parent: "editing", color: "#a16207", description: "Legal reads, corrections, publication bans and the standards policy.", turnaround: "1 business day" },
  { id: "business", name: "Business office", parent: "leadership", color: "#52525b", description: "Subscriptions, advertising and printing." },
];

// [user id, name, title, team, role]
const PEOPLE: Person[] = [
  ["fiona", "Fiona Garrity", "Editor-in-chief", "leadership", "lead"],
  ["raj", "Raj Malhotra", "Managing editor", "leadership", "member"],
  ["colin", "Colin Ashworth", "Publisher", "leadership", "member"],
  ["teresa", "Teresa Novak", "Deputy managing editor, news", "news", "lead"],
  ["owen", "Owen Park", "Digital editor", "digital", "lead"],
  ["martine", "Martine Leblanc", "Deputy managing editor, editing", "editing", "lead"],
  ["grant", "Grant Hollis", "City editor", "city", "lead"],
  ["ayesha", "Ayesha Rahman", "City hall reporter", "city", "member"],
  ["noah", "Noah Fischer", "Courts and crime reporter", "city", "member"],
  ["bea", "Bea Santos", "Health reporter", "city", "member"],
  ["hugh", "Hugh Barlow", "Investigations editor", "investigations", "lead"],
  ["lena", "Lena Kovac", "Investigative reporter", "investigations", "member"],
  ["kofi", "Kofi Mensah", "Data reporter", "investigations", "member"],
  ["pete", "Pete Dunlop", "Sports editor", "sports", "lead"],
  ["carly", "Carly Vance", "Sports reporter", "sports", "member"],
  ["marco", "Marco Bellini", "Photo editor", "photo", "lead"],
  ["tasha", "Tasha Reid", "Photojournalist", "photo", "member"],
  ["jae", "Jae Lim", "Video producer", "photo", "member"],
  ["hannah", "Hannah Choi", "Audience editor", "audience", "lead"],
  ["devon", "Devon Brooks", "Social media producer", "audience", "member"],
  ["iris", "Iris Vandermeer", "Newsletter and podcast producer", "audience", "member"],
  ["gord", "Gord Patterson", "Presentation editor", "desk", "lead"],
  ["simone", "Simone Tremblay", "Copy editor", "desk", "member"],
  ["will", "Will Ostrowski", "Page designer", "desk", "member"],
  ["catherine", "Catherine Boyd", "Standards editor", "standards", "lead"],
  ["renee", "Renée Gagnon", "Legal counsel", "standards", "member"],
  ["alex", "Alex Ferreira", "Fact-checker", "standards", "member"],
  ["denise", "Denise Okafor", "Business director", "business", "lead"],
  ["ruth", "Ruth Kim", "Subscriptions manager", "business", "member"],
  ["tony", "Tony Marchetti", "Advertising manager", "business", "member"],
];

// [id, team, title, description, owner user, keywords]
const OWNS: Ownership[] = [
  ["own_cityhall", "city", "City hall", "Council, the budget and city departments", "ayesha", ["council", "city hall", "mayor", "budget"]],
  ["own_courts", "city", "Courts and crime", "Courts, police and crime", "noah", ["court", "courts", "police", "crime", "trial"]],
  ["own_health", "city", "Health", "Hospitals, public health and long-term care news", "bea", ["health", "hospital", "public health"]],
  ["own_carehome", "investigations", "Care home investigation", "The investigation into Linden Care Group's homes", "lena", ["care home", "linden", "long-term care", "investigation", "inspections"]],
  ["own_data", "investigations", "Data reporting", "Records requests, datasets and analysis", "kofi", ["data", "foi", "records", "freedom of information", "dataset"]],
  ["own_sports", "sports", "Sports coverage", "Local, junior and university sports", "pete", ["sports", "hockey", "game", "score"]],
  ["own_photo", "photo", "Photo assignments", "Photographers, portraits and the photo archive", "marco", ["photo", "photos", "photographer", "portrait", "portraits", "archive"]],
  ["own_video", "photo", "Video", "Video stories and live streams", "jae", ["video", "livestream", "stream"]],
  ["own_web", "audience", "Website and push alerts", "The homepage, push alerts and story launches", "hannah", ["website", "homepage", "push", "alert", "launch"]],
  ["own_social", "audience", "Social media", "Facebook, Instagram, TikTok and X", "devon", ["social", "facebook", "instagram", "tiktok"]],
  ["own_newsletter", "audience", "Newsletters and podcast", "The morning newsletter and the weekly podcast", "iris", ["newsletter", "podcast", "email"]],
  ["own_a1", "desk", "Front page", "The front page and page plan", "gord", ["front page", "a1", "page plan", "layout", "print"]],
  ["own_copy", "desk", "Copy editing", "Copy editing, headlines and style", "simone", ["copy", "headline", "headlines", "style", "cp style"]],
  ["own_legal", "standards", "Legal review", "Pre-publication legal reads, libel and defamation risk", "renee", ["legal", "legal read", "legal review", "lawyer", "libel", "defamation", "publication ban"]],
  ["own_standards", "standards", "Standards policy", "The standards policy, right of reply and anonymous sources", "catherine", ["standards", "right of reply", "anonymous", "sources", "policy"]],
  ["own_corrections", "standards", "Corrections", "Corrections and clarifications", "catherine", ["correction", "corrections", "clarification"]],
  ["own_factcheck", "standards", "Fact-checking", "Fact-checks for investigations and features", "alex", ["fact-check", "fact check", "facts"]],
  ["own_subs", "business", "Subscriptions", "Digital and print subscriptions and offers", "ruth", ["subscription", "subscriptions", "subscribers", "paywall", "offer"]],
  ["own_ads", "business", "Advertising", "Print and digital advertising", "tony", ["advertising", "ads", "advertiser", "sponsor"]],
  ["own_priorities", "leadership", "Coverage priorities", "Coverage priorities, staffing and budgets", "raj", ["priorities", "staffing", "strategy"]],
];

const FOLLOWS: Record<string, string[]> = {
  standards: ["investigations", "city", "desk", "audience", "leadership"],
  investigations: ["desk", "audience", "photo", "standards", "leadership"],
  desk: ["investigations", "audience", "photo", "city", "sports", "leadership"],
  audience: ["desk", "investigations", "business", "leadership"],
  photo: ["desk", "audience", "investigations"],
  city: ["desk", "audience", "photo", "leadership"],
  sports: ["desk", "audience", "photo"],
  business: ["leadership", "audience"],
  leadership: ["city", "investigations", "sports", "photo", "audience", "desk", "standards", "business"],
};

const ITEMS: Record<string, Item[]> = {
  city: [
    ["progress", "Council passed the transit fare freeze 7 to 4; our story was the most read of the week.", ["audience", "desk"]],
    ["decision", "Courts coverage moves to a daily brief online, with full stories only for major trials.", ["audience", "desk"]],
    ["progress", "The hospital emergency wait-time series ran in four parts.", ["audience", "photo"]],
    ["risk", "Two reporters are out over the holidays; breaking news coverage is thin Dec 24 to 27.", ["leadership", "desk"]],
    ["ask", "Photo: we need a photographer at the council budget meeting on Dec 9.", ["photo"]],
  ],
  investigations: [
    ["progress", "The care home investigation draft is done: 4,800 words, three homes, 18 months of inspection reports.", ["desk", "standards", "audience"]],
    ["decision", "We'll publish the inspection data as a searchable table alongside the story.", ["audience", "desk"]],
    ["progress", "Kofi finished the analysis of 1,140 provincial inspection reports.", ["standards"]],
    ["ask", "Photo: we need portraits of two families for the care home story.", ["photo"]],
  ],
  sports: [
    ["progress", "Junior hockey coverage drew 22% more readers this season.", ["audience"]],
    ["decision", "High school sports move to a Friday roundup page.", ["desk"]],
    ["ask", "Desk: can Sports get a full page on Dec 12 for the junior hockey showcase?", ["desk"]],
  ],
  photo: [
    ["progress", "Exterior and archive photos for the care home story are filed.", ["investigations", "desk"]],
    ["decision", "Every portrait subject signs a release before we shoot.", ["investigations", "city"]],
    ["risk", "Only two photographers are on Dec 9 and 10.", ["desk", "city"]],
    ["progress", "Our flood coverage won a provincial photo award.", ["audience"]],
  ],
  audience: [
    ["progress", "Digital subscriptions grew 9% this quarter; investigations drive the most sign-ups.", ["leadership", "business"]],
    ["decision", "Big investigations launch at 6 am on Saturdays, with the newsletter, a push alert and a podcast episode.", ["investigations", "desk"]],
    ["progress", "The morning newsletter passed 41,000 subscribers.", ["business"]],
    ["ask", "Investigations: send three pull quotes for social by Thursday.", ["investigations"]],
  ],
  desk: [
    ["progress", "Copy deadlines moved 30 minutes earlier after the press schedule change.", ["city", "sports"]],
    ["decision", "Front pages are planned at the Tuesday news meeting for the rest of the week.", ["investigations", "city", "audience"]],
    ["ask", "Reporters: file weekend stories by 4 pm Friday.", ["city", "sports"]],
  ],
  standards: [
    ["progress", "Corrections are down to 6 this month, from 11 in October.", ["city", "desk"]],
    ["decision", "Anonymous sources need the editor-in-chief's sign-off from January.", ["investigations", "city"]],
    ["progress", "Updated the guide to publication bans for the courts beat.", ["city"]],
  ],
  business: [
    ["progress", "The Black Friday subscription offer brought in 1,300 new subscribers.", ["audience", "leadership"]],
    ["decision", "Holiday ads close Dec 15.", ["desk"]],
    ["risk", "Newsprint prices rose 6%; we're reviewing print costs.", ["leadership"]],
  ],
  leadership: [
    ["decision", "Priorities for 2027: investigations first, local news second, newsletters third.", ["investigations", "city", "audience"]],
    ["decision", "Hiring stays flat in Q1 except for one data reporter.", ["investigations"]],
    ["progress", "The annual readers' town hall is set for Jan 22.", ["audience"]],
  ],
};

const STORY: StoryItem[] = [
  ["standards", 5, "answer", "Every allegation in the care home investigation went to the operator, Linden Care Group, in writing on Nov 26 with 48 hours to respond, as our standards policy requires.",
    "The care home operator got every allegation in writing with 48 hours to respond.", "Operator got a right of reply.", ["investigations", "desk", "audience"], null, "answer_reply"],
  ["desk", 6, "decision", "We decided the care home investigation leads the Saturday Dec 12 front page, with a two-page spread inside. The final edit is due Dec 10 and pages close at 9 pm on Dec 11.",
    "The care home investigation leads the Dec 12 front page; pages close Dec 11.", "Front page planned for Dec 12.", ["investigations", "audience", "photo"], null, "a1_decision"],
  ["standards", 7, "risk", "Linden Care Group's lawyer sent a letter on Dec 3 disputing four points in the care home investigation, so the legal read won't be finished by Dec 5. Renée is checking the letter against our documents.",
    "The legal read of the care home story will miss Dec 5 after a letter from the operator's lawyer.", "Legal read delayed.", ["investigations", "desk"], null, "legal_late"],
  ["standards", 7, "progress", "Cleared the courts brief on the Lakeport assault trial; the publication ban is respected.",
    "Cleared the courts brief; the publication ban is respected.", "Courts brief cleared.", ["city"], null, "courts_ok"],
  ["investigations", 7, "risk", "The care home investigation can't go to final edit until Legal clears it. Hugh needs two days for the final edit and fact-check after that.",
    "The care home story waits on Legal; final edit takes two days after.", "Care home story waits on a review.", ["standards", "desk", "audience"], null, "story_dep"],
  ["audience", 7, "risk", "The 6 am Saturday launch (the story, the newsletter to 41,000 subscribers, a push alert and a podcast episode) is built around the care home investigation. Without it we need a new lead by Thursday.",
    "The Saturday launch depends on the care home investigation.", "Saturday launch planned.", ["desk", "investigations"], null, "launch_dep"],
  ["business", 7, "progress", "Halvorsen Printing's press contract ends Feb 28. From March 2 the Courier prints five days a week, with Monday and Tuesday digital only. Nothing about this goes outside the masthead and the business office before the staff meeting on Jan 15.",
    "We're planning a change to the print schedule; details stay confidential until a staff meeting in January.", "Print planning under way.", ["leadership"], "mk_conf", "print_days"],
];

const REQS: Req[] = [
  ["rq_legal", "investigations", "standards", "hugh", "Legal read of the care home investigation by Dec 5",
    "The story is set for the Dec 12 front page. Can Legal finish the read by Dec 5 so we have time for the final edit?", "2026-11-24", "2026-12-05", "accepted", "own_legal", "renee", null, "form"],
  ["rq_when_1", "desk", "standards", "gord", "When will the legal read be done? A1 is held for the care home story.",
    "Asked the Standards agent. I need to know by Thursday whether to plan a backup front page.", "2026-12-04", null, "open", "own_legal", "renee", "ck_legal_date", "agent"],
  ["rq_when_2", "audience", "standards", "hannah", "Is the care home story still cleared for Saturday? The newsletter and push alert depend on the legal read.",
    "Asked the Standards agent.", "2026-12-05", null, "open", "own_legal", "renee", "ck_legal_date", "agent"],
  ["rq_when_3", "photo", "standards", "marco", "When does the legal read finish? I'm holding Tasha for the family portraits.",
    "Asked the Standards agent.", "2026-12-05", null, "open", "own_legal", "renee", "ck_legal_date", "agent"],
  ["rq_ban", "city", "standards", "noah", "Can we name the witness in the Lakeport assault trial?",
    "The judge mentioned a ban in court; I want to check before the trial resumes Dec 14.", "2026-12-05", "2026-12-14", "open", "own_legal", "renee", "ck_ban", "form"],
  ["rq_letter", "audience", "standards", "devon", "Can we post the operator's response letter on social?",
    "Asked the Standards agent.", "2026-12-04", null, "open", "own_standards", "catherine", "ck_letter", "agent"],
  ["rq_portraits", "investigations", "photo", "lena", "Portraits of two families for the care home story",
    "Both families agreed. Any day before Dec 10.", "2026-12-02", "2026-12-10", "open", "own_photo", "marco", "ck_portraits", "form"],
  ["rq_page", "sports", "desk", "carly", "Can Sports get a full page on Dec 12 for the junior hockey showcase?",
    "Six teams, two days of games.", "2026-12-03", null, "open", "own_a1", "gord", "ck_page", "form"],
];

const COMS: Com[] = [
  ["cm_legal", "standards", "renee", "investigations", "Legal read of the care home investigation finished", "2026-12-05", "open", "request", "rq_legal", null,
    "Linden Care Group's lawyer sent a letter on Dec 3 disputing four points; Legal is checking it against our documents (Standards' Dec 4 update).", null],
  ["cm_story", "investigations", "lena", "desk", "Care home investigation: final edit and fact-check done", "2026-12-10", "open", "manual", null, "cm_legal", null, null],
  ["cm_a1", "desk", "gord", "audience", "Saturday Dec 12 front page with the care home investigation", "2026-12-11", "open", "update_item", "ui_a1_decision", "cm_story", null, null],
  ["cm_launch", "audience", "hannah", "leadership", "6 am Saturday launch: story, newsletter, push alert and podcast", "2026-12-12", "open", "manual", null, "cm_a1", null, null],
  ["cm_budget", "city", "ayesha", "leadership", "Council budget explainer published", "2026-12-03", "open", "manual", null, null, "Waiting on the city's revised budget numbers.", null],
  ["cm_offer", "business", "ruth", "leadership", "Holiday subscription offer live", "2026-12-14", "open", "manual", null, null, null, null],
  ["cm_archive", "photo", "tasha", "investigations", "Care home exterior and archive photos filed", "2026-12-01", "done", "manual", null, null, null, "2026-11-30"],
  ["cm_policy", "standards", "catherine", "leadership", "Publication ban guide updated", "2026-12-02", "done", "manual", null, null, null, "2026-12-01"],
];

const QS: Qn[] = [
  ["qn_1", "simone", "standards", "Did the care home operator get a right of reply?", "answered",
    "The care home operator got every allegation in writing with 48 hours to respond.", ["update_item:ui_answer_reply"], null, "2026-11-27"],
  ["qn_2", "devon", "desk", "What's leading Saturday's front page?", "answered",
    "The care home investigation leads the Dec 12 front page; pages close Dec 11.", ["update_item:ui_a1_decision"], null, "2026-11-30"],
  ["qn_3", "carly", "business", "When do holiday ads close?", "answered", "Holiday ads close Dec 15.", [], null, "2026-11-25"],
  ["qn_4", "gord", "standards", "When will the legal read be done?", "routed",
    "Standards and legal hasn't published a new date. I asked Renée Gagnon, who owns Legal review.", [], "rq_when_1", "2026-12-04"],
  ["qn_5", "hannah", "standards", "Is the care home story still cleared for Saturday?", "routed",
    "Standards and legal hasn't published a new date. I asked Renée Gagnon, who owns Legal review.", [], "rq_when_2", "2026-12-05"],
  ["qn_6", "marco", "standards", "When does the legal read finish?", "routed",
    "Standards and legal hasn't published a new date. I asked Renée Gagnon, who owns Legal review.", [], "rq_when_3", "2026-12-05"],
  ["qn_7", "devon", "standards", "Can we post the operator's response letter on social?", "routed",
    "Standards and legal hasn't published anything on this. I asked Catherine Boyd, who owns Standards policy.", [], "rq_letter", "2026-12-04"],
  ["qn_8", "bea", "desk", "When are weekend stories due?", "answered", "Reporters file weekend stories by 4 pm Friday.", [], null, "2026-11-28"],
];

const CONNECTORS: Conn[] = [
  ["cn_std_slack", "standards", "slack", "#standards-legal", "catherine"],
  ["cn_std_drive", "standards", "gdrive", "Legal files", "renee"],
  ["cn_std_zoom", "standards", "zoom", "Zoom", "catherine"],
  ["cn_inv_slack", "investigations", "slack", "#investigations", "hugh"],
  ["cn_inv_drive", "investigations", "gdrive", "Care home investigation files", "lena"],
  ["cn_desk_slack", "desk", "slack", "#desk", "gord"],
  ["cn_desk_drive", "desk", "gdrive", "News budget", "gord"],
  ["cn_desk_zoom", "desk", "zoom", "Zoom", "gord"],
  ["cn_aud_slack", "audience", "slack", "#audience", "hannah"],
  ["cn_aud_notion", "audience", "notion", "Launch calendar", "hannah"],
  ["cn_pho_slack", "photo", "slack", "#photo", "marco"],
  ["cn_city_slack", "city", "slack", "#citydesk", "grant"],
  ["cn_biz_drive", "business", "gdrive", "Business office", "denise"],
  ["cn_lead_drive", "leadership", "gdrive", "Masthead", "raj"],
  ["cn_lead_zoom", "leadership", "zoom", "Zoom", "raj"],
];

const DOCS: SourceDoc[] = [
  // Standards and legal
  ["cn_std_drive", "doc", null, "Letter from Linden Care Group's lawyer, Dec 3", "Disputes four points: staffing levels at Elm Ridge, two inspection findings and a quote from a former manager. Asks the Courier not to publish.", null, "Renée Gagnon", "2026-12-03T16:00:00Z"],
  ["cn_std_drive", "doc", null, "Legal read notes: care home investigation", "Two of the four disputed points are backed by provincial inspection reports. The staffing figure needs a second source. The former manager's quote needs her recording.", null, "Renée Gagnon", "2026-12-04T15:00:00Z"],
  ["cn_std_slack", "message", null, "Renée Gagnon in #standards-legal", "Lena is sending the operator a new right-of-reply letter on the staffing figure. They get 48 hours.", null, "Renée Gagnon", "2026-12-04T21:10:00Z"],
  ["cn_std_slack", "message", null, "Catherine Boyd in #standards-legal", "Let's not give the desk a date until the operator's reply is in. Tentatively Dec 9.", null, "Catherine Boyd", "2026-12-05T09:05:00Z"],
  // Investigations
  ["cn_inv_drive", "doc", null, "Care home investigation: draft 4", "4,800 words on three Linden Care Group homes. 1,140 inspection reports analyzed. Two families interviewed.", null, "Lena Kovac", "2026-12-02T10:00:00Z"],
  ["cn_inv_slack", "message", null, "Lena Kovac in #investigations", "The former manager is fine with us sharing her recording with Legal. Sending it to Renée now.", null, "Lena Kovac", "2026-12-05T10:00:00Z"],
  ["cn_inv_slack", "message", null, "Hugh Barlow in #investigations", "If Legal clears it Dec 9, I can finish the final edit by Dec 10 with Alex on the fact-check.", null, "Hugh Barlow", "2026-12-05T11:30:00Z"],
  // Desk
  ["cn_desk_drive", "doc", null, "News budget, week of Dec 7", "Saturday A1: care home investigation, two-page spread on A4 and A5. Backup: council budget explainer. Pages close 9 pm Dec 11.", null, "Gord Patterson", "2026-12-02T10:00:00Z"],
  ["cn_desk_slack", "message", null, "Gord Patterson in #desk", "I'll draw a backup A1 by Thursday just in case. I'd rather not use it.", null, "Gord Patterson", "2026-12-05T12:00:00Z"],
  // Audience and photo
  ["cn_aud_notion", "doc", null, "Saturday Dec 12 launch plan", "6 am: story, data table and video live. 6:05 push alert. 7 am newsletter to 41,000. Podcast episode recorded Dec 11.", null, "Hannah Choi", "2026-12-03T10:00:00Z"],
  ["cn_aud_slack", "message", null, "Hannah Choi in #audience", "If the story slips a week we move the podcast too. Iris, can you hold the Dec 11 recording slot?", null, "Hannah Choi", "2026-12-05T13:00:00Z"],
  ["cn_pho_slack", "message", null, "Marco Bellini in #photo", "Tasha can do both family portraits Dec 8 if the story is still on.", null, "Marco Bellini", "2026-12-05T14:00:00Z"],
  // City
  ["cn_city_slack", "message", null, "Grant Hollis in #citydesk", "The budget explainer can be the backup front page if we need it.", null, "Grant Hollis", "2026-12-05T15:00:00Z"],
  // Confidential
  ["cn_biz_drive", "doc", null, "Halvorsen Printing: contract end", "Press contract ends Feb 28. Five print days from March 2; Monday and Tuesday digital only. Staff meeting Jan 15.", null, "Denise Okafor", "2026-12-02T10:00:00Z", "mk_conf"],
  ["cn_lead_drive", "doc", null, "Print schedule plan", "Five-day print week from March 2 after the Halvorsen contract ends. Announce to staff Jan 15, readers Feb 1.", null, "Colin Ashworth", "2026-12-01T10:00:00Z", "mk_conf"],
];

const T1 = `Catherine Boyd: Thanks for joining. The topic is the legal read of the care home investigation.
Renée Gagnon: Status first. Linden Care Group's lawyer sent a letter on Dec 3 disputing four points. Two are backed by inspection reports. The staffing figure needs a second source, and I need the former manager's recording.
Hugh Barlow: What does that do to Dec 5? I need two days for the final edit, and pages close Dec 11.
Renée Gagnon: Dec 5 is gone. The operator has 48 hours to answer the new right-of-reply letter. If nothing new comes back, I can finish the legal read by Dec 9.
Catherine Boyd: Let's not promise a date until the operator replies. I'll confirm the new date with the desk by Dec 8.
Lena Kovac: I'll get the former manager's recording to Renée by Dec 6.
Hugh Barlow: Then the decision is we keep the Dec 12 front page and do the final edit Dec 9 and 10.
Catherine Boyd: Agreed. The desk and Audience should hear this before they plan backups.
Alex Ferreira: I'll have the fact-check of the data table done by Dec 8.
Renée Gagnon: One more thing: Audience wants to post the operator's letter. Let's decide that once the story is cleared.`;

const T2 = `Raj Malhotra: Afternoon news meeting. Saturday first.
Gord Patterson: A1 is held for the care home investigation, with the spread on A4 and A5.
Hugh Barlow: It's waiting on a new date. Legal needs more time after the operator's letter, so the final edit waits on Legal.
Gord Patterson: Then let's decide now: if the story isn't cleared by Dec 10, the council budget explainer leads Saturday and care homes move a week.
Raj Malhotra: Agreed, that's the decision. Hannah, can the launch work either way?
Hannah Choi: Yes, I'll have both launch plans ready by Dec 9.
Marco Bellini: Tasha shoots the family portraits Dec 8 either way.
Raj Malhotra: I'll tell Fiona by Dec 8.`;

const T3 = `Fiona Garrity: Two topics: the 2027 plan and printing.
Colin Ashworth: Halvorsen Printing's contract ends Feb 28. We go to five print days from March 2, with Monday and Tuesday digital only.
Denise Okafor: Subscribers keep their rate. The business office has the reader letter drafted.
Fiona Garrity: Decision: nothing about printing goes beyond this group and the business office until the staff meeting on Jan 15.
Raj Malhotra: The desk will need a new page plan. I'll ask Gord without saying why.
Colin Ashworth: I'll have the staff announcement drafted by Jan 8.
Denise Okafor: I'll have the reader letter ready by Jan 20.`;

const MEETINGS: Mtg[] = [
  ["mt_legal", "standards", "cn_std_zoom", "Legal read: care home investigation", "2026-12-04T16:00:00Z", 30, ["catherine", "renee", "alex", "hugh", "lena"], T1, "recorded", null, null],
  ["mt_news", "desk", "cn_desk_zoom", "Afternoon news meeting", "2026-12-05T19:00:00Z", 25, ["raj", "gord", "hugh", "hannah", "marco"], T2, "summarized", null, {
    summary: "Saturday's front page is held for the care home investigation, which waits on the delayed legal read. If it isn't cleared by Dec 10, the council budget explainer leads and care homes move a week.",
    decisions: ["If the care home story isn't cleared by Dec 10, the council budget explainer leads Saturday's front page."],
    risks: ["The final edit depends on the legal read; Dec 10 may move."],
    action_items: [
      { owner: "hannah", text: "Prepare launch plans for both front pages", due: "2026-12-09" },
      { owner: "raj", text: "Brief the editor-in-chief", due: "2026-12-08" },
    ],
    by: "Offline writer",
  }],
  ["mt_masthead", "leadership", "cn_lead_zoom", "Masthead meeting", "2026-12-03T17:00:00Z", 45, ["fiona", "raj", "colin", "denise"], T3, "summarized", "mk_conf", {
    summary: "Halvorsen Printing's press contract ends Feb 28 and the Courier moves to five print days from March 2. Nothing about it leaves the masthead and the business office before the Jan 15 staff meeting.",
    decisions: ["Keep the print schedule change within the masthead and the business office until Jan 15; the desk gets an unnamed request."],
    risks: ["Newsprint costs rose 6%."],
    action_items: [
      { owner: "colin", text: "Draft the staff announcement", due: "2027-01-08" },
      { owner: "denise", text: "Prepare the reader letter", due: "2027-01-20" },
    ],
    by: "Offline writer",
  }],
];

export const lakeportCourier: DemoPack = {
  id: "newsroom",
  audience: "Regional daily newspaper",
  org: { name: "The Lakeport Courier", short: "the Courier", headcount: 140, domain: "lakeportcourier", about: "a fictional regional daily newspaper in a mid-size Canadian city, with about 140 staff" },
  summary:
    "The legal read on a big investigation needs a few more days, and everyone planning Saturday gets the new date without asking the reporter.",
  defaultPersona: "lena",
  teams: TEAMS,
  people: PEOPLE,
  alsoOnLeadership: ["teresa", "owen", "martine"],
  owns: OWNS,
  follows: FOLLOWS,
  interfaceOverrides: [
    { from: "standards", to: "investigations", level: "full", cadence: "immediate" },
    { from: "business", to: "leadership", level: "full", allKinds: true },
    { from: "desk", to: "audience", cadence: "immediate" },
  ],
  markings: [{ id: "mk_conf", label: "Confidential: Masthead and business office only", allowed: ["leadership", "business"], othersLevel: "summary" }],
  items: ITEMS,
  story: STORY,
  requests: REQS,
  confidentialRequests: [
    {
      id: "rq_pageplan", from: "leadership", to: "desk", requester: "raj",
      title: "Page plan for a five-day print week after the Halvorsen contract ends",
      details: "Halvorsen Printing's contract ends Feb 28. Draft a page plan for five print days from March 2, with Monday and Tuesday digital only. Needed by Dec 18.",
      summaryTitle: "Page plan for a possible print schedule change",
      summaryDetails: "The masthead needs a draft page plan for a possible change to the print schedule. Needed by Dec 18.",
      headline: "The masthead asked the desk about page planning",
      neededBy: "2026-12-18", ownership: "own_a1", assignee: "gord", marking: "mk_conf", cluster: "ck_pageplan", created: "2026-12-03T14:00:00Z",
    },
  ],
  commitments: COMS,
  questions: QS,
  connectors: CONNECTORS,
  docs: DOCS,
  meetings: MEETINGS,
  agentSpend: { standards: 41, investigations: 38, audience: 29 },
  task: {
    id: "tr_aud_carehomes",
    unit: "audience",
    requestedBy: "hannah",
    title: "What do readers want to know about care homes?",
    instructions: "Pull together what readers have asked us about long-term care this year, and what Investigations has published about the story. I need it to plan the Saturday launch.",
    steps: [
      { at: "2026-12-05T14:00:00Z", kind: "start", text: "Started for Hannah Choi." },
      { at: "2026-12-05T14:00:20Z", kind: "read", text: "Read the Saturday launch plan and the news budget." },
      { at: "2026-12-05T14:00:40Z", kind: "read", text: "Read #audience from the last two weeks." },
      { at: "2026-12-05T14:01:30Z", kind: "read", text: "Read what Investigations has published about the story (at Audience's level)." },
      { at: "2026-12-05T14:02:10Z", kind: "done", text: "Wrote a brief with 3 findings." },
    ],
    result:
      "## What readers want to know\n\n- **How to check a home.** The most common question is how to look up a home's inspection record.\n- **What families can do.** Readers ask who to call when they're worried about a parent.\n- **Names.** Readers want the homes named, not just the operator.\n\n## Where the story stands\n\nThe desk plans it for the Dec 12 front page, but the legal read missed Dec 5 and Standards hasn't published a new date.\n\n## Recommendation\n\nLaunch with the searchable inspection table and a short \"how to check a home\" guide in the newsletter.",
    sources: [{ title: "Saturday Dec 12 launch plan" }, { title: "#audience" }, { title: "The desk's front page decision" }],
    at: "2026-12-05T14:00:00Z",
    doneAt: "2026-12-05T14:02:10Z",
  },
  ui: {
    writeExamples: {
      standards: `Standards and legal weekly, Dec 6
- Two of the four points in the operator's letter are backed by provincial inspection reports.
- We'll finish the legal read of the care home investigation by Dec 9.
- The former manager's recording supports her quote.
- Can Investigations confirm the final edit can start a day later?`,
      investigations: `Investigations weekly
- The data table for the care home story is built and fact-checked.
- We still need Legal to clear the care home story before the final edit.
- We'll finish the final edit and fact-check by Dec 10.`,
      desk: `Desk weekly
- Saturday's spread is designed and waiting on copy.
- If the care home story isn't cleared by Dec 10, the council budget explainer leads Saturday.`,
    },
    askExamples: {
      standards: "When will the legal read be done?",
      desk: "What's leading Saturday's front page?",
      business: "When do holiday ads close?",
    },
    searchHint: 'Try "legal review", "push alerts" or a name',
    researchHint: "How have other Canadian newsrooms covered long-term care inspections?",
    sampleSessions: {},
  },
  intro: {
    problem:
      "Lena's care home investigation is planned for Saturday's front page once Legal clears it. The operator's lawyer sent a letter with questions, so Renée is taking a few more days on the legal read. Here's how the desk, Audience and Photo stay in step without chasing Lena.",
    cast: [
      { as: "lena", note: "The reporter, whose story is planned for Saturday's front page." },
      { as: "renee", note: "The paper's lawyer, doing the legal read." },
      { as: "fiona", note: "The editor-in-chief, who wants the newsroom's week on one page." },
    ],
  },
  agentTemplate: {
    team: "standards",
    name: "Legal read prep",
    firstJob: "Review the letter from Linden Care Group's lawyer",
    purpose: "Before each legal read, review the documents: list every named person and allegation, check the right-of-reply letters went out, flag publication bans, and draft Standards' weekly update. Renée makes every legal call.",
    actions: ["documents", "research", "draft_update"],
  },
  guide: [
    { title: "Start the day in your feed", as: "lena", href: "/feed",
      text: "Under Dates that are changing, Lena's final edit shows Waiting on a change. Beacon traces it to the legal read, which needs a few more days. Below, the desk's decision to lead Saturday's front page with the story.",
      why: "Lena sees the whole plan in one place: Legal, her story, the front page and the Saturday launch." },
    { title: "Ask your agent", as: "lena", href: "/feed?agent=When+will+the+legal+read+be+done%3F&to=me",
      text: "The agent panel on the right has the question filled in. Press Send. Your agent sees that Standards and legal owns it and asks Standards and legal's agent. The new date isn't posted yet, so it goes to Renée, and 3 others asked too.",
      why: "The desk, Audience and Photo were asking too. Renée gets one question instead of four messages, and nobody has to chase Lena." },
    { title: "Add an agent teammate", as: "renee", href: "/agents/new?template=demo",
      text: "Renée adds Legal read prep, a Worker for Standards and legal. It's filled in: what it can read, what it can do and what needs Renée's OK. Click Add, then click \"Review the letter from Linden Care Group's lawyer\" in the chat and Approve.",
      why: "Renée gets a prep checklist for every legal read: names, figures and disputed points. She still makes every legal call." },
    { title: "Post the new date", as: "renee", href: "/write?example=1",
      text: "Renée's notes are filled in. Click Split into items. At the top, Beacon flags that one line moves the Dec 5 promise to Dec 9. Scroll down and click Publish.",
      why: "Renée writes her notes once. Beacon works out who's waiting and updates the promise." },
    { title: "Everyone gets the new date", as: "lena", href: "/feed?agent=When+will+the+legal+read+be+done%3F&to=me",
      text: "Back as Lena, the panel has the same question ready. Send it. This time your agent answers straight from Renée's update, with the source. The Inbox in the sidebar has the new date too.",
      why: "The desk, Audience and Photo get the news at the same moment, so nobody draws a backup front page for nothing." },
    { title: "See the week on one page", as: "fiona", href: "/digest", compare: "lena",
      text: "Fiona sees one short paragraph per desk, plus every date that is changing. The business office paragraph covers a print schedule change, so it's confidential. Open the page as Lena: that paragraph isn't there.",
      why: "The editor-in-chief gets the whole newsroom at a glance, and sensitive business plans stay with the people cleared to see them." },
  ],
  explore: [
    { title: "Answer four people at once", as: "renee", href: "/asks", text: "Four questions about the same date, merged into one. Answer once and everyone who asked gets the reply." },
    { title: "Turn a meeting into updates", as: "renee", href: "/meetings/mt_legal", text: "Summarize the legal read meeting. Beacon writes the decisions and turns each action item into a commitment for its owner." },
    { title: "Meet every agent teammate", as: "renee", href: "/agents", text: "Every team's built-in agent plus the teammates teams added: Q&A agents that answer, and Workers that research, review documents or change code. Message any of them." },
    { title: "See how desks depend on each other", as: "fiona", href: "/map", text: "Who owes whom, and who is asking whom, across the newsroom." },
    { title: "Check who saw what", as: "fiona", href: "/audit", text: "Every read, share and answer, including what each agent read and for whom." },
  ],
  checks: {
    search: { q: "legal review", team: "standards", owns: "Legal review" },
    feed: { as: "lena", decision: "ui_a1_decision", atRisk: "cm_story" },
    slipped: { as: "hugh", team: "investigations", commitment: "cm_legal", reason: "letter" },
    revise: { as: "renee", team: "standards", commitment: "cm_legal", due: "2026-12-09", notify: ["lena", "gord"] },
    digest: { allowed: "fiona", denied: "lena", marking: "mk_conf", slipped: ["cm_legal", "cm_budget"] },
    route: { as: "lena", team: "standards", question: "When will the legal read be done?", owner: "renee", cluster: "ck_legal_date", askers: 4 },
    answer: { as: "will", team: "standards", question: "Did the care home operator get a right of reply?", contains: "48 hours", source: "update_item:ui_answer_reply" },
    leak: { as: "lena", team: "business", question: "Is the Halvorsen printing contract ending?", secret: "Halvorsen" },
  },
};
