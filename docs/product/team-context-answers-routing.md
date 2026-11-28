<!--
Product spec, saved verbatim from Ovo's message in the MVP project on Nov 28, 2026.
Status: adopted. This is the current product direction for Beacon. It supersedes the framing in
SPEC.md (the v1 build brief) wherever the two differ. See docs/product/roadmap.md for how the
repository gets there.
Note: the message was cut off partway through the last open question; the text below ends where
the message ended.
-->

# Beacon Team Context, Answers, and Routing

### TL;DR

Beacon helps people understand what teams do, what they own, what they know, and how to work with them. It builds team context from connected work activity and explicit team input, then uses team agents to answer questions and route unanswered requests to the right team or person. Agents that perform units of work are a later phase, after the context and coordination foundation is useful and trusted.

---

## Goals

### Business Goals

* Establish a differentiated product position around team understanding and cross-team coordination, rather than knowledge search alone.
* Demonstrate value through connected team context, grounded answers, and successful routing. Target measures and thresholds: TBD.
* Build a foundation that can support agents performing bounded work in a later phase.

### User Goals

* Understand what another team is doing, what it owns, and what capabilities or resources it can offer.
* Ask questions in Beacon or connected tools and receive useful answers grounded in team context.
* Get unanswered questions to the appropriate team or person without manually chasing contacts.
* See where an answer came from and whether it may be stale, inferred, or incomplete.
* Give teams a way to provide and correct context about their responsibilities and ways of working.

### Non-Goals

* Having agents autonomously perform units of work in the initial product milestone.
* Positioning Beacon primarily as a project-risk, deadline, or task-tracking dashboard.
* Replacing connected systems as the source of truth for their underlying records.

---

## User Stories

* As a person in one team, I want to understand another team’s work, responsibilities, and capabilities so that I can find the right help and collaborate effectively.
* As a person seeking help, I want to ask a team agent a question and receive a sourced answer so that I can understand the answer’s basis.
* As a requester, I want an unanswered or unclear question routed to the appropriate team or person so that it reaches someone able to respond.
* As a team member, I want to answer questions routed to my team so that other teams can get help from people with relevant context.
* As a team member, I want to review or correct the team’s shared context so that Beacon’s representation stays useful and accurate.
* As an organization administrator, I want Beacon to respect source permissions and approved team-shared context so that cross-team answers do not expose unauthorized information.

---

## Functional Requirements

* Team context foundation (Priority: P0)

  * Activity summaries: Summarize information from connected work sources into team context. The exact event types, capture behavior, and supported sources for the initial milestone are TBD.
  * Explicit team context: Allow teams to describe what they do, own, know, and can help with, including how other teams should work with them.
  * Linked context: Connect relevant people, teams, work, decisions, responsibilities, systems, and source material where available.
  * Context freshness: Indicate source and freshness where possible; distinguish observed facts from team-provided or inferred information.
  * Team correction: Provide a way for authorized team members to correct or supplement the team picture. Approval and edit permissions are TBD.

* Team agent answers (Priority: P0)

  * Team questions: Answer questions about team activity, responsibilities, capabilities, and ways of working using available context.
  * Grounded responses: Show supporting sources and make uncertainty or missing context visible.
  * Permission-aware answers: Respect the user’s access to connected source information while supporting team-approved shared context.
  * Clarification: Ask a user follow-up question when the request lacks enough detail to answer or route usefully.

* Cross-team question routing (Priority: P0)

  * Routing choice: Route by likely owner, team intake path, or open team request according to request type and available confidence. Exact policy is TBD.
  * Team responses: Allow an appropriate team member to respond to a routed question; the user’s intent is that any team member may be able to answer.
  * Request status: Show whether a question is awaiting a team response, answered, or otherwise unresolved. Detailed states and notifications are TBD.
  * Context reuse: Make a response available for the current request. Whether and how it updates shared team knowledge requires a review policy; recommended starting point is to propose updates rather than silently promote answers to canonical context.

* Entry points and integrations (Priority: P0/P1; exact sequencing TBD)

  * Beacon interface: Support asking questions and reviewing routed requests in Beacon.
  * Connected tools: Support question access or notifications from connected tools where integrations allow.
  * Current website-listed connections: GitHub, Claude Code, and Slack channel notifications are described as available.
  * Planned website-listed connections: Jira, Linear, Zoom, Google Meet, Microsoft Teams, Notion, Confluence, Google Drive, HubSpot, Zendesk, and Figma are described as planned. The site notes these planned integrations are demo-only and do not connect to real accounts yet.

* Later execution layer (Priority: Later)

  * Work-performing agents: Add agents that perform bounded units of work only after the team-context, answering, and routing foundation is established. Task scope, permissions, approval model, and sequencing are TBD.

## User Experience

**Entry Point & First-Time User Experience**

* A user enters Beacon or reaches a Beacon agent from a connected tool.
* The organization connects available sources and configures access. Initial setup flow and supported source permissions are TBD.
* Teams provide or review a concise description of their responsibilities, capabilities, and preferred ways of working.
* Beacon explains what it can currently see, which sources are connected, and where its team context may be incomplete.

**Core Experience**

* **Step 1: Ask about a team.** The user asks what a team is doing, what it owns, what it knows, or how it can help.
  * The interface should make it easy to ask in natural language from Beacon or a supported connected-tool entry point.
  * Beacon should clarify the team or scope if the question is ambiguous.
* **Step 2: Build an answer from context.** The team agent uses connected activity summaries and explicit team context.
  * The response should distinguish sourced information from inference and show supporting sources where available.
  * If evidence is stale, incomplete, or conflicting, Beacon should make that limitation clear.
* **Step 3: Resolve or route.** If Beacon cannot answer confidently, it asks for needed details or routes the question to a likely owner, team intake path, or team request queue.
  * The requester should understand where the question went and its status.
  * An available team member can respond; routing should not imply that only one designated owner is allowed to answer.
* **Step 4: Return the response.** Beacon delivers the team member’s response to the requester and preserves its relationship to the request and supporting context.
  * Beacon should not silently treat every response as a permanent or authoritative update to team knowledge.
* **Step 5: Keep the team picture useful.** Teams can add or correct explicit context. Beacon can surface activity that may indicate a change.
  * Handling depends on the information type: low-risk changes may be candidates for automatic updates, while ownership, commitments, or sensitive information should require review. Exact classification and policy are TBD.

**Advanced Features & Edge Cases**

* Conflicting context: Detect disagreements between explicit team descriptions and observed activity. Apply different update behavior based on information sensitivity and risk; detailed rules are TBD.
* Missing or stale data: State that Beacon lacks current evidence rather than presenting an unsupported answer as fact.
* Access boundaries: Do not reveal restricted source content through summaries or derived answers. The permission model needs technical validation.
* Unanswered requests: Provide a clear unresolved state and a path for the requester or team to follow up; escalation timing is TBD.
* Multi-team questions: Identify relevant teams or route the question to an appropriate cross-team path; exact coordination behavior is TBD.
* Agent execution: Requests to perform work remain out of scope for the initial milestone and should not be represented as completed actions.

**UI/UX Highlights**

* Make clear whether the user is asking Beacon generally or a specific team agent.
* Show sources, freshness, and uncertainty close to the claims they support.
* Separate an answer from a recommendation, routed request, or completed action.
* Make team context editable and understandable, not an opaque profile generated by the system.
* Support responsive use in Beacon and connected-tool entry points; accessibility requirements are TBD.

---

## Narrative

A person on the Product team needs help understanding whether the Platform team can support a new initiative. Today, they might search documents, scan chat channels, inspect tickets, and still be unsure who owns the relevant capability or whether the information is current.

They ask Beacon’s Platform agent from the Beacon workspace or a connected tool. The agent summarizes relevant team context: what Platform owns, what related work is active, and how another team should make a request. It links to the available sources and signals where information is incomplete. The answer draws on both connected activity and context the Platform team has explicitly provided.

The question includes a detail the agent cannot verify. Instead of guessing, Beacon asks a clarifying question and routes the request through the appropriate team path. A Platform team member responds, and Beacon returns that response to the requester with the request status. If the response indicates that the team’s shared description is out of date, Beacon can propose a context update or apply an update under a defined low-risk policy; sensitive or consequential changes require review.

The requester gets a clearer answer and a path to help without manually searching across teams. Platform can make its work and capabilities easier to understand. Beacon earns trust by showing what it knows, where the knowledge came from, and when a person needs to step in. Later, once this foundation is reliable, Beacon can extend team agents to perform bounded units of work with appropriate authorization.

---

## Success Metrics

Targets and baseline values are TBD. Select initial measures after the first supported sources and pilot use cases are confirmed.

### User-Centric Metrics

* Answer usefulness: User rating or follow-up signal for answers about team work, ownership, capabilities, and ways of working.
* Grounding coverage: Share of substantive answers with accessible supporting sources or explicit uncertainty.
* Routing resolution: Share of routed questions that receive a response and are marked resolved.
* Team-context quality: Team member assessment of whether Beacon’s representation of the team is accurate and current.

### Business Metrics

* Active teams using Beacon for cross-team questions: TBD definition and target.
* Repeat usage of team agents across Beacon and connected-tool entry points: TBD.
* Reduction in manual effort to identify the right team or person: measurement approach and target TBD.

### Technical Metrics

* Answer and routing latency targets: TBD.
* Source ingestion and summarization reliability targets: TBD.
* Permission enforcement and data leakage targets: TBD; security acceptance criteria required before launch.

### Tracking Plan

* Track question submission, question scope, entry point, and clarification requested.
* Track answer delivery, source-link use, uncertainty signals, and user feedback.
* Track routing destination type, request status changes, response time, and resolution outcome.
* Track team-context edits, proposed updates, approvals, and reversals.
* Track source connection health, ingestion failures, permission denials, and stale-context indicators.
* Define privacy-conscious event retention and access policies before implementation.

---

## Technical Considerations

### Technical Needs

* A team-context representation linking teams, people, responsibilities, capabilities, initiatives or work, decisions, systems, and source references.
* Connectors and ingestion workflows for available sources, with clear separation between live connections and planned integrations.
* Summarization and retrieval that preserve source references, timestamps, provenance, and permission context.
* Team-agent answer generation with uncertainty handling and a routing mechanism for unresolved questions.
* Request and response records that support status, notifications, and an auditable interaction history.
* A policy mechanism for distinguishing low-risk context changes from changes requiring review. Classification rules are TBD.

### Integration Points

* Website-listed available connections: GitHub, Claude Code, and Slack channel notifications.
* Website-listed planned connections: Jira, Linear, Zoom, Google Meet, Microsoft Teams, Notion, Confluence, Google Drive, HubSpot, Zendesk, and Figma. They are not described as live account integrations on the site.
* Beacon workspace and connected-tool entry points; exact product surfaces and technical integration behavior are TBD.

### Data Storage & Privacy

* Respect permissions from connected sources and do not expose restricted content through derived summaries or answers.
* Support team-approved shared context that is explicitly available for cross-team use.
* Preserve provenance and freshness for observed, team-provided, and inferred information.
* Define data retention, deletion, tenant isolation, and audit requirements before implementation; details are TBD.
* Validate whether source permissions can be faithfully enforced during ingestion, summarization, retrieval, and routing.

### Scalability & Performance

* Expected organization size, event volume, concurrent usage, and latency targets are TBD.
* The system should support incremental updates to team context as new activity arrives, without implying that every source is continuously or autonomously monitored.
* Degraded connector or stale-source states should be visible to users.

### Potential Challenges

* Activity signals alone may not reveal capabilities, intent, or preferred collaboration paths; explicit team input is also required.
* Different systems may contain stale, duplicated, or conflicting information.
* Inference about ownership or team capability can be wrong and must be presented with appropriate uncertainty.
* Permission leakage through summaries or cross-team answers is a critical risk.
* Asking a team for an answer requires an appropriate routing destination, notification approach, and expectation-setting; these are not yet specified.
* The current website’s prominent risks, deadlines, and initiative tracking may create expectations that differ from this product focus. Messaging should distinguish an example use case from the core product promise.

---

## Milestones & Sequencing

Dates and owners are TBD. Sequence is a proposed lean progression, not a committed roadmap.

### Project Estimate

TBD. Estimate after confirming the initial use case, data sources, permissions approach, and current implementation state.

### Team Size & Composition

TBD. A lean product and engineering group can validate the initial workflow; named owners and staffing are unknown.

### Suggested Phases

**Phase 1: Team context and grounded answers (duration TBD)**

* Key Deliverables: Select initial supported sources; let teams provide context; create sourced answers about team work, ownership, and capabilities.
* Dependencies: Connector availability, permission model, team-context structure, and pilot teams.

**Phase 2: Cross-team question routing (duration TBD)**

* Key Deliverables: Clarification, routing to a person or team path, team-member responses, request status, and requester follow-up.
* Dependencies: Team intake destinations, notification behavior, and a defined request lifecycle.

**Phase 3: Context maintenance and policy (duration TBD)**

* Key Deliverables: Provenance and freshness signals, team review and corrections, conflict handling, and differentiated update policies for low-risk and sensitive information.
* Dependencies: Information classification and authorization policy.

**Later: Bounded work execution (timing TBD)**

* Key Deliverables: Agents perform defined units of work with explicit authorization and appropriate review.
* Dependencies: Reliable context and routing, clearly scoped tasks, permissions, approval and audit model, and validation of user value.

---

## Open Questions

* Which initial use case should anchor the first pilot: understanding team capabilities, getting an answer across team boundaries, or a specific handoff workflow?
* Which available source or sources should be connected first, and what activity can Beacon actually collect from each?
* What is the minimum useful team context schema?
* Which response updates can be automated, and which require team review? How are sensitive or consequential changes identified?
* What team request destination and notification behavior should Beacon provide initially?
* How should users distinguish an answer backed by team-provided context from one inferred from observed activity?
* What are the privacy, retention, and audit requirements?
* What baseline and target values should be set for answer usefulness, routing resolution, team-context quality, and adoption?
* Which current product or code setup elements should be retained, refactored, or removed to align with this
