# Beacon

**A signal across every team.** Beacon is the orchestration and execution layer for modern organizations: it connects people, context and work across teams, and turns strategic intent into coordinated action.

This repository holds two things, deployed together:

- **The marketing site** at `/`, with an early-access form at `/early-access`. Launch images and captions are in [`marketing/`](marketing/launch-campaign.md).
- **The working prototype** at `/feed` and the pages around it, running inside a fictional 300-person company, Northwind Labs. It's the v1 product described in [`SPEC.md`](SPEC.md). (The code still uses the working name "Relay" internally.) The earlier city-permitting brief is in [`docs/permitting-brief.md`](docs/permitting-brief.md).

## Early-access signups

Set **`EARLY_ACCESS_WEBHOOK_URL`** in Vercel before you send people to the site. Every request is forwarded there as JSON (with a `text` field, so a Slack incoming webhook works as is; Zapier, Make or Formspree work too). Without it, requests are only stored in the app's database, which on Vercel resets whenever a new server starts. Set `DATABASE_URL` as well if you want a permanent copy in Postgres.

## Editing the launch site

- **Your name on "Built by":** set `FOUNDER` at the top of [`src/app/(site)/page.tsx`](src/app/(site)/page.tsx) (name, plus an optional LinkedIn or personal link).
- **Logos:** tool marks come from Simple Icons ([`src/components/site/marks.ts`](src/components/site/marks.ts)). Slack, Microsoft Teams and Toast restrict use of their logos, so they're set as plain type. If you have the right to use an official logo, save it as `public/logos/<id>.svg` (`slack`, `teams`, `toast`) and it replaces the typeset version.
- **Integration status:** [`src/components/site/Integrations.tsx`](src/components/site/Integrations.tsx). Only GitHub, Claude Code and Slack channel notifications are marked Available; move a tool to `live` when it really works.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000 for the site, or http://localhost:3000/feed for the prototype. There's nothing else to set up: the database is an embedded Postgres (PGlite) stored in `.data/`, and it seeds itself on first run.

- **AI:** with no API key, Beacon uses its built-in offline writer, so the demo always works. To use Claude, put `ANTHROPIC_API_KEY=...` in `.env.local` (see `.env.example`).
- **Reset:** the "Reset demo data" button in the sidebar, or `npm run db:reset`.
- **Tests:** `npm test` (45 tests, including every permission test in the brief). Tests use a fake model and never call a real one.

## The five-minute demo

The story is set on **Dec 6, 2026**. Pick who you are with **Viewing as** at the bottom of the sidebar. There's no login; the server enforces every permission as that person.

1. **Find who owns what.** Search "rate limits" and land on Platform's page: what it owns, who owns each area, and its open commitments.
2. **The feed (as Jordan Ellis, Growth marketing).** The webhook-retries decision appears at Summary. The Dec 15 launch is flagged at risk because it depends on Payments API's retries, which depend on Platform's rate-limit change, which slipped.
3. **Commitments (as Priya Raman, Payments API).** Platform's Dec 5 commitment shows as slipped, with the latest reason.
4. **Write update (as Marcus Johnson, Platform lead).** Click "Paste example notes", then "Split into items". Beacon splits the notes into items, tags affected teams, and finds "we'll land the rate-limit change by Dec 9" as a revision of the Dec 5 commitment. Publish, and Payments API and Growth marketing are notified (see Inbox as Priya or Jordan).
5. **Leadership digest (as Elena Vasquez, CEO).** One paragraph per team, plus slipped commitments. The Sales paragraph mentions Halcyon Bank, so it's marked confidential. Switch to Diego Alvarez (Payments API): that paragraph is hidden, and his view of the Sales request has the customer's name redacted.

Then show the team agents and asks:

6. **Ask a team's agent (as Ravi Shah, Growth).** On Platform's page, ask "When will the rate-limit change land?". Before step 4 the agent can't answer, so it routes the question to Aisha Bello (who owns Rate limits) and tells Ravi that 3 others asked the same thing. After step 4 it answers from Platform's update. On Payments API's page, "Do webhook retries cover payout events?" is answered from a published answer.
7. **Asks for you (as Aisha Bello).** The four questions about the rate-limit date are merged into one. Answer once: everyone who asked gets the reply, and with "Publish" ticked the agent can answer it next time. "Send my batch now" shows the single message she'd get instead of separate emails.
8. **Integrations.** Each team's page lists the tools its agent reads (fictional Northwind Jira, Slack, Notion, GitHub and others). "Simulate a session" turns a coding-agent session into a draft update; "Simulate a merged pull request" does the same for GitHub. Drafts are visible only to their author until published.
9. **Audit log.** Every feed read, agent read (with the person the agent acted for), share, answer and digest send.

Then show meetings, agent work and the map:

10. **Meetings (as Marcus Johnson).** Open "Platform × Payments: rate-limit dependency". It's recorded but not summarized. "Summarize" writes decisions, risks and action items with owners. "Route to teams" turns it into a draft update for Marcus to review, and each action item becomes a draft commitment for its owner. Hannah's draft is visible only to Hannah until she confirms it. The Leadership staff meeting is confidential: only its attendees see it.
11. **Agent workspace (as anyone on Platform).** Open "Platform agent" in the sidebar. Start a research task ("How do other payment APIs limit webhook retry traffic per merchant?") or a draft update from the team's recent tickets and PRs. The task page shows each step while it runs. Anyone on the team can comment, redirect it and rerun, or take it over. Spend counts against the agent's monthly budget. People outside the team can't open the task.
12. **Team map.** Who owes whom (colored by commitment state), who is asking whom, and what each team shares. Click a team to focus on it. Everything on the map is shown at your level, and the table under it lists the same relationships.

Research uses Claude with web search, so it needs `ANTHROPIC_API_KEY`; without one, the task says so and sends nothing. Meeting summaries and draft updates work offline.

## How it works

- **One permission check.** `visibleLevel(reader, item)` in [`src/lib/permissions.ts`](src/lib/permissions.ts) decides what anyone sees, at five levels: Full detail, Summary, Status only, Headline, Not shared. Team members see their own items in full. Followers get what the interface grants (Summary by default), everyone else the org default (Headline). Markings cap it further, and drafts are visible only to their author. An agent reading for someone never sees more than that person.
- **Only rendered text leaves the server.** [`src/lib/render.ts`](src/lib/render.ts) turns an item into the text for the reader's level. Pages never receive more detailed text to hide in the browser.
- **Derived outputs carry markings.** Agent answers and digest paragraphs carry every marking of their inputs, and are shown only to readers every marking allows.
- **Team agents** ([`src/lib/agent.ts`](src/lib/agent.ts)). The agent reads the team's published items, commitments and ownership at the asker's level. It answers with sources, or routes to the owner of the matching ownership item (falling back to the team lead). Questions about the same thing to the same person share a cluster. Asks marked blocking, or needed before the next batch, are delivered right away; everything else waits for the person's batch.
- **AI adapter** ([`src/lib/ai/llm.ts`](src/lib/ai/llm.ts)). Every AI task goes through one adapter (Claude by default, `claude-opus-5-5` at low effort with server-side fallback), and falls back to the offline writer in [`src/lib/ai/offline.ts`](src/lib/ai/offline.ts) if the model is missing, refuses or errors. To swap providers (Bedrock, Vertex, on-premises), change only this file.
- **Tool content is private by default.** Messages, tickets, docs and PRs from connected tools are visible in full only to the owning team. Other teams see tickets and PRs only where an interface shares them, and never see a marked item below full detail, so a confidential ticket can't leak through its title.
- **Agent work** ([`src/lib/work.ts`](src/lib/work.ts)). Tasks run in the background after the response (`after()`), and the page polls until they finish. Research reads only what the requester could read, and the agent can only write drafts.
- **Data model.** The tables in [`src/lib/migrations.ts`](src/lib/migrations.ts) keep the brief's names (unit, member, ownership_item, update/update_item, interface, follow, request, commitment, marking, audit_event), so industry packs fit later. There are a few additions: a `question` table, `delivery` (the inbox), each ownership item's owner, and a publisher's cap on what an answer shows to other teams.

## Coding agents and GitHub

- **Claude Code:** [`integrations/claude-code/relay-hook.mjs`](integrations/claude-code/relay-hook.mjs) runs as a `SessionEnd` hook. It sends your prompts, the agent's closing notes and recent commits to `POST /api/sources/coding-session` with your Relay token. Relay drafts "what I worked on", strips anything that looks like a secret, and shows it only to you until you publish. The Connect tools page has the exact `settings.json` snippet.
- **GitHub:** point a repository webhook (Pull requests, JSON) at `/api/sources/github`. Set `GITHUB_WEBHOOK_SECRET` to verify signatures. People are matched by GitHub login.

## Hosting

**Vercel, demo mode (no setup):** import the repo in Vercel and deploy. No database or environment variables are needed. On Vercel, Beacon keeps the Northwind demo data in memory, so each new server starts from the Dec 6 story. Changes you make during a demo (publishing, answering asks) last as long as that server stays warm, usually the length of a demo. Add `ANTHROPIC_API_KEY` in the project's environment variables to use Claude.

**Keeping data:** set `DATABASE_URL` to any Postgres (Neon, Supabase, RDS). The first request migrates and seeds it, and a database lock makes sure only one server does that.

There's no login by design: Beacon is demoed inside the fictional Northwind Labs, and the persona switcher and demo tokens (`rly_demo_*`) are part of that.

## Decisions made for this demo

- **AI provider:** Claude behind one adapter, with the offline writer as a fallback. Answered Nov 26.
- **Sign-in:** none. The product is demoed inside a fictional company, so a persona switcher stands in for login. Decided Nov 27.
- **Team page visibility:** org-wide at Headline, as the brief's disclosure defaults describe.
- **Slack vs. Teams:** delivery goes to the in-app inbox, plus a Slack incoming webhook if `SLACK_WEBHOOK_URL` is set. Teams is not built.
- **Hosting region:** not decided. The embedded database keeps demo data on the machine running it.

## Not built yet

- Email sending (the digest "sends" to the inbox).
- A Slack slash command.
- Editing interfaces in the UI (following a team creates one at Summary).
- Real meeting recordings from Zoom, Meet or Teams. Meetings and tool content are fictional Northwind data.
- Jira and Linear status for commitments.
