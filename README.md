# Relay

Relay routes information between teams so they don't need handoff meetings. v0 is a staff-facing
permit-review app for the fictional City of Harborview. `SPEC.md` is the brief; `HANDOFF.md` has the
decisions so far.

## Run it

```sh
npm i
npm run dev        # http://localhost:3000, embedded Postgres (PGlite) in .data/, seeded on first run
npm test           # the brief's 9 permission tests, plus seed and summary checks
npm run db:reset   # wipe .data/ and reseed Harborview
```

Set `DATABASE_URL` to use any Postgres instead of PGlite.

## Where things are

| Path | What |
| --- | --- |
| `db/migrations/` | Plain SQL migrations. The six primitives: unit, member, entity + field, interface, marking, audit log |
| `src/lib/permissions.ts` | `visibleLevel(reader, entity, field)`, the single permission check |
| `src/lib/render.ts` | How each field type renders at Full detail, Summary, Status only and Headline |
| `src/lib/entities.ts` | `readEntity` and `writeField`: every read and write goes through the permission check and the audit log |
| `src/lib/derive.ts` | AI summaries built only from what the reader can see; they carry their inputs' markings |
| `src/lib/llm/` | The one LLM adapter, with template and fake implementations |
| `src/lib/seed/harborview.ts` | Deterministic demo seed: 186 open applications, BP-2027-0418 is the demo story |
| `tests/` | vitest |
| `design/` | Polished mocks and the Python that generated them (tokens, seed copy) |
| `docs/research/` | Background research, not needed for v0 |
