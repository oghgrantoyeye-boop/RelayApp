# Beacon roadmap: team context, answers and routing

This is the build plan for moving this repository onto the adopted product spec,
[`team-context-answers-routing.md`](team-context-answers-routing.md). It is written as a handoff:
each phase lists the goal, the concrete changes with file paths, schema changes, and what "done"
means. Anyone (a person, Claude Code or Cursor) can pick up a phase and work from it.

Written Nov 28, 2026, against `claude/dazzling-archimedes-x7233q` at `8bfe8f1`.

## How to read this

- **Phase 0** is cleanup and reframing: no new features, just getting the product and the site to
  say what the spec says, and parking what the spec defers.
- **Phases 1 to 3** match the spec's suggested phases one for one.
- **Later** is the spec's execution layer. Most of it is already built, so the plan is to park it,
  not delete it.
- **Decisions needed** lists the spec's open questions that block a phase, each with a recommended
  default so work doesn't stall.

Sizes are rough: **S** is under a day, **M** is one to three days, **L** is about a week, for one
engineer with an AI coding assistant.

---

## 1. Where the repo is today

The repo is a Next.js 16 + TypeScript app with an embedded Postgres (PGlite), a marketing site at
`/`, and a working prototype at `/feed` and around it, demoed inside five fictional organizations
with a persona switcher in place of sign-in. It was built to `SPEC.md` (the v1 build brief:
team pages, updates, commitments, a leadership digest) and then extended with team agents,
integrations, meetings, an agent workspace and "Worker" teammates.

Much of the spec's foundation already exists. The main gaps are explicit, editable team context;
provenance and freshness on answers; a team queue (rather than one named owner); request status
for the requester; and a review policy for turning answers into team knowledge. The main conflicts
are the Worker agents (the spec defers work-performing agents) and the risk, slip and deadline
framing across the demos, the feed, the digest and the site (the spec says Beacon is not a
risk or deadline dashboard).

## 2. Audit: keep, refactor, park or remove

### Keep (already matches the spec)

| Area | Where | Why it stays |
| --- | --- | --- |
| One permission check | `src/lib/permissions.ts` (`visibleLevel`, `deriveMarkings`, `canSeeDerived`), `src/lib/render.ts`, `tests/permissions.test.ts` | The spec calls permission leakage "a critical risk". Levels, markings, "only rendered text leaves the server" and derived-output markings are exactly what it asks for. Every new table in this plan goes through it. |
| Team agent answers from published context, at the asker's level, with sources | `src/lib/agent.ts` (`askTeam`, `publishedSources`, `getQuestion`), `src/lib/ai/tasks.ts` (`answerFromPublished`) | This is the core of spec Phase 1. The prompt already says "never guess", and the agent reads with the asker's access. |
| Routing to an owner, with the lead as fallback | `ownerFor`, `routeQuestion`, `ownership_item.owner_member_id` | The spec's "route by likely owner". Phase 2 extends it to a team queue. |
| Merging duplicate asks and batching | `clusterKeyFor`, `getAsks`, `sendBatch`, `app_user.ask_cadence` | Reduces noise for the team that's asked, which the spec's "expectation-setting" challenge needs. |
| Answer once, to everyone who asked | `answerCluster` | The spec's "team responses" and "return the response". |
| Audit log of agent reads and answers, naming agent and asker | `audit_event`, `src/app/(app)/audit/page.tsx` | The spec asks for "an auditable interaction history" and a tracking plan. The audit table can double as the event log (see "Tracking" below). |
| "Your Beacon agent" that finds the right team | `src/lib/assistant.ts` (`replyTo`, the question path) | The spec's "asking Beacon generally" vs "a specific team agent". Needs clarification added (Phase 1). |
| Directory and team pages | `src/app/(app)/directory`, `src/app/(app)/teams/[slug]`, `src/lib/directory.ts` | "Understand what another team does and owns." The team page becomes the home of team context. |
| Draft sources: Claude Code hook and GitHub webhook | `integrations/claude-code/relay-hook.mjs`, `src/app/api/sources/*`, `src/lib/sources.ts` | These are the two live sources the site lists as available. They turn activity into drafts only the author sees, which is the right default. |
| Slack delivery | `src/lib/deliver.ts` (`SLACK_WEBHOOK_URL`) | The third live connection on the site ("Slack channel notifications"). |
| AI adapter with offline writer and fake model in tests | `src/lib/ai/llm.ts`, `src/lib/ai/offline.ts` | Demos work without a key, tests never call a model. Keep for every new AI task. |
| Integration status on the site | `src/components/site/Integrations.tsx` | Already marks only GitHub, Claude Code and Slack as Available, as the spec describes. |
| Append-only migrations | `src/lib/migrations.ts` | Add new entries; never edit old ones. |

### Refactor (useful, but framed or shaped wrong for the spec)

| Area | Where | What changes |
| --- | --- | --- |
| Ownership items | `ownership_item` | Becomes one kind of team context ("responsibility"), with provenance, freshness and review fields. Phase 1. |
| `unit.description` and `unit.how_to_ask` | `unit` table, team page "How to ask" card | Today these are seeded and not editable. They become editable team context ("what we do", "how to work with us"). Phase 1. |
| Answer output | `answerFromPublished`, `question` table, team page and agent panel rendering | Add per-source provenance (team-provided, observed, inferred) and freshness, an explicit "what I couldn't find" line, and a clarification outcome. Phase 1. |
| Asks page | `src/app/(app)/asks/page.tsx`, `getAsks` | Today it only shows asks assigned to the viewer, although `answerCluster` already lets any member of the team answer. Add a team queue so routing doesn't imply only one owner can answer. Phase 2. |
| Request status | `request.status` (`open`, `answered`, `accepted`, `declined`) | Add requester-facing states (awaiting team, needs your input, answered, resolved, unresolved) and a "My questions" view. Phase 2. |
| "Publish" on an answer | `answerCluster` (`input.publish` writes an `update_item` of kind `answer` straight to the team page) | The spec recommends proposing updates rather than silently promoting answers. Change "Publish" to "Propose as team context", reviewed by the team. Phase 2, policy in Phase 3. |
| Write update | `src/app/(app)/write`, `src/lib/updates.ts`, `src/lib/ai/tasks.ts` (`splitUpdate`) | Keep as explicit team input and as the activity summary path. Drop "risk" as a headline item kind in the UI (keep the enum for data), and stop auto-suggesting commitments by default. Phase 0. |
| My feed | `src/app/(app)/feed`, `src/lib/feed.ts` | Today it's grouped as asks, decisions, risks, progress. Reframe as "What's changing with teams you work with", without a risk bucket at the top. Phase 0. |
| Commitments | `commitment` table, `src/lib/commitments.ts`, `/commitments`, `src/components/Commitment.tsx` | The spec makes deadline tracking a non-goal. Keep the data (it answers "when will X land?" and shows a team's active work), but remove the top-level page and the slipped and at-risk highlighting. Show "Active work" on the team page instead. Phase 0. |
| Meetings | `src/lib/meetings.ts`, `/meetings` | Keep as a source of activity summaries, but Zoom, Meet and Teams are "planned, demo-only" per the spec. Label meeting data as demo data. Phase 0. |
| Connectors | `connector`, `source_doc`, `src/lib/integrations.ts`, `src/lib/seed-integrations.ts`, `/connect` | Everything except GitHub and Claude Code is seeded fictional data. Add a `mode` (`live` or `demo`) so the product, like the site, separates live connections from planned ones, and show "what Beacon can see" per team. Phase 1. |
| Customer demos | `src/lib/demos/*.ts`, `src/lib/demos/types.ts`, `tests/demos.test.ts`, `/guide`, `src/components/GuideBar.tsx` | All five stories are slip chains ("X slips, which blocks Y, which puts Z at risk"), and the demo type and tests require a `slipped` step. Rewrite the Northwind story around the spec's narrative (Product asks whether Platform can support a new initiative), and change `types.ts` and the tests to check answer, clarify, route and respond instead of slip. Phase 0 for Northwind; the others follow or are hidden. |
| Marketing site | `src/app/(site)/page.tsx`, `src/components/site/Mockups.tsx`, `AskBeacon.tsx`, `DependencyGraph.tsx`, `SideBySide.tsx`, `src/app/(site)/layout.tsx` | Hero says agents "do the legwork" and "work side by side"; the product preview shows "Launch at risk", "At-risk projects", "Slipped"; the flow is "From a question to coordinated action". The spec flags this directly. Rewrite around understanding teams, sourced answers and routing; keep a deadline scenario only as one example use case. Phase 0. |
| README, HANDOFF, SPEC | `README.md`, `HANDOFF.md`, `SPEC.md` | Point to the new spec as current. Mark `SPEC.md` as the historical v1 brief. Phase 0. |
| Hard-coded org | `ORG_ID = "northwind"` in `src/lib/data.ts` | Fine for the demo. Tenant isolation is a pre-pilot requirement in the spec; see "Before a real pilot". |

### Park (the spec defers it; keep the code, hide it)

| Area | Where | Why park instead of delete |
| --- | --- | --- |
| Worker teammates and the agent gallery | `src/lib/agents.ts` (`AGENT_ACTIONS` with tier `worker`, `GALLERY`), `agent_profile`, `/agents/new`, "New teammate" button in `src/app/(app)/layout.tsx` | Work-performing agents are the spec's "Later" phase. The work is built and tested, and the permission model is sound, so hide it behind a flag rather than throw it away. |
| Agent workspace and task runs | `src/lib/work.ts`, `task_run`, `/agents/[slug]`, `/agents/[slug]/tasks/[id]` | Research, document review, code changes and drafting. Same reasoning. |
| Work proposals in the agent panel | `assistant.ts`: the `DRAFT`, `REVIEW`, `CODE`, `RESEARCH` branches and `decideAction` | The spec says requests to perform work "should not be represented as completed actions". With the flag off, the agent should say it can't do work yet and offer to route the request to the team instead. |
| Leadership digest | `src/lib/digest.ts`, `/digest` | Status reporting for leadership is outside the spec's focus. Its marking logic is a good test of derived-output permissions, so keep the tests. |
| Team map | `src/components/TeamMap.tsx`, `/map` | Colored by commitment state (on track, at risk, slipped). Could return later as "who works with whom", but not in the first milestone. |

### Remove

Nothing needs deleting outright. Parking behind one flag keeps the tests green and the option open.
If the parked code is still unused once Phase 3 ships, remove it then, with its migrations left in
place (migrations are append-only).

---

## Phase 0: Reframe and park (about 1 week)

Goal: the product and the site say what the spec says, and deferred features are out of sight.
No new data model.

1. **Feature flag for deferred features** (S). Add `BEACON_WORKERS` (off by default) read in one
   place, for example `src/lib/flags.ts`. When off: hide "New teammate", the agent gallery,
   worker tiers on agent profiles, the task workspace, the digest and the map from the sidebar in
   `src/app/(app)/layout.tsx`; return 404 from their routes; and in `assistant.ts` replace the
   work branches with a reply that says Beacon can't do work yet and offers to route the request to
   the team. Keep each team's built-in Q&A agent.
2. **Navigation** (S). Sidebar becomes: Ask Beacon (the agent panel and Messages), Teams
   (directory), Team queue / Asks, My questions (Phase 2), What's changing (feed), Write update,
   Inbox, Audit log, Integrations. Remove Commitments, Meetings, Team map and Leadership digest
   from the nav (Meetings stays reachable from a team page).
3. **Commitments and slips** (M). Remove slipped and at-risk styling from the feed, team page and
   inbox alerts (`notifyCommitmentChange` slip notices). On the team page, rename "Open
   commitments" to "Active work". Stop `splitUpdate` suggesting commitments unless the author asks.
4. **Feed** (S). Retitle and regroup in `src/lib/feed.ts` and `feed/page.tsx`: asks for you,
   decisions that affect you, then everything else. No risk section.
5. **Northwind story** (L). Rewrite `src/lib/demos/northwind.ts` around the spec's narrative: a
   Product person asks whether Platform can support a new initiative; the Platform agent answers
   what it owns, its active work and how to ask, with sources and a gap; it asks one clarifying
   question; the question routes to Platform's queue; a Platform member answers; the answer is
   proposed as team context. Update `types.ts` (replace the `slipped` and `digest` expectations
   with `answer`, `clarify`, `route`, `respond`), `tests/demos.test.ts`, `/guide` and
   `GuideBar.tsx`. Hide the other four demos from `/demos` until each is rewritten (see
   Decisions).
6. **Site** (M). Rewrite the hero, product section, mockups and flow in `src/app/(site)/page.tsx`
   and `src/components/site/*` to the spec's TL;DR. Replace the risk dashboard mockup with a team
   page and a sourced answer. Keep `Integrations.tsx` statuses as they are. Update metadata in
   `src/app/(site)/layout.tsx` and `marketing/launch-campaign.md`.
7. **Docs** (S). README and HANDOFF point to the new spec; `SPEC.md` gets a header saying it's
   the historical v1 brief.

Done when: with the flag off, no page, agent reply or site section shows at-risk, slipped or
deadline dashboards, or offers to do work; the Northwind guide walks the spec's narrative; all
tests pass.

## Phase 1: Team context and grounded answers (2 to 3 weeks)

Goal: teams can describe themselves, and agents answer from that plus observed activity, showing
where each claim came from and how fresh it is.

1. **Team context model** (M). New migration `006_team_context`:
   ```sql
   create table context_entry (
     id text primary key,
     unit_id text not null references unit(id),
     kind text not null check (kind in ('about', 'responsibility', 'capability', 'how_to_work', 'knows', 'system')),
     title text not null,
     body text not null default '',
     owner_member_id text references member(id),
     provenance text not null check (provenance in ('team_provided', 'observed', 'inferred')),
     source_refs jsonb not null default '[]',
     shared_level text not null default 'headline',   -- what other teams see; capped by markings
     marking_id text references marking(id),
     status text not null default 'active' check (status in ('active', 'proposed', 'retired')),
     created_by text references app_user(id),
     reviewed_by text references app_user(id),
     reviewed_at timestamptz,
     as_of timestamptz not null,      -- when the fact was last true or confirmed
     updated_at timestamptz not null
   );
   alter table ownership_item add column provenance text not null default 'team_provided';
   alter table ownership_item add column reviewed_at timestamptz;
   ```
   Keep `ownership_item` for routing (it has keywords and an owner) and treat it as the
   `responsibility` kind in the UI. Seed `about` and `how_to_work` entries from `unit.description`
   and `unit.how_to_ask`. Add `refContext(row)` in `src/lib/data.ts` so `visibleLevel` covers it,
   and add permission tests (team members see full, others see `shared_level`, markings cap).
2. **Edit team context** (M). A "Team context" section on the team page, editable by the team's
   members (`assertWrite`), with add, edit and retire for each kind, and an "is this still
   accurate?" confirm button that sets `reviewed_at`. Every change writes an audit event. Who may
   edit what is a decision (see Decisions); default: any member edits, the lead is notified of
   changes to responsibilities and their owners.
3. **What Beacon can see** (S). On each team page and in the agent panel: connected sources, each
   marked live or demo (new `connector.mode` column), last sync, and gaps ("No tickets connected",
   "Team context last confirmed 45 days ago").
4. **Sources carry provenance and freshness** (M). In `publishedSources`, add `provenance` and
   `asOf` to each `Source`, and include `context_entry` rows. Published updates and answers are
   `team_provided`; connector documents, PRs and coding sessions are `observed`; anything the model
   concludes without a direct source is `inferred`.
5. **Grounded answer format** (M). Change `ANSWER_SCHEMA` and `answerFromPublished` to return
   claims, each with refs, plus `gaps` (what it couldn't find) and `stale_refs`. Mark a source
   stale past a threshold (default 30 days; make it a constant). Update the offline writer to
   produce the same shape. Render answers with sources and freshness next to each claim, a "Team
   says" / "Seen in GitHub, Dec 4" / "Beacon's inference" tag, and a visible gaps line, on the team
   page (`#agent` card) and in `ChatThread.tsx`.
6. **Clarification** (M). Add `needs_clarification` with a follow-up question to the answer output,
   and `clarify` to `question.outcome`. The agent asks when the question is ambiguous or lacks a
   detail needed to route. The asker's reply continues the same question. In `assistant.ts`, when
   Beacon can't tell which team a general question is for, or two teams match, ask the person to
   pick instead of guessing.
7. **Feedback** (S). Thumbs up or down and an optional note on every answer, stored on `question`
   (`feedback`, `feedback_note`). This is the spec's "answer usefulness" metric.

Done when: a team member can describe their team's responsibilities, capabilities and ways of
working; a person from another team gets an answer that shows, per claim, whether it's
team-provided, observed or inferred, how fresh it is and what's missing; ambiguous questions get a
clarifying question; permission tests cover the new table.

## Phase 2: Cross-team question routing (2 weeks)

Goal: unanswered questions reach someone able to respond, the requester always knows where their
question is, and any team member can answer.

1. **Routing destinations** (M). Add `request.destination` (`person`, `team_queue`, `intake`)
   and `request.route_reason`. Policy in one function, `chooseRoute()` in `src/lib/agent.ts`:
   a confident ownership match goes to the owner and is also visible in the team queue; a weak or
   no match goes to the team queue (not silently to the lead); a request that matches the team's
   `how_to_ask` intake (for example "file a ticket") points the requester there. Keep the
   threshold a named constant; the exact policy is a decision.
2. **Team queue** (M). `/asks` gets two tabs: "For you" (today's view) and "Team queue" (all open
   requests to the viewer's teams). Any member can claim (`request.claimed_by`), answer or pass to
   a teammate. `answerCluster` already permits this; the UI and `getAsks` need to show it.
3. **Request lifecycle** (M). Extend `request.status` to `awaiting_team`, `needs_info`,
   `answered`, `resolved`, `declined`, `unresolved`. The requester can mark an answer resolved or
   ask a follow-up. A request with no response after N business days (default 3) becomes
   `unresolved`, notifies the requester, and offers "send to the team lead" or "ask again".
   Record every status change in `audit_event`.
4. **My questions** (M). A page listing the viewer's questions and requests with status, where
   each went and why ("Sent to Platform's queue because no one owns 'data exports'"), and the reply
   when it arrives. Link to it from every routed answer.
5. **Answers become proposals, not team knowledge** (S). Replace the "Publish" checkbox in
   `answerCluster` with "Propose as team context", which creates a `context_entry` with
   `status = 'proposed'` for the team to review (Phase 3 handles the policy). The answer itself
   stays private to the people who asked, as today.
6. **Notifications** (S). Keep the inbox and the Slack webhook. Add Slack delivery for team queue
   items to a per-team channel webhook (a new `unit.slack_webhook_url` column) so a team sees new
   asks where it already works. Batching rules stay.
7. **Multi-team questions** (M). When the general agent finds more than one relevant team, show the
   candidates and let the person send to one or several; each becomes its own request linked by a
   shared `question_id`.

Done when: a question no one owns lands in the team queue, any member can answer it, the requester
sees its status and where it went, unanswered requests become visibly unresolved with a next step,
and answers are never promoted to team context without review.

## Phase 3: Context maintenance and policy (2 weeks)

Goal: the team picture stays accurate, changes are handled by how sensitive they are, and
conflicts are surfaced.

1. **Update policy** (M). One function, `changePolicy(kind, change)`, in a new
   `src/lib/context-policy.ts`, returning `auto` or `review`. Default classification:
   `auto` for wording changes to `about` and `how_to_work`, new `knows` entries from answers the
   answerer proposed, and links; `review` for anything touching `responsibility` or its owner,
   `capability`, commitments or dates, or anything with a marking. Auto-applied changes can be
   undone in one click for 7 days. Rules are configurable in `org.settings`.
2. **Review queue** (M). A "Proposed changes" list on the team page for members: approve, edit or
   reject, each with who proposed it and from what source. Approval and reversal write audit
   events (the spec's tracking plan asks for edits, proposals, approvals and reversals).
3. **Activity proposals** (M). When a merged PR, a coding session or a connector document
   suggests a change (a new system, a new area of work), propose a `context_entry` with
   `provenance = 'observed'` instead of only drafting an update. Reuse `src/lib/sources.ts`.
4. **Conflict detection** (M). Flag when observed activity disagrees with stated context, for
   example another team's PRs touch a system this team says it owns, or an owner has left the
   team. Show the conflict on both team pages and in answers ("Platform says it owns rate limits;
   recent changes came from Payments API").
5. **Freshness prompts** (S). Ask each team to confirm its context every N days (default 30) in
   the team's batch, and show "last confirmed" on the team page and in answers.

Done when: low-risk changes apply with undo, sensitive ones wait for review, conflicts are shown
with their sources, and every team page shows when its context was last confirmed.

## Later: bounded work execution

Turn `BEACON_WORKERS` back on, one action at a time, once the foundation is trusted. The parked code
(`src/lib/work.ts`, `src/lib/agents.ts`, `agent_profile`, `task_run`) already has budgets, approval
rules, "reads only what the requester can read" and "only writes drafts". Before enabling any
action: define its scope, the permissions it needs, its approval model and its audit trail, and
check with pilot users that they want it.

---

## Cross-cutting

- **Permissions first.** Every new table gets an `ItemRef` and goes through `visibleLevel`. Every
  new derived output (answers, proposals, conflict notices) carries the markings of its inputs.
  Add tests in `tests/permissions.test.ts` for each.
- **Tracking.** Use `audit_event` as the event log for the spec's tracking plan: question asked
  (with entry point and scope), clarification asked, answer delivered (with provenance mix and
  gaps), source link opened, feedback, route chosen, status changes, context edits, proposals,
  approvals, reversals, connector sync failures and permission denials. A small `/audit` filter
  and a metrics card per team (answered vs routed, resolution rate) cover the spec's first
  metrics.
- **AI tasks.** Every new prompt goes through `src/lib/ai/llm.ts` with an offline fallback in
  `src/lib/ai/offline.ts`, and tests use the fake model.
- **Next.js.** This is Next.js 16, which differs from older versions. Read the relevant guide in
  `node_modules/next/dist/docs/` before changing routing, server actions or caching (see
  `AGENTS.md`).
- **Migrations** are append-only in `src/lib/migrations.ts`.

## Before a real pilot

These are outside the three phases but required before Beacon touches a real organization's data.
The spec calls them out under privacy and security.

- Real sign-in and organizations (the persona switcher is demo-only), and tenant isolation
  (remove the hard-coded `ORG_ID`).
- Source permission enforcement for each live connector: validate that GitHub repository access
  and Slack channel membership are respected at ingestion, summarization, retrieval and routing.
- Retention and deletion rules for ingested content, questions and answers.
- Security acceptance criteria for permission leakage, with tests.

## Decisions needed

The spec leaves these open. Each has a recommended default so work can proceed; change any of them
and the affected phase adjusts.

| Question (from the spec) | Blocks | Recommended default |
| --- | --- | --- |
| Which use case anchors the first pilot? | Phase 0 story, Phase 1 | Getting an answer across team boundaries. It's the most built today and exercises context, answers and routing together. |
| Which sources connect first? | Phase 1 | Explicit team context plus GitHub (merged PRs) and Claude Code sessions, the two live sources. Slack for notifications only. |
| Minimum team context schema? | Phase 1 | The six kinds in `context_entry`: about, responsibility, capability, how to work with us, knows, systems. |
| Who can edit team context? | Phase 1 | Any team member; the lead is notified of changes to responsibilities and owners. |
| Initial request destination and notifications? | Phase 2 | Owner when the match is confident, otherwise the team queue; inbox plus a per-team Slack channel. |
| How do users tell team-provided from inferred? | Phase 1 | A tag next to each claim: "Team says", "Seen in GitHub", "Beacon's inference". |
| Which updates are automatic vs reviewed? | Phase 3 | The classification in Phase 3, step 1. |
| Keep all five demos? | Phase 0 | Rewrite Northwind first and hide the other four until each is rewritten to the new story. |
| Privacy, retention and audit requirements? | Pilot | Not decided; needed before a pilot. |
| Metric baselines and targets? | Pilot | Measure during the first pilot, then set targets. |
