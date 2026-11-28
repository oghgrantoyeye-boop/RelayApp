# Relay: handoff

Paste this into a new chat or add it to a project's knowledge.

## Where things stand (Nov 27, 2026)

Relay pivoted from city permitting to knowledge sharing for tech companies of 200 to 2,000 people. The current spec is [`docs/product/team-context-answers-routing.md`](docs/product/team-context-answers-routing.md) (adopted Nov 28, 2026). The build plan is [`docs/product/roadmap.md`](docs/product/roadmap.md), the goal screens are [`docs/product/mocks/`](docs/product/mocks/index.html), and the task list, split between the Claude and Cursor lanes, is [`docs/product/backlog.md`](docs/product/backlog.md). [`SPEC.md`](SPEC.md), the v1 build brief, is historical: it describes what was built first, and the new spec wins wherever they differ. The permitting brief is kept in `docs/permitting-brief.md`.

**v1 is built**, on branch `claude/dazzling-archimedes-x7233q`, and runs with `npm install && npm run dev`. See [`README.md`](README.md) for the demo script. It includes:

- Directory, team pages, My feed, Commitments, Write update, the leadership digest, Inbox, the audit log and Connect tools.
- **Team agents.** Each team's agent answers from what the team has published, at the asker's level. It routes the rest to the person who owns that area, merges duplicate questions and batches asks per person. The person answers once, for everyone who asked, and can publish the answer so the agent answers it next time.
- **Draft sources.** A Claude Code `SessionEnd` hook and a GitHub webhook turn sessions and merged pull requests into drafts only their author sees.
- **Integrations, meetings and agent work.** Teams connect (fictional) tools, and their content feeds the agent at each reader's level. Meetings are summarized and routed into draft updates and commitments. Agents run research (Claude with web search, needs a key) and draft updates as background tasks the team can steer, within a monthly budget.
- **Team map** of commitments, asks and sharing between teams.
- **Beacon launch site** at `/`, with early-access signups and the campaign in `marketing/`.
- **Tests.** 85 tests cover every permission test in the brief, the agent and request routing, and the key walkthrough steps for each demo.
- **Five customer demos** (`/demos`): Northwind Labs (software company), City of Harborview (city hall), Halden & Moss Architects (architecture firm), Maison Verel (fashion house) and The Lakeport Courier (regional daily newspaper). Each is one file in `src/lib/demos/`, with a guide page at `/guide`.

## Decisions made

- **AI provider:** Claude (`claude-opus-5-5`) behind one adapter, with an offline writer when no key is set. Tests use a fake model.
- **Sign-in:** none, by design. Relay is demoed inside the fictional Northwind Labs; a persona switcher stands in for login, and the server enforces permissions as the chosen person.
- **Stack:** Next.js 16 + TypeScript, embedded Postgres (PGlite) locally, any Postgres via `DATABASE_URL`.
- **Agents** answer, route and batch, and can do work the team asks for (research, draft updates). They only ever write drafts, and never read more than the person they act for.
- **Name:** the product is Beacon. The code keeps the working name Relay.

## Open questions

- Slack first or Microsoft Teams first, depending on design partners.
- Hosting region, if customers require data to stay in Canada or the US.

## Next steps

- Deploy with a hosted Postgres for design-partner demos.
- Add a Slack app (delivery and a slash command), then email.
- Replace the fictional tool data with real Zoom/Meet transcripts and Jira/Linear status.
- Set `EARLY_ACCESS_WEBHOOK_URL` and `ANTHROPIC_API_KEY` in Vercel.
