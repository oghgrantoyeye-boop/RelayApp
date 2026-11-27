# Relay v1 build brief: team pages and updates

Nov 26, 2026 · @Ovo

> Exported from the claude.ai doc "Relay v1 build brief: team pages and updates" (rev 8): https://claude.ai/artifact/72jJUjVxZsWiAqXrJFbVMS. The earlier city permitting brief is kept in `docs/permitting-brief.md`.

Build Relay v1: a knowledge-sharing platform where every team has a page, and its updates, asks and commitments reach the right teams automatically. Work features come later.

## How to use this brief

This brief replaces the [city permitting build brief](https://claude.ai/artifact/1eGQPLRLWv6PhWm9VnAi4n) as the current spec. Export it as Markdown and save it as `SPEC.md`. Keep the old brief as `docs/permitting-brief.md` for later.

What changed and why:

- **The first market changed.** v1 targets tech companies of roughly 200 to 2,000 employees, not cities. The founder has Amazon experience and network access there, and sales cycles are shorter.
- **Knowledge sharing comes first, and work later.** v1 moves information between teams. It does not do anyone's work. Narrow agents come in later versions.
- **The core model stays.** Units, interfaces, disclosure levels, markings and the audit log carry over unchanged. Permitting becomes a later industry pack on the same core.

Instructions for Claude Code:

- Build only what the v1 sections list. The roadmap is there so the data model doesn't block it.
- Enforce permissions on the server through one function, and write the permission tests before the features.
- Seed a fictional company (Northwind Labs, about 300 people) so the product can be demoed without a customer.
- Ask before deciding anything listed under open questions.

## Product

Relay v1 is "Phonetool for teams": every team has a page saying what it owns, what it shares, how to ask it for something, and what it has committed to. Updates written on that page reach the teams that depend on it automatically, at their level of detail.

**The problem.** Much of the workday goes to status meetings, catch-ups and messages asking other teams what they decided or when they'll deliver. Directories such as Amazon's Phonetool say who someone is, but not what their team does or what it owes you.

**Thesis:** information first, meetings second.

**Core user:** the person waiting on another team.

**First customer:** tech companies of 200 to 2,000 employees. The buyer is a chief of staff, head of operations or engineering director. Success is measured by status meetings removed and asks that slipped without warning.

**Positioning:**

| Tool | What it does | How Relay differs |
| --- | --- | --- |
| Notion, Confluence | Store updates and docs | Relay delivers updates to the right teams, with boundaries |
| Glean, Copilot, Slack AI | Answer questions when asked | Relay pushes information without anyone asking |
| Jira, Linear | Track work inside one tool | Relay tracks commitments between teams, across tools |
| Meeting note-takers | Summarize for attendees | Relay routes decisions to people who weren't there |

One-line pitch: "Phonetool tells you who someone is. Relay tells you what their team does, how to work with them, and what they owe you."

## Data model and permissions

v1 uses the same core as the platform design, with teams as units. Keep these names in code so later industry packs fit without a rewrite.

| Object | What it is |
| --- | --- |
| Org | One customer company |
| Unit (team) | A team, with a parent team for the org chart |
| Member | A person in a team, with a role (lead, member, admin) |
| Team page | A team's published interface: owns, shares, how to ask, commitments |
| Ownership item | Something the team owns (a service, process or decision area) |
| Update | A team's periodic post (weekly by default) |
| Update item | One piece of an update: progress, decision, risk or ask, tagged with the teams it affects |
| Interface | A rule from one team to another: which item types, at what level, how often |
| Request | An ask from one team to another through its "how to ask us" form |
| Commitment | An accepted request or a promise found in an update, with an owner, a waiting team and a due date |
| Marking | A restriction, such as "confidential: leadership only," that overrides interfaces |
| Audit event | Who saw, shared or changed what, and when |

Disclosure levels: **Full detail**, **Summary**, **Status only**, **Headline**, **Not shared**. The default is Summary for teams that follow you, and Headline for everyone else in the org.

Starting schema (adjust names, keep the shape):

```
org(id, name)
unit(id, org_id, name, parent_unit_id, description)
member(id, unit_id, user_id, role)
ownership_item(id, unit_id, title, description)
update(id, unit_id, author_id, period_start, body_md, published_at)
update_item(id, update_id, kind, text, affected_unit_ids, marking_id)  -- kind: progress | decision | risk | ask
interface(id, from_unit_id, to_unit_id, kinds, level, cadence)  -- cadence: immediate | daily | weekly
follow(unit_id, follower_unit_id)  -- creates a default interface
request(id, from_unit_id, to_unit_id, requester_id, title, details, needed_by, status)
commitment(id, owner_unit_id, owner_member_id, waiting_unit_id, source_kind, source_id, title, due_date, status, confirmed_at)
marking(id, label, allowed_unit_ids)
audit_event(id, actor_id, action, target_kind, target_id, at)
```

Rules the code must enforce:

- One function, `visible_level(reader, item)`, decides what anyone sees. Every API route, feed, digest and AI call goes through it.
- A reader sees an item at the most detailed level any applicable interface grants, unless a marking restricts it further.
- AI-written summaries and digests inherit the strictest marking of their inputs.
- Only a team's members can write its page, updates and commitments.
- A commitment found by AI is a draft until its owner confirms it.

## Features and screens

v1 has five screens. Reuse the visual style of the [polished mocks](https://claude.ai/artifact/VwWK7tzXxBBhsJPSUMHPmo) (tokens in `design/source/gen2.py`): Geist at a 13px base, ink #18181b, muted #5f5f6b, lines #e6e6ea, accent blue #1d4ed8, in the style of Linear and Attio.

| Screen | What it shows |
| --- | --- |
| Directory | Search people and teams, plus an org chart. People link to their team. Teams show owner, what they own, and whether you follow them |
| Team page | Owns, latest update, "how to ask us" form with expected turnaround, open commitments (who's waiting, due, status), members, followers |
| My feed | Update items from teams you follow, filtered to what affects your team, at your level. Grouped as asks for you, decisions that affect you, risks, and progress |
| Commitments | What your team owes others, and what others owe you, with due dates, status and slips highlighted |
| Write update | Write or paste an update. AI splits it into items, tags affected teams and suggests commitments. The author reviews it before publishing |

Also build a **leadership digest**: a weekly one-paragraph headline per team, plus a list of slipped commitments across the org, sent by email.

## AI behavior

AI in v1 only handles communication. It never does a team's work and never makes decisions.

- **Splitting updates:** turn a written update into update items (progress, decision, risk, ask). Suggest affected teams by matching ownership items and past routing. The author accepts or edits every tag before publishing.
- **Writing for each level:** produce the Summary and Headline versions of each item. A reader only ever gets text built from what they're allowed to see. Never build from full data and then filter.
- **Finding commitments:** detect promises ("we'll ship the API by Dec 12") and create draft commitments. The owner gets a one-click confirm, edit or reject.
- **Spotting slips:** when a due date passes, or a later update signals delay, notify the waiting team with the reason, if one is known.
- **Leadership headline:** one paragraph per team per week, inheriting the strictest marking.
- In tests, use a fake model that returns fixed text, so tests never call a real model. Keep the model provider behind one adapter.

## Team agents and requests

Every team has an agent that acts as its front door. Like the rest of v1's AI, it only handles communication: it answers, routes and batches, and never does the team's work.

1. **Ask the team's agent.** Anyone can ask a team's agent a question from its team page. The agent answers only from what the team has published, at the asker's level, and cites its sources.
2. **Route what it can't answer.** If the published material doesn't answer the question, the agent files a request with the person who owns that area, using the team's ownership items. If no one owns it, the request goes to the team lead.
3. **Batch asks for each person.** Each person gets one list of what people want from them, on their own schedule (daily by default), instead of separate emails and messages. The agent merges duplicates, for example "4 people asked when the rate-limit change lands."
4. **Answer once.** The reply goes to everyone who asked. The person who answered can publish it to the team page at a level they choose, so the agent can answer it next time.

Rules:

- An ask marked as blocking, or needed before the next batch, is delivered right away. Everything else waits for the batch.
- An answer stays private to the people who asked until the person who answered publishes it.
- Each ownership item has an owner person, with the team lead as the fallback.
- The agent reads with the asker's access. Every agent read and answer writes an audit event naming both the agent and the asker.
- Success measures: the share of asks the agent answers itself, and time to answer for routed asks.

Screen: **Asks**, a person's batched requests with duplicates merged and urgent asks first.

## Integrations in v1

- **Slack:** post feed items and commitment alerts to a team's channel, and let people write an update with a slash command. Slack is the main delivery surface for tech companies.
- **Email:** digests and alerts.
- **Paste-in:** meeting notes or docs pasted into the Write update screen.
- **Coding agents:** a hook for Claude Code and similar tools sends a summary when a session ends. It becomes a draft update for its author to review.
- **GitHub:** merged pull requests become draft progress items for the author's team.

Later: Teams, Zoom and Google Meet transcripts, Jira and Linear status for commitments, and Google Docs or Notion as update sources.

## Seed data: Northwind Labs (demo)

Northwind Labs is a fictional company of about 300 people that sells a payments API. Seed about 40 people across these teams:

| Team | Parent | Owns |
| --- | --- | --- |
| Payments API | Engineering | Public API, webhooks |
| Platform | Engineering | Auth, infrastructure, rate limits |
| Mobile | Engineering | iOS and Android apps |
| Product design | Product | Design system, research |
| Growth marketing | Marketing | Launches, website, pricing page |
| Sales | Revenue | Enterprise deals |
| Customer success | Revenue | Onboarding, renewals |
| Finance | Operations | Budgets, billing operations |
| Leadership | (none) | Company priorities |

The demo story:

- Payments API's weekly update says it will ship webhook retries by Dec 12 and is blocked on Platform's rate-limit change.
- Platform committed to the rate-limit change by Dec 5 in an accepted request. It's now Dec 6 and the work isn't done, so it shows as slipped.
- Growth marketing has a launch planned for Dec 15 that depends on webhook retries.
- Sales has an open request to Payments API about an enterprise customer's custom limits. It's marked "confidential: leadership and Sales only," because it names the customer.

Seed about eight weeks of updates so the feed, commitments and digest look real.

## Permission tests (write these first)

- [ ] Growth marketing follows Payments API and sees its decisions at Summary, not full detail.
- [ ] A team that doesn't follow Payments API sees only its Headline.
- [ ] Only Leadership and Sales can see the enterprise customer's name. Payments API sees the request with the customer name redacted.
- [ ] A leadership digest built from the confidential request is itself marked confidential.
- [ ] Only Platform members can edit Platform's page, updates and commitments.
- [ ] An AI-found commitment stays a draft, and appears to no one but its owner, until the owner confirms it.
- [ ] Every feed read and digest send writes an audit event.

## Definition of done: the demo

1. Search "rate limits" in the directory and land on Platform's team page, which shows what it owns and its open commitments.
2. Open My feed as a Growth marketing member. It shows the webhook-retries decision and flags that the Dec 15 launch is at risk.
3. Open Commitments as Payments API. Platform's Dec 5 commitment is highlighted as slipped, with the latest reason.
4. Paste meeting notes into Write update as Platform: "we'll land the rate-limit change by Dec 9." Relay suggests the items and a revised commitment. The lead confirms, and Payments API and Growth marketing are notified.
5. Open the leadership digest. It gives one paragraph per team and lists slipped commitments. The confidential request appears only for Leadership.

## Roadmap after v1

1. **Meeting sources:** pull decisions and commitments from Teams, Zoom and Google Meet transcripts or AI summaries, and route them like update items.
2. **Commitment status from work tools:** read Jira and Linear to update commitment status automatically.
3. **Narrow agents:** one defined job each, writing drafts a person approves. The first candidate is an agent that drafts a team's weekly update from its Jira, Linear and Slack activity.
4. **Industry packs:** city permitting first, using the earlier brief, then others where customers pull Relay in.

## Out of scope for v1

General AI agents or "AI employees," doing any team's work, entities beyond teams and commitments (like permits or athletes), outside parties such as clients or applicants, connectors beyond Slack and email, mobile apps, on-premises deployment and a public API.

## Open questions for the founder

- [ ] Sign-in: Google and Microsoft single sign-on from day one, or email login for the demo?
- [ ] Which AI model provider for v1?
- [ ] Should team pages be visible org-wide by default, or only to followers?
- [ ] Slack first, or Microsoft Teams first? This depends on the first design partners.
- [ ] Hosting region, if early customers require data to stay in Canada or the US.
