# Relay v0: handoff

## What we're building
Relay is about the future of team collaboration: each team publishes what it shares, with whom, at what level of detail and on what trigger, and Relay pushes that slice to the people who need it, so handoff meetings become optional. v0 must be demoable end to end in five minutes, for founders and early customers, so build fast and keep it light.

**Direction change (Nov 26, Ovo):** the product is the cross-team mechanics, not permitting. The demo setting moved from the City of Harborview to **Larkspur Outdoor Co.**, a fictional outdoor-gear company. Six teams (Product, Engineering, Compliance, Supply chain, Marketing, Sales) work on cross-team initiatives, and retail partners are the outside party (the public unit). The setting is deliberately not a software company, because the brief judged Atlassian and Linear too strong there.

- Original brief (rev 12): "Relay build brief for Claude Code", https://claude.ai/artifact/1eGQPLRLWv6PhWm9VnAi4n, saved as `SPEC.md`. Its primitives, permission rules, agent model and tests still hold. Its permit-specific seed, screens and demo script are superseded by the mapping below.
- Visual reference: the "Polished screens" page of the design canvas, https://claude.ai/artifact/VwWK7tzXxBBhsJPSUMHPmo, in `design/`. Tokens: Geist at a 13px base, ink #18181b, muted #5f5f6b, lines #e6e6ea, accent #1d4ed8, plus the tone pills in `app/globals.css`.

## How the brief maps onto the company demo
| Brief (permits) | Larkspur |
| --- | --- |
| Permit application BP-2027-0418 | Initiative LK-014, Trailhead e-bike spring launch (ships Mar 3) |
| Permit center (Dana Brooks) | Product (Maya Chen, VP Product) |
| Fire prevention, the bottleneck | Compliance (Omar Haddad, head; Nina Patel and Chris Wu, analysts) |
| Fire corrections (fire code 1006.3.4, amendment 907.6) | Compliance findings (UN 38.3 battery label mark; UL 2849 charging warnings) |
| Sprinkler determination, Building waiting on it | Battery certification decision (UL 2849 via Intertek); Supply chain waiting on it to book freight |
| Plan pre-check agent ($84 of $150) | Compliance pre-check agent ($84 of $150) |
| Applicant, Northline Homes | Retail partner, Summit Cycles (partners see only their own launches) |
| "Contains applicant financial data" marking | "Unannounced pricing" marking (Product and Sales only) |
| 186 open, median 38 days, 1.9 cycles, 14 blocked (6 on Fire) | 64 open, median 41 days (target 30), 1.9 handoff rounds (was 2.8), 9 blocked (4 on Compliance) |

## Decisions made
- **Stack** (confirmed by Ovo, Nov 26): Next.js 16 + TypeScript; PGlite locally so `npm i && npm run dev` just works; any Postgres via `DATABASE_URL`; plain SQL migrations; vitest; plain CSS tokens.
- **LLM:** Claude (`claude-opus-5-5`, low effort for short summaries) behind one adapter. With no API key it falls back to template text so the demo never breaks. Tests use a deterministic fake.
- **Auth:** a persona switcher with no login. The server enforces every permission as the selected member.
- **Six primitives only.** The unit feed is the audit log's `share` events addressed to a unit. Agent memory and task runs will be entity types owned by the agent's unit. `interface.status` (active / requested / suggested / declined) covers requests and suggestions. Schema additions: `audit_event.detail` + `to_unit_id`, `member.config`, `entity.revision`.
- **Permission function** `visibleLevel(reader, entity, field)`: owner gets Full; the public unit sees only entities that belong to it; otherwise the highest active interface; markings cap that for units outside their allowed list; with `onBehalfOf`, the lower of agent and person; derived outputs carry every input marking.
- **Generic field types:** status, checklist, decision, text, money, person, date, each rendered at Full detail, Summary, Status only or Headline. Only rendered values leave the server.
- **Demo packs:** a setting is one file in `src/lib/seed/` (units, members, fields, interfaces, markings, demo data). `larkspur.ts` is active.
- **Interpretation:** Supply chain has no certification interface until Compliance approves the seeded suggestion, because the suggestion only makes sense if the interface doesn't exist yet. Permission test 2 approves it first.

## Status
- **Step 1 done:** schema, the Larkspur pack, `visibleLevel`, rendering, audited `readEntity`/`writeField`, summaries that carry markings, and the LLM adapter (template + fake; the Claude adapter comes with summaries). The 9 permission tests pass, restated for Larkspur, plus seed-metric and summary checks.
- The home page is a placeholder that reads the database directly. It goes away with the first real screen.

## Next steps (proposed, reordered so the collaboration mechanics come first)
1. ~~Schema, seed and permission function, with the 9 permission tests.~~
2. Team screen: a unit's published interfaces with previews, incoming requests, the suggested interface (Approve / Approve as summary / Decline), members including the agent. Interface triggers write to the receiving team's feed.
3. "Waiting on" home: for whoever is selected, what they're waiting on, who holds it and when it will land, plus their team's feed. This replaces the permit queue.
4. Initiative view with the role switch (Product lead / Compliance analyst / retail partner), reading through the permission function.
5. Role-based AI summaries and the morning digest. Inputs are only what the reader can see; cache per reader, entity and revision; markings carry over.
6. Compliance pre-check agent: runs when Engineering submits or resubmits files, applies seeded rules (label marks, manual warnings, ingress rating), posts draft findings for an analyst to approve, shared task runs, stops when the budget runs out.
7. Audit log view, showing the agent acting for the analyst.
