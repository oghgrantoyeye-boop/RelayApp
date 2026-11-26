# Relay v0: handoff

## What we're building
v0 of Relay is a staff-facing permit-review web app for the fictional City of Harborview. It must be demoable end to end in five minutes. It's for founders and early customers, so build fast and keep it light.

- Brief (source of truth, now rev 12): "Relay build brief for Claude Code", https://claude.ai/artifact/1eGQPLRLWv6PhWm9VnAi4n. Rev 12 added an **Implementation details** section with the exact seed data, the permission tests, AI rules, agent behavior, the suggested interface and the 5-step demo. It also added an artifacts table and "How the idea developed".
- Visual reference: the "Polished screens" page of the design canvas, https://claude.ai/artifact/VwWK7tzXxBBhsJPSUMHPmo (Queue, Application, Unit; Athlete is not needed). Tokens: Geist at a 13px base, ink #18181b, muted #5f5f6b, lines #e6e6ea, accent #1d4ed8. Pills: green #f0fdf4/#bbf7d0/#166534, amber #fffbeb/#fde68a/#92400e, red #fef2f2/#fecaca/#991b1b, blue #eff6ff/#bfdbfe/#1e40af, violet #f5f3ff/#ddd6fe/#5b21b6. Unit colors: Permit center #6d28d9, Fire #c2410c, Building #1d4ed8, Zoning #a16207, Utilities #0e7490, Applicant #0f766e, agent #64748b.
- Zip `YC_Valuation_and_Agents.zip` goes into the repo as `design/mocks/` (4 mocks + canvas.json), `design/source/` (gen2.py, screens2*.py, which hold the tokens and seed copy) and `docs/research/` (sports research, background only). Also save the brief as `SPEC.md`.

## Decisions made
- **LLM:** Claude (`claude-opus-5-5`, low effort for short summaries) behind one adapter. With no API key it falls back to built-in template text, so the demo never breaks. Tests use a deterministic fake LLM.
- **Auth:** a persona switcher with no login. The server enforces every permission as the selected member. The Application screen's role switch (manager / fire examiner / applicant) changes who the reader is.
- **City and permit system:** none yet. Everything is seeded for Harborview.

## Proposed, not yet confirmed
- Stack: Next.js 16 (App Router) + TypeScript; PGlite (embedded Postgres) locally so `npm i && npm run dev` just works; any Postgres via `DATABASE_URL` when hosted; plain SQL migrations; vitest; plain CSS tokens (no Tailwind).
- Keeping to the six primitives:
  - The unit feed is the audit log's `share` events addressed to that unit.
  - Agent memory and task runs are entity types owned by Fire prevention, so the permission model covers them.
  - `interface.status` (active / requested / suggested / declined) handles incoming requests and suggestions.
  - Small additions to the schema shape: `audit_event.detail jsonb` + `to_unit_id`, and `member.config jsonb` for the agent's budget and approval rules.
- Permission function `visible_level(reader, entity, field)`:
  1. The owning unit gets Full detail.
  2. The public unit sees only its own applications.
  3. Anyone else gets the highest level of any active interface.
  4. Markings then cap the result (an allowed-units list, with a maximum level for everyone else).
  5. With `on_behalf_of`, the result is the lower of the agent's level and the person's.
  6. Derived outputs carry every marking of their inputs.
- Each field type (review status, corrections list, determination, text, money, person) renders itself at Full detail, Summary, Status only or Headline. Only these rendered values leave the server.

## Status
- Stack confirmed by Ovo on Nov 26: Next.js 16 + TypeScript, PGlite locally (Postgres via `DATABASE_URL`), plain SQL migrations, vitest, plain CSS tokens.
- **Step 1 done:** schema (`db/migrations/001_init.sql`), Harborview seed, `visibleLevel`, field rendering, audited `readEntity`/`writeField`, summaries that carry markings, and the LLM adapter (template + fake; the Claude adapter comes with step 4). The brief's 9 permission tests pass, plus seed-metric and summary checks.
- Design bundle is in `design/` and `docs/research/`; the brief is `SPEC.md`.
- Interpretation: Building plan review has **no** sprinkler interface until Fire approves the seeded suggestion (Building is "waiting on Fire's sprinkler determination", and the suggestion only makes sense if the interface doesn't exist yet). Permission test 2 therefore approves the suggestion first. The seeded Building interface shares Fire's corrections at Full detail.
- The home page is a placeholder that reads the database directly; it goes away with the Queue screen.

## Next steps (brief's build order)
1. ~~Schema, Harborview seed (186 open applications; BP-2027-0418 is the demo story) and the permission function, with the brief's 9 permission tests written first.~~
2. Queue and Application screens with the role switch, reading through the permission function.
3. Interfaces: create and edit them on the Unit screen. Triggers write to the receiving unit's feed. Seed the sprinkler suggestion (Approve / Approve as summary / Decline).
4. Role-based AI summaries and the morning digest. Inputs are only what the reader can see. Cache per reader, entity and revision. Summaries inherit markings.
5. Plan pre-check agent. It runs on a submission or resubmission and applies seeded rules (exit count, sprinklers, hydrant distance). Findings stay as drafts until an examiner approves them. Runs are shared. Budget is $84 of $150 and the agent stops when it runs out.
6. Audit log view. The demo must show the agent acting for the examiner.
