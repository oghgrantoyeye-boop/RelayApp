// Schema migrations, applied in order on startup. Append new entries; never edit old ones.
// Names follow the v1 brief (SPEC.md): org, unit, member, ownership_item, update (team_update),
// update_item, interface, follow, request, commitment, marking, audit_event.

export const migrations: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
create table org (
  id text primary key,
  name text not null,
  settings jsonb not null default '{}'
);

create table unit (
  id text primary key,
  org_id text not null references org(id),
  slug text not null,
  name text not null,
  parent_unit_id text references unit(id),
  description text not null default '',
  color text not null default '#71717a',
  how_to_ask jsonb not null default '{}',
  unique (org_id, slug)
);

-- People and agents. Agents are members of a team, like people.
create table app_user (
  id text primary key,
  org_id text not null references org(id),
  kind text not null default 'human' check (kind in ('human', 'agent')),
  name text not null,
  title text not null default '',
  email text,
  github_login text,
  api_token text unique,
  ask_cadence text not null default 'daily' check (ask_cadence in ('immediate', 'daily', 'weekly')),
  last_batch_at timestamptz
);

create table member (
  id text primary key,
  unit_id text not null references unit(id),
  user_id text not null references app_user(id),
  role text not null default 'member' check (role in ('lead', 'member', 'admin', 'agent')),
  unique (unit_id, user_id)
);

create table ownership_item (
  id text primary key,
  unit_id text not null references unit(id),
  title text not null,
  description text not null default '',
  owner_member_id text references member(id),
  keywords text[] not null default '{}'
);

create table marking (
  id text primary key,
  org_id text not null references org(id),
  label text not null,
  allowed_unit_ids text[] not null,
  -- Level for readers outside the allowed teams. Derived outputs are hidden from them entirely.
  others_level text not null default 'none'
);

create table team_update (
  id text primary key,
  unit_id text not null references unit(id),
  author_id text not null references app_user(id),
  period_start date,
  body_md text not null default '',
  source text not null default 'manual' check (source in ('manual', 'meeting', 'coding_agent', 'github')),
  status text not null default 'draft' check (status in ('draft', 'published', 'discarded')),
  created_at timestamptz not null,
  published_at timestamptz
);

create table update_item (
  id text primary key,
  update_id text references team_update(id) on delete cascade,
  unit_id text not null references unit(id),
  author_id text not null references app_user(id),
  kind text not null check (kind in ('progress', 'decision', 'risk', 'ask', 'answer')),
  text text not null,
  summary_text text not null,
  headline_text text not null,
  affected_unit_ids text[] not null default '{}',
  marking_id text references marking(id),
  -- Optional cap on what other teams see, chosen by the person who published it (answers).
  max_level text check (max_level in ('full', 'summary', 'status', 'headline')),
  status text not null default 'published' check (status in ('draft', 'published', 'discarded')),
  source_kind text not null default 'manual',
  source_ref text,
  created_at timestamptz not null,
  published_at timestamptz
);

create table interface (
  id text primary key,
  from_unit_id text not null references unit(id),
  to_unit_id text not null references unit(id),
  kinds text[] not null,
  level text not null check (level in ('full', 'summary', 'status', 'headline', 'none')),
  cadence text not null default 'weekly' check (cadence in ('immediate', 'daily', 'weekly')),
  unique (from_unit_id, to_unit_id)
);

create table follow (
  unit_id text not null references unit(id),
  follower_unit_id text not null references unit(id),
  primary key (unit_id, follower_unit_id)
);

create table request (
  id text primary key,
  org_id text not null references org(id),
  from_unit_id text not null references unit(id),
  to_unit_id text not null references unit(id),
  requester_id text not null references app_user(id),
  title text not null,
  details text not null default '',
  -- Versions safe to show when a marking limits a reader to Summary or Headline.
  summary_title text,
  summary_details text,
  headline_text text,
  needed_by date,
  urgency text not null default 'normal' check (urgency in ('normal', 'blocking')),
  status text not null default 'open' check (status in ('open', 'answered', 'accepted', 'declined')),
  ownership_item_id text references ownership_item(id),
  assignee_member_id text references member(id),
  marking_id text references marking(id),
  cluster_key text,
  via text not null default 'form' check (via in ('form', 'agent')),
  delivery text not null default 'batch' check (delivery in ('batch', 'immediate')),
  delivered_at timestamptz,
  answer_text text,
  answered_by text references app_user(id),
  answered_at timestamptz,
  created_at timestamptz not null
);

-- Questions asked of a team's agent, answered by the agent or routed as a request.
create table question (
  id text primary key,
  org_id text not null references org(id),
  asker_id text not null references app_user(id),
  unit_id text not null references unit(id),
  text text not null,
  outcome text not null check (outcome in ('answered', 'routed')),
  answer_text text not null,
  source_refs jsonb not null default '[]',
  marking_ids text[] not null default '{}',
  request_id text references request(id),
  created_at timestamptz not null
);

create table commitment (
  id text primary key,
  owner_unit_id text not null references unit(id),
  owner_member_id text references member(id),
  waiting_unit_id text references unit(id),
  source_kind text not null default 'manual' check (source_kind in ('request', 'update_item', 'manual')),
  source_id text,
  title text not null,
  due_date date not null,
  original_due_date date,
  status text not null default 'draft' check (status in ('draft', 'open', 'done', 'rejected')),
  confirmed_at timestamptz,
  done_at timestamptz,
  slip_reason text,
  blocked_by_id text references commitment(id),
  -- A draft that proposes a new due date for an existing commitment.
  revises_id text references commitment(id),
  update_id text references team_update(id) on delete cascade,
  marking_id text references marking(id),
  created_at timestamptz not null
);

-- What Relay sent to whom: batched asks, alerts, digests. Also posted to Slack when configured.
create table delivery (
  id text primary key,
  recipient_id text not null references app_user(id),
  kind text not null,
  subject text not null,
  body text not null,
  refs jsonb not null default '[]',
  created_at timestamptz not null,
  read_at timestamptz
);

create table audit_event (
  id bigserial primary key,
  org_id text not null,
  actor_id text,
  on_behalf_of_id text,
  action text not null,
  target_kind text not null,
  target_id text,
  detail jsonb not null default '{}',
  at timestamptz not null
);

create index update_item_unit_idx on update_item (unit_id, status, created_at desc);
create index request_assignee_idx on request (assignee_member_id, status);
create index commitment_owner_idx on commitment (owner_unit_id, status);
create index commitment_waiting_idx on commitment (waiting_unit_id, status);
create index audit_at_idx on audit_event (at desc);
create index delivery_recipient_idx on delivery (recipient_id, created_at desc);
`,
  },
  {
    id: "002_integrations_meetings_work",
    sql: `
alter table app_user add column monthly_budget_usd numeric;
alter table app_user add column spent_usd numeric not null default 0;

-- A team's connected tools (Slack, Jira, Drive, ...). Their content belongs to that team.
create table connector (
  id text primary key,
  unit_id text not null references unit(id),
  kind text not null,
  name text not null,
  status text not null default 'connected',
  connected_by text references app_user(id),
  last_sync_at timestamptz,
  created_at timestamptz not null
);

-- What a connector synced: messages, tickets, docs, pull requests.
create table source_doc (
  id text primary key,
  connector_id text not null references connector(id) on delete cascade,
  unit_id text not null references unit(id),
  kind text not null check (kind in ('message', 'ticket', 'doc', 'pr')),
  external_ref text,
  title text not null,
  body text not null default '',
  status text,
  author_name text,
  marking_id text references marking(id),
  occurred_at timestamptz not null
);

-- Meetings the team's agent attended (from Zoom, Meet or Teams), with their transcript.
create table meeting (
  id text primary key,
  unit_id text not null references unit(id),
  connector_id text references connector(id),
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null default 30,
  attendee_ids text[] not null default '{}',
  transcript text not null,
  summary jsonb,
  update_id text references team_update(id),
  status text not null default 'recorded' check (status in ('recorded', 'summarized', 'routed')),
  marking_id text references marking(id),
  created_at timestamptz not null
);

-- Work a team's agent does for a member: research, drafting. Visible to the whole team.
create table task_run (
  id text primary key,
  unit_id text not null references unit(id),
  agent_id text not null references app_user(id),
  requested_by text not null references app_user(id),
  kind text not null check (kind in ('research', 'draft_update')),
  title text not null,
  instructions text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'stopped', 'needs_key')),
  steps jsonb not null default '[]',
  result_md text,
  sources jsonb not null default '[]',
  output_ref text,
  taken_over_by text references app_user(id),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  searches int not null default 0,
  cost_usd numeric not null default 0,
  error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index source_doc_unit_idx on source_doc (unit_id, occurred_at desc);
create index meeting_unit_idx on meeting (unit_id, starts_at desc);
create index task_unit_idx on task_run (unit_id, created_at desc);
`,
  },
  {
    id: "003_early_access",
    sql: `
-- Early-access requests from the marketing site.
create table lead (
  id text primary key,
  email text not null,
  name text,
  company text,
  role text,
  team_size text,
  note text,
  source text,
  forwarded boolean not null default false,
  created_at timestamptz not null default now()
);
`,
  },
];
