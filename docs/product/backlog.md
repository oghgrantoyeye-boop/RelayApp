# Beacon backlog: goal-oriented tasks

The end goal is drawn in [`mocks/index.html`](mocks/index.html) (open it in a browser; the tabs
along the top switch screens). This file breaks the gap between today's app and those screens into
tasks that can each ship on their own. Pick any task whose dependencies are done, build it, and
the product gets closer to the mocks.

The why behind each task is in [`roadmap.md`](roadmap.md), and the product spec is
[`team-context-answers-routing.md`](team-context-answers-routing.md).

## How to work a task

- Every task names the **mock** it moves toward (M1 to M6, below), its **acceptance** checks, the
  files it **touches**, its **size** (S under a day, M one to three days, L about a week) and what
  it **depends on**.
- One task, one pull request. Keep `npm test` green and add tests for what you build. Tests use the
  fake model and never call a real one.
- Integrations are real, not demo data. Where a task needs a live account (Slack, GitHub), it says
  which environment variables it reads. Keep the sample workspaces working with seeded data.
- This is Next.js 16. Read the guide in `node_modules/next/dist/docs/` before changing routing,
  server actions or caching (see `AGENTS.md`). Migrations in `src/lib/migrations.ts` are
  append-only.
- When a task is done, tick it here in the same pull request.

## The goal screens

| Mock | Screen | What it shows |
| --- | --- | --- |
| M1 | Sign in | Signing in and choosing a workspace; sample workspaces beside real ones |
| M2 | Team page | "What Beacon knows about us", learned with sources, one-click Looks right, Fix or Remove; one pending ownership question; how to work with the team; what Beacon can see |
| M3 | Ask a team | A sourced answer, each claim tagged confirmed, learned, seen in tools or inference; a "what I couldn't find" line; a clarifying question; routing to the team queue with status |
| M4 | Team queue | For you and Team queue tabs; anyone can pick a question up; answer once; Beacon proposes what it learned for one teammate to confirm |
| M5 | My questions | Every question the person asked, where it went, its status and the reply; unanswered ones flagged with a next step |
| M6 | Workspace setup | Live sources, the Slack channels Beacon learns from, what needs a teammate's OK, people |

## Environment variables

| Variable | Used for | Status |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Every AI task (answers, learning, summaries, research). Without it the app uses the offline writer. | Read today in `src/lib/ai/llm.ts` |
| `RELAY_LLM_PROVIDER` | `claude` or `offline`. Defaults to `claude` when a key is set. | Read today |
| `DATABASE_URL` | Postgres (Neon, Supabase). Required on Vercel for anything real: without it data lives in memory and resets when a server restarts. | Read today |
| `SLACK_WEBHOOK_URL` | One incoming webhook for notifications. Replaced by the Slack app in T-40. | Read today |
| `GITHUB_WEBHOOK_SECRET` | Verifies GitHub webhook signatures. | Read today |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | The Slack app (T-40 to T-43). | New |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET` | The GitHub App (T-44). | New |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `EMAIL_SERVER` | Sign-in (T-31). | New |
| `ENCRYPTION_KEY` | Encrypts stored Slack and GitHub tokens (T-40, T-44). | New |

The model adapter supports Claude only. An OpenAI key would need a second provider in
`src/lib/ai/llm.ts` (T-03); Claude is the default and needs no code change.

---

## Foundation

- [ ] **T-01 Feature flag for deferred features.** Mock: all. Add `BEACON_WORKERS` (default off)
  in `src/lib/flags.ts`. Off hides New teammate, the agent gallery, worker tiers, the task
  workspace, the digest and the map, and returns 404 from their routes; the agent panel says it
  can't do work yet and offers to ask the team instead. Acceptance: with the flag off, no page or
  agent reply offers to do work; with it on, today's behaviour is unchanged; tests pass both ways.
  Touches: `src/app/(app)/layout.tsx`, `src/lib/assistant.ts`, agent and digest routes. S.
- [ ] **T-02 New navigation.** Mock: M2 to M6 sidebar. Ask Beacon, Teams, Team queue, My
  questions, What's changing, Inbox, Audit log, Workspace settings. Acceptance: matches the mock's
  sidebar; Commitments, Meetings, Map and Digest are gone from the nav. Depends: T-01. S.
- [ ] **T-03 Real model calls on Vercel.** Mock: M3. Confirm every AI task runs with
  `ANTHROPIC_API_KEY` set in Vercel: log which provider answered (`by`) in the audit event, show a
  small "Offline writer" note in the UI when no key is set, and add a per-workspace monthly spend
  cap with a clear message when it's reached. Optional: an `openai` provider behind the same
  adapter, selected by `RELAY_LLM_PROVIDER=openai` and `OPENAI_API_KEY`. Acceptance: with a key,
  answers come from Claude in the preview deploy; without one, the demo still works. Touches:
  `src/lib/ai/llm.ts`. S.
- [ ] **T-04 Hosted database by default.** Mock: all. Document and check `DATABASE_URL` for the
  Vercel project; show a warning banner in the app when running on Vercel without it.
  Acceptance: data survives a redeploy on the preview. S.

## M2 and M3: learned team context and grounded answers

- [ ] **T-10 Team context tables.** Mock: M2. Migration `006_team_context` with `context_entry`
  and `context_signal` as in the roadmap's Phase 1, each with `org_id`. `refContext` in
  `src/lib/data.ts` so `visibleLevel` covers them. Acceptance: permission tests show members see
  full, others see the shared level, a marked signal never surfaces above its source's level. M.
- [ ] **T-11 Learning engine.** Mock: M2. `src/lib/context-learn.ts` with `learnFrom(source)`,
  an `extractContext` AI task with offline and fake versions, and `applySignal()` with the trust
  rules (low-risk kinds apply as "learned"; ownership, capabilities and marked sources wait for
  confirmation). Runs with `after()`. Acceptance: unit tests feed sample answers and PRs and get
  the expected entries and pending claims. Depends: T-10. L.
- [ ] **T-12 Learn from answered asks and agent chats.** Mock: M2, M4. Call `learnFrom` from
  `answerCluster` (the answerer's reply) and from team members' messages in `chat_message`.
  Acceptance: answering a routed question in the demo creates a learned or pending entry on the
  team page. Depends: T-11. S.
- [ ] **T-13 Learn from updates, meetings, PRs and Claude Code sessions.** Mock: M2. Call
  `learnFrom` from `publishDraft`, `summarizeMeeting`, `ingestPullRequest` and
  `ingestCodingSession`. Acceptance: a merged PR touching a new repository adds a "Runs" entry
  tagged Seen in GitHub. Depends: T-11. M.
- [ ] **T-14 Seed by learning.** Mock: M2. The sample workspaces build their team context by
  running `learnFrom` over their seeded updates, answers, meetings and documents. Acceptance:
  Platform's page in Northwind looks like M2 without hand-written context. Depends: T-12, T-13. S.
- [ ] **T-15 "What Beacon knows about us" section.** Mock: M2. Entries grouped by kind with
  provenance tags, sources and freshness; Looks right, Fix (inline edit) and Remove with undo, for
  team members; others see it read-only at the shared level. Every action writes an audit event
  and feeds back into learning. Acceptance: matches M2; removing an entry stops it being
  re-learned from the same sources. Depends: T-10. M.
- [ ] **T-16 Pending questions.** Mock: M2. Show at most three pending claims as yes, no or not
  sure questions at the top of the team page, and add them to each member's batch of asks.
  Acceptance: one confirmation makes the claim active. Depends: T-11, T-15. S.
- [ ] **T-17 What Beacon can see.** Mock: M2, M6. Per team: sources with Live or Planned, last
  sync, and gaps. Adds `connector.mode`. Acceptance: matches M2's card; planned tools never show as
  Live. S.
- [ ] **T-18 Sources carry provenance and freshness.** Mock: M3. `publishedSources` includes
  active entries and adds `provenance` and `lastSeen` to every source. Pending entries are never
  used for other teams. Acceptance: test that a pending claim can't appear in another team's
  answer. Depends: T-10. S.
- [ ] **T-19 Claim-by-claim answers.** Mock: M3. New answer schema with claims, refs, `gaps` and
  stale sources; offline writer produces the same shape; render each claim with its tag, date and
  source link, and a "What I couldn't find" box, on the team page and in the agent panel.
  Acceptance: matches M3's first answer. Depends: T-18. M.
- [ ] **T-20 Clarifying questions.** Mock: M3. Answer output can ask one follow-up with
  suggested replies; `question.outcome` gains `clarify`; the reply continues the question. The
  general Beacon agent asks which team when two match. Acceptance: the M3 exchange works end to
  end in the demo. Depends: T-19. M.
- [ ] **T-21 Answer feedback.** Mock: M3. Thumbs up or down with an optional note; a thumbs down
  lowers confidence in the entries used. S.

## M4 and M5: routing, the team queue and request status

- [ ] **T-22 Route to the team queue.** Mock: M3, M4. `chooseRoute()` sends a confident ownership
  match to the owner (and shows it in the team queue), anything else to the team queue, and says
  why (`request.destination`, `request.route_reason`). Acceptance: "merchant sign-on" goes to
  Platform's queue with the reason shown. M.
- [ ] **T-23 Team queue page.** Mock: M4. For you and Team queue tabs, I'll take it
  (`request.claimed_by`), Pass to a teammate, answer once for everyone who asked, Ask them for more
  detail. Acceptance: matches M4; any Platform member can answer. Depends: T-22. M.
- [ ] **T-24 Answers feed learning.** Mock: M4. Remove the Publish checkbox; after an answer,
  show what Beacon learned and whether it needs confirming, as in M4. Depends: T-12, T-23. S.
- [ ] **T-25 Request lifecycle.** Mock: M5. Statuses awaiting team, needs your input, answered,
  resolved, declined, unresolved; unresolved after 3 business days with Send to the lead or Ask
  again; every change audited. Acceptance: status tests for each transition. Depends: T-22. M.
- [ ] **T-26 My questions page.** Mock: M5. The progress steps, the reply, That answers it and
  Ask a follow-up, and the table of past questions with where they went. Depends: T-25. M.
- [ ] **T-27 Multi-team questions.** Mock: M3. When several teams match, list them and let the
  person send to one or more, linked by one question. Depends: T-22. M.

## M1 and M6: workspaces and sign-in

- [ ] **T-30 `org_id` everywhere.** Mock: M1. Add and backfill `org_id` on every table that
  lacks it; the viewer carries `orgId`; every query filters by it; remove the `ORG_ID` constant.
  Acceptance: a test seeds two workspaces with the same team names and finds no page, answer,
  entry or audit read that crosses. L.
- [ ] **T-31 Sign-in.** Mock: M1. Google, Microsoft and email magic links (env vars above), a
  `session` table, membership in several workspaces, and the workspace chooser. The persona
  switcher stays only inside sample workspaces. Depends: T-30. M.
- [ ] **T-32 Sample workspaces side by side.** Mock: M1. Each demo pack seeds its own workspace;
  Reset resets only that one; no more truncating every table. Depends: T-30. M.
- [ ] **T-33 Create a workspace and invite people.** Mock: M1, M6. Create, invite by email, create
  teams and leads. Depends: T-31. M.
- [ ] **T-34 Workspace settings.** Mock: M6. Sources, Slack channels Beacon learns from (with
  exclusion), what needs a teammate's OK (the trust rules, stored in `org.settings`), people.
  Depends: T-33, T-40. M.

## Real integrations

Slack first, because that's where team conversation happens and where people already ask each
other questions. Then GitHub, then the planned tools.

- [ ] **T-40 Slack app: install and tokens.** Mock: M6. A Slack app with OAuth install per
  workspace (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`), bot token stored encrypted
  (`ENCRYPTION_KEY`), and request signing verified (`SLACK_SIGNING_SECRET`). Connector rows become
  `mode = 'live'`. Acceptance: installing from M6 shows Slack as Live. M.
- [ ] **T-41 Slack: learn from chosen channels.** Mock: M2, M6. Events API for messages in the
  public channels a workspace picks (never DMs or private channels), mapped to the team that owns
  each channel; messages go to `context_signal` through `learnFrom`, respecting exclusions;
  excluding a channel forgets what was learned only from it. Acceptance: a message in
  #platform-asks answering a question creates a learned entry with a link back to Slack.
  Depends: T-11, T-40. L.
- [ ] **T-42 Slack: notifications.** Mock: M4. Post team queue items to the team's channel and
  answers to the asker by DM, replacing `SLACK_WEBHOOK_URL`; batching rules stay. Depends: T-40,
  T-23. M.
- [ ] **T-43 Slack: ask from Slack.** Mock: M3. A `/beacon` slash command and an @Beacon mention
  that ask a team's agent and reply in thread with the same claim-by-claim answer and routing.
  Depends: T-19, T-40. M.
- [ ] **T-44 GitHub App.** Mock: M2, M6. Replace the per-repository webhook with a GitHub App
  install (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`); map
  repositories to teams; feed merged PRs and reviews to `learnFrom`; respect repository access when
  showing sources. Acceptance: installing on the northwind org and merging a PR updates the owning
  team's page. Depends: T-11. L.
- [ ] **T-45 Claude Code tokens per person.** Mock: M6. Real per-person tokens issued from
  settings (replacing `rly_demo_*`), revocable, with the hook install command shown. Depends:
  T-31. S.
- [ ] **T-46 Jira or Linear (pick one).** Mock: M2. Read issues for the teams that own projects,
  into `learnFrom` and as sources. Depends: T-11. L.
- [ ] **T-47 Google Meet or Zoom transcripts.** Mock: M2. Read transcripts of meetings the team
  chooses, summarize, and learn from them. Depends: T-11. L.

## Reframe (from Phase 0)

- [ ] **T-50 Remove slip and at-risk framing.** No slipped or at-risk styling in the feed, team
  page and inbox; "Open commitments" becomes "Active work" (as in M2). S.
- [ ] **T-51 Rewrite the Northwind story.** The spec's narrative, as in M3 to M5: Ava asks
  whether Platform can support merchant sign-on; clarify; team queue; Ken answers; Beacon learns.
  Update `types.ts`, `tests/demos.test.ts`, `/guide`. Hide the other demos until rewritten. L.
- [ ] **T-52 Rewrite the marketing site.** Hero, product section and mockups to the spec's TL;DR;
  replace the risk dashboard with a team page and a sourced answer. M.
- [ ] **T-53 Docs.** README and HANDOFF point to the new spec; `SPEC.md` marked historical. S.

## Later

- [ ] **T-60 Bounded work, one action at a time.** Turn on `BEACON_WORKERS` per action once
  answers and routing are trusted, each with its scope, permissions, approval and audit defined
  first.

## Suggested order

If you want a path rather than a menu: T-01, T-02, T-03, T-04, then T-10, T-11, T-12, T-15, T-18,
T-19 (that's M2 and M3 working on the demo), then T-22, T-23, T-24, T-25, T-26 (M4 and M5), then
T-40, T-41, T-42 (real Slack), then T-30 to T-33 before any pilot.
