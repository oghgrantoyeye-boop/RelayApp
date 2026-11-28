# Beacon roadmap: team context, answers and routing

This is the build plan for moving this repository onto the adopted product spec,
[`team-context-answers-routing.md`](team-context-answers-routing.md). The goal screens are in [`mocks/index.html`](mocks/index.html) (also published at https://claude.ai/artifact/Br3yuED6gSPJujQ3SCPLPF) and the pick-up-any-task list is
[`backlog.md`](backlog.md). It is written as a handoff:
each phase lists the goal, the concrete changes with file paths, schema changes, and what "done"
means. Anyone (a person, Claude Code or Cursor) can pick up a phase and work from it.

Written Nov 28, 2026, against `claude/dazzling-archimedes-x7233q` at `8bfe8f1`.

## How to read this

- **Phase 0** is cleanup and reframing: no new features, just getting the product and the site to
  say what the spec says, and parking what the spec defers.
- **Phases 1 to 3** match the spec's suggested phases one for one. Team context is learned from
  conversations and activity first; teams correct it rather than write it (decided Nov 28).
- **Phase 4** adds workspaces and sign-in. It runs early, in parallel, so Beacon is usable for real.
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

Much of the spec's foundation already exists. The main gaps are a team picture learned from
conversations and activity, with light correction by the team; provenance and freshness on answers; a team queue (rather than one named owner); request status
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
| Ownership items | `ownership_item` | Becomes one kind of team context ("responsibility"), learned and kept fresh from activity, with provenance and freshness fields. Phase 1. |
| `unit.description` and `unit.how_to_ask` | `unit` table, team page "How to ask" card | Today these are seeded and not editable. They become the team-edited starting point, with the rest of the picture learned from conversations and activity. Phase 1. |
| Answer output | `answerFromPublished`, `question` table, team page and agent panel rendering | Add per-source provenance (team-provided, observed, inferred) and freshness, an explicit "what I couldn't find" line, and a clarification outcome. Phase 1. |
| Asks page | `src/app/(app)/asks/page.tsx`, `getAsks` | Today it only shows asks assigned to the viewer, although `answerCluster` already lets any member of the team answer. Add a team queue so routing doesn't imply only one owner can answer. Phase 2. |
| Request status | `request.status` (`open`, `answered`, `accepted`, `declined`) | Add requester-facing states (awaiting team, needs your input, answered, resolved, unresolved) and a "My questions" view. Phase 2. |
| "Publish" on an answer | `answerCluster` (`input.publish` writes an `update_item` of kind `answer` straight to the team page) | The spec recommends not silently promoting answers. Instead every answer feeds learning, and the trust rules decide whether a claim applies or waits for a teammate's confirmation. Phase 1 and 2. |
| Write update | `src/app/(app)/write`, `src/lib/updates.ts`, `src/lib/ai/tasks.ts` (`splitUpdate`) | Keep as explicit team input and as the activity summary path. Drop "risk" as a headline item kind in the UI (keep the enum for data), and stop auto-suggesting commitments by default. Phase 0. |
| My feed | `src/app/(app)/feed`, `src/lib/feed.ts` | Today it's grouped as asks, decisions, risks, progress. Reframe as "What's changing with teams you work with", without a risk bucket at the top. Phase 0. |
| Commitments | `commitment` table, `src/lib/commitments.ts`, `/commitments`, `src/components/Commitment.tsx` | The spec makes deadline tracking a non-goal. Keep the data (it answers "when will X land?" and shows a team's active work), but remove the top-level page and the slipped and at-risk highlighting. Show "Active work" on the team page instead. Phase 0. |
| Meetings | `src/lib/meetings.ts`, `/meetings` | Keep as a source of activity summaries, but Zoom, Meet and Teams are "planned, demo-only" per the spec. Label meeting data as demo data. Phase 0. |
| Connectors | `connector`, `source_doc`, `src/lib/integrations.ts`, `src/lib/seed-integrations.ts`, `/connect` | Everything except GitHub and Claude Code is seeded fictional data. Add a `mode` (`live` or `demo`) so the product, like the site, separates live connections from planned ones, and show "what Beacon can see" per team. Phase 1. |
| Customer demos | `src/lib/demos/*.ts`, `src/lib/demos/types.ts`, `tests/demos.test.ts`, `/guide`, `src/components/GuideBar.tsx` | All five stories are slip chains ("X slips, which blocks Y, which puts Z at risk"), and the demo type and tests require a `slipped` step. Rewrite the Northwind story around the spec's narrative (Product asks whether Platform can support a new initiative), and change `types.ts` and the tests to check answer, clarify, route and respond instead of slip. Phase 0 for Northwind; the others follow or are hidden. |
| Marketing site | `src/app/(site)/page.tsx`, `src/components/site/Mockups.tsx`, `AskBeacon.tsx`, `DependencyGraph.tsx`, `SideBySide.tsx`, `src/app/(site)/layout.tsx` | Hero says agents "do the legwork" and "work side by side"; the product preview shows "Launch at risk", "At-risk projects", "Slipped"; the flow is "From a question to coordinated action". The spec flags this directly. Rewrite around understanding teams, sourced answers and routing; keep a deadline scenario only as one example use case. Phase 0. |
| README, HANDOFF, SPEC | `README.md`, `HANDOFF.md`, `SPEC.md` | Point to the new spec as current. Mark `SPEC.md` as the historical v1 brief. Phase 0. |
| Hard-coded org | `ORG_ID = "northwind"` in `src/lib/data.ts` | Fine for the demo. Becomes real workspaces with sign-in in Phase 4. |

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

## Phase 1: Learned team context and grounded answers (3 weeks)

Goal: Beacon builds each team's picture by itself, from the team's conversations and work
activity, so teams don't have a profile to maintain. Agents answer from that picture, showing
where each claim came from and how fresh it is. Teams only step in to correct it.

**The principle:** learning is the main mechanism and editing is a light correction layer. A team
should get a useful picture without typing anything. Any form that asks a team to write its own
context from scratch is the wrong default, because it turns Beacon into one more thing to keep up
to date.

1. **Team context model** (M). New migration `006_team_context`:
   ```sql
   create table context_entry (
     id text primary key,
     unit_id text not null references unit(id),
     kind text not null check (kind in ('about', 'responsibility', 'capability', 'how_to_work', 'knows', 'system')),
     title text not null,
     body text not null default '',
     owner_member_id text references member(id),
     provenance text not null check (provenance in ('learned', 'team_confirmed', 'team_edited')),
     confidence numeric not null default 0.5,          -- rises as more sources agree
     source_refs jsonb not null default '[]',           -- the conversations and activity it came from
     shared_level text not null default 'headline',     -- what other teams see; capped by markings
     marking_id text references marking(id),
     status text not null default 'active' check (status in ('active', 'pending', 'retired')),
     confirmed_by text references app_user(id),
     confirmed_at timestamptz,
     first_seen_at timestamptz not null,
     last_seen_at timestamptz not null,                 -- last time a source supported it
     updated_at timestamptz not null
   );
   create table context_signal (               -- one observation from one source, before it becomes an entry
     id text primary key,
     unit_id text not null references unit(id),
     source_kind text not null,                -- agent_chat, answer, update, pr, coding_session, slack, meeting
     source_ref text not null,
     claim jsonb not null,                     -- { kind, title, body, owner_hint }
     marking_id text references marking(id),
     entry_id text references context_entry(id),
     at timestamptz not null
   );
   alter table ownership_item add column provenance text not null default 'team_edited';
   alter table ownership_item add column last_seen_at timestamptz;
   ```
   Keep `ownership_item` for routing (it has keywords and an owner) and show it as the
   `responsibility` kind. Add `refContext(row)` in `src/lib/data.ts` so `visibleLevel` covers
   entries and signals, and add permission tests: a signal from a marked or team-only source can
   never produce an entry other teams see above what that source allows.
2. **Learn from conversations** (L). A new `src/lib/context-learn.ts` with one entry point,
   `learnFrom(source)`, that extracts candidate claims (what the team owns, can help with, knows,
   which systems it runs, how it likes to be asked) and records them as `context_signal` rows,
   then merges signals into entries. Sources, in order:
   - **Conversations with the team's agent** (`chat_message`) and **answered asks**
     (`answerCluster`): what teammates say when they answer is the richest signal of what the team
     knows and owns. Learn from the answerer's reply, not the asker's question.
   - **Published updates** (`publishDraft`) and **meeting summaries** (`summarizeMeeting`).
   - **Activity**: merged PRs and Claude Code sessions (`src/lib/sources.ts`), and connector
     documents (`source_doc`).
   - **Team Slack channels** once the Slack app can read them (see Decisions). Today Slack is
     notifications only.
   Runs after each source event with `after()`, as `work.ts` does today, plus a nightly pass that
   decays confidence on entries no source has supported for a while. A new AI task in
   `src/lib/ai/tasks.ts`, `extractContext`, with an offline version in `offline.ts` and a fixed
   fake in tests. Every extraction writes an audit event.
3. **Merge and trust rules** (M). One function, `applySignal()`, in a new
   `src/lib/context-policy.ts`. Low-risk claims (`knows`, `system`, `how_to_work`, `about`)
   become active entries straight away, tagged "learned" with their sources. Claims that change who
   owns something, add a `capability` the team might be held to, or come from a marked source
   become `pending` and wait for one team member to confirm. Repeated signals raise confidence;
   a team-edited entry is never overwritten by a learned one, only flagged if they disagree.
   (This pulls the core of the old Phase 3 policy forward, because learned context needs it from
   day one.)
4. **Light correction on the team page** (M). A "What Beacon knows about us" section, visible to
   the team's members, listing entries with their sources and a one-click **Looks right**, **Fix**
   (inline edit) or **Remove** on each. Pending claims sit at the top as short questions ("Beacon
   thinks Platform owns webhook delivery. Right?"), at most a few at a time, and are also folded
   into each member's existing batch of asks instead of a new notification. Teams can add an
   entry by hand, but the page never opens on an empty form. Every confirmation, fix and removal
   writes an audit event and feeds back into learning (a removed claim isn't re-learned from the
   same sources).
5. **Seed from what exists** (S). On first run, learn from the demo's existing updates, answers,
   meetings and source docs instead of seeding hand-written context, so the demo shows learning
   working. `unit.description` and `unit.how_to_ask` stay as the team-edited starting point.
6. **What Beacon can see** (S). On each team page and in the agent panel: connected sources, each
   marked live or demo (new `connector.mode` column), last sync, how many entries came from each,
   and gaps ("Nothing learned about how to ask this team yet").
7. **Sources carry provenance and freshness** (M). In `publishedSources`, add `provenance` and
   `lastSeen` to each `Source`, and include active `context_entry` rows. Pending entries are never
   used in answers to other teams.
8. **Grounded answer format** (M). Change `ANSWER_SCHEMA` and `answerFromPublished` to return
   claims, each with refs, plus `gaps` (what it couldn't find) and `stale_refs`. Mark a source
   stale past a threshold (default 30 days; make it a constant). Update the offline writer to
   produce the same shape. Render answers with sources and freshness next to each claim, a
   "Confirmed by Platform" / "Learned from Platform's conversations, Dec 4" / "Seen in GitHub" /
   "Beacon's inference" tag, and a visible gaps line, on the team page (`#agent` card) and in
   `ChatThread.tsx`.
9. **Clarification** (M). Add `needs_clarification` with a follow-up question to the answer output,
   and `clarify` to `question.outcome`. The agent asks when the question is ambiguous or lacks a
   detail needed to route. The asker's reply continues the same question. In `assistant.ts`, when
   Beacon can't tell which team a general question is for, or two teams match, ask the person to
   pick instead of guessing.
10. **Feedback** (S). Thumbs up or down and an optional note on every answer, stored on `question`
    (`feedback`, `feedback_note`). This is the spec's "answer usefulness" metric. A thumbs down on
    an answer lowers confidence in the entries it used.

Done when: with no one typing team context, a team's page shows what it owns, knows and how to
work with it, learned from its conversations and activity with sources; a team member can confirm,
fix or remove any of it in one click; sensitive claims wait for one confirmation; a person from
another team gets an answer that shows, per claim, where it came from, how fresh it is and what's
missing; permission tests cover signals and entries.

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
5. **Answers feed learning, not the team page directly** (S). Remove the "Publish" checkbox in
   `answerCluster`. Every answer is passed to `learnFrom()` (Phase 1), which turns it into
   context under the trust rules: low-risk knowledge becomes a learned entry, anything sensitive
   waits for a teammate's confirmation. The answerer doesn't have to decide anything extra. The
   answer itself stays private to the people who asked, as today, and only the learned claim (at
   the team's shared level) is reusable.
6. **Notifications** (S). Keep the inbox and the Slack webhook. Add Slack delivery for team queue
   items to a per-team channel webhook (a new `unit.slack_webhook_url` column) so a team sees new
   asks where it already works. Batching rules stay.
7. **Multi-team questions** (M). When the general agent finds more than one relevant team, show the
   candidates and let the person send to one or several; each becomes its own request linked by a
   shared `question_id`.

Done when: a question no one owns lands in the team queue, any member can answer it, the requester
sees its status and where it went, unanswered requests become visibly unresolved with a next step,
and answers only become team context through the trust rules, never by being published as is.

## Phase 3: Context maintenance and policy (2 weeks)

Goal: the learned picture stays accurate as teams change, with as little asked of teams as
possible. Phase 1 already applies low-risk claims automatically and holds sensitive ones for
confirmation; this phase makes that policy configurable and handles change over time.

1. **Configurable policy** (M). Move the rules in `context-policy.ts` into `org.settings` so an
   admin can choose which kinds apply automatically and which wait for confirmation. Auto-applied
   changes can be undone in one click for 7 days.
2. **Change detection** (M). When new signals contradict an active entry (a system's PRs now come
   from another team, an owner has left the team, answers about an area now come from someone
   else), lower the old entry's confidence, learn the new one, and ask the team one question
   ("Did data exports move to Payments API?") instead of asking it to re-check its whole page.
3. **Conflict display** (S). Show unresolved disagreements on both teams' pages and in answers
   ("Platform's page says it owns rate limits; recent changes came from Payments API").
4. **Decay instead of review cycles** (S). Entries that no source has supported for N days (default
   45) fade to "may be out of date" in answers, and drop out after longer. No periodic "please
   review your context" prompts: those are the maintenance burden learning is meant to remove.
5. **Audit and reversals** (S). A per-team history of learned, confirmed, fixed and removed
   entries, with their sources (the spec's tracking plan asks for edits, proposals, approvals and
   reversals).

Done when: a team that changes what it owns sees Beacon's picture follow within days, with at most
one question to confirm it; stale entries fade on their own; conflicts are shown with their
sources; admins can tune which changes need confirmation.

## Phase 4: Workspaces and sign-in (2 to 3 weeks)

Goal: each organization is its own workspace that people sign in to, with its data kept apart
from every other workspace. Demos become sample workspaces that sit side by side instead of
replacing each other. It starts right away, in parallel with Phases 0 and 1, because the goal is a product real teams
can use, not only a demo. The demos stay, as sample workspaces.

Today there is one hard-coded organization (`ORG_ID = "northwind"` in `src/lib/data.ts`), every
demo is seeded under that id, "Choose a demo" truncates every table (`loadDemo` in
`src/app/actions.ts`), most reads don't filter by organization, and the persona switcher stands in
for sign-in.

1. **Workspace on every row** (M). Rename nothing (keep `org` and `org_id`, called "workspace" in
   the UI). Add `org_id` to the tables that don't have it (`member`, `ownership_item`,
   `team_update`, `update_item`, `commitment`, `connector`, `source_doc`, `meeting`, `task_run`,
   `delivery`, `context_entry`, `context_signal`), backfilled from their unit. From Phase 1 on,
   every new table gets `org_id` from the start.
2. **Scoped queries** (L). The viewer carries `orgId`. Every query filters by it; `loadPolicy`,
   `unitMap`, `search`, `orgChart`, `getFeed` and the agent's `publishedSources` take it from the
   viewer, not a constant. Add a test that seeds two workspaces with overlapping team names and
   checks that no page, agent answer, learned entry or audit read crosses between them.
3. **Sign-in** (M). Email magic link or Google and Microsoft sign-in (decision), a `session`
   table, and `app_user.org_id` as the person's workspace. A person can belong to several
   workspaces and switch between them. Keep the persona switcher, but only inside sample
   workspaces.
4. **Workspace setup** (M). Create a workspace, invite people by email, create teams and pick
   leads, connect sources (GitHub app, Claude Code token, Slack app), and choose which channels and
   repositories Beacon learns from. A first-run screen shows what Beacon can see and what it has
   learned so far.
5. **Sample workspaces** (M). Each demo pack seeds its own workspace (`org.id = pack.id`), so
   Northwind and Harborview can be open at once, and "Reset" resets only that workspace. Signed-in
   people can open a sample workspace from the workspace switcher.
6. **Per-workspace settings** (S). The context policy (Phase 3), routing thresholds, batch cadence
   defaults and retention live in `org.settings`.

Done when: two people in two workspaces never see each other's data, sign-in replaces the persona
switcher outside sample workspaces, and a new workspace can be set up, connected and learning
without seed data.

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

These are outside the phases above but required before Beacon touches a real organization's data.
The spec calls them out under privacy and security.

- Phase 4 (workspaces, sign-in and data kept apart per workspace) is done.
- Source permission enforcement for each live connector: validate that GitHub repository access
  and Slack channel membership are respected at ingestion, summarization, retrieval and routing.
- Retention and deletion rules for ingested content, questions and answers.
- Clear disclosure of which conversations Beacon learns from, a way for a team to exclude a
  channel or thread, and a guarantee that learned context never quotes a private message to
  another team (it states the claim and links the source only for readers allowed to open it).
- Security acceptance criteria for permission leakage, with tests.

## Decisions needed

The spec leaves these open. Each has a recommended default so work can proceed; change any of them
and the affected phase adjusts.

| Question (from the spec) | Blocks | Recommended default |
| --- | --- | --- |
| Which use case anchors the first pilot? | Phase 0 story, Phase 1 | Getting an answer across team boundaries. It's the most built today and exercises context, answers and routing together. |
| Which sources connect first? | Phase 1 | Learn first from what Beacon already has: conversations with team agents, answered asks, updates and meetings, plus GitHub and Claude Code (the two live sources). Reading team Slack channels is the first new integration to build, since that's where most team conversation happens. |
| Minimum team context schema? | Phase 1 | The six kinds in `context_entry`: about, responsibility, capability, how to work with us, knows, systems. |
| Who can correct team context? | Phase 1 | Any team member can confirm, fix or remove a learned entry; the lead is notified of changes to responsibilities and owners. |
| Initial request destination and notifications? | Phase 2 | Owner when the match is confident, otherwise the team queue; inbox plus a per-team Slack channel. |
| How do users tell team-provided from inferred? | Phase 1 | A tag next to each claim: "Confirmed by the team", "Learned from the team's conversations", "Seen in GitHub", "Beacon's inference". |
| Which updates are automatic vs reviewed? | Phase 1 | Low-risk kinds apply automatically; ownership, capabilities and anything from a marked source wait for one teammate's confirmation (Phase 1, step 3). Configurable in Phase 3. |
| Keep all five demos? | Phase 0 | Rewrite Northwind first and hide the other four until each is rewritten to the new story. |
| Sign-in method? | Phase 4 | Google and Microsoft sign-in, plus email magic links for everyone else. |
| Privacy, retention and audit requirements? | Pilot | Not decided; needed before a pilot. |
| Metric baselines and targets? | Pilot | Measure during the first pilot, then set targets. |
