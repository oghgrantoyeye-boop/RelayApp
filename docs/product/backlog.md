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
- Keep `npm test` green and add tests for what you build. Tests use the
  fake model and never call a real one.
- Integrations are real, not demo data. Where a task needs a live account (Slack, GitHub), it says
  which environment variables it reads. Keep the sample workspaces working with seeded data.
- This is Next.js 16. Read the guide in `node_modules/next/dist/docs/` before changing routing,
  server actions or caching (see `AGENTS.md`). Migrations in `src/lib/migrations.ts` are
  append-only.
- When a task is done, tick it here in its last commit.

## Two lanes: Claude and Cursor

Two agents build at the same time. Each lane owns a set of files, so their commits rarely touch
the same lines. The goal is a product people can really use: real sign-in, real workspaces and
real integrations come early, and the demos stay as sample workspaces anyone can open.

| Lane | Tasks | Mainly touches |
| --- | --- | --- |
| **Claude** | T-00 (first), then T-01, T-02, T-03, T-10 to T-27, T-50 to T-53 | `src/lib/agent.ts`, `src/lib/assistant.ts`, `src/lib/ai/*`, `src/lib/context-*.ts`, `src/lib/feed.ts`, `src/lib/commitments.ts`, `src/lib/demos/*`, team, asks, feed and guide pages, the marketing site |
| **Cursor** | T-30 to T-33 (first), then T-04, T-34, T-40 to T-47 | `src/lib/session.ts`, `src/lib/data.ts` (viewer and `org_id`), `src/lib/db.ts`, `src/lib/seed.ts`, new `src/lib/auth/*`, `src/lib/slack/*`, `src/lib/github/*`, `src/app/api/slack/*`, `src/app/api/github/*`, sign-in and settings pages |

Shared files and how to handle them:

- **`src/lib/migrations.ts`:** append one entry per task, id `NNN_task-id_short_name`
  (for example `007_T-40_slack_install`). If `git pull --rebase` shows both lanes added one, keep
  both and put yours last, renumbering yours.
- **`src/app/actions.ts` and `src/app/(app)/layout.tsx`:** add, don't reorganize. New server
  actions for a lane go in a new file (`src/app/actions/slack.ts`, `src/app/actions/context.ts`).
- **New tables** in either lane include `org_id` from the start, so T-30 doesn't have to backfill
  them.
- **Cross-lane dependencies:** T-41 needs T-11, T-42 needs T-23, T-43 needs T-19. Until those
  land, build against the function names in this file (`learnFrom`, `chooseRoute`) behind a stub,
  or pick another task.

## Claiming and shipping a task

One pull request per task, reviewed by the other lane. Claude reviews Cursor's PRs and Cursor
reviews Claude's. The base branch is the default branch, `claude/dazzling-archimedes-x7233q`.

1. **Claim it.** Change the task's box to `[~]` and add your lane, for example
   `- [~] **T-40 ...** (Cursor)`. Commit that line alone and push it straight to the default
   branch right away, so the other lane sees it before starting. Claims are the only straight
   pushes.
2. **Build it** on a branch named for the task, `<lane>/t-NN-short-name` (for example
   `cursor/t-40-slack-install`). Commit messages start with the task id: `T-40: Slack OAuth install`.
   Change `[~]` to `[x]` in the PR's last commit.
3. **Before every push:** bring in the default branch (`git merge origin/<default>` on a branch
   that's already pushed, or a rebase before its first push), then `npm run typecheck`, `npm test`
   and `npm run build`. Push only when all three pass. Never force-push, not even to your own task
   branch.
4. **Open the PR** with the title `T-NN: <task name>`. The body says what changed, how it was
   tested, and anything the reviewer should look at closely.
5. **Review the other lane's PRs** before starting your next task. Check the diff against the
   task's acceptance and mock, the permission rules (one `visibleLevel` check, markings carried
   into derived outputs, `org_id` on new tables) and that tests cover the change and never call a
   real model or API. Pull the branch and run the three checks yourself. Both lanes push as the
   same GitHub account, so GitHub won't accept a formal approval: post the review as a comment
   review that starts with **Approved** or **Changes requested**, with line comments for each issue.
6. **Merge your own PR** (squash) once the other lane has posted **Approved** and the Vercel check
   is green. Address requested changes with new commits on the branch and reply to each comment.
   If the other lane hasn't reviewed within a few hours, ask Ovo rather than merging unreviewed.
7. **If a merge breaks the build** (Vercel shows it on the default branch), the lane that merged it
   fixes it next, before anything else.

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
| `BEACON_WORKERS` | `on` turns back on work-performing agents, the agent gallery, the digest and the map. Off by default. | Read since T-01 |
| `RELAY_LLM_PROVIDER` | `claude` or `offline`. Defaults to `claude` when a key is set. | Read today |
| `DATABASE_URL` | Postgres (Neon, Supabase). Required on Vercel for anything real: without it data lives in memory and resets when a server restarts. | Read today |
| `SLACK_WEBHOOK_URL` | One incoming webhook for notifications. Replaced by the Slack app in T-40. | Read today |
| `GITHUB_WEBHOOK_SECRET` | Verifies GitHub webhook signatures. | Read today |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | The Slack app (T-40 to T-43). | New |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` | The GitHub App (T-44). Enable user OAuth during installation. | New |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `EMAIL_SERVER` | Sign-in (T-31). For Microsoft, also add optional ID-token claims `email` and `xms_edov` on the Entra app (Token configuration) so verified emails work after T-36. | New |
| `BEACON_ADMIN_EMAILS` | Comma-separated emails that can sign in without approval and approve early-access leads (T-36). | New |
| `ENCRYPTION_KEY` | Encrypts stored Slack and GitHub tokens (T-40, T-44). | New |

The model adapter supports Claude only. An OpenAI key would need a second provider in
`src/lib/ai/llm.ts` (T-03); Claude is the default and needs no code change.

---

## First: the website

- [x] **T-00 Rewrite the website to the new spec.** Done before anything else. The landing page
  (`src/app/(site)/page.tsx`, `src/components/site/*`, `src/app/(site)/layout.tsx`, the early-access
  page) says what Beacon is now: it helps people understand what other teams do, own and know;
  answers questions with sources, saying where each point came from and what's missing; and gets
  the rest to the right team or person. Remove the risk, deadline and slipped-launch framing from
  the hero, mockups and flow (keep at most one example of a deadline question, as a use case).
  Don't promise agents that do work. Only GitHub, Claude Code and Slack show as available; the
  rest stay marked planned. Replace the risk dashboard mockups with a team page and a sourced
  answer drawn from the goal mocks (M2, M3). Acceptance: no page on the site says "at risk",
  "slipped", "does the legwork" or that agents do work; the integrations list matches what's live;
  `npm run build` passes; it reads well on a phone. (Claude)

## Foundation

- [x] **T-01 Feature flag for deferred features.** (Claude) Mock: all. Add `BEACON_WORKERS` (default off)
  in `src/lib/flags.ts`. Off hides New teammate, the agent gallery, worker tiers, the task
  workspace, the digest and the map, and returns 404 from their routes; the agent panel says it
  can't do work yet and offers to ask the team instead. Acceptance: with the flag off, no page or
  agent reply offers to do work; with it on, today's behaviour is unchanged; tests pass both ways.
  Touches: `src/app/(app)/layout.tsx`, `src/lib/assistant.ts`, agent and digest routes. S.
- [x] **T-02 New navigation.** (Claude) Mock: M2 to M6 sidebar. Ask Beacon, Teams, Team queue, My
  questions, What's changing, Inbox, Audit log, Workspace settings. Acceptance: matches the mock's
  sidebar; Commitments, Meetings, Map and Digest are gone from the nav. Depends: T-01. S.
- [x] **T-03 Real model calls on Vercel.** (Claude) Done: Integrations shows which model answers, calls, tokens and the last failure; failures are logged. The per-workspace spend cap moved to T-35. Mock: M3. Confirm every AI task runs with
  `ANTHROPIC_API_KEY` set in Vercel: log which provider answered (`by`) in the audit event, show a
  small "Offline writer" note in the UI when no key is set, and add a per-workspace monthly spend
  cap with a clear message when it's reached. Optional: an `openai` provider behind the same
  adapter, selected by `RELAY_LLM_PROVIDER=openai` and `OPENAI_API_KEY`. Acceptance: with a key,
  answers come from Claude in the preview deploy; without one, the demo still works. Touches:
  `src/lib/ai/llm.ts`. S.
- [x] **T-04 Hosted database by default.** Mock: all. Document and check `DATABASE_URL` for the
  Vercel project; show a warning banner in the app when running on Vercel without it.
  Acceptance: data survives a redeploy on the preview. S. (Cursor)

## M2 and M3: learned team context and grounded answers

- [x] **T-10 Team context tables.** (Claude) Mock: M2. Migration `006_team_context` with `context_entry`
  and `context_signal` as in the roadmap's Phase 1, each with `org_id`. `refContext` in
  `src/lib/data.ts` so `visibleLevel` covers them. Acceptance: permission tests show members see
  full, others see the shared level, a marked signal never surfaces above its source's level. M.
- [x] **T-11 Learning engine.** (Claude) Mock: M2. `src/lib/context-learn.ts` with `learnFrom(source)`,
  an `extractContext` AI task with offline and fake versions, and `applySignal()` with the trust
  rules (low-risk kinds apply as "learned"; ownership, capabilities and marked sources wait for
  confirmation). Runs with `after()`. Acceptance: unit tests feed sample answers and PRs and get
  the expected entries and pending claims. Depends: T-10. L.
- [x] **T-12 Learn from answered asks and agent chats.** (Claude) Mock: M2, M4. Call `learnFrom` from
  `answerCluster` (the answerer's reply) and from team members' messages in `chat_message`.
  Acceptance: answering a routed question in the demo creates a learned or pending entry on the
  team page. Depends: T-11. S.
- [x] **T-13 Learn from updates, meetings, PRs and Claude Code sessions.** (Claude) Mock: M2. Call
  `learnFrom` from `publishDraft`, `summarizeMeeting`, `ingestPullRequest` and
  `ingestCodingSession`. Acceptance: a merged PR touching a new repository adds a "Runs" entry
  tagged Seen in GitHub. Depends: T-11. M.
- [~] **T-14 Seed by learning.** (Claude) Mock: M2. The sample workspaces build their team context by
  running `learnFrom` over their seeded updates, answers, meetings and documents. Acceptance:
  Platform's page in Northwind looks like M2 without hand-written context. Depends: T-12, T-13. S.
- [x] **T-15 "What Beacon knows about us" section.** (Claude) Mock: M2. Entries grouped by kind with
  provenance tags, sources and freshness; Looks right, Fix (inline edit) and Remove with undo, for
  team members; others see it read-only at the shared level. Every action writes an audit event
  and feeds back into learning. Acceptance: matches M2; removing an entry stops it being
  re-learned from the same sources. Depends: T-10. M.
- [x] **T-16 Pending questions.** (Claude) Mock: M2. Show at most three pending claims as yes, no or not
  sure questions at the top of the team page, and add them to each member's batch of asks.
  Acceptance: one confirmation makes the claim active. Depends: T-11, T-15. S.
- [~] **T-17 What Beacon can see.** (Claude) Mock: M2, M6. Per team: sources with Live or Planned, last
  sync, and gaps. Adds `connector.mode`. Acceptance: matches M2's card; planned tools never show as
  Live. S.
- [x] **T-18 Sources carry provenance and freshness.** (Claude) Mock: M3. `publishedSources` includes
  active entries and adds `provenance` and `lastSeen` to every source. Pending entries are never
  used for other teams. Acceptance: test that a pending claim can't appear in another team's
  answer. Depends: T-10. S.
- [x] **T-19 Claim-by-claim answers.** (Claude) Mock: M3. New answer schema with claims, refs, `gaps` and
  stale sources; offline writer produces the same shape; render each claim with its tag, date and
  source link, and a "What I couldn't find" box, on the team page and in the agent panel.
  Acceptance: matches M3's first answer. Depends: T-18. M.
- [x] **T-20 Clarifying questions.** (Claude) Mock: M3. Answer output can ask one follow-up with
  suggested replies; `question.outcome` gains `clarify`; the reply continues the question. The
  general Beacon agent asks which team when two match. Acceptance: the M3 exchange works end to
  end in the demo. Depends: T-19. M.
- [~] **T-21 Answer feedback.** (Claude) Mock: M3. Thumbs up or down with an optional note; a thumbs down
  lowers confidence in the entries used. S.

## M4 and M5: routing, the team queue and request status

- [x] **T-22 Route to the team queue.** (Claude) Mock: M3, M4. `chooseRoute()` sends a confident ownership
  match to the owner (and shows it in the team queue), anything else to the team queue, and says
  why (`request.destination`, `request.route_reason`). Acceptance: "merchant sign-on" goes to
  Platform's queue with the reason shown. M.
- [x] **T-23 Team queue page.** (Claude) Mock: M4. For you and Team queue tabs, I'll take it
  (`request.claimed_by`), Pass to a teammate, answer once for everyone who asked, Ask them for more
  detail. Acceptance: matches M4; any Platform member can answer. Depends: T-22. M.
- [~] **T-24 Answers feed learning.** (Claude) Mock: M4. Remove the Publish checkbox; after an answer,
  show what Beacon learned and whether it needs confirming, as in M4. Depends: T-12, T-23. S.
- [~] **T-25 Request lifecycle.** (Claude) Mock: M5. Statuses awaiting team, needs your input, answered,
  resolved, declined, unresolved; unresolved after 3 business days with Send to the lead or Ask
  again; every change audited. Acceptance: status tests for each transition. Depends: T-22. M.
- [~] **T-26 My questions page.** (Claude) Mock: M5. The progress steps, the reply, That answers it and
  Ask a follow-up, and the table of past questions with where they went. Depends: T-25. M.
- [~] **T-27 Multi-team questions.** (Claude) Mock: M3. When several teams match, list them and let the
  person send to one or more, linked by one question. Depends: T-22. M.

## M1 and M6: workspaces and sign-in

- [x] **T-30 `org_id` everywhere.** Mock: M1. Add and backfill `org_id` on every table that
  lacks it; the viewer carries `orgId`; every query filters by it; remove the `ORG_ID` constant.
  Acceptance: a test seeds two workspaces with the same team names and finds no page, answer,
  entry or audit read that crosses. L. (Cursor)
- [x] **T-31 Sign-in.** Mock: M1. Google, Microsoft and email magic links (env vars above), a
  `session` table, membership in several workspaces, and the workspace chooser. The persona
  switcher stays only inside sample workspaces. Depends: T-30. M. (Cursor)
- [x] **T-36 Gate account creation behind early access.** Do this next, before T-32 continues. (Cursor)
  Today `upsertAccount` (`src/lib/auth/accounts.ts`) creates an account for any email that signs in
  with Google, Microsoft or a magic link. Change it so a new account is created only when the email
  is approved: a `lead` row with `status = 'approved'` (add `status` pending/approved/declined,
  `approved_at`, `approved_by` to `lead` in a new migration), a pending workspace invite (T-33), or
  an email in `BEACON_ADMIN_EMAILS`. Anyone else who signs in gets no account and no session: save
  them as a lead (source `signin`) if they aren't one, and send them to `/signin/waitlist`, which
  says "You're on the early access list. We'll email you when your workspace is ready." Existing
  accounts keep signing in. Sample workspaces stay open to everyone without an account. Admin
  approval: `/admin/early-access`, visible only to accounts whose email is in `BEACON_ADMIN_EMAILS`,
  lists leads newest first with Approve and Decline, and approving writes an audit event. Tests:
  an unapproved email gets no account through all three sign-in paths, an approved one does, an
  existing account still signs in, a non-admin gets a 404 on the admin page. Depends: T-31. S. (Cursor)
- [x] **T-32 Sample workspaces side by side.** Mock: M1. Each demo pack seeds its own workspace;
  Reset resets only that one; no more truncating every table. Depends: T-30. M. (Cursor)
- [x] **T-33 Create a workspace and invite people.** Mock: M1, M6. Create, invite by email, create
  teams and leads. Depends: T-31. M. (Cursor)
- [x] **T-35 AI spend cap per workspace.** (Claude) Mock: M6. Record each model call's tokens in an `ai_usage` table with `org_id`, show this month's spend in workspace settings, and fall back to the offline writer with a clear note when a workspace's monthly cap (`org.settings.ai_monthly_usd`) is reached. Depends: T-30, T-03. S. (Claude)
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
- [x] **T-44 GitHub App.** Mock: M2, M6. Replace the per-repository webhook with a GitHub App
  install (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`); map
  repositories to teams; feed merged PRs and reviews to `learnFrom`; respect repository access when
  showing sources. Acceptance: installing on the northwind org and merging a PR updates the owning
  team's page. Depends: T-11. L. (Cursor)
- [x] **T-45 Claude Code tokens per person.** Mock: M6. Real per-person tokens issued from
  settings (replacing `rly_demo_*`), revocable, with the hook install command shown. Depends:
  T-31. S. (Cursor)
- [ ] **T-46 Jira or Linear (pick one).** Mock: M2. Read issues for the teams that own projects,
  into `learnFrom` and as sources. Depends: T-11. L.
- [ ] **T-47 Google Meet or Zoom transcripts.** Mock: M2. Read transcripts of meetings the team
  chooses, summarize, and learn from them. Depends: T-11. L.

## Reframe (from Phase 0)

- [x] **T-50 Remove slip and at-risk framing.** (Claude) No slipped or at-risk styling in the feed, team
  page and inbox; "Open commitments" becomes "Active work" (as in M2). S.
- [x] **T-51 Rewrite the Northwind story.** (Claude) The spec's narrative, as in M3 to M5: Ava asks
  whether Platform can support merchant sign-on; clarify; team queue; Ken answers; Beacon learns.
  Update `types.ts`, `tests/demos.test.ts`, `/guide`. Hide the other demos until rewritten. L.
- [ ] **T-52 Marketing follow-ups.** Anything T-00 leaves, plus `marketing/launch-campaign.md`. S.
- [x] **T-53 Docs.** (Claude) README and HANDOFF point to the new spec; `SPEC.md` marked historical. S.

## Later

- [ ] **T-60 Bounded work, one action at a time.** Turn on `BEACON_WORKERS` per action once
  answers and routing are trusted, each with its scope, permissions, approval and audit defined
  first.

## Suggested order

- **Claude:** T-00 (website), T-01, T-02, T-50, T-03, then T-10, T-11, T-12, T-13, T-15, T-18, T-19,
  T-20 (M2 and M3), then T-22 to T-26 (M4 and M5), then T-51 (the new demo story, once the features
  it walks through exist) and T-35.
- **Cursor, starting now in parallel:** T-30, T-31, T-32, T-33 (real sign-in and workspaces, with
  the demos as sample workspaces), then T-04, T-40, T-44, T-45 (real Slack, GitHub and Claude Code
  connections), then T-34, T-41, T-42, T-43 once the Claude lane's T-11, T-19 and T-23 are in.
