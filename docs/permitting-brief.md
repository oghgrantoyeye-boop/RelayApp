# Relay build brief for Claude Code

Nov 26, 2026 · @Ovo

> Exported from the claude.ai doc "Relay build brief for Claude Code" (rev 12): https://claude.ai/artifact/1eGQPLRLWv6PhWm9VnAi4n

## How to use this brief

Build v0 of Relay: an internal permit-review tool for one city, on a data model that can grow into the full platform. Export this doc as Markdown and save it in the repo as `SPEC.md`.

Instructions for Claude Code:

- Build only what the MVP scope section lists. Everything else is context so the data model doesn't box us in later.
- Keep the core to the six primitives. If a feature needs a new primitive, stop and propose it instead of adding it.
- Seed realistic demo data for a fictional city (City of Harborview) so the app can be demoed without a real customer.
- Ask before choosing anything this brief marks as an open question.

## Artifacts from this session

Claude Code can't open claude.ai links, which are private to you. Put the files from the attached bundle in the repo as shown, and keep the links for your own reference.

| Artifact | What it is | Use for Claude Code | Repo path |
| --- | --- | --- | --- |
| [Relay platform: units, interfaces and entities in three domains](https://claude.ai/artifact/VwWK7tzXxBBhsJPSUMHPmo) | Design canvas. The "Polished screens" page has Queue, Application, Unit and Athlete. "First draft" has sports, corporate and city boards | **Primary visual reference.** Match the polished city screens | `design/mocks/` |
| Mock generator scripts (`gen2.py`, `screens2*.py`) | Python that produced the polished mocks, including the colors, pills, AI cards and role switch | Lift design tokens and seed copy directly | `design/source/` |
| [Athletic department agent: UI mocks](https://claude.ai/artifact/NRULDan3tXdZQSYyjecax8) | Earlier sports-only mocks, from before the pivot to a horizontal platform | Background only. Superseded | not needed |
| [Pitch: An AI Research Department for Sports](https://claude.ai/artifact/VHm9YGkghFoh7B8nTtNgB9) | The original idea: an AI research scientist for a sports organization | Where "agents as members" came from. Background only | not needed |
| [Autonomous AI Research Platform: Assessment of Open Questions](https://claude.ai/artifact/McUKJAMsdj9GZgsH6zThwt) | Analysis of the original idea's risks and open questions | Background only | not needed |
| [Sports recruiting intelligence: market sizing by buyer tier](https://claude.ai/artifact/99pfiqEVynNU7WqSjDQpMz) | Market sizing sheet for the sports version | Not for v0. Relevant to a later athletics pack | not needed |
| Sports operations friction research (report) | Research on front-office pain points in sports organizations | Context for the athletics pack later | `docs/research/` |

## Product summary

Relay routes information between teams so they don't need handoff meetings. The thesis is "information first, meetings second." Most day-to-day work is passing information along chains of command. Relay keeps the chain but lets each team decide what it shares with every other team, at what level of detail, and when.

- **Units** are teams. Each unit publishes an interface: what it shares, with whom, at what detail, and on what trigger.
- **Entities** are the things work is about (a permit application, a player, an initiative). They're first-class and tracked across units. Each field is owned by one unit.
- **Agents** are members of a unit, like people. Each is one continuous colleague with its own memory, compute and budget.
- **The public is a unit too.** An applicant gets the same kind of interface as an internal department.

Positioning: Relay is the routing layer above meeting note-takers and enterprise search (Glean, Copilot, Slackbot). Those tools find information when you ask. Relay pushes the right slice of it to the right people. It's a horizontal platform sold through vertical packs, starting with city permitting. Sports organizations and corporate planning are later packs.

## How the idea developed

Relay started as an AI research scientist for sports teams and became a general platform for how teams share information, with city permitting as the first market. Knowing this path explains why the data model is general but the first product is narrow.

1. **AI research department for sports.** The original idea was agents that analyze player data for a sports organization. These were shared by staff, with one memory anyone could talk to. See the pitch and assessment docs.
2. **Exploring sports problems.** We looked at front-office software, handoffs between players and agents, NIL, and medical, legal and financial services for athletes. Conclusion: sports buying runs on relationships, contracts and skepticism, NIL is saturated, and outsiders are at a disadvantage. Sports stays as a later vertical pack, not the starting point.
3. **The core insight, from Amazon.** Much of the workday goes to handoff meetings, knowledge transfer and waiting on other teams. Amazon's writing culture showed that information first, meetings second works, but no tool supports it across teams. The goal became keeping the chain of command while democratizing information across it.
4. **Not another search tool.** Glean, Copilot and Slackbot answer questions when you ask. They lack domain connectors such as medical or sports analytics, and they don't push information or respect team boundaries. Relay became the routing layer above them.
5. **The model takes shape.** Teams become units that define how they work with other units and what they share automatically. Unit admins add their own connectors. Domain entities, like a player tracked across departments, are first-class. That produced the six primitives.
6. **Three domains, one platform.** The first mocks applied the same model to athletics, corporate planning and a city. They showed the primitives generalize without custom code.
7. **City permitting as the first customer.** YC's "AI for City Hall" request matched well. One permit crosses up to six departments, and the applicant can't see who's holding it. Decisions: the public is a unit; build a staff tool before a public portal; generate the portal from the schema rather than building an app builder.
8. **Security.** Thinking about military buyers added mandatory markings, aggregation risk (combining harmless facts reveals sensitive ones) and inherited markings on derived outputs. These shaped the permission model even for cities.
9. **Agents return as members.** The original analysis agents came back as unit members with identity, compute, a budget and a manager, acting with the requester's access. That added complexity, so the plan is to build v0 only but design the data model for v3.
10. **Go-to-market.** Pilots funded through grants, delivery through Outlook and Teams first because cities use Microsoft, and the Collison installation approach: set it up for the customer in person, using their data exports.
11. **Refinements today.** "What is my dependency working on, and when will it deliver?" confirmed the person waiting on a request as the core user. Architects' code compliance was judged a different product and filed as a future connector (UpCodes, CivCheck). YC's Multiplayer AI request led to the agent model: one continuous colleague, shared inside its unit and bounded everywhere else.

Decided against:

| Option | Why not |
| --- | --- |
| Starting in sports | Relationship-driven buying, saturated NIL market, outsider disadvantage |
| Starting in Africa | Considered early. Not pursued for the first market |
| Hardware | Explored briefly. Not pursued |
| A code-compliance checker | UpCodes and others own it. It checks the work rather than routing information about it |
| A general app builder for public portals | Too broad. Generate the portal from the schema instead |
| Competing on dependency tracking in software companies | Atlassian and Linear will add features faster. It's one Relay feature, not the pitch |

## First customer: city permitting

The first customer is a city building department. One permit application crosses up to six departments, and applicants can't see who is holding it. This matches YC's "AI for City Hall" request.

The permit process Relay models:

1. **Pre-application:** the applicant asks what's needed. This is optional.
2. **Submission:** forms, drawings and fees.
3. **Intake:** a clerk checks that the submission is complete.
4. **Multi-department review:** building, zoning, fire, engineering, planning and utilities review, often in parallel.
5. **Corrections:** reviewers send comments, and the applicant resubmits. Steps 4 and 5 repeat, often two or three times.
6. **Issuance:** the permit is issued.
7. **Inspections:** during construction.
8. **Occupancy:** the final sign-off.

The product grows in three layers. Build only the first for v0.

| Layer | What it is | Users |
| --- | --- | --- |
| v0: Staff tool | Internal queue, application view, department reviews, role-based summaries | City staff |
| v1: Outbound updates | Automatic status and comment updates to applicants by email | Staff and applicants (read only) |
| v2: Public front door | Submit, track and respond to corrections. Generated from the entity schema, not hand-built | Applicants, architects, contractors |

The public front door is not a general app builder. It is generated from the permit entity's schema and the public unit's interface.

## Core primitives and data model

Everything in Relay is built from six primitives. Vertical packs (permitting, athletics, corporate) are configuration: entity types, units and interfaces. They are not new code paths.

| Primitive | What it is | Permitting example |
| --- | --- | --- |
| Unit | A team with members, connectors and an interface | Fire prevention |
| Member | A person or an agent in a unit, with a role | Reviewer Leo Grant; Plan pre-check agent |
| Entity and Field | A tracked thing with typed fields. Each field is owned by exactly one unit | Application BP-2027-0418; `fire_review_status` owned by Fire |
| Interface | A unit's published rule: which fields, at what disclosure level, to which units, on what trigger | Fire shares review status as a summary with Zoning on each change |
| Marking | A mandatory restriction on a field or derived output that overrides interfaces | "Contains applicant financial data" |
| Audit log | An append-only record of every read, share, agent action and override | Agent read the drawings at 09:14 for reviewer Grant |

Disclosure levels, from most to least detail: **Full detail**, **Summary**, **Status only**, **Headline**, **Not shared**.

Starting schema (adjust names, keep the shape):

```
unit(id, org_id, name, kind)                 -- kind: internal | public
member(id, unit_id, kind, name, role, manager_id)  -- kind: person | agent
entity_type(id, org_id, name, schema_json)   -- e.g. permit_application
entity(id, entity_type_id, external_ref, created_at)
field(id, entity_type_id, key, type, owner_unit_id)
field_value(entity_id, field_id, value_json, updated_by, updated_at)
interface(id, from_unit_id, to_unit_id, field_id, level, trigger)  -- trigger: on_change | daily | on_request
marking(id, target_kind, target_id, label, rule)
audit_event(id, actor_member_id, on_behalf_of_member_id, action, target, at)
```

Rules the code must enforce:

- Only the owning unit can write a field.
- A reader sees each field at the most detailed level any applicable interface grants, unless a marking restricts it further.
- Derived outputs (summaries, digests, agent answers) inherit the strictest marking of their inputs.
- Push, not pull: interface triggers generate updates to the receiving unit's feed. No one has to go looking.

## Agents

An agent is one continuous member of a unit. It's like a colleague everyone talks to, not a chat window each person opens. The trainer, the coach and the GM all talk to the same sports science agent, which has one memory. In v0, the only agent is the Plan pre-check agent in the Fire prevention unit.

Agent profile fields: identity, unit, role, manager (a person), compute sandbox inside the unit's boundary, memory, inbox, triggers, monthly budget (for example $84 of $150 used), approval rules, and an offboarding state.

How agents behave:

- **Multiplayer inside the unit.** Every conversation and task run is visible to the unit's members by default. Any member can open it, watch it, redirect it or take it over.
- **Bounded across units.** People outside the unit get their own thread. The agent answers them at their disclosure level, never at its own.
- **Acts with the requester's access.** When the agent works for someone, it can only read what that person can read. This prevents it from leaking information on someone else's behalf.
- **Memory keeps its source.** Every memory records which conversation, person and unit it came from, along with its marking. The agent can explain how it knows something.
- **Approval before acting.** Anything that leaves the unit or changes an entity needs approval from a member until the manager loosens the rules.

Three patterns, in build order:

1. Agents working within one unit's data (v0).
2. Agents answering cross-unit questions with the requester's access (v1).
3. Clean-room analysis across units, where the agent sees raw data from several units but only returns outputs that pass every unit's interface (later).

## Security and disclosure

Permissions are the product, so they are enforced on the server for every read, including the agent's. They are never just hidden in the UI.

- **One permission check.** A single function decides `visible_level(reader, entity, field)`. Every API route, digest and agent tool call goes through it.
- **Markings override interfaces.** If a marking says applicant financial data is restricted to Finance, no interface can share it more widely.
- **Aggregation risk.** Combining harmless facts can reveal something sensitive, as Strava's 2018 heatmap did with military bases. Treat cross-unit summaries and agent answers as derived outputs: they inherit the strictest marking, and they're logged.
- **Everything is audited.** The audit log records who read what, on whose behalf, and what the agent did. An agent acting for someone logs both itself and that person.
- **The public unit sees only its interface.** Applicants see their own applications, at the levels the city publishes. Internal fields appear as locked.
- **Model-agnostic.** Keep the LLM behind one interface so a city or a later defense customer can choose their own provider or run on-premises.

Later markets (secure and air-gapped environments) will need classification markings and accredited hosting. Don't build either now, but don't hard-code anything that prevents them.

## MVP scope

v0 is a staff-facing web app for one fictional city that can be demoed end to end in five minutes. Match the screens and visual style of the [polished mocks](https://claude.ai/artifact/VwWK7tzXxBBhsJPSUMHPmo): Geist at a 13px base, ink #18181b, muted #5f5f6b, lines #e6e6ea, accent blue #1d4ed8, in the style of Linear and Attio.

Screens:

| Screen | What it shows |
| --- | --- |
| Queue | Metrics strip, a morning AI summary, filter chips, table of applications with status pills and the department currently holding each one |
| Application | Department track, a role switch (manager, fire reviewer, applicant), and a summary, open items, activity and properties panel for each role |
| Unit | The unit's published interfaces with previews, incoming requests, a suggested interface, members including agents, connectors |
| Agent | The agent's profile, budget, memory with sources, and shared task runs that unit members can open and redirect |

Suggested stack (Claude Code may propose another): TypeScript, Next.js, Postgres, a single permission module, and an LLM provider behind one adapter. Deliver digests by email first, since cities run on Outlook and Teams. A Teams integration comes after v0.

Build order:

- [ ] Schema, seed data for City of Harborview, and the permission function with tests
- [ ] Queue and Application screens with the role switch, reading through the permission function
- [ ] Interfaces: create and edit them on the Unit screen, with triggers generating feed updates
- [ ] Role-based AI summaries and the morning digest, which inherit markings
- [ ] Plan pre-check agent: runs on new submissions, posts findings for a reviewer to approve, shared task runs
- [ ] Audit log view

Out of scope for v0: the public applicant portal, payments, a code-compliance engine (connect UpCodes or CivCheck later instead), a general app builder, the sports and corporate packs, clean-room agents, on-premises deployment, and mobile.

## Implementation details

This section gives Claude Code the exact data, behavior and acceptance criteria. The values come from the polished mocks.

### Seed data: City of Harborview (demo)

Units and people:

| Unit | Kind | Members |
| --- | --- | --- |
| Permit center | internal | Dana Brooks, permit center manager (lead) |
| Zoning | internal | EP, zoning reviewer |
| Fire prevention | internal | Leo Grant, deputy fire marshal and unit admin; Marcus Hill and Rosa Kim, fire plans examiners; Plan pre-check agent |
| Building plan review | internal | JT, building reviewer |
| Utilities | internal | one reviewer |
| Inspections | internal | one inspector |
| Public portal | public | applicant accounts, such as Northline Homes (demo) |

Applications for the queue:

| ID | Project | Address |
| --- | --- | --- |
| BP-2027-0418 | 12-unit apartment building | 1840 Alder St |
| BP-2027-0369 | Warehouse addition | 1200 Industrial Way |
| BP-2027-0381 | Restaurant fit-out | 88 Front St |
| BP-2027-0402 | Tenant improvement, suite 300 | 220 Harbor Ave |
| BP-2027-0397 | Single-family home | 77 Cedar Ln |
| BP-2027-0390 | 4-storey mixed use | 510 Quay St |
| BP-2027-0375 | Duplex | 302 Spruce Ave |
| BP-2027-0388 | Detached garage | 19 Birch Pl |

Generate about 186 open applications in total so the queue metrics are real: 186 open, a median of 38 days to permit (target 30), 1.9 review cycles per application (down from 2.8), and 14 blocked between units, 6 of them waiting on Fire prevention.

The demo story is BP-2027-0418, submitted Jan 6 with a $4.2M valuation and fees paid:

- Intake completed Jan 6. Zoning approved Jan 10, after 4 days. Utilities approved Jan 12.
- Fire prevention requested corrections on Jan 15 (day 6 of 10). Correction 1 requires a second exit stairway for floors 3 and 4 (fire code 1006.3.4). Correction 2 covers the alarm panel location (local amendment 907.6).
- Building review has been waiting on Fire's sprinkler determination since Jan 14 (NFPA 13R proposed), because egress width depends on it.
- The applicant must resubmit by Jan 19. The Plan pre-check agent flagged the exit count on Jan 7, before review started.
- Fire properties: fire flow 1,750 gal/min, hydrant at 48 m (within limit), occupancy R-2, 4 storeys, fire code 2024 plus local amendments.

### Fire prevention interfaces (seed)

| To unit | What | Level | Example | Trigger |
| --- | --- | --- | --- | --- |
| Applicant | Corrections to pass fire review | Summary | Show a second exit stairway for floors 3 and 4 on your plans | Review complete |
| Building plan review | Items that overlap the building code | Full detail | Sprinkler system NFPA 13R; egress width per comment 4 | On change |
| Permit center | Status and days in queue | Status only | In review, day 6 of 10 | On change, plus daily digest |
| Inspections | Fire conditions to verify on site | Full detail | Verify alarm panel location at rough-in | On approval |
| Public portal | Fire review status | Headline | Fire review: changes requested | On change |

### Role views on the Application screen

The same application must render three different views from the same data, with each role seeing only what the permission function allows:

- **Permit manager:** the whole picture and the deadline. "If the applicant resubmits by Jan 19, both reviews can close in the same cycle and the permit stays inside the 30-day target."
- **Fire examiner:** their decisions and code detail. It shows the pending sprinkler decision, both corrections with code citations, fire flow and hydrant data.
- **Applicant:** plain language and only what to do next. Internal notes and reviewer names show as locked, with an upload button for revised plans.

### Permission tests (write these first)

- [ ] Zoning reads a Fire-owned field that has no interface to Zoning, and gets "Not shared."
- [ ] Building plan review reads the sprinkler determination at Full detail.
- [ ] Permit center reads Fire's review at Status only, not the correction text.
- [ ] The applicant sees their own application's corrections as a summary, and can't see another applicant's application at all.
- [ ] A marking on a field overrides an interface that grants more detail.
- [ ] An AI summary built from a marked field carries that marking.
- [ ] The agent, acting for Marcus Hill, can't read anything Marcus can't.
- [ ] Only Fire prevention members can write Fire-owned fields.
- [ ] Every read made through the API and the agent writes an audit event, including on\_behalf\_of.

### AI summaries and digests

- Input: only the field values the reader can see, at their level. Never build a summary from full data and then filter the result.
- Output: two to four sentences with bold key numbers and source tags naming the units the facts came from, as in the mocks.
- Cache per reader role, entity and data revision. Regenerate when an input changes.
- The morning digest for the Permit center leads with the bottleneck: which unit is holding the most applications, how many are past target, and what came back overnight.
- In tests, use a fake LLM that returns deterministic text so the tests don't call a real model.

### Plan pre-check agent

- Trigger: a new submission or resubmission.
- Checks: exit count, sprinkler need and hydrant distance. Use simple seeded rules and the LLM for wording. Do not build a real code engine.
- Output: draft findings in Fire's unit feed. Nothing reaches the applicant until an examiner approves it.
- Every run is a shared task run that Fire members can open, comment on, redirect or take over.
- Track cost against the monthly budget (seed $84 used of $150) and stop when it runs out.

### Suggested interfaces

In v0, seed one suggestion: "Building plan review asks about sprinkler requirements on 40% of mid-rise applications. Send them the sprinkler determination at full detail as soon as you make it?" Approve creates the interface, "Approve as summary" creates it at Summary level, and Decline dismisses it. Detecting suggestions from real message traffic comes later.

### Definition of done: the demo

1. Open the Queue as Dana Brooks and see the metrics and the morning summary naming Fire prevention as the bottleneck.
2. Open BP-2027-0418, then switch roles between manager, fire examiner and applicant. The content changes and locked fields stay locked.
3. Open the Fire prevention unit, approve the suggested interface, and see Building plan review's feed update.
4. Submit a revised plan as the applicant. The pre-check agent runs, an examiner approves its findings, and the applicant's view updates.
5. Open the audit log and see every step, including the agent acting for the examiner.

## Context and open questions

This is background for product decisions. Claude Code doesn't need to build anything from it.

| Area | Who's there | How Relay differs |
| --- | --- | --- |
| Permitting software | CivCheck (Clariti), Govstream.ai | They check plans or digitize forms. Relay coordinates the departments and the applicant |
| Code compliance | UpCodes, Kestrel Labs, Spacial, CodeComply.ai | They answer whether a drawing complies. Relay plugs them in as connectors |
| Dependency tracking | Jira Plans and Rovo, Linear, Aha!, Planview | Built for software teams who all use one tracker. Relay serves the person waiting on a request, across any kind of work |
| Enterprise search and AI | Glean, Copilot, Slackbot | They pull information on request. Relay pushes it, with boundaries |

YC Requests for Startups fit: **AI for City Hall** is the direct match (the first customer). **Multiplayer AI** matches the larger vision of agents shared within a team, with boundaries everywhere else. **AI for the Air-Gapped Economy** is a later market for the permission model.

Open questions:

- [ ] Which city will be the first pilot, and which departments does it route permits through?
- [ ] Which permit system does that city use today, and can we get a data export?
- [x] Which LLM provider for v0, given that cities may require data to stay in Canada or the US? **Decided Nov 26: Claude behind one adapter, with an offline fallback; a city can switch providers later.**
- [x] Authentication: Microsoft Entra single sign-on from day one, or email login for the demo? **Decided Nov 26: a persona switcher with no login for the demo; real auth for a pilot.**
