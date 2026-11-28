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
  {
    id: "004_agent_drafts",
    sql: `
alter table team_update drop constraint team_update_source_check;
alter table team_update add constraint team_update_source_check check (source in ('manual', 'meeting', 'coding_agent', 'github', 'agent'));
`,
  },
  {
    id: "005_agents_everywhere",
    sql: `
-- The agent panel on every page: each person's conversation with their own agent and team agents.
create table chat_message (
  id text primary key,
  org_id text not null references org(id),
  user_id text not null references app_user(id),
  role text not null check (role in ('user', 'agent')),
  target text not null,
  agent_label text,
  text text not null,
  refs jsonb not null default '[]',
  actions jsonb not null default '[]',
  created_at timestamptz not null
);
create index chat_user_idx on chat_message (user_id, created_at);

-- Worker agents do more than research and drafting: they review documents and change code.
alter table task_run drop constraint task_run_kind_check;
alter table task_run add constraint task_run_kind_check check (kind in ('research', 'draft_update', 'review_doc', 'code'));
alter table task_run drop constraint task_run_status_check;
alter table task_run add constraint task_run_status_check check (status in ('queued', 'running', 'done', 'failed', 'stopped', 'needs_key', 'needs_sandbox'));

-- Agents a team creates: what each may read, what it may do, and what needs a person's approval.
create table agent_profile (
  agent_id text primary key references app_user(id),
  unit_id text not null references unit(id),
  purpose text not null,
  connector_ids text[] not null default '{}',
  actions text[] not null default '{}',
  approval text not null default 'outside_team' check (approval in ('always', 'outside_team')),
  kind text not null default 'custom',
  schedule text not null default 'on_request' check (schedule in ('on_request', 'daily', 'weekly')),
  created_by text references app_user(id),
  created_at timestamptz not null
);
`,
  },
  {
    id: "006_T-30_org_id",
    sql: `
-- Workspace id on every row. Backfill from the owning unit (or recipient), then keep it filled
-- on insert so existing writers that omit org_id still work until they pass it explicitly.

alter table member add column org_id text references org(id);
alter table ownership_item add column org_id text references org(id);
alter table team_update add column org_id text references org(id);
alter table update_item add column org_id text references org(id);
alter table interface add column org_id text references org(id);
alter table follow add column org_id text references org(id);
alter table commitment add column org_id text references org(id);
alter table connector add column org_id text references org(id);
alter table source_doc add column org_id text references org(id);
alter table meeting add column org_id text references org(id);
alter table task_run add column org_id text references org(id);
alter table delivery add column org_id text references org(id);
alter table agent_profile add column org_id text references org(id);

update member m set org_id = u.org_id from unit u where u.id = m.unit_id;
update ownership_item o set org_id = u.org_id from unit u where u.id = o.unit_id;
update team_update t set org_id = u.org_id from unit u where u.id = t.unit_id;
update update_item i set org_id = u.org_id from unit u where u.id = i.unit_id;
update interface i set org_id = u.org_id from unit u where u.id = i.from_unit_id;
update follow f set org_id = u.org_id from unit u where u.id = f.unit_id;
update commitment c set org_id = u.org_id from unit u where u.id = c.owner_unit_id;
update connector c set org_id = u.org_id from unit u where u.id = c.unit_id;
update source_doc d set org_id = u.org_id from unit u where u.id = d.unit_id;
update meeting m set org_id = u.org_id from unit u where u.id = m.unit_id;
update task_run t set org_id = u.org_id from unit u where u.id = t.unit_id;
update delivery d set org_id = a.org_id from app_user a where a.id = d.recipient_id;
update agent_profile p set org_id = u.org_id from unit u where u.id = p.unit_id;

alter table member alter column org_id set not null;
alter table ownership_item alter column org_id set not null;
alter table team_update alter column org_id set not null;
alter table update_item alter column org_id set not null;
alter table interface alter column org_id set not null;
alter table follow alter column org_id set not null;
alter table commitment alter column org_id set not null;
alter table connector alter column org_id set not null;
alter table source_doc alter column org_id set not null;
alter table meeting alter column org_id set not null;
alter table task_run alter column org_id set not null;
alter table delivery alter column org_id set not null;
alter table agent_profile alter column org_id set not null;

create or replace function relay_fill_org_from_unit() returns trigger as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from unit where id = new.unit_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function relay_fill_org_from_owner_unit() returns trigger as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from unit where id = new.owner_unit_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function relay_fill_org_from_from_unit() returns trigger as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from unit where id = new.from_unit_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function relay_fill_org_from_recipient() returns trigger as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from app_user where id = new.recipient_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger member_org before insert on member for each row execute procedure relay_fill_org_from_unit();
create trigger ownership_org before insert on ownership_item for each row execute procedure relay_fill_org_from_unit();
create trigger team_update_org before insert on team_update for each row execute procedure relay_fill_org_from_unit();
create trigger update_item_org before insert on update_item for each row execute procedure relay_fill_org_from_unit();
create trigger follow_org before insert on follow for each row execute procedure relay_fill_org_from_unit();
create trigger connector_org before insert on connector for each row execute procedure relay_fill_org_from_unit();
create trigger source_doc_org before insert on source_doc for each row execute procedure relay_fill_org_from_unit();
create trigger meeting_org before insert on meeting for each row execute procedure relay_fill_org_from_unit();
create trigger task_run_org before insert on task_run for each row execute procedure relay_fill_org_from_unit();
create trigger agent_profile_org before insert on agent_profile for each row execute procedure relay_fill_org_from_unit();
create trigger commitment_org before insert on commitment for each row execute procedure relay_fill_org_from_owner_unit();
create trigger interface_org before insert on interface for each row execute procedure relay_fill_org_from_from_unit();
create trigger delivery_org before insert on delivery for each row execute procedure relay_fill_org_from_recipient();

create index member_org_idx on member (org_id);
create index update_item_org_idx on update_item (org_id, status, created_at desc);
create index commitment_org_idx on commitment (org_id, status);
create index audit_org_idx on audit_event (org_id, at desc);
create index delivery_org_idx on delivery (org_id, created_at desc);
`,
  },
  {
    id: "007_T-10_team_context",
    sql: `
-- What Beacon knows about each team, learned from its conversations and activity (spec:
-- docs/product/team-context-answers-routing.md; roadmap Phase 1). Teams correct it; they don't write it.
create table context_entry (
  id text primary key,
  org_id text not null references org(id),
  unit_id text not null references unit(id),
  kind text not null check (kind in ('about', 'responsibility', 'capability', 'how_to_work', 'knows', 'system')),
  title text not null,
  body text not null default '',
  owner_member_id text references member(id),
  -- learned: from signals only; team_confirmed: a member said it's right; team_edited: a member wrote or fixed it.
  provenance text not null check (provenance in ('learned', 'team_confirmed', 'team_edited')),
  confidence numeric not null default 0.5,
  -- The signals it came from, as [{ kind, ref, label, at }].
  source_refs jsonb not null default '[]',
  -- What other teams see. Members of the team always see it in full; markings cap it further.
  shared_level text not null default 'summary' check (shared_level in ('full', 'summary', 'status', 'headline', 'none')),
  -- Every marking of every signal it came from.
  marking_ids text[] not null default '{}',
  -- pending: waits for one member to confirm (ownership, capabilities, marked sources). retired: removed.
  status text not null default 'active' check (status in ('active', 'pending', 'retired')),
  confirmed_by text references app_user(id),
  confirmed_at timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null
);
-- One observation from one source, before (or after) it is merged into an entry.
create table context_signal (
  id text primary key,
  org_id text not null references org(id),
  unit_id text not null references unit(id),
  -- agent_chat, answer, update, pr, coding_session, slack, meeting, source_doc
  source_kind text not null,
  source_ref text not null,
  source_label text not null default '',
  -- { kind, title, body, owner_hint }
  claim jsonb not null,
  marking_ids text[] not null default '{}',
  entry_id text references context_entry(id),
  at timestamptz not null
);
alter table ownership_item add column provenance text not null default 'team_edited';
alter table ownership_item add column last_seen_at timestamptz;
create trigger context_entry_org before insert on context_entry for each row execute procedure relay_fill_org_from_unit();
create trigger context_signal_org before insert on context_signal for each row execute procedure relay_fill_org_from_unit();
create index context_entry_unit_idx on context_entry (org_id, unit_id, status);
create index context_signal_unit_idx on context_signal (org_id, unit_id, at desc);
create index context_signal_entry_idx on context_signal (entry_id);
`,
  },
  {
    id: "008_T-31_auth",
    sql: `
-- Signed-in identity (Google, Microsoft or email). Separate from app_user so one person can
-- belong to several workspaces, each with its own app_user row.
create table account (
  id text primary key,
  email text not null unique,
  name text not null default '',
  google_sub text unique,
  microsoft_sub text unique,
  created_at timestamptz not null default now()
);

create table session (
  id text primary key,
  account_id text not null references account(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index session_account_idx on session (account_id);
create index session_expires_idx on session (expires_at);

-- Which app_user this account acts as inside a workspace.
create table org_membership (
  account_id text not null references account(id) on delete cascade,
  org_id text not null references org(id) on delete cascade,
  user_id text not null references app_user(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  primary key (account_id, org_id)
);

create table magic_link (
  id text primary key,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
`,
  },
  {
    id: "009_T-36_early_access_gate",
    sql: `
-- Gate new accounts behind an approved lead (or BEACON_ADMIN_EMAILS). Platform-level audits
-- (approving / declining leads) may have no workspace, so org_id may be null.
alter table lead add column status text not null default 'pending';
alter table lead add constraint lead_status_check check (status in ('pending', 'approved', 'declined'));
alter table lead add column approved_at timestamptz;
alter table lead add column approved_by text references account(id);
alter table audit_event alter column org_id drop not null;
`,
  },
  {
    id: "010_T-33_workspace_setup",
    sql: `
-- Create a workspace, invite people by email, create teams and pick leads (T-33).
-- Pending invites also let someone create an account (T-36 early-access gate).
create table workspace_invite (
  id text primary key,
  org_id text not null references org(id) on delete cascade,
  email text not null,
  invited_by text not null references account(id),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  unit_id text references unit(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index workspace_invite_email_idx on workspace_invite (lower(email), status);
create index workspace_invite_org_idx on workspace_invite (org_id, status);
`,
  },
  {
    id: "011_T-44_github_app",
    sql: `
-- GitHub App install per workspace (T-44). Replaces the single-repo webhook with an org install,
-- repo→team maps, and live connectors. Tokens are stored encrypted (ENCRYPTION_KEY).
alter table connector add column mode text not null default 'demo' check (mode in ('demo', 'live'));

create table github_installation (
  id text primary key,
  org_id text not null references org(id) on delete cascade,
  installation_id text not null unique,
  account_login text not null,
  encrypted_token text,
  installed_by text references account(id),
  created_at timestamptz not null default now()
);
create index github_installation_org_idx on github_installation (org_id);

create table github_repo_map (
  id text primary key,
  org_id text not null references org(id) on delete cascade,
  installation_id text not null references github_installation(installation_id) on delete cascade,
  repo_full_name text not null,
  unit_id text not null references unit(id) on delete cascade,
  unique (org_id, installation_id, repo_full_name)
);
create index github_repo_map_repo_idx on github_repo_map (installation_id, lower(repo_full_name));

-- Repos this installation is allowed to map (from App API or installation webhooks).
create table github_installation_repo (
  installation_id text not null references github_installation(installation_id) on delete cascade,
  repo_full_name text not null,
  primary key (installation_id, repo_full_name)
);
`,
  },
  {
    id: "012_T-45_api_token_hash",
    sql: `
-- Store coding-agent tokens as hash + display prefix (T-45). Plaintext is shown once via cookie.
alter table app_user add column api_token_hash text unique;
alter table app_user add column api_token_prefix text;
`,
  },
  {
    id: "010_T-19_answer_claims",
    sql: `
-- Claim-by-claim answers (T-19). Each claim cites its sources; a claim with none is Beacon's
-- inference. gaps lists what the agent couldn't find. Chat messages keep the same shape so the
-- agent panel can render the answer the same way as the team page.
alter table question add column claims jsonb not null default '[]';
alter table question add column gaps jsonb not null default '[]';
alter table chat_message add column answer jsonb;
`,
  },
  {
    id: "011_T-20_clarify",
    sql: `
-- Clarifying questions (T-20). An agent can ask one follow-up instead of, or alongside, an answer.
-- The asker's reply continues the question as a new question whose parent is this one.
alter table question drop constraint if exists question_outcome_check;
alter table question add constraint question_outcome_check check (outcome in ('answered', 'routed', 'clarify'));
alter table question add column clarify jsonb;
alter table question add column parent_id text references question(id);
`,
  },
  {
    id: "012_T-22_route_destination",
    sql: `
-- Where a routed question went and why (T-22). A confident ownership match goes to its owner (and
-- shows in the team queue); anything else goes to the team queue with no assignee.
alter table request add column destination text not null default 'owner' check (destination in ('owner', 'team_queue'));
alter table request add column route_reason text;
`,
  },
  {
    id: "013_T-23_team_queue",
    sql: `
-- The team queue (T-23): a teammate picks a question up, passes it on, or asks the askers for more.
alter table request add column claimed_by text references app_user(id);
alter table request add column claimed_at timestamptz;
alter table request add column detail_question text;
alter table request add column detail_asked_at timestamptz;
`,
  },
  {
    id: "014_T-25_request_lifecycle",
    sql: `
-- The request lifecycle (T-25). Stored statuses stay open, answered, accepted and declined, plus
-- resolved; what the asker sees (awaiting the team, needs your input, unresolved) is derived from
-- these timestamps in requestState(), so open requests stay in every team-queue query unchanged.
alter table request drop constraint if exists request_status_check;
alter table request add constraint request_status_check check (status in ('open', 'answered', 'accepted', 'declined', 'resolved'));
alter table request add column detail_asked_by text references app_user(id);
alter table request add column detail_reply text;
alter table request add column detail_replied_at timestamptz;
alter table request add column unresolved_at timestamptz;
alter table request add column asked_again_at timestamptz;
alter table request add column escalated_at timestamptz;
alter table request add column resolved_at timestamptz;
`,
  },
  {
    id: "015_T-35_ai_usage",
    sql: `
-- AI spend per workspace (T-35): one row per model call, with its tokens and list-price cost.
-- org_id is null for calls outside any workspace (a background job before sign-in, say).
create table ai_usage (
  id bigserial primary key,
  org_id text references org(id) on delete cascade,
  task text not null,
  input_tokens int not null,
  output_tokens int not null,
  cost_usd numeric(12, 6) not null,
  at timestamptz not null
);
create index ai_usage_org_at_idx on ai_usage (org_id, at);
`,
  },
  {
    id: "016_T-16_pending_questions",
    sql: `
-- Pending questions (T-16): a member who answers "Not sure" isn't asked about that claim again.
alter table context_entry add column unsure_by text[] not null default '{}';
`,
  },
  {
    id: "017_T-21_answer_feedback",
    sql: `
-- Answer feedback (T-21): the asker says whether an agent's answer helped, with an optional note.
-- A thumbs down lowers Beacon's confidence in the team context the answer used.
create table answer_feedback (
  id text primary key,
  org_id text not null references org(id) on delete cascade,
  question_id text not null references question(id) on delete cascade,
  user_id text not null references app_user(id),
  vote text not null check (vote in ('up', 'down')),
  note text not null default '',
  at timestamptz not null,
  unique (question_id, user_id)
);
`,
  },
  {
    id: "018_T-27_question_group",
    sql: `
-- Multi-team questions (T-27): one question sent to several teams. Each team gets its own question
-- row (and request, if routed); group_id links them so the asker sees them as one.
alter table question add column group_id text;
create index question_group_idx on question (group_id) where group_id is not null;
`,
  },
  {
    id: "019_T-63_coding_session",
    sql: `
-- Local coding agents (T-63): each Claude Code, Codex or Cursor session that reports in. Sessions
-- feed one rolling draft per person per day (update_id); a session that reports again after that
-- draft was published starts over in the next one.
create table coding_session (
  id text primary key,
  org_id text not null references org(id) on delete cascade,
  user_id text not null references app_user(id),
  tool text not null check (tool in ('claude_code', 'codex', 'cursor')),
  session_key text not null,
  update_id text references team_update(id) on delete set null,
  repo text not null,
  branch text not null,
  prompts jsonb not null default '[]',
  notes jsonb not null default '[]',
  commits jsonb not null default '[]',
  diffstat text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, tool, session_key)
);
create index coding_session_update_idx on coding_session (update_id, repo);
`,
  },
];
