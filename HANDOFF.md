# Relay: handoff

Paste this into a new chat or add it to a project's knowledge.

## Where things stand (Nov 27, 2026)

Relay pivoted from city permitting to knowledge sharing for tech companies of 200 to 2,000 people. The current spec is [`SPEC.md`](SPEC.md), exported from the claude.ai doc "Relay v1 build brief: team pages and updates" (https://claude.ai/artifact/72jJUjVxZsWiAqXrJFbVMS). The permitting brief is kept in `docs/permitting-brief.md`.

**v1 is built**, on branch `claude/dazzling-archimedes-x7233q`, and runs with `npm install && npm run dev`. See [`README.md`](README.md) for the demo script. It includes:

- Directory, team pages, My feed, Commitments, Write update, the leadership digest, Inbox, the audit log and Connect tools.
- **Team agents.** Each team's agent answers from what the team has published, at the asker's level. It routes the rest to the person who owns that area, merges duplicate questions and batches asks per person. The person answers once, for everyone who asked, and can publish the answer so the agent answers it next time.
- **Draft sources.** A Claude Code `SessionEnd` hook and a GitHub webhook turn sessions and merged pull requests into drafts only their author sees.
- **Tests.** 33 tests cover every permission test in the brief, the agent and request routing, and the five demo steps.

## Decisions made

- **AI provider:** Claude (`claude-opus-5-5`) behind one adapter, with an offline writer when no key is set. Tests use a fake model.
- **Sign-in:** none, by design. Relay is demoed inside the fictional Northwind Labs; a persona switcher stands in for login, and the server enforces permissions as the chosen person.
- **Stack:** Next.js 16 + TypeScript, embedded Postgres (PGlite) locally, any Postgres via `DATABASE_URL`.
- **Agents in scope for v1,** but communication only: answer, route and batch, never do a team's work.

## Open questions

- Slack first or Microsoft Teams first, depending on design partners.
- Hosting region, if customers require data to stay in Canada or the US.

## Next steps

- Deploy with a hosted Postgres for design-partner demos.
- Add a Slack app (delivery and a slash command), then email.
- Add meeting transcripts from Zoom, Meet or Teams, and commitment status from Jira and Linear.
