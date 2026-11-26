# Relay

Relay routes information between teams so they don't need handoff meetings. Each team publishes what it
shares, with whom, at what level of detail and when, and Relay pushes that slice to the right people.
The v0 demo is Larkspur Outdoor Co., a fictional gear company whose six teams and retail partners
work on cross-team initiatives. `SPEC.md` is the original brief (written for a city-permitting demo);
`HANDOFF.md` has the decisions since, including the switch to the company demo.

## Run it

```sh
npm i
npm run dev        # http://localhost:3000, embedded Postgres (PGlite) in .data/, seeded on first run
npm test           # the brief's 9 permission tests, plus seed and summary checks
npm run db:reset   # wipe .data/ and reseed the demo pack
```

Set `DATABASE_URL` to use any Postgres instead of PGlite.

## Try the demo

There's no login. Pick who you are from **Viewing Relay as** at the bottom of the sidebar; the server
enforces every permission as that person.

1. As **Maya Chen (Product)**, open **Waiting on**: the morning summary names Compliance as the
   bottleneck, and every blocked handoff shows who holds it and when it should land.
2. Open **Trailhead e-bike spring launch** and use the role switch (Product lead, Compliance analyst,
   Retail partner). The same initiative renders differently; locked fields stay locked.
3. As **Omar Haddad (Compliance)**, open **Your team** and approve the suggested interface. Switch to
   **Lena Ortiz (Supply chain)**: the certification decision is now in Supply chain's feed.

## Where things are

| Path | What |
| --- | --- |
| `db/migrations/` | Plain SQL migrations. The six primitives: unit, member, entity + field, interface, marking, audit log |
| `src/lib/permissions.ts` | `visibleLevel(reader, entity, field)`, the single permission check |
| `src/lib/render.ts` | How each field type renders at Full detail, Summary, Status only and Headline |
| `src/lib/entities.ts` | `readEntity` and `writeField`: every read and write goes through the permission check and the audit log |
| `src/lib/derive.ts` | AI summaries built only from what the reader can see; they carry their inputs' markings |
| `src/lib/llm/` | The one LLM adapter, with template and fake implementations |
| `src/lib/seed/` | Demo packs. `larkspur.ts` is active: 64 open initiatives, LK-014 (Trailhead e-bike launch) is the demo story |
| `tests/` | vitest |
| `design/` | Polished mocks and the Python that generated them (tokens and components; the copy is from the permit demo) |
| `docs/research/` | Background research, not needed for v0 |
