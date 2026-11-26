-- Relay v0 schema: the six primitives (unit, member, entity + field,
-- interface, marking, audit log). Vertical packs are rows, not tables.

create table org (
  id      text primary key,
  name    text not null,
  config  jsonb not null default '{}'   -- targets and baselines for queue metrics
);

create table unit (
  id      text primary key,
  org_id  text not null references org(id),
  name    text not null,
  kind    text not null check (kind in ('internal', 'public')),
  color   text
);

create table member (
  id          text primary key,
  unit_id     text not null references unit(id),
  kind        text not null check (kind in ('person', 'agent')),
  name        text not null,
  role        text not null,
  manager_id  text references member(id),
  config      jsonb not null default '{}'  -- agent budget and approval rules
);

create table entity_type (
  id           text primary key,
  org_id       text not null references org(id),
  name         text not null,
  schema_json  jsonb not null default '{}'
);

create table entity (
  id              text primary key,
  entity_type_id  text not null references entity_type(id),
  external_ref    text not null unique,
  revision        integer not null default 1,  -- bumps on every write; keys summary caches
  created_at      timestamptz not null default now()
);

create table field (
  id              text primary key,
  entity_type_id  text not null references entity_type(id),
  key             text not null,
  label           text not null,
  type            text not null check (type in
                    ('status', 'checklist', 'decision', 'text', 'money', 'person', 'date')),
  owner_unit_id   text not null references unit(id),
  unique (entity_type_id, key)
);

create table field_value (
  entity_id   text not null references entity(id),
  field_id    text not null references field(id),
  value_json  jsonb,
  updated_by  text references member(id),
  updated_at  timestamptz not null default now(),
  primary key (entity_id, field_id)
);

create table interface (
  id            text primary key,
  from_unit_id  text not null references unit(id),
  to_unit_id    text not null references unit(id),
  field_id      text not null references field(id),
  level         text not null check (level in ('full', 'summary', 'status', 'headline')),
  trigger       text not null,  -- on_change | daily | on_request | on_approval | on_decision
  status        text not null default 'active'
                  check (status in ('active', 'requested', 'suggested', 'declined')),
  label         text,           -- "What" column on the Unit screen
  example       text,
  note          text,           -- why a suggestion or request was made
  created_at    timestamptz not null default now()
);

create table marking (
  id           text primary key,
  target_kind  text not null check (target_kind in ('field', 'entity')),
  target_id    text not null,
  label        text not null,
  -- {"allowed_units": [...], "max_level_others": "status"}
  rule         jsonb not null
);

create table audit_event (
  id                      bigserial primary key,
  actor_member_id         text references member(id),
  on_behalf_of_member_id  text references member(id),
  action                  text not null,   -- read | read_denied | write | write_denied | share | ...
  target                  text not null,   -- e.g. entity external ref
  to_unit_id              text references unit(id),  -- set on share events: the unit feed
  detail                  jsonb not null default '{}',
  at                      timestamptz not null default now()
);

create index audit_event_at on audit_event (at desc);
create index audit_event_feed on audit_event (to_unit_id, at desc) where action = 'share';
create index field_value_field on field_value (field_id);
