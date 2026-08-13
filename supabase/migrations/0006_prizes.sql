-- ============================================================================
-- EduPass · SPM Games — 0006 · Prizes
-- ----------------------------------------------------------------------------
-- Prizes are per award category and per placing, and they change between
-- seasons and as sponsors come and go. So they are rows, not constants: an
-- admin edits the prize table, the dashboard reflects it, and no deploy is
-- needed when a sponsor is confirmed in week three.
--
-- image_url is nullable on purpose. The UI falls back to a drawn placeholder,
-- so the prize section is presentable before any photography exists.
-- ============================================================================

alter table award_definitions
  add column if not exists sort_order   smallint not null default 0,
  add column if not exists prize_note   text;

create table if not exists award_prizes (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references seasons(id) on delete cascade,
  award_id     uuid not null references award_definitions(id) on delete cascade,

  rank         smallint not null check (rank between 1 and 10),
  title        text not null,               -- 'MacBook Air M3 13"'
  subtitle     text,                        -- 'Plus RM1,000 EduPass credit'
  value_myr    numeric(10,2),               -- indicative retail value
  quantity     smallint not null default 1,

  -- Filled in when artwork exists. Until then the UI draws a placeholder.
  image_url    text,
  image_alt    text,

  sponsor_name text,
  sponsor_logo_url text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (season_id, award_id, rank)
);

create index if not exists award_prizes_lookup
  on award_prizes (season_id, award_id, rank);

drop trigger if exists award_prizes_updated on award_prizes;
create trigger award_prizes_updated before update on award_prizes
  for each row execute function set_updated_at();

alter table award_prizes enable row level security;

-- Prizes are public: they are the reason students enter, and they appear on
-- the marketing page as well as the dashboard.
drop policy if exists read_prizes on award_prizes;
create policy read_prizes on award_prizes for select using (true);

drop policy if exists admin_prizes on award_prizes;
create policy admin_prizes on award_prizes
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- Total advertised prize pool for a season.
-- Derived, never stored — a stored total drifts out of step with the rows the
-- moment a sponsor is added.
-- ----------------------------------------------------------------------------
create or replace function season_prize_pool(p_season_id uuid default null)
returns numeric language sql stable as $$
  select coalesce(sum(value_myr * quantity), 0)
  from award_prizes
  where season_id = coalesce(p_season_id, current_season_id());
$$;
