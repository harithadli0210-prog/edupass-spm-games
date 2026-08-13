-- ==========================================================================
-- EduPass SPM Games 2026 - COMPLETE DATABASE SETUP
-- Paste into the Supabase SQL Editor and press Run. Safe to re-run.
-- ==========================================================================


-- ##########################################################################
-- ##  0001_schema.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0001 · Schema
-- ----------------------------------------------------------------------------
-- Every table lands in this one migration, including the ones nothing reads
-- until October (missions, boss battles, awards). Turning those features on
-- later must be a feature flag, never a migration against live competition
-- data.
--
-- Conventions
--   * text + CHECK rather than native enums, so adding a question type or a
--     source type is an application change, not an ALTER TYPE on a hot table.
--   * All competition data is scoped by season_id. Nothing hard-codes 2026.
--   * Private student data lives ONLY in student_profiles (see 0002_rls.sql).
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Malaysia is UTC+8 with no DST. "Which day is it" decides which Daily
-- Challenge a student may play, so this must never be derived from UTC.
create or replace function my_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Kuala_Lumpur')::date
$$;

-- ============================================================================
-- SEASONS
-- ============================================================================

create table seasons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,               -- 'SPM_GAMES_2026_S1'
  name        text not null,                      -- 'SPM Games 2026 — Season 1'
  starts_on   date not null,
  ends_on     date not null,
  status      text not null default 'UPCOMING'
              check (status in ('UPCOMING','ACTIVE','ENDED')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint season_dates_ordered check (ends_on >= starts_on)
);
create trigger seasons_updated before update on seasons
  for each row execute function set_updated_at();

-- Exactly one season may be ACTIVE at a time.
create unique index seasons_one_active on seasons ((status)) where status = 'ACTIVE';

create or replace function current_season_id()
returns uuid language sql stable as $$
  select id from seasons where status = 'ACTIVE' limit 1
$$;

-- ============================================================================
-- GEOGRAPHY & SCHOOLS
-- ============================================================================

create table states (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,                -- 'JHR', 'KUL', ...
  name       text not null
);

create table districts (
  id         uuid primary key default gen_random_uuid(),
  state_id   uuid not null references states(id) on delete cascade,
  name       text not null,
  unique (state_id, name)
);

-- School name normalisation (spec §16).
--   "SMK ABC", "SMK A.B.C", "smk abc " → 'SMK ABC'
create or replace function normalize_school_name(raw text)
returns text language plpgsql immutable as $$
declare s text;
begin
  if raw is null then return null; end if;

  s := upper(unaccent(trim(raw)));
  s := replace(s, '&', ' AND ');
  s := regexp_replace(s, '[^A-Z0-9 ]', ' ', 'g');   -- strip punctuation
  s := regexp_replace(s, '\s+', ' ', 'g');
  s := trim(s);

  -- Expand the long forms students type out, so they collapse onto the
  -- abbreviation the registry uses.
  s := regexp_replace(s, '^SEKOLAH MENENGAH KEBANGSAAN AGAMA\M', 'SMKA');
  s := regexp_replace(s, '^SEKOLAH MENENGAH JENIS KEBANGSAAN\M', 'SMJK');
  s := regexp_replace(s, '^SEKOLAH MENENGAH KEBANGSAAN\M',       'SMK');
  s := regexp_replace(s, '^SEKOLAH MENENGAH TEKNIK\M',           'SMT');
  s := regexp_replace(s, '^SEKOLAH BERASRAMA PENUH\M',           'SBP');
  s := regexp_replace(s, '^SEK MEN JEN KEB\M',                   'SMJK');
  s := regexp_replace(s, '^SEK MEN KEB\M',                       'SMK');
  s := regexp_replace(s, '^SEK MEN\M',                           'SMK');

  s := regexp_replace(s, '\s+', ' ', 'g');
  return trim(s);
end $$;

create table schools (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  normalized_name text not null,
  state_id        uuid references states(id),
  district_id     uuid references districts(id),
  moe_code        text,                            -- official MOE school code
  status          text not null default 'PENDING_REVIEW'
                  check (status in ('VERIFIED','PENDING_REVIEW','MERGED')),
  merged_into_id  uuid references schools(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A school that is MERGED must say what it merged into, and nothing else may.
  constraint merged_target check (
    (status = 'MERGED' and merged_into_id is not null) or
    (status <> 'MERGED' and merged_into_id is null)
  )
);
create trigger schools_updated before update on schools
  for each row execute function set_updated_at();

create unique index schools_norm_state on schools (normalized_name, state_id)
  where status <> 'MERGED';
create index schools_trgm on schools using gin (normalized_name gin_trgm_ops);
create unique index schools_moe_code on schools (moe_code) where moe_code is not null;

-- Every raw string a student ever typed, mapped to the school it resolved to.
-- Makes the merge queue auditable and lets fuzzy matches improve over time.
create table school_aliases (
  id              uuid primary key default gen_random_uuid(),
  raw_name        text not null,
  normalized_name text not null,
  school_id       uuid not null references schools(id) on delete cascade,
  match_method    text not null
                  check (match_method in ('EXACT','TRIGRAM','MANUAL','CREATED')),
  similarity      numeric(4,3),
  created_at      timestamptz not null default now()
);
create index school_aliases_norm on school_aliases (normalized_name);

-- Resolve merges transitively so historical rows never need backfilling.
create or replace function resolve_school(p_school_id uuid)
returns uuid language plpgsql stable as $$
declare cur uuid := p_school_id; nxt uuid; hops int := 0;
begin
  loop
    select merged_into_id into nxt from schools where id = cur;
    exit when nxt is null or hops > 10;
    cur := nxt; hops := hops + 1;
  end loop;
  return cur;
end $$;

-- ============================================================================
-- SUBJECTS & TOPICS
-- ============================================================================

create table subjects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                -- 'BM','ENGLISH','MATH',...
  name_en     text not null,
  name_ms     text not null,
  icon        text not null,                       -- key into SubjectIcon map
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,       -- adding PI/PM is an INSERT
  created_at  timestamptz not null default now()
);

create table topics (
  id              uuid primary key default gen_random_uuid(),
  subject_id      uuid not null references subjects(id) on delete cascade,
  parent_topic_id uuid references topics(id) on delete cascade,  -- → subtopic
  name            text not null,
  form            smallint check (form between 1 and 5),
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  unique (subject_id, parent_topic_id, name)
);
create index topics_subject on topics (subject_id);

-- ============================================================================
-- STUDENTS
-- ----------------------------------------------------------------------------
-- Split in two on purpose. `students` holds the public-safe identity and is
-- the only table leaderboards join. Phone, email and postcode live in
-- `student_profiles`, which no leaderboard query can reach — the privacy
-- requirement is structural rather than procedural.
-- ============================================================================

create table students (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 30),
  avatar_seed  text,
  is_admin     boolean not null default false,
  status       text not null default 'ACTIVE'
               check (status in ('ACTIVE','SUSPENDED','DISQUALIFIED')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger students_updated before update on students
  for each row execute function set_updated_at();

create table student_profiles (
  student_id       uuid primary key references students(id) on delete cascade,
  full_name        text not null,
  phone_e164       text not null,                  -- '+601...'
  email            text not null,
  school_id        uuid references schools(id),
  school_name_raw  text not null,                  -- exactly what they typed
  state_id         uuid references states(id),
  district_id      uuid references districts(id),
  postcode         text not null check (postcode ~ '^[0-9]{5}$'),
  -- PDPA: participants are minors. Nothing is collected without these.
  consent_at       timestamptz,
  guardian_consent boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger student_profiles_updated before update on student_profiles
  for each row execute function set_updated_at();

-- Duplicate-account guards (spec §8).
create unique index student_profiles_phone on student_profiles (phone_e164);
create unique index student_profiles_email on student_profiles (lower(email));
create index student_profiles_school on student_profiles (school_id);
create index student_profiles_state on student_profiles (state_id);

-- ============================================================================
-- QUESTION BANK
-- ============================================================================

create table questions (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,          -- 'MATH-00124'
  subject_id        uuid not null references subjects(id),
  topic_id          uuid references topics(id),
  form              smallint check (form between 1 and 5),

  question_type     text not null default 'MCQ'
                    check (question_type in
                      ('MCQ','TRUE_FALSE','MATCHING','ORDERING','CLOZE','IMAGE')),
  stem              text not null,
  stem_media        jsonb,                         -- reserved for image/audio
  explanation       text,

  -- Initial value is admin-assigned. The difficulty engine blends its computed
  -- value in as attempts accumulate; see 0004_engines.sql.
  difficulty_score  smallint not null default 50 check (difficulty_score between 0 and 100),
  difficulty_label  text not null default 'MEDIUM'
                    check (difficulty_label in ('EASY','MEDIUM','HARD')),
  difficulty_source text not null default 'ADMIN'
                    check (difficulty_source in ('ADMIN','BLENDED','COMPUTED')),

  -- Provenance (spec §20). Trial papers must never be presentable as official
  -- SPM questions, so the distinction is stored, not inferred.
  source_type       text not null
                    check (source_type in ('SPM_PAST_YEAR','TRIAL_PAPER','TOPICAL',
                                           'TEACHER_CREATED','EDUPASS','AI_GENERATED')),
  source_name       text,
  source_year       smallint,
  source_state_id   uuid references states(id),
  rights_cleared    boolean not null default false,

  status            text not null default 'DRAFT'
                    check (status in ('DRAFT','ACTIVE','RETIRED')),
  created_by        uuid references students(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger questions_updated before update on questions
  for each row execute function set_updated_at();

-- The hot path: "give me ACTIVE questions in this subject at this difficulty".
create index questions_selection
  on questions (subject_id, difficulty_label, status)
  where status = 'ACTIVE';
create index questions_topic on questions (topic_id);

create table question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  label       text not null,                       -- 'A','B','C','D'
  content     text not null,
  is_correct  boolean not null default false,      -- NEVER exposed to a client
  sort_order  smallint not null default 0,
  unique (question_id, label)
);
create index question_options_question on question_options (question_id);

-- Exactly one correct option per question.
create unique index question_options_one_correct
  on question_options (question_id) where is_correct;

-- ============================================================================
-- DIFFICULTY STATISTICS
-- ============================================================================

create table question_difficulty_stats (
  question_id          uuid primary key references questions(id) on delete cascade,
  attempts             integer not null default 0,
  correct_count        integer not null default 0,
  incorrect_count      integer not null default 0,
  accuracy             numeric(5,4),
  avg_response_ms      integer,
  median_response_ms   integer,

  -- Component scores from the engine (spec §23), stored so the admin screen
  -- can show WHY a question scored as it did rather than just the result.
  incorrect_component  numeric(6,2),
  time_component       numeric(6,2),
  level_gradient       numeric(6,4),
  discrimination       numeric(6,4),

  computed_score       smallint check (computed_score between 0 and 100),
  blended_score        smallint check (blended_score between 0 and 100),
  confidence           numeric(4,3) check (confidence between 0 and 1),
  sample_size          integer not null default 0,
  maturity             text not null default 'PROVISIONAL'
                       check (maturity in ('PROVISIONAL','EARLY','STABLE')),
  needs_review         boolean not null default false,
  last_calculated_at   timestamptz
);

-- ============================================================================
-- GAME MODE CONFIGURATION
-- ============================================================================

create table daily_challenges (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid not null references seasons(id) on delete cascade,
  subject_id      uuid not null references subjects(id),
  challenge_date  date not null,
  question_count  smallint not null default 10,
  status          text not null default 'SCHEDULED'
                  check (status in ('SCHEDULED','OPEN','CLOSED')),
  created_at      timestamptz not null default now(),
  unique (season_id, subject_id, challenge_date)
);
create index daily_challenges_date on daily_challenges (challenge_date);

-- The day's questions are fixed and identical for every student. A leaderboard
-- built on differing question sets is not a fair comparison.
create table daily_challenge_questions (
  daily_challenge_id uuid not null references daily_challenges(id) on delete cascade,
  question_id        uuid not null references questions(id),
  position           smallint not null,
  primary key (daily_challenge_id, position),
  unique (daily_challenge_id, question_id)
);

create table missions (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons(id) on delete cascade,
  subject_id        uuid not null references subjects(id),
  code              text not null,                 -- 'MATH-M01'
  title             text not null,                 -- 'Algebra'
  description       text,
  sequence          smallint not null,
  unlock_rule       jsonb not null default '{}'::jsonb,
  question_count    smallint not null default 10,
  required_score    integer,
  required_accuracy numeric(4,3),
  xp_reward         integer not null default 500,
  status            text not null default 'DRAFT'
                    check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  created_at        timestamptz not null default now(),
  unique (season_id, code),
  unique (season_id, subject_id, sequence)
);

create table mission_questions (
  mission_id  uuid not null references missions(id) on delete cascade,
  question_id uuid not null references questions(id),
  position    smallint not null,
  primary key (mission_id, position),
  unique (mission_id, question_id)
);

create table boss_battles (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references seasons(id) on delete cascade,
  subject_id       uuid not null references subjects(id),
  week_no          smallint not null,
  title            text not null,
  opens_at         timestamptz not null,
  closes_at        timestamptz not null,
  question_count   smallint not null default 20,
  -- e.g. {"EASY":5,"MEDIUM":8,"HARD":7} — served in ascending difficulty.
  difficulty_curve jsonb not null default '{"EASY":5,"MEDIUM":8,"HARD":7}'::jsonb,
  time_limit_sec   integer,
  xp_reward        integer not null default 2000,
  status           text not null default 'DRAFT'
                   check (status in ('DRAFT','SCHEDULED','OPEN','CLOSED')),
  created_at       timestamptz not null default now(),
  unique (season_id, week_no),
  constraint boss_window check (closes_at > opens_at)
);

create table boss_battle_questions (
  boss_battle_id uuid not null references boss_battles(id) on delete cascade,
  question_id    uuid not null references questions(id),
  position       smallint not null,
  primary key (boss_battle_id, position),
  unique (boss_battle_id, question_id)
);

-- ============================================================================
-- GAME SESSIONS  —  the anti-cheat core
-- ============================================================================

create table game_sessions (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references students(id) on delete cascade,
  season_id          uuid not null references seasons(id),
  mode               text not null check (mode in ('DAILY','SPEED','MISSION','BOSS')),
  subject_id         uuid references subjects(id),

  daily_challenge_id uuid references daily_challenges(id),
  mission_id         uuid references missions(id),
  boss_battle_id     uuid references boss_battles(id),

  -- Pins the exact rule set this game is scored under, so a mid-season config
  -- change never retroactively rewrites a game already in progress.
  --
  -- A foreign key rather than a JSON copy: the snapshot is ~800 bytes and this
  -- table grows to millions of rows. Storing the id gives the same immutability
  -- guarantee for 16 bytes, because scoring_rules rows are versioned and never
  -- updated in place — a change inserts a new version.
  -- FK added at the end of this file, once scoring_rules exists.
  scoring_rules_id   uuid not null,

  status             text not null default 'ACTIVE'
                     check (status in ('ACTIVE','COMPLETED','EXPIRED','ABANDONED')),
  started_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  completed_at       timestamptz,

  questions_served   smallint not null default 0,
  questions_answered smallint not null default 0,
  questions_correct  smallint not null default 0,
  raw_points         integer not null default 0,
  final_points       integer not null default 0,
  xp_awarded         integer not null default 0,

  client_meta        jsonb,                        -- UA, viewport — for review
  created_at         timestamptz not null default now()
);
create index game_sessions_student on game_sessions (student_id, season_id, mode);
create index game_sessions_active on game_sessions (student_id) where status = 'ACTIVE';

-- One Daily Challenge run per student per subject per day (spec §10).
create unique index game_sessions_one_daily
  on game_sessions (student_id, daily_challenge_id)
  where daily_challenge_id is not null and status <> 'ABANDONED';

-- One row per question in the session's set. `served_at` is NULL until the
-- question is actually handed to the browser, and is stamped by the server at
-- that moment — response time is `answered_at - served_at`.
--
-- This is why the whole set can be built up front without corrupting timing:
-- a question created at session start but served three minutes later measures
-- from the serve, not the creation.
create table session_questions (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references game_sessions(id) on delete cascade,
  question_id  uuid not null references questions(id),
  position     smallint not null,
  served_at    timestamptz,
  answered_at  timestamptz,
  is_calibration boolean not null default false,   -- see selection engine
  unique (session_id, question_id),
  unique (session_id, position)
);
create index session_questions_session on session_questions (session_id);

-- ============================================================================
-- ATTEMPTS  —  the substrate everything else is built from
-- ============================================================================

-- Partitioned by month. This is the only table that reaches tens of millions of
-- rows, and partitioning is what makes end-of-season archival a DROP TABLE
-- instead of a DELETE across 20 million rows. It also keeps each index small
-- enough to stay in cache during the campaign.
--
-- Both unique constraints carry created_at because Postgres requires the
-- partition key in every unique index on a partitioned table.
create table question_attempts (
  id                        uuid not null default gen_random_uuid(),
  session_question_id       uuid not null references session_questions(id) on delete cascade,
  session_id                uuid not null references game_sessions(id) on delete cascade,
  student_id                uuid not null references students(id) on delete cascade,
  question_id               uuid not null references questions(id),
  subject_id                uuid not null references subjects(id),
  topic_id                  uuid references topics(id),
  season_id                 uuid not null references seasons(id),
  mode                      text not null check (mode in ('DAILY','SPEED','MISSION','BOSS')),

  selected_option_id        uuid references question_options(id),
  is_correct                boolean not null,
  response_time_ms          integer not null,
  client_elapsed_ms         integer,               -- kept only for comparison

  -- Difficulty as it stood at attempt time. Without this, recalculating
  -- difficulty later would silently rewrite the meaning of historical scores.
  difficulty_at_attempt     smallint not null,
  difficulty_label_at_attempt text not null,
  student_level_at_attempt  smallint not null default 1,

  points_awarded            integer not null default 0,
  xp_awarded                integer not null default 0,
  speed_bonus               integer not null default 0,

  is_suspicious             boolean not null default false,
  created_at                timestamptz not null default now(),

  primary key (id, created_at),
  unique (session_question_id, created_at)
) partition by range (created_at);

-- ----------------------------------------------------------------------------
-- Indexes.
--
-- Kept deliberately few: at ~600 bytes per attempt row, indexes cost more than
-- the data itself, so every one here has to earn its place against a query
-- that actually runs.
--
--   student_season  → dashboard, streaks, and the selection engine's repeat
--                     cooldown (which filters on student_id + created_at only,
--                     so a separate (student_id, question_id) index would never
--                     be chosen)
--   question        → difficulty engine, per-question analytics
--   subject         → performance page subject filter
--
-- A descending created_at is not needed as a separate index: Postgres scans a
-- btree backwards at the same cost.
-- ----------------------------------------------------------------------------
create index attempts_student_season on question_attempts (student_id, season_id, created_at desc);
create index attempts_question       on question_attempts (question_id);
create index attempts_subject        on question_attempts (student_id, subject_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Partition management.
--
-- Explicit monthly partitions plus a DEFAULT as a safety net. The default must
-- stay empty for months that later get their own partition — Postgres refuses
-- to attach a partition whose range already has rows sitting in the default —
-- so ensure_attempt_partitions() is run ahead of time, not reactively.
-- ----------------------------------------------------------------------------
create or replace function ensure_attempt_partitions(
  p_from  date default date_trunc('month', now())::date,
  p_months int default 6
) returns integer
language plpgsql as $$
declare
  i      int;
  starts date;
  ends   date;
  name   text;
  made   int := 0;
begin
  for i in 0..(p_months - 1) loop
    starts := (date_trunc('month', p_from) + (i || ' month')::interval)::date;
    ends   := (starts + interval '1 month')::date;
    name   := format('question_attempts_%s', to_char(starts, 'YYYYMM'));

    if not exists (select 1 from pg_class where relname = name) then
      execute format(
        'create table %I partition of question_attempts for values from (%L) to (%L)',
        name, starts, ends);
      made := made + 1;
    end if;
  end loop;
  return made;
end $$;

create table question_attempts_default partition of question_attempts default;

-- Covers the campaign plus a runway either side.
select ensure_attempt_partitions('2026-08-01', 8);

-- ============================================================================
-- PROGRESSION
-- ============================================================================

create table level_thresholds (
  level       smallint primary key check (level >= 1),
  xp_required integer not null check (xp_required >= 0),
  title       text
);

-- Append-only ledger. Balances are derived, never edited in place.
create table xp_transactions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  season_id   uuid not null references seasons(id),
  source      text not null
              check (source in ('ATTEMPT','SESSION_COMPLETE','MISSION','BOSS',
                                'STREAK','AWARD','ADJUSTMENT')),
  source_id   uuid,
  xp          integer not null,
  created_at  timestamptz not null default now()
);
create index xp_tx_student on xp_transactions (student_id, season_id);

-- Denormalised rollup, updated in the same transaction that writes an attempt.
-- Leaderboards read one indexed row per student rather than aggregating
-- millions of attempts on request.
create table student_season_stats (
  student_id         uuid not null references students(id) on delete cascade,
  season_id          uuid not null references seasons(id) on delete cascade,

  daily_points       integer not null default 0,
  speed_points       integer not null default 0,
  mission_points     integer not null default 0,
  boss_points        integer not null default 0,
  overall_points     integer not null default 0,   -- weighted index, see 0004

  xp                 integer not null default 0,
  level              smallint not null default 1,

  questions_answered integer not null default 0,
  questions_correct  integer not null default 0,
  total_response_ms  bigint  not null default 0,

  active_days        integer not null default 0,
  current_streak     integer not null default 0,
  longest_streak     integer not null default 0,
  last_played_on     date,

  daily_completions  integer not null default 0,   -- for Consistency Champion
  speed_rounds       integer not null default 0,

  updated_at         timestamptz not null default now(),
  primary key (student_id, season_id)
);
create index sss_daily   on student_season_stats (season_id, daily_points desc);
create index sss_speed   on student_season_stats (season_id, speed_points desc);
create index sss_overall on student_season_stats (season_id, overall_points desc);

create table student_subject_stats (
  student_id        uuid not null references students(id) on delete cascade,
  season_id         uuid not null references seasons(id) on delete cascade,
  subject_id        uuid not null references subjects(id),
  attempts          integer not null default 0,
  correct           integer not null default 0,
  total_response_ms bigint  not null default 0,
  points            integer not null default 0,
  -- Rolling window over the last 30 attempts, used by the selection engine to
  -- band the student. Deliberately NOT derived from level.
  recent_attempts   integer not null default 0,
  recent_correct    integer not null default 0,
  mastery           numeric(5,4) not null default 0,
  hard_attempts     integer not null default 0,
  hard_correct      integer not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (student_id, season_id, subject_id)
);

create table student_topic_stats (
  student_id uuid not null references students(id) on delete cascade,
  season_id  uuid not null references seasons(id) on delete cascade,
  topic_id   uuid not null references topics(id) on delete cascade,
  attempts   integer not null default 0,
  correct    integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, season_id, topic_id)
);

-- Signals, not diagnoses (spec §27).
create table student_behaviour_signals (
  student_id  uuid not null references students(id) on delete cascade,
  season_id   uuid not null references seasons(id) on delete cascade,
  signal      text not null,
  value       numeric(6,4) not null,
  confidence  numeric(4,3) not null default 0,
  sample_size integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (student_id, season_id, signal)
);

-- ============================================================================
-- AWARDS
-- ============================================================================

create table award_definitions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  category    text not null
              check (category in ('OVERALL','DAILY','SPEED','SUBJECT','SCHOOL',
                                  'CONSISTENCY','IMPROVED')),
  subject_id  uuid references subjects(id),
  -- Qualification gates live here, not in code: minimum attempts, minimum
  -- active days, shrinkage constant for Most Improved, etc.
  rules       jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true
);

create table student_awards (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  season_id    uuid not null references seasons(id) on delete cascade,
  award_id     uuid not null references award_definitions(id),
  rank         smallint,
  value        numeric(10,2),
  awarded_at   timestamptz not null default now(),
  unique (season_id, award_id, student_id)
);

-- ============================================================================
-- CONFIGURATION  —  changing any of this is an admin action, not a deploy
-- ============================================================================

create table scoring_rules (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons(id) on delete cascade,
  version    integer not null default 1,
  rules      jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (season_id, version)
);
create unique index scoring_rules_one_active on scoring_rules (season_id) where is_active;

create table difficulty_config (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons(id) on delete cascade unique,
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

create table selection_profiles (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons(id) on delete cascade unique,
  profiles   jsonb not null,
  updated_at timestamptz not null default now()
);

create table mode_configs (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references seasons(id) on delete cascade,
  mode       text not null check (mode in ('DAILY','SPEED','MISSION','BOSS')),
  config     jsonb not null,
  updated_at timestamptz not null default now(),
  unique (season_id, mode)
);

-- ============================================================================
-- ANALYTICS & INTEGRITY
-- ============================================================================

create table analytics_events (
  id          bigserial primary key,
  student_id  uuid references students(id) on delete set null,
  season_id   uuid references seasons(id),
  event       text not null,
  properties  jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index analytics_events_student on analytics_events (student_id, occurred_at desc);
create index analytics_events_name    on analytics_events (event, occurred_at desc);

-- Flags are recorded, never auto-enforced. A false positive that disqualifies a
-- real student mid-competition is worse than a cheat who is caught in review.
create table suspicion_flags (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  session_id  uuid references game_sessions(id) on delete set null,
  reason      text not null
              check (reason in ('IMPOSSIBLE_RESPONSE_TIME','ACCURACY_AT_SPEED',
                                'DUPLICATE_SUBMISSION','RATE_LIMIT',
                                'SESSION_REPLAY','DEVICE_OVERLAP')),
  detail      jsonb not null default '{}'::jsonb,
  reviewed    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index suspicion_flags_student on suspicion_flags (student_id, created_at desc);

-- ============================================================================
-- FEATURE FLAGS
-- ----------------------------------------------------------------------------
-- Single switchboard for turning parts of the product on and off without a
-- deploy. Two distinct jobs:
--
--   · During the build, keep unfinished areas (Missions, Boss) hidden from
--     students while remaining reachable to an admin for review.
--   · During the campaign, kill-switch anything misbehaving in seconds.
--
-- `enabled` is what students see. `visible_to_admin` lets an admin walk a
-- feature that is switched off for everyone else, which is the whole point of
-- being able to review work in progress on the live site.
-- ============================================================================

create table feature_flags (
  key              text primary key,
  label            text not null,
  description      text,
  category         text not null default 'GENERAL'
                   check (category in ('MODE','CONTENT','COMPETITION','GENERAL')),
  enabled          boolean not null default false,
  visible_to_admin boolean not null default true,
  sort_order       smallint not null default 0,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references students(id)
);

create trigger feature_flags_updated before update on feature_flags
  for each row execute function set_updated_at();

-- ============================================================================
-- Deferred foreign keys
-- ----------------------------------------------------------------------------
-- game_sessions is declared before scoring_rules exists, so its FK is attached
-- here rather than reordering the file.
-- ============================================================================

alter table game_sessions
  add constraint game_sessions_scoring_rules_fk
  foreign key (scoring_rules_id) references scoring_rules(id);


-- ##########################################################################
-- ##  0002_rls.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0002 · Row Level Security
-- ----------------------------------------------------------------------------
-- The rule that shapes this file: a student may READ their own data and
-- NOTHING may let a student WRITE a score.
--
-- There is deliberately no INSERT or UPDATE policy anywhere on
-- question_attempts, xp_transactions, student_season_stats,
-- student_subject_stats or game_sessions. Those writes happen only through the
-- service role, from Next.js Route Handlers. A tampered client has no path to
-- `score = 999999` because the path does not exist.
--
-- question_options has no policy at all. Not "a restrictive policy" — none.
-- With RLS enabled and zero policies, every anon/authenticated read returns
-- zero rows, which is exactly what we want for the table holding is_correct.
-- ============================================================================

alter table seasons                    enable row level security;
alter table states                     enable row level security;
alter table districts                  enable row level security;
alter table schools                    enable row level security;
alter table school_aliases             enable row level security;
alter table subjects                   enable row level security;
alter table topics                     enable row level security;
alter table students                   enable row level security;
alter table student_profiles           enable row level security;
alter table questions                  enable row level security;
alter table question_options           enable row level security;
alter table question_difficulty_stats  enable row level security;
alter table daily_challenges           enable row level security;
alter table daily_challenge_questions  enable row level security;
alter table missions                   enable row level security;
alter table mission_questions          enable row level security;
alter table boss_battles               enable row level security;
alter table boss_battle_questions      enable row level security;
alter table game_sessions              enable row level security;
alter table session_questions          enable row level security;
alter table question_attempts          enable row level security;
alter table level_thresholds           enable row level security;
alter table xp_transactions            enable row level security;
alter table student_season_stats       enable row level security;
alter table student_subject_stats      enable row level security;
alter table student_topic_stats        enable row level security;
alter table student_behaviour_signals  enable row level security;
alter table award_definitions          enable row level security;
alter table student_awards             enable row level security;
alter table scoring_rules              enable row level security;
alter table difficulty_config          enable row level security;
alter table selection_profiles         enable row level security;
alter table mode_configs               enable row level security;
alter table analytics_events           enable row level security;
alter table suspicion_flags            enable row level security;
alter table feature_flags              enable row level security;

-- ----------------------------------------------------------------------------
-- Admin check.
-- SECURITY DEFINER so the lookup on `students` is not itself filtered by the
-- policies that call it, which would recurse.
-- ----------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from students where id = auth.uid()), false)
$$;

-- ============================================================================
-- Public reference data — readable by anyone, writable only by admin
-- ============================================================================

create policy read_seasons    on seasons    for select using (true);
create policy read_states     on states     for select using (true);
create policy read_districts  on districts  for select using (true);
create policy read_subjects   on subjects   for select using (true);
create policy read_topics     on topics     for select using (true);
create policy read_levels     on level_thresholds for select using (true);
create policy read_awards_def on award_definitions for select using (true);

-- Schools are readable so onboarding can offer a "did you mean" list.
create policy read_schools on schools for select using (status <> 'MERGED');

create policy admin_seasons  on seasons  for all using (is_admin()) with check (is_admin());
create policy admin_schools  on schools  for all using (is_admin()) with check (is_admin());
create policy admin_subjects on subjects for all using (is_admin()) with check (is_admin());
create policy admin_topics   on topics   for all using (is_admin()) with check (is_admin());
create policy admin_aliases  on school_aliases for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- Identity
-- ============================================================================

-- Display names are public — they appear on leaderboards.
create policy read_students_public on students for select using (true);

create policy update_own_student on students
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- A student may rename themselves. They may not promote themselves to
    -- admin, unsuspend themselves, or lift a disqualification.
    and is_admin() = (select is_admin from students where id = auth.uid())
    and status     = (select status   from students where id = auth.uid())
  );

create policy insert_own_student on students
  for insert with check (auth.uid() = id and is_admin() = false);

-- Private data. Own row only, always.
create policy read_own_profile on student_profiles
  for select using (auth.uid() = student_id);
create policy write_own_profile on student_profiles
  for insert with check (auth.uid() = student_id);
create policy update_own_profile on student_profiles
  for update using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
create policy admin_profiles on student_profiles
  for select using (is_admin());

-- ============================================================================
-- Question bank
-- ----------------------------------------------------------------------------
-- Students get NO direct access to questions. Question text reaches the browser
-- only through the session-scoped API, which strips correctness. Admin-only
-- here keeps the bank from being scraped ahead of a Daily Challenge.
-- ============================================================================

create policy admin_questions on questions
  for all using (is_admin()) with check (is_admin());

-- question_options: RLS enabled, no policy for students. Only the admin policy
-- and the service role can see is_correct.
create policy admin_question_options on question_options
  for all using (is_admin()) with check (is_admin());

create policy admin_difficulty_stats on question_difficulty_stats
  for all using (is_admin()) with check (is_admin());

create policy admin_daily_challenges on daily_challenges
  for all using (is_admin()) with check (is_admin());
create policy admin_daily_questions on daily_challenge_questions
  for all using (is_admin()) with check (is_admin());
create policy admin_mission_questions on mission_questions
  for all using (is_admin()) with check (is_admin());
create policy admin_boss_questions on boss_battle_questions
  for all using (is_admin()) with check (is_admin());

-- Missions and boss battles are announced, so their metadata is readable once
-- published. Their question sets (above) are not.
create policy read_missions on missions
  for select using (status = 'ACTIVE');
create policy read_boss on boss_battles
  for select using (status in ('SCHEDULED','OPEN','CLOSED'));
create policy admin_missions on missions for all using (is_admin()) with check (is_admin());
create policy admin_boss     on boss_battles for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- Gameplay — read own, write never
-- ============================================================================

create policy read_own_sessions on game_sessions
  for select using (auth.uid() = student_id);

create policy read_own_session_questions on session_questions
  for select using (
    exists (select 1 from game_sessions gs
            where gs.id = session_questions.session_id
              and gs.student_id = auth.uid())
  );

create policy read_own_attempts on question_attempts
  for select using (auth.uid() = student_id);

create policy read_own_xp on xp_transactions
  for select using (auth.uid() = student_id);

create policy read_own_season_stats on student_season_stats
  for select using (auth.uid() = student_id);

create policy read_own_subject_stats on student_subject_stats
  for select using (auth.uid() = student_id);

create policy read_own_topic_stats on student_topic_stats
  for select using (auth.uid() = student_id);

create policy read_own_signals on student_behaviour_signals
  for select using (auth.uid() = student_id);

create policy read_own_student_awards on student_awards
  for select using (auth.uid() = student_id);

-- Admin read-through for analytics screens.
create policy admin_sessions      on game_sessions        for select using (is_admin());
create policy admin_attempts      on question_attempts    for select using (is_admin());
create policy admin_season_stats  on student_season_stats for select using (is_admin());
create policy admin_subject_stats on student_subject_stats for select using (is_admin());
create policy admin_events        on analytics_events     for all using (is_admin()) with check (is_admin());
create policy admin_flags         on suspicion_flags      for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- Configuration — admin only. Students never see the scoring formula.
-- ============================================================================

-- Feature flags: admin only, with no student policy at all.
--
-- The app reads flags through the service role, so students never need direct
-- access. Left unprotected, anyone holding the publishable key could WRITE
-- here — switching scoring off, opening an unfinished mode, or closing
-- registration mid-campaign.
create policy admin_feature_flags     on feature_flags      for all using (is_admin()) with check (is_admin());

create policy admin_scoring_rules      on scoring_rules      for all using (is_admin()) with check (is_admin());
create policy admin_difficulty_config  on difficulty_config  for all using (is_admin()) with check (is_admin());
create policy admin_selection_profiles on selection_profiles for all using (is_admin()) with check (is_admin());
create policy admin_mode_configs       on mode_configs       for all using (is_admin()) with check (is_admin());
create policy admin_award_defs         on award_definitions  for all using (is_admin()) with check (is_admin());
create policy admin_student_awards     on student_awards     for all using (is_admin()) with check (is_admin());


-- ##########################################################################
-- ##  0003_leaderboards.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0003 · Leaderboards
-- ----------------------------------------------------------------------------
-- Ranking is computed in Postgres. The client consumes ranked rows.
--
-- The materialised views live in a private schema with no grants to anon or
-- authenticated. Matviews cannot carry RLS, so the only way to read them is
-- through the SECURITY DEFINER functions at the bottom of this file, which
-- return a fixed, sanitised column set: display name, school, state, points.
-- Phone, email and postcode are not reachable from here — student_profiles is
-- not in any of these query graphs.
-- ============================================================================

create schema if not exists lb;
revoke all on schema lb from anon, authenticated;

-- ============================================================================
-- Base projection: one row per participating student, already sanitised.
-- ============================================================================

create materialized view lb.participants as
select
  s.student_id,
  s.season_id,
  st.display_name,
  sch.name       as school_name,
  sch.id         as school_id,
  stt.name       as state_name,
  stt.id         as state_id,
  d.id           as district_id,
  s.daily_points,
  s.speed_points,
  s.mission_points,
  s.boss_points,
  s.overall_points,
  s.xp,
  s.level,
  s.active_days,
  s.current_streak,
  s.longest_streak,
  s.daily_completions,
  s.questions_answered,
  s.questions_correct
from student_season_stats s
join students st on st.id = s.student_id and st.status = 'ACTIVE'
left join student_profiles p on p.student_id = s.student_id
left join schools sch on sch.id = resolve_school(p.school_id)
left join states stt on stt.id = p.state_id
left join districts d on d.id = p.district_id;

create unique index on lb.participants (student_id, season_id);
create index on lb.participants (season_id, school_id);
create index on lb.participants (season_id, state_id);

-- ============================================================================
-- A. DAILY CHALLENGE
-- ============================================================================

create materialized view lb.daily as
select
  student_id, season_id, display_name, school_name, school_id,
  state_name, state_id, district_id,
  daily_points as points,
  rank() over (partition by season_id order by daily_points desc, student_id) as rank
from lb.participants
where daily_points > 0;
create unique index on lb.daily (season_id, student_id);
create index on lb.daily (season_id, rank);

-- ============================================================================
-- B. SPEEDY CHALLENGE
-- ============================================================================

create materialized view lb.speed as
select
  student_id, season_id, display_name, school_name, school_id,
  state_name, state_id, district_id,
  speed_points as points,
  rank() over (partition by season_id order by speed_points desc, student_id) as rank
from lb.participants
where speed_points > 0;
create unique index on lb.speed (season_id, student_id);
create index on lb.speed (season_id, rank);

-- ============================================================================
-- C. OVERALL
-- ----------------------------------------------------------------------------
-- overall_points is the WEIGHTED INDEX computed by recompute_overall_points(),
-- not a sum of raw mode points. See the comment on that function for why.
-- ============================================================================

create materialized view lb.overall as
select
  student_id, season_id, display_name, school_name, school_id,
  state_name, state_id, district_id,
  overall_points as points,
  rank() over (partition by season_id order by overall_points desc, student_id) as rank
from lb.participants
where overall_points > 0;
create unique index on lb.overall (season_id, student_id);
create index on lb.overall (season_id, rank);

-- ============================================================================
-- D. SUBJECT CHAMPION
-- ============================================================================

create materialized view lb.subject as
select
  ss.student_id, ss.season_id, ss.subject_id, sub.code as subject_code,
  p.display_name, p.school_name, p.school_id, p.state_name, p.state_id, p.district_id,
  ss.points,
  rank() over (partition by ss.season_id, ss.subject_id
               order by ss.points desc, ss.student_id) as rank
from student_subject_stats ss
join subjects sub on sub.id = ss.subject_id
join lb.participants p on p.student_id = ss.student_id and p.season_id = ss.season_id
where ss.points > 0;
create unique index on lb.subject (season_id, subject_id, student_id);
create index on lb.subject (season_id, subject_id, rank);

-- ============================================================================
-- E. SCHOOL CHAMPION
-- ----------------------------------------------------------------------------
-- Ranked by MEAN score across qualifying students, not by sum. A sum ranks
-- schools by enrolment size and the largest school in Malaysia wins in week one.
-- ============================================================================

create materialized view lb.school as
with agg as (
  select
    season_id, school_id, school_name, state_name, state_id,
    count(*)                    as participants,
    round(avg(overall_points))  as mean_points,
    sum(overall_points)         as total_points
  from lb.participants
  where school_id is not null and overall_points > 0
  group by season_id, school_id, school_name, state_name, state_id
)
select
  a.*,
  rank() over (partition by season_id order by mean_points desc, participants desc, school_id) as rank
from agg a
-- Minimum participant count, so a school with one strong student cannot top a
-- school with fifty. Sourced from award_definitions at refresh time.
where a.participants >= coalesce(
  (select (rules->>'min_participants')::int
     from award_definitions where code = 'SCHOOL_CHAMPION'), 5);
create unique index on lb.school (season_id, school_id);
create index on lb.school (season_id, rank);

-- ============================================================================
-- F. CONSISTENCY CHAMPION
-- ----------------------------------------------------------------------------
-- Rewards showing up, not grinding. questions_answered and total time played
-- are deliberately absent — including either collapses this into a duplicate of
-- the volume leaderboards (spec §16).
-- ============================================================================

create materialized view lb.consistency as
with season_span as (
  select id as season_id,
         greatest(1, least(current_date, ends_on) - starts_on + 1) as days_elapsed,
         (select count(*) from subjects where is_active) as active_subjects
  from seasons
),
scored as (
  select
    p.student_id, p.season_id, p.display_name, p.school_name, p.school_id,
    p.state_name, p.state_id, p.district_id,
    p.active_days, p.longest_streak, p.daily_completions,
    round(1000 * (
        0.45 * least(1.0, p.active_days::numeric / s.days_elapsed)
      + 0.35 * least(1.0, p.daily_completions::numeric
                          / greatest(1, s.days_elapsed * s.active_subjects))
      + 0.20 * least(1.0, p.longest_streak::numeric / s.days_elapsed)
    )) as points
  from lb.participants p
  join season_span s on s.season_id = p.season_id
  where p.active_days > 0
)
select *, rank() over (partition by season_id order by points desc, student_id) as rank
from scored;
create unique index on lb.consistency (season_id, student_id);
create index on lb.consistency (season_id, rank);

-- ============================================================================
-- G. MOST IMPROVED
-- ----------------------------------------------------------------------------
-- Two guards against a lucky-quiz fake improvement (spec §16):
--   1. A qualification gate — minimum attempts AND active days in EACH window.
--   2. Shrinkage — each window's mean is pulled toward the cohort mean in
--      inverse proportion to its sample size:
--         adjusted = (n·observed + k·cohort) / (n + k)
--      so a 20-attempt window barely moves off the cohort average, while a
--      400-attempt window is trusted almost entirely.
-- ============================================================================

create materialized view lb.improved as
with cfg as (
  select
    coalesce((select (rules->>'min_attempts_per_window')::int
                from award_definitions where code = 'MOST_IMPROVED'), 150) as min_attempts,
    coalesce((select (rules->>'min_active_days_per_window')::int
                from award_definitions where code = 'MOST_IMPROVED'), 10)  as min_days,
    coalesce((select (rules->>'shrinkage_k')::numeric
                from award_definitions where code = 'MOST_IMPROVED'), 50)  as k
),
windows as (
  -- Window A is the first calendar month of the season, window B the rest.
  -- Expressed relative to the season so 2027 needs no code change.
  select id as season_id, starts_on,
         (starts_on + interval '1 month')::date as split_on,
         ends_on
  from seasons
),
per_window as (
  select
    a.student_id, a.season_id,
    case when a.created_at < w.split_on then 'A' else 'B' end as win,
    count(*)                                        as attempts,
    count(*) filter (where a.is_correct)            as correct,
    count(distinct (a.created_at at time zone 'Asia/Kuala_Lumpur')::date) as active_days
  from question_attempts a
  join windows w on w.season_id = a.season_id
  group by 1, 2, 3
),
cohort as (
  select season_id, win,
         sum(correct)::numeric / nullif(sum(attempts), 0) as cohort_accuracy
  from per_window group by 1, 2
),
adjusted as (
  select
    pw.student_id, pw.season_id, pw.win, pw.attempts, pw.active_days,
    (pw.attempts * (pw.correct::numeric / pw.attempts) + cfg.k * c.cohort_accuracy)
      / (pw.attempts + cfg.k) as adj_accuracy
  from per_window pw
  join cohort c on c.season_id = pw.season_id and c.win = pw.win
  cross join cfg
),
paired as (
  select
    a.student_id, a.season_id,
    a.adj_accuracy as accuracy_a, b.adj_accuracy as accuracy_b,
    a.attempts as attempts_a, b.attempts as attempts_b,
    a.active_days as days_a, b.active_days as days_b
  from adjusted a
  join adjusted b on b.student_id = a.student_id and b.season_id = a.season_id and b.win = 'B'
  where a.win = 'A'
),
qualified as (
  select p.*, round((p.accuracy_b - p.accuracy_a) * 10000) as points
  from paired p cross join cfg
  where p.attempts_a >= cfg.min_attempts and p.attempts_b >= cfg.min_attempts
    and p.days_a   >= cfg.min_days     and p.days_b     >= cfg.min_days
)
select
  q.student_id, q.season_id, pt.display_name, pt.school_name, pt.school_id,
  pt.state_name, pt.state_id, pt.district_id,
  q.accuracy_a, q.accuracy_b, q.points,
  rank() over (partition by q.season_id order by q.points desc, q.student_id) as rank
from qualified q
join lb.participants pt on pt.student_id = q.student_id and pt.season_id = q.season_id
where q.points > 0;
create unique index on lb.improved (season_id, student_id);
create index on lb.improved (season_id, rank);

-- ============================================================================
-- OVERALL INDEX  —  why this is not a weighted sum of raw points
-- ----------------------------------------------------------------------------
-- Speedy is unlimited; Daily is capped at 50 questions a day. Raw Speedy totals
-- will run an order of magnitude above Daily's. Applying 30/20/25/25 directly
-- to raw points would make the 20% weight dominate, and the published weights
-- would be fiction.
--
-- Each mode is therefore normalised to a 0–1000 index against that mode's 99th
-- percentile scorer for the season before weights apply. The percentile is
-- recomputed on every refresh, so the weights mean what they say on day one,
-- when the top score is tiny, and on 31 October, when it is not.
-- ============================================================================

create or replace function recompute_overall_points(p_season_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_season uuid := coalesce(p_season_id, current_season_id());
  w        jsonb;
  p99_d numeric; p99_s numeric; p99_m numeric; p99_b numeric;
begin
  select rules->'overall_weights' into w
  from scoring_rules where season_id = v_season and is_active;

  if w is null then
    w := '{"daily":0.30,"speed":0.20,"mission":0.25,"boss":0.25}'::jsonb;
  end if;

  select
    percentile_cont(0.99) within group (order by daily_points)   filter (where daily_points   > 0),
    percentile_cont(0.99) within group (order by speed_points)   filter (where speed_points   > 0),
    percentile_cont(0.99) within group (order by mission_points) filter (where mission_points > 0),
    percentile_cont(0.99) within group (order by boss_points)    filter (where boss_points    > 0)
  into p99_d, p99_s, p99_m, p99_b
  from student_season_stats where season_id = v_season;

  update student_season_stats s
  set overall_points = round(
        (w->>'daily')::numeric   * 1000 * least(1, s.daily_points   / nullif(p99_d, 0))
      + (w->>'speed')::numeric   * 1000 * least(1, s.speed_points   / nullif(p99_s, 0))
      + (w->>'mission')::numeric * 1000 * least(1, s.mission_points / nullif(p99_m, 0))
      + (w->>'boss')::numeric    * 1000 * least(1, s.boss_points    / nullif(p99_b, 0))
      ),
      updated_at = now()
  where s.season_id = v_season;
end $$;

-- ============================================================================
-- REFRESH
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Refresh is split in two, because the boards have wildly different costs.
--
-- The fast set reads student_season_stats — one row per student, so a few tens
-- of thousands of rows. Cheap enough to run every few minutes.
--
-- lb.improved is different in kind: it aggregates the ENTIRE question_attempts
-- table, which reaches tens of millions of rows during the campaign. Running
-- that every five minutes would spend the whole database on a metric that, by
-- construction, compares one month against another and cannot meaningfully
-- change between breakfast and lunch. It runs nightly.
-- ----------------------------------------------------------------------------

create or replace function refresh_leaderboards_fast(p_season_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform recompute_overall_points(p_season_id);

  -- CONCURRENTLY keeps the boards readable during refresh. Every matview here
  -- has the unique index that requires.
  refresh materialized view concurrently lb.participants;
  refresh materialized view concurrently lb.daily;
  refresh materialized view concurrently lb.speed;
  refresh materialized view concurrently lb.overall;
  refresh materialized view concurrently lb.subject;
  refresh materialized view concurrently lb.school;
  refresh materialized view concurrently lb.consistency;
end $$;

create or replace function refresh_leaderboards_slow()
returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently lb.improved;
end $$;

/** Everything, in order. For manual runs and the first population after seed. */
create or replace function refresh_leaderboards(p_season_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform refresh_leaderboards_fast(p_season_id);
  perform refresh_leaderboards_slow();
end $$;

-- ============================================================================
-- READ API  —  the only way a client reaches any of the above
-- ============================================================================

create type lb_row as (
  rank         bigint,
  student_id   uuid,
  display_name text,
  school_name  text,
  state_name   text,
  points       numeric
);

/**
 * Ranked rows for one board, optionally filtered by geography or subject.
 * Filtering re-ranks within the filtered set, so "#1 in Johor" means what it
 * says rather than "the Johor student with the best national rank".
 */
create or replace function leaderboard_page(
  p_board     text,
  p_season_id uuid    default null,
  p_state_id  uuid    default null,
  p_district_id uuid  default null,
  p_school_id uuid    default null,
  p_subject_id uuid   default null,
  p_limit     int     default 20,
  p_offset    int     default 0
) returns setof lb_row
language plpgsql stable security definer set search_path = public, lb as $$
declare
  v_season uuid := coalesce(p_season_id, current_season_id());
  v_sql    text;
  v_src    text;
begin
  v_src := case p_board
    when 'overall'     then 'lb.overall'
    when 'daily'       then 'lb.daily'
    when 'speed'       then 'lb.speed'
    when 'subject'     then 'lb.subject'
    when 'consistency' then 'lb.consistency'
    when 'improved'    then 'lb.improved'
    else null end;

  if v_src is null then
    raise exception 'Unknown leaderboard %', p_board using errcode = '22023';
  end if;

  v_sql := format($f$
    with filtered as (
      select student_id, display_name, school_name, state_name, points
      from %s
      where season_id = $1
        and ($2::uuid is null or state_id    = $2)
        and ($3::uuid is null or district_id = $3)
        and ($4::uuid is null or school_id   = $4)
        and ($5::uuid is null or %s)
    )
    select rank() over (order by points desc, student_id)::bigint,
           student_id, display_name, school_name, state_name, points::numeric
    from filtered
    order by points desc, student_id
    limit $6 offset $7
  $f$, v_src, case when p_board = 'subject' then 'subject_id = $5' else 'true' end);

  return query execute v_sql
    using v_season, p_state_id, p_district_id, p_school_id, p_subject_id, p_limit, p_offset;
end $$;

/**
 * The caller's own rank on a board, plus the Top-100 cutoff.
 *
 * Kept separate from leaderboard_page so the "your position" bar is always
 * available even when the student sits at #4,812 and would never appear in any
 * reasonable page of results (spec §31).
 */
create or replace function leaderboard_me(
  p_board     text,
  p_season_id uuid default null,
  p_subject_id uuid default null
) returns table (
  rank              bigint,
  points            numeric,
  total_participants bigint,
  top_100_points    numeric
)
language plpgsql stable security definer set search_path = public, lb as $$
declare
  v_season uuid := coalesce(p_season_id, current_season_id());
  v_src    text;
  v_sql    text;
begin
  v_src := case p_board
    when 'overall'     then 'lb.overall'
    when 'daily'       then 'lb.daily'
    when 'speed'       then 'lb.speed'
    when 'subject'     then 'lb.subject'
    when 'consistency' then 'lb.consistency'
    when 'improved'    then 'lb.improved'
    else null end;

  if v_src is null then
    raise exception 'Unknown leaderboard %', p_board using errcode = '22023';
  end if;

  v_sql := format($f$
    with board as (
      select student_id, rank::bigint as rank, points::numeric as points
      from %s where season_id = $1 and ($3::uuid is null or %s)
    )
    select b.rank, b.points,
           (select count(*) from board),
           (select min(points) from board where rank <= 100)
    from board b where b.student_id = $2
  $f$, v_src, case when p_board = 'subject' then 'subject_id = $3' else 'true' end);

  return query execute v_sql using v_season, auth.uid(), p_subject_id;
end $$;

/** School board is aggregated, so it has its own shape. */
create or replace function leaderboard_schools(
  p_season_id uuid default null,
  p_state_id  uuid default null,
  p_limit     int  default 20,
  p_offset    int  default 0
) returns table (
  rank bigint, school_id uuid, school_name text, state_name text,
  participants bigint, mean_points numeric
)
language sql stable security definer set search_path = public, lb as $$
  with filtered as (
    select school_id, school_name, state_name, participants, mean_points
    from lb.school
    where season_id = coalesce(p_season_id, current_season_id())
      and (p_state_id is null or state_id = p_state_id)
  )
  select rank() over (order by mean_points desc, participants desc)::bigint,
         school_id, school_name, state_name, participants, mean_points
  from filtered
  order by mean_points desc, participants desc
  limit p_limit offset p_offset;
$$;

grant execute on function leaderboard_page      to authenticated;
grant execute on function leaderboard_me        to authenticated;
grant execute on function leaderboard_schools   to authenticated;


-- ##########################################################################
-- ##  0004_engines.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0004 · Engines
-- ----------------------------------------------------------------------------
--  1. commit_attempt()               — atomic write of one answer + all rollups
--  2. finalize_session()             — accuracy gate, completion bonus, points
--  3. recompute_question_difficulty()— the deterministic difficulty engine
--
-- Scoring FORMULAS live in TypeScript (src/lib/engines/scoring.ts), driven by
-- the JSON in scoring_rules. This file owns ATOMICITY: the attempt row, the
-- session counters, the subject stats, the XP ledger and the streak must all
-- move together or not at all. Splitting them across round trips would let a
-- dropped connection leave a student's XP and points disagreeing.
-- ============================================================================

-- ============================================================================
-- 1. COMMIT ONE ATTEMPT
-- ============================================================================

create or replace function commit_attempt(
  p_session_question_id uuid,
  p_selected_option_id  uuid,
  p_is_correct          boolean,
  p_response_time_ms    integer,
  p_client_elapsed_ms   integer,
  p_points              integer,
  p_xp                  integer,
  p_speed_bonus         integer,
  p_is_suspicious       boolean default false
) returns question_attempts
language plpgsql security definer set search_path = public as $$
declare
  sq      session_questions%rowtype;
  sess    game_sessions%rowtype;
  q       questions%rowtype;
  att     question_attempts%rowtype;
  v_level smallint;
  v_today date := my_today();
  v_prev  date;
begin
  -- Lock the served question row. Two concurrent submissions for the same
  -- question serialise here, and the second one finds answered_at already set.
  select * into sq from session_questions where id = p_session_question_id for update;
  if not found then
    raise exception 'Unknown session question' using errcode = 'P0002';
  end if;
  if sq.answered_at is not null then
    raise exception 'Already answered' using errcode = 'P0001';
  end if;
  -- An answer for a question that was never served means the client fabricated
  -- the submission rather than playing it.
  if sq.served_at is null then
    raise exception 'Question was never served' using errcode = 'P0001';
  end if;

  select * into sess from game_sessions where id = sq.session_id for update;
  if sess.status <> 'ACTIVE' then
    raise exception 'Session is not active' using errcode = 'P0001';
  end if;
  if now() > sess.expires_at then
    update game_sessions set status = 'EXPIRED' where id = sess.id;
    raise exception 'Session expired' using errcode = 'P0001';
  end if;

  select * into q from questions where id = sq.question_id;

  select coalesce(level, 1) into v_level
  from student_season_stats
  where student_id = sess.student_id and season_id = sess.season_id;

  update session_questions set answered_at = now() where id = sq.id;

  insert into question_attempts (
    session_question_id, session_id, student_id, question_id, subject_id,
    topic_id, season_id, mode, selected_option_id, is_correct,
    response_time_ms, client_elapsed_ms,
    difficulty_at_attempt, difficulty_label_at_attempt, student_level_at_attempt,
    points_awarded, xp_awarded, speed_bonus, is_suspicious
  ) values (
    sq.id, sess.id, sess.student_id, q.id, q.subject_id,
    q.topic_id, sess.season_id, sess.mode, p_selected_option_id, p_is_correct,
    p_response_time_ms, p_client_elapsed_ms,
    q.difficulty_score, q.difficulty_label, coalesce(v_level, 1),
    p_points, p_xp, p_speed_bonus, p_is_suspicious
  ) returning * into att;

  -- Session counters (raw_points; the accuracy gate is applied at finalise).
  update game_sessions set
    questions_answered = questions_answered + 1,
    questions_correct  = questions_correct + (case when p_is_correct then 1 else 0 end),
    raw_points         = raw_points + p_points,
    xp_awarded         = xp_awarded + p_xp
  where id = sess.id;

  -- ---- Season rollup + streak ---------------------------------------------
  select last_played_on into v_prev
  from student_season_stats
  where student_id = sess.student_id and season_id = sess.season_id;

  insert into student_season_stats (
    student_id, season_id, xp, questions_answered, questions_correct,
    total_response_ms, active_days, current_streak, longest_streak, last_played_on
  ) values (
    sess.student_id, sess.season_id, p_xp, 1,
    (case when p_is_correct then 1 else 0 end),
    p_response_time_ms, 1, 1, 1, v_today
  )
  on conflict (student_id, season_id) do update set
    xp                 = student_season_stats.xp + p_xp,
    questions_answered = student_season_stats.questions_answered + 1,
    questions_correct  = student_season_stats.questions_correct
                         + (case when p_is_correct then 1 else 0 end),
    total_response_ms  = student_season_stats.total_response_ms + p_response_time_ms,
    -- A day counts once, however many questions are answered in it.
    active_days = student_season_stats.active_days
                  + (case when student_season_stats.last_played_on is distinct from v_today
                          then 1 else 0 end),
    current_streak = case
      when student_season_stats.last_played_on = v_today then student_season_stats.current_streak
      when student_season_stats.last_played_on = v_today - 1 then student_season_stats.current_streak + 1
      else 1 end,
    longest_streak = greatest(
      student_season_stats.longest_streak,
      case
        when student_season_stats.last_played_on = v_today then student_season_stats.current_streak
        when student_season_stats.last_played_on = v_today - 1 then student_season_stats.current_streak + 1
        else 1 end),
    last_played_on = v_today,
    -- Level derived in the same statement rather than a follow-up UPDATE of a
    -- row we have already written. level_thresholds is ~25 rows and stays in
    -- cache, so the subquery is far cheaper than a second row version.
    level = coalesce((
      select max(l.level) from level_thresholds l
      where l.xp_required <= student_season_stats.xp + p_xp
    ), 1),
    updated_at     = now();

  -- ---- Subject rollup ------------------------------------------------------
  -- recent_attempts/recent_correct form the rolling window the selection engine
  -- bands on. Capped at 30 by decaying proportionally rather than storing the
  -- last 30 rows, which keeps this O(1) per attempt.
  insert into student_subject_stats (
    student_id, season_id, subject_id, attempts, correct, total_response_ms,
    points, recent_attempts, recent_correct, hard_attempts, hard_correct, mastery
  ) values (
    sess.student_id, sess.season_id, q.subject_id, 1,
    (case when p_is_correct then 1 else 0 end), p_response_time_ms,
    greatest(0, p_points), 1, (case when p_is_correct then 1 else 0 end),
    (case when q.difficulty_label = 'HARD' then 1 else 0 end),
    (case when q.difficulty_label = 'HARD' and p_is_correct then 1 else 0 end),
    (case when p_is_correct then 1 else 0 end)
  )
  on conflict (student_id, season_id, subject_id) do update set
    attempts          = student_subject_stats.attempts + 1,
    correct           = student_subject_stats.correct + (case when p_is_correct then 1 else 0 end),
    total_response_ms = student_subject_stats.total_response_ms + p_response_time_ms,
    points            = student_subject_stats.points + greatest(0, p_points),
    hard_attempts     = student_subject_stats.hard_attempts
                        + (case when q.difficulty_label = 'HARD' then 1 else 0 end),
    hard_correct      = student_subject_stats.hard_correct
                        + (case when q.difficulty_label = 'HARD' and p_is_correct then 1 else 0 end),
    recent_attempts   = least(30, student_subject_stats.recent_attempts + 1),
    recent_correct    = case
      when student_subject_stats.recent_attempts >= 30 then
        round(student_subject_stats.recent_correct * 29.0 / 30.0)
        + (case when p_is_correct then 1 else 0 end)
      else student_subject_stats.recent_correct + (case when p_is_correct then 1 else 0 end)
      end,
    mastery = round(
      (student_subject_stats.correct + (case when p_is_correct then 1 else 0 end))::numeric
      / (student_subject_stats.attempts + 1), 4),
    updated_at = now();

  -- ---- Deliberately NOT written here ---------------------------------------
  --
  -- student_topic_stats: rolled up nightly by recompute_topic_stats() instead.
  --   It is read by analytics, never by gameplay, so paying an upsert on the
  --   hottest path in the product to keep it current to the second is waste.
  --
  -- xp_transactions: written once per session by finalize_session(), not once
  --   per question. The running XP total already lives on student_season_stats;
  --   the ledger exists for audit, and per-session granularity is enough for
  --   that. At campaign scale this is ~20 million rows not written.
  --
  -- level: folded into the upsert above rather than a second UPDATE of a row
  --   this function has already touched.

  if p_is_suspicious then
    insert into suspicion_flags (student_id, session_id, reason, detail)
    values (sess.student_id, sess.id, 'IMPOSSIBLE_RESPONSE_TIME',
            jsonb_build_object('response_time_ms', p_response_time_ms,
                               'question_id', q.id));
  end if;

  return att;
end $$;

-- ============================================================================
-- 2. FINALISE A SESSION
-- ----------------------------------------------------------------------------
-- Where the accuracy gate is applied. Per-question points alone still reward
-- volume; multiplying the round total by an accuracy factor is what stops a
-- student who answers 100 questions badly from outranking one who answers 20
-- well (spec §12).
-- ============================================================================

create or replace function finalize_session(
  p_session_id       uuid,
  p_accuracy_factor  numeric,
  p_completion_bonus integer,
  p_bonus_xp         integer
) returns game_sessions
language plpgsql security definer set search_path = public as $$
declare
  sess  game_sessions%rowtype;
  v_pts integer;
begin
  select * into sess from game_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Unknown session' using errcode = 'P0002';
  end if;
  if sess.status = 'COMPLETED' then
    -- Idempotent: a retried "complete" call must not pay the bonus twice.
    return sess;
  end if;

  v_pts := greatest(0, round(sess.raw_points * p_accuracy_factor)::integer + p_completion_bonus);

  update game_sessions set
    status       = 'COMPLETED',
    completed_at = now(),
    final_points = v_pts,
    xp_awarded   = xp_awarded + p_bonus_xp
  where id = sess.id
  returning * into sess;

  -- Mode points are kept in separate columns on purpose. Daily and Speedy have
  -- independent leaderboards and must never contaminate each other (spec §10).
  update student_season_stats set
    daily_points      = daily_points   + (case when sess.mode = 'DAILY'   then v_pts else 0 end),
    speed_points      = speed_points   + (case when sess.mode = 'SPEED'   then v_pts else 0 end),
    mission_points    = mission_points + (case when sess.mode = 'MISSION' then v_pts else 0 end),
    boss_points       = boss_points    + (case when sess.mode = 'BOSS'    then v_pts else 0 end),
    daily_completions = daily_completions + (case when sess.mode = 'DAILY' then 1 else 0 end),
    speed_rounds      = speed_rounds      + (case when sess.mode = 'SPEED' then 1 else 0 end),
    xp                = xp + p_bonus_xp,
    updated_at        = now()
  where student_id = sess.student_id and season_id = sess.season_id;

  -- One ledger row per session, covering every question in it plus the
  -- completion bonus. This is the only place xp_transactions is written.
  insert into xp_transactions (student_id, season_id, source, source_id, xp)
  values (sess.student_id, sess.season_id, 'SESSION_COMPLETE', sess.id,
          sess.xp_awarded);

  update student_season_stats s set level = coalesce((
    select max(l.level) from level_thresholds l where l.xp_required <= s.xp
  ), 1)
  where s.student_id = sess.student_id and s.season_id = sess.season_id;

  return sess;
end $$;

-- ============================================================================
-- 4. NIGHTLY ROLLUPS
-- ----------------------------------------------------------------------------
-- Moved off the gameplay path. Topic stats feed analytics and the (future)
-- mission unlock rules, neither of which needs second-level freshness.
-- ============================================================================

create or replace function recompute_topic_stats(p_season_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_season uuid := coalesce(p_season_id, current_season_id());
  v_count  integer := 0;
begin
  insert into student_topic_stats (student_id, season_id, topic_id, attempts, correct, updated_at)
  select a.student_id, a.season_id, a.topic_id,
         count(*), count(*) filter (where a.is_correct), now()
  from question_attempts a
  where a.season_id = v_season and a.topic_id is not null
  group by a.student_id, a.season_id, a.topic_id
  on conflict (student_id, season_id, topic_id) do update set
    attempts   = excluded.attempts,
    correct    = excluded.correct,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ============================================================================
-- 3. DIFFICULTY ENGINE
-- ----------------------------------------------------------------------------
-- Deterministic statistics over real attempt data. No model is asked whether a
-- question is hard.
--
-- Four components (weights configurable in difficulty_config):
--   incorrect   0.45  classical facility index, inverted
--   time        0.25  median response time as a z-score within subject
--   level       0.20  how the strongest quartile fares — if good students also
--                     fail it, the question is genuinely hard rather than merely
--                     confusing
--   discrim     0.10  classical D index, top 27% minus bottom 27%
--
-- Response time is weighted independently precisely because accuracy alone
-- misleads: a question 90% of students get right but which takes three times
-- the subject median is not easy, it is laborious, and it will wreck a 60
-- second Speedy round.
--
-- Blending, rather than a hard cutoff at 200 attempts, avoids jolting live
-- scoring the moment a question crosses the threshold mid-competition.
-- ============================================================================

create or replace function recompute_question_difficulty(p_question_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg          jsonb;
  w_incorrect  numeric; w_time numeric; w_level numeric; w_discrim numeric;
  t_early      integer; t_stable integer;
  v_updated    integer := 0;
begin
  select config into cfg from difficulty_config where season_id = current_season_id();
  if cfg is null then cfg := '{}'::jsonb; end if;

  w_incorrect := coalesce((cfg->'weights'->>'incorrect')::numeric, 0.45);
  w_time      := coalesce((cfg->'weights'->>'time')::numeric,      0.25);
  w_level     := coalesce((cfg->'weights'->>'level')::numeric,     0.20);
  w_discrim   := coalesce((cfg->'weights'->>'discrimination')::numeric, 0.10);
  t_early     := coalesce((cfg->>'threshold_early')::integer,  50);
  t_stable    := coalesce((cfg->>'threshold_stable')::integer, 200);

  with
  -- Ability proxy: the student's season accuracy in that subject. Level is NOT
  -- used — level tracks XP, which tracks participation, not ability.
  ability as (
    select student_id, subject_id,
           case when attempts >= 20 then correct::numeric / attempts else null end as acc
    from student_subject_stats
    where season_id = current_season_id()
  ),
  banded as (
    select a.question_id, a.is_correct, a.response_time_ms,
           ntile(4) over (partition by a.subject_id order by ab.acc) as quartile,
           percent_rank() over (partition by a.subject_id order by ab.acc) as pr
    from question_attempts a
    left join ability ab
      on ab.student_id = a.student_id and ab.subject_id = a.subject_id
    where a.is_suspicious = false
      and (p_question_id is null or a.question_id = p_question_id)
  ),
  base as (
    select
      b.question_id,
      count(*)                                          as attempts,
      count(*) filter (where b.is_correct)              as correct_count,
      count(*) filter (where not b.is_correct)          as incorrect_count,
      avg(b.response_time_ms)::integer                  as avg_rt,
      percentile_cont(0.5) within group (order by b.response_time_ms)::integer as median_rt,
      -- Top quartile accuracy: the "is it genuinely hard" signal.
      avg(case when b.quartile = 4 then (b.is_correct)::int end)::numeric as acc_top_q,
      -- Classical D: top 27% minus bottom 27%.
      coalesce(avg(case when b.pr >= 0.73 then (b.is_correct)::int end)::numeric, 0)
      - coalesce(avg(case when b.pr <= 0.27 then (b.is_correct)::int end)::numeric, 0) as discrim
    from banded b
    group by b.question_id
  ),
  -- Time is only meaningful relative to peers in the same subject.
  subject_time as (
    select q.subject_id,
           avg(bs.median_rt)    as mean_median,
           nullif(stddev_pop(bs.median_rt), 0) as sd_median
    from base bs join questions q on q.id = bs.question_id
    group by q.subject_id
  ),
  scored as (
    select
      b.*,
      q.subject_id,
      q.difficulty_score as admin_score,
      (1 - b.correct_count::numeric / b.attempts) * 100 as incorrect_component,
      greatest(0, least(100,
        50 + 20 * ((b.median_rt - st.mean_median) / coalesce(st.sd_median, 1))
      )) as time_component,
      (1 - coalesce(b.acc_top_q, b.correct_count::numeric / b.attempts)) * 100 as level_component,
      greatest(0, least(100, (1 - b.discrim) * 100)) as discrim_component
    from base b
    join questions q on q.id = b.question_id
    left join subject_time st on st.subject_id = q.subject_id
  ),
  final as (
    select
      s.*,
      round(
        w_incorrect * s.incorrect_component
      + w_time      * s.time_component
      + w_level     * s.level_component
      + w_discrim   * s.discrim_component
      )::smallint as computed_score,
      -- Ramp the computed score in against the admin's rather than switching.
      greatest(0, least(1, (s.attempts - t_early)::numeric / (t_stable - t_early))) as blend_w,
      -- Population standard deviation of the four components, computed inline.
      -- This is the "do the signals agree?" term in confidence below.
      sqrt(
        (
            power(s.incorrect_component - m.mean_c, 2)
          + power(s.time_component      - m.mean_c, 2)
          + power(s.level_component     - m.mean_c, 2)
          + power(s.discrim_component   - m.mean_c, 2)
        ) / 4.0
      ) as component_sd
    from scored s
    cross join lateral (
      select (s.incorrect_component + s.time_component
              + s.level_component + s.discrim_component) / 4.0 as mean_c
    ) m
  )
  insert into question_difficulty_stats (
    question_id, attempts, correct_count, incorrect_count, accuracy,
    avg_response_ms, median_response_ms,
    incorrect_component, time_component, level_gradient, discrimination,
    computed_score, blended_score, confidence, sample_size, maturity,
    needs_review, last_calculated_at
  )
  select
    f.question_id, f.attempts, f.correct_count, f.incorrect_count,
    round(f.correct_count::numeric / f.attempts, 4),
    f.avg_rt, f.median_rt,
    round(f.incorrect_component, 2), round(f.time_component, 2),
    round(coalesce(f.acc_top_q, 0), 4), round(f.discrim, 4),
    f.computed_score,
    round(f.admin_score * (1 - f.blend_w) + f.computed_score * f.blend_w)::smallint,
    -- Sample size alone is not confidence. When the four components disagree,
    -- the estimate is shaky even at large n, so dispersion discounts it. An SD
    -- of 50 points across components means they are telling completely
    -- different stories, which zeroes the agreement term.
    round(
      least(1, f.attempts::numeric / t_stable)
      * (1 - least(1, f.component_sd / 50.0)),
    3),
    f.attempts,
    case when f.attempts < t_early then 'PROVISIONAL'
         when f.attempts < t_stable then 'EARLY'
         else 'STABLE' end,
    -- Low or negative discrimination at a real sample size means ambiguous or
    -- broken, not hard. Flag for a human rather than trusting the number.
    (f.attempts >= t_early and f.discrim < 0.10),
    now()
  from final f
  on conflict (question_id) do update set
    attempts            = excluded.attempts,
    correct_count       = excluded.correct_count,
    incorrect_count     = excluded.incorrect_count,
    accuracy            = excluded.accuracy,
    avg_response_ms     = excluded.avg_response_ms,
    median_response_ms  = excluded.median_response_ms,
    incorrect_component = excluded.incorrect_component,
    time_component      = excluded.time_component,
    level_gradient      = excluded.level_gradient,
    discrimination      = excluded.discrimination,
    computed_score      = excluded.computed_score,
    blended_score       = excluded.blended_score,
    confidence          = excluded.confidence,
    sample_size         = excluded.sample_size,
    maturity            = excluded.maturity,
    needs_review        = excluded.needs_review,
    last_calculated_at  = excluded.last_calculated_at;

  get diagnostics v_updated = row_count;

  -- Push the blended value back onto the question, but never for questions
  -- still in the provisional band — there the admin's estimate stands.
  update questions q set
    difficulty_score  = s.blended_score,
    difficulty_label  = case when s.blended_score <= 33 then 'EASY'
                             when s.blended_score <= 66 then 'MEDIUM'
                             else 'HARD' end,
    difficulty_source = case when s.maturity = 'STABLE' then 'COMPUTED' else 'BLENDED' end
  from question_difficulty_stats s
  where s.question_id = q.id
    and s.maturity <> 'PROVISIONAL'
    and (p_question_id is null or q.id = p_question_id);

  return v_updated;
end $$;


-- ##########################################################################
-- ##  0005_functions.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0005 · Supporting functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fuzzy school matching, used by src/lib/schools.ts stage 2.
--
-- Scoped to the student's state. Two schools with near-identical names in
-- different states are usually genuinely different schools, and matching across
-- state boundaries merges them wrongly.
-- ----------------------------------------------------------------------------
create or replace function match_school(
  p_normalized text,
  p_state_id   uuid default null,
  p_threshold  real default 0.6
) returns table (id uuid, name text, similarity real)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, similarity(s.normalized_name, p_normalized) as similarity
  from schools s
  where s.status <> 'MERGED'
    and (p_state_id is null or s.state_id = p_state_id)
    and similarity(s.normalized_name, p_normalized) >= p_threshold
  order by similarity desc, s.status = 'VERIFIED' desc
  limit 5;
$$;

grant execute on function match_school to authenticated;

-- ----------------------------------------------------------------------------
-- Keep normalized_name in step with name, whatever writes the row.
-- ----------------------------------------------------------------------------
create or replace function schools_sync_normalized()
returns trigger language plpgsql as $$
begin
  new.normalized_name := normalize_school_name(new.name);
  return new;
end $$;

create trigger schools_normalize
  before insert or update of name on schools
  for each row execute function schools_sync_normalized();

-- ----------------------------------------------------------------------------
-- Merge two schools. Admin action behind /admin/schools.
-- ----------------------------------------------------------------------------
create or replace function merge_school(p_from uuid, p_into uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_from = p_into then
    raise exception 'Cannot merge a school into itself' using errcode = '22023';
  end if;
  if not is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  -- Point profiles at the surviving row so future queries need no resolution,
  -- while resolve_school() still covers rows written before the merge.
  update student_profiles set school_id = p_into where school_id = p_from;
  update school_aliases    set school_id = p_into where school_id = p_from;

  update schools
  set status = 'MERGED', merged_into_id = p_into
  where id = p_from;
end $$;

-- ----------------------------------------------------------------------------
-- Served counter. Split out so a serve is one round trip rather than a
-- read-modify-write, which would race between two tabs of the same session.
-- ----------------------------------------------------------------------------
create or replace function increment_served(p_session_id uuid)
returns void language sql security definer set search_path = public as $$
  update game_sessions
  set questions_served = questions_served + 1
  where id = p_session_id;
$$;

-- ----------------------------------------------------------------------------
-- Behaviour signals (spec §26–27).
--
-- Signals, not diagnoses. Each is a normalised 0–1 value with an explicit
-- sample size, so the UI can stay silent until there is enough evidence rather
-- than telling a student on their first day that they are a "Fast Thinker".
-- ----------------------------------------------------------------------------
create or replace function recompute_behaviour_signals(p_student_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_season uuid := current_season_id();
  v_count  integer := 0;
begin
  with base as (
    select
      a.student_id,
      count(*)                                             as n,
      avg(a.response_time_ms)                              as avg_rt,
      avg((a.is_correct)::int)                             as accuracy,
      avg(case when a.difficulty_label_at_attempt = 'HARD'
               then (a.is_correct)::int end)               as hard_accuracy,
      count(*) filter (where a.difficulty_label_at_attempt = 'HARD') as hard_n,
      avg(case when a.mode = 'SPEED' then (a.is_correct)::int end)   as speed_accuracy,
      count(*) filter (where a.mode = 'SPEED')             as speed_n
    from question_attempts a
    where a.season_id = v_season
      and a.is_suspicious = false
      and (p_student_id is null or a.student_id = p_student_id)
    group by a.student_id
  ),
  cohort as (
    select avg(avg_rt) as cohort_rt, stddev_pop(avg_rt) as sd_rt from base
  ),
  signals as (
    -- Speed, expressed against the cohort rather than an absolute threshold:
    -- "fast" only means anything relative to other students on the same bank.
    select b.student_id, 'FAST_THINKER' as signal,
           greatest(0, least(1, 0.5 + (c.cohort_rt - b.avg_rt) / nullif(c.sd_rt * 4, 0))) as value,
           b.n
    from base b cross join cohort c
    union all
    select b.student_id, 'CAREFUL_RESPONDER',
           greatest(0, least(1, 0.5 + (b.avg_rt - c.cohort_rt) / nullif(c.sd_rt * 4, 0))), b.n
    from base b cross join cohort c
    union all
    select b.student_id, 'DIFFICULTY_TOLERANT', coalesce(b.hard_accuracy, 0), b.hard_n
    from base b
    union all
    select b.student_id, 'PRESSURE_PERFORMER', coalesce(b.speed_accuracy, 0), b.speed_n
    from base b
    union all
    select s.student_id, 'MATHEMATICAL_STRONG', s.mastery, s.attempts
    from student_subject_stats s join subjects sub on sub.id = s.subject_id
    where s.season_id = v_season and sub.code = 'MATH'
      and (p_student_id is null or s.student_id = p_student_id)
    union all
    select s.student_id, 'SCIENCE_STRONG', s.mastery, s.attempts
    from student_subject_stats s join subjects sub on sub.id = s.subject_id
    where s.season_id = v_season and sub.code = 'SCIENCE'
      and (p_student_id is null or s.student_id = p_student_id)
    union all
    select s.student_id, 'LANGUAGE_STRONG',
           avg(s.mastery), sum(s.attempts)::int
    from student_subject_stats s join subjects sub on sub.id = s.subject_id
    where s.season_id = v_season and sub.code in ('BM','ENGLISH')
      and (p_student_id is null or s.student_id = p_student_id)
    group by s.student_id
    union all
    select st.student_id, 'CONSISTENT',
           least(1, st.active_days::numeric / greatest(1, (select least(current_date, ends_on) - starts_on + 1 from seasons where id = v_season))),
           st.active_days
    from student_season_stats st
    where st.season_id = v_season
      and (p_student_id is null or st.student_id = p_student_id)
  )
  insert into student_behaviour_signals (student_id, season_id, signal, value, confidence, sample_size, computed_at)
  select
    s.student_id, v_season, s.signal, round(coalesce(s.value, 0), 4),
    -- 100 relevant attempts before a signal is considered fully evidenced.
    round(least(1, coalesce(s.n, 0)::numeric / 100), 3),
    coalesce(s.n, 0), now()
  from signals s
  on conflict (student_id, season_id, signal) do update set
    value = excluded.value, confidence = excluded.confidence,
    sample_size = excluded.sample_size, computed_at = excluded.computed_at;

  get diagnostics v_count = row_count;
  return v_count;
end $$;


-- ##########################################################################
-- ##  0006_prizes.sql
-- ##########################################################################

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


-- ##########################################################################
-- ##  0007_phone_verification.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0007 · Phone verification
-- ----------------------------------------------------------------------------
-- Sign-in and phone verification are deliberately separate concerns.
--
-- Students sign in with email, which costs nothing and works today. The phone
-- number on their profile is what stops one person entering several times, but
-- verifying it is only worth doing for students who are actually in contention
-- for a prize — the top few hundred, not all fifty thousand.
--
-- Verifying lazily turns a five-figure SMS/WhatsApp bill into a trivial one,
-- and it keeps the sign-up flow free of a step that would lose students at the
-- door.
--
-- This migration only prepares the ground. The delivery channel (WhatsApp via
-- Meta Cloud API, SMS via a provider, or a manual admin check) is a later
-- decision, and nothing here commits to one.
-- ============================================================================

alter table student_profiles
  add column if not exists phone_verified     boolean not null default false,
  add column if not exists phone_verified_at  timestamptz,
  add column if not exists phone_verify_channel text
    check (phone_verify_channel in ('WHATSAPP','SMS','MANUAL'));

-- Finding who still needs verifying, cheaply.
create index if not exists student_profiles_unverified
  on student_profiles (phone_verified)
  where phone_verified = false;

-- ----------------------------------------------------------------------------
-- One-time codes.
--
-- Only the hash is stored: a leaked table should not hand out live codes. The
-- attempt counter is what stops a six-digit code being brute-forced, which is
-- otherwise a few thousand requests.
-- ----------------------------------------------------------------------------
create table if not exists phone_verifications (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  phone_e164   text not null,
  code_hash    text not null,
  channel      text not null default 'WHATSAPP'
               check (channel in ('WHATSAPP','SMS')),
  attempts     smallint not null default 0,
  max_attempts smallint not null default 5,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists phone_verifications_student
  on phone_verifications (student_id, created_at desc);

alter table phone_verifications enable row level security;

-- No student policy at all: codes are issued and checked by the server. A
-- client that could read this table could read its own code, which defeats the
-- point of sending it to a device.
drop policy if exists admin_phone_verifications on phone_verifications;
create policy admin_phone_verifications on phone_verifications
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- Who is worth verifying right now.
--
-- Ranked students whose phone is still unverified. Feed this to whichever
-- channel is chosen, in rank order, and stop when the prize positions are
-- covered.
-- ----------------------------------------------------------------------------
create or replace function students_pending_verification(
  p_top_n int default 500,
  p_season_id uuid default null
)
returns table (student_id uuid, display_name text, phone_e164 text, rank bigint)
language sql stable security definer set search_path = public, lb as $$
  select o.student_id, o.display_name, p.phone_e164, o.rank::bigint
  from lb.overall o
  join student_profiles p on p.student_id = o.student_id
  where o.season_id = coalesce(p_season_id, current_season_id())
    and o.rank <= p_top_n
    and p.phone_verified = false
  order by o.rank;
$$;


-- ##########################################################################
-- ##  0008_policy.sql
-- ##########################################################################

-- ============================================================================
-- EduPass · SPM Games — 0008 · Competition policy
-- ----------------------------------------------------------------------------
-- The rules a student can be held to must be (a) published, and (b) the same
-- numbers the code actually enforces. Keeping them in one config row is what
-- stops the page saying "7 days" while the job runs on 14.
--
-- Every value here appears verbatim on the public rules page.
-- ============================================================================

create table if not exists competition_policy (
  season_id   uuid primary key references seasons(id) on delete cascade,
  policy      jsonb not null,
  version     integer not null default 1,
  -- Rules can change mid-season, but students must be told. This is the date
  -- shown at the top of the published page.
  effective_from date not null default current_date,
  updated_at  timestamptz not null default now()
);

drop trigger if exists competition_policy_updated on competition_policy;
create trigger competition_policy_updated before update on competition_policy
  for each row execute function set_updated_at();

alter table competition_policy enable row level security;

-- Public: these are the terms people are entering under.
drop policy if exists read_policy on competition_policy;
create policy read_policy on competition_policy for select using (true);

drop policy if exists admin_policy on competition_policy;
create policy admin_policy on competition_policy
  for all using (is_admin()) with check (is_admin());

insert into competition_policy (season_id, policy)
select s.id, $json${
  "eligibility": {
    "min_age": 13,
    "guardian_consent_below": 18,
    "residency": "Malaysia",
    "entry_fee_myr": 0
  },

  "accounts": {
    "max_per_person": 1,
    "identified_by": "phone_number",
    "duplicate_rule": "EARLIEST_REGISTRATION_KEPT",
    "duplicate_rule_note": "Where two accounts verify the same phone number, the account registered first is kept and the later one is removed from prize eligibility."
  },

  "verification": {
    "required_for_prizes": true,
    "channel": "WHATSAPP",
    "triggered_at_rank": 500,
    "response_window_days": 7,
    "code_length": 6,
    "code_expiry_minutes": 10,
    "max_attempts": 5,
    "unverified_consequence": "Play and appear on leaderboards continues; prize eligibility is suspended until verified."
  },

  "fair_play": {
    "prohibited": [
      "Using more than one account",
      "Automated tools, scripts or bots",
      "Sharing an account with another person",
      "Sharing answers during a live Daily Challenge",
      "Interfering with the service or other participants"
    ],
    "review_before_action": true,
    "appeal_window_days": 7
  },

  "prizes": {
    "substitution_allowed": true,
    "claim_window_days": 30,
    "transferable": false,
    "taxes_borne_by": "recipient",
    "school_prizes_paid_to": "school"
  },

  "results": {
    "final_at": "2026-10-31T23:59:59+08:00",
    "verification_period_days": 14,
    "tie_break": ["higher_accuracy", "fewer_total_attempts", "earlier_registration"]
  },

  "data": {
    "public_fields": ["display_name", "school", "state"],
    "never_public": ["full_name", "phone", "email", "postcode"],
    "retention_months": 24,
    "controller": "EduPass",
    "contact": "spmgames@edupass.my"
  }
}$json$::jsonb
from seasons s
where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id) do update set
  policy = excluded.policy, updated_at = now();


-- ##########################################################################
-- ##  0001_reference.sql
-- ##########################################################################

-- ============================================================================
-- Seed 0001 · Reference data
-- Season, states, districts, subjects, topics, level thresholds.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Season (spec §40 — 2026 is data, never a constant in code)
-- ----------------------------------------------------------------------------
insert into seasons (code, name, starts_on, ends_on, status) values
  ('SPM_GAMES_2026_S1', 'SPM Games 2026 — Season 1', '2026-09-01', '2026-10-31', 'ACTIVE')
on conflict (code) do update set
  name = excluded.name, starts_on = excluded.starts_on, ends_on = excluded.ends_on;

-- ----------------------------------------------------------------------------
-- States — 13 states + 3 federal territories
-- ----------------------------------------------------------------------------
insert into states (code, name) values
  ('JHR','Johor'), ('KDH','Kedah'), ('KTN','Kelantan'), ('MLK','Melaka'),
  ('NSN','Negeri Sembilan'), ('PHG','Pahang'), ('PNG','Pulau Pinang'),
  ('PRK','Perak'), ('PLS','Perlis'), ('SBH','Sabah'), ('SWK','Sarawak'),
  ('SGR','Selangor'), ('TRG','Terengganu'),
  ('KUL','W.P. Kuala Lumpur'), ('LBN','W.P. Labuan'), ('PJY','W.P. Putrajaya')
on conflict (code) do update set name = excluded.name;

-- ----------------------------------------------------------------------------
-- Districts (PPD). Abridged to the main districts per state for the MVP; the
-- admin import tool loads the complete MOE list before launch.
-- ----------------------------------------------------------------------------
insert into districts (state_id, name)
select s.id, d.name from states s
join (values
  ('JHR','Johor Bahru'),('JHR','Batu Pahat'),('JHR','Kluang'),('JHR','Muar'),
  ('JHR','Segamat'),('JHR','Kota Tinggi'),('JHR','Pontian'),('JHR','Kulai'),
  ('JHR','Mersing'),('JHR','Tangkak'),
  ('KDH','Kota Setar'),('KDH','Kubang Pasu'),('KDH','Kuala Muda'),('KDH','Kulim'),
  ('KDH','Baling'),('KDH','Langkawi'),('KDH','Sik'),('KDH','Yan'),('KDH','Padang Terap'),
  ('KTN','Kota Bharu'),('KTN','Pasir Mas'),('KTN','Tumpat'),('KTN','Bachok'),
  ('KTN','Machang'),('KTN','Tanah Merah'),('KTN','Kuala Krai'),('KTN','Gua Musang'),
  ('MLK','Melaka Tengah'),('MLK','Alor Gajah'),('MLK','Jasin'),
  ('NSN','Seremban'),('NSN','Port Dickson'),('NSN','Jempol'),('NSN','Kuala Pilah'),
  ('NSN','Rembau'),('NSN','Tampin'),('NSN','Jelebu'),
  ('PHG','Kuantan'),('PHG','Temerloh'),('PHG','Bentong'),('PHG','Pekan'),
  ('PHG','Raub'),('PHG','Jerantut'),('PHG','Bera'),('PHG','Rompin'),
  ('PHG','Lipis'),('PHG','Maran'),('PHG','Cameron Highlands'),
  ('PNG','Timur Laut'),('PNG','Barat Daya'),('PNG','Seberang Perai Utara'),
  ('PNG','Seberang Perai Tengah'),('PNG','Seberang Perai Selatan'),
  ('PRK','Kinta'),('PRK','Larut Matang dan Selama'),('PRK','Manjung'),
  ('PRK','Kerian'),('PRK','Hilir Perak'),('PRK','Batang Padang'),
  ('PRK','Kuala Kangsar'),('PRK','Perak Tengah'),('PRK','Hulu Perak'),
  ('PLS','Perlis'),
  ('SBH','Kota Kinabalu'),('SBH','Sandakan'),('SBH','Tawau'),('SBH','Penampang'),
  ('SBH','Papar'),('SBH','Keningau'),('SBH','Lahad Datu'),('SBH','Semporna'),
  ('SBH','Kudat'),('SBH','Beaufort'),('SBH','Ranau'),('SBH','Tuaran'),
  ('SWK','Kuching'),('SWK','Miri'),('SWK','Sibu'),('SWK','Bintulu'),
  ('SWK','Samarahan'),('SWK','Sri Aman'),('SWK','Kapit'),('SWK','Limbang'),
  ('SWK','Sarikei'),('SWK','Betong'),('SWK','Mukah'),
  ('SGR','Petaling'),('SGR','Klang'),('SGR','Hulu Langat'),('SGR','Gombak'),
  ('SGR','Sepang'),('SGR','Kuala Langat'),('SGR','Kuala Selangor'),
  ('SGR','Sabak Bernam'),('SGR','Hulu Selangor'),
  ('TRG','Kuala Terengganu'),('TRG','Kemaman'),('TRG','Dungun'),('TRG','Besut'),
  ('TRG','Marang'),('TRG','Hulu Terengganu'),('TRG','Setiu'),
  ('KUL','Bangsar Pudu'),('KUL','Keramat'),('KUL','Sentul'),('KUL','Kepong'),
  ('KUL','Cheras'),
  ('LBN','Labuan'),
  ('PJY','Putrajaya')
) as d(state_code, name) on d.state_code = s.code
on conflict (state_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Subjects (spec §9). Five active for the MVP; the two future subjects are
-- seeded inactive so adding them later is a flag flip, not a migration.
-- ----------------------------------------------------------------------------
insert into subjects (code, name_en, name_ms, icon, sort_order, is_active) values
  ('BM',      'Bahasa Melayu', 'Bahasa Melayu', 'BM',      1, true),
  ('ENGLISH', 'English',       'Bahasa Inggeris','ENGLISH', 2, true),
  ('MATH',    'Mathematics',   'Matematik',     'MATH',    3, true),
  ('SCIENCE', 'Science',       'Sains',         'SCIENCE', 4, true),
  ('SEJARAH', 'History',       'Sejarah',       'SEJARAH', 5, true),
  ('PENDIDIKAN_ISLAM', 'Islamic Education', 'Pendidikan Islam', 'PENDIDIKAN_ISLAM', 6, false),
  ('PENDIDIKAN_MORAL', 'Moral Education',   'Pendidikan Moral', 'PENDIDIKAN_MORAL', 7, false)
on conflict (code) do update set
  name_en = excluded.name_en, name_ms = excluded.name_ms,
  icon = excluded.icon, sort_order = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- Topics — the KSSM chapter structure, which also seeds the Mission list later.
-- ----------------------------------------------------------------------------
insert into topics (subject_id, name, form, sort_order)
select s.id, t.name, t.form, t.ord from subjects s
join (values
  ('MATH','Quadratic Functions and Equations',4,1),
  ('MATH','Number Bases',4,2),
  ('MATH','Logical Reasoning',4,3),
  ('MATH','Operations on Sets',4,4),
  ('MATH','Network in Graph Theory',4,5),
  ('MATH','Linear Inequalities in Two Variables',4,6),
  ('MATH','Graphs of Motion',4,7),
  ('MATH','Measures of Dispersion',4,8),
  ('MATH','Probability of Combined Events',4,9),
  ('MATH','Consumer Mathematics',4,10),
  ('MATH','Variation',5,11),
  ('MATH','Matrices',5,12),
  ('MATH','Insurance and Taxation',5,13),
  ('MATH','Congruency, Enlargement and Combined Transformations',5,14),
  ('MATH','Ratios and Graphs of Trigonometric Functions',5,15),

  ('SCIENCE','Scientific Investigation',4,1),
  ('SCIENCE','Body Coordination',4,2),
  ('SCIENCE','Heredity and Variation',4,3),
  ('SCIENCE','Growth in Plants',4,4),
  ('SCIENCE','Transport in Plants',4,5),
  ('SCIENCE','Electricity and Magnetism',4,6),
  ('SCIENCE','Nuclear Energy',4,7),
  ('SCIENCE','Light and Optics',4,8),
  ('SCIENCE','Waves',5,9),
  ('SCIENCE','Chemicals in Industry',5,10),
  ('SCIENCE','Carbon Compounds',5,11),
  ('SCIENCE','Motion and Force',5,12),
  ('SCIENCE','Space Exploration',5,13),

  ('BM','Pemahaman Petikan',4,1),
  ('BM','Tatabahasa: Kata dan Frasa',4,2),
  ('BM','Tatabahasa: Ayat',4,3),
  ('BM','Peribahasa dan Simpulan Bahasa',4,4),
  ('BM','Kesalahan Bahasa',4,5),
  ('BM','Karangan dan Ringkasan',5,6),
  ('BM','Komsas: Prosa Tradisional',5,7),
  ('BM','Komsas: Puisi dan Sajak',5,8),
  ('BM','Komsas: Novel dan Drama',5,9),

  ('ENGLISH','Reading Comprehension',4,1),
  ('ENGLISH','Grammar: Tenses',4,2),
  ('ENGLISH','Grammar: Subject-Verb Agreement',4,3),
  ('ENGLISH','Vocabulary and Word Forms',4,4),
  ('ENGLISH','Prepositions and Connectors',4,5),
  ('ENGLISH','Idioms and Phrasal Verbs',5,6),
  ('ENGLISH','Summary Writing',5,7),
  ('ENGLISH','Literature Components',5,8),

  ('SEJARAH','Kemakmuran dan Kejayaan Tamadun Awal',4,1),
  ('SEJARAH','Warisan Kesultanan Melayu Melaka',4,2),
  ('SEJARAH','Kedatangan Kuasa Barat',4,3),
  ('SEJARAH','Perkembangan Nasionalisme',4,4),
  ('SEJARAH','Pendudukan Jepun di Tanah Melayu',4,5),
  ('SEJARAH','Malayan Union dan Persekutuan Tanah Melayu',5,6),
  ('SEJARAH','Kemerdekaan Negara',5,7),
  ('SEJARAH','Pembentukan Malaysia',5,8),
  ('SEJARAH','Sistem Pentadbiran dan Perlembagaan',5,9),
  ('SEJARAH','Dasar Luar Malaysia',5,10)
) as t(subject_code, name, form, ord) on t.subject_code = s.code
on conflict (subject_id, parent_topic_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Level thresholds (spec §18). Curve widens as it climbs so early levels come
-- quickly — the first session should produce visible progress — while Level 20
-- remains a genuine two-month goal.
-- ----------------------------------------------------------------------------
insert into level_thresholds (level, xp_required, title) values
  (1,      0, 'Newcomer'),      (2,    500, 'Starter'),
  (3,   1200, 'Learner'),       (4,   2200, 'Learner'),
  (5,   3500, 'Contender'),     (6,   5200, 'Contender'),
  (7,   7300, 'Challenger'),    (8,   9800, 'Challenger'),
  (9,  12800, 'Achiever'),      (10, 16300, 'Achiever'),
  (11, 20400, 'Specialist'),    (12, 25100, 'Specialist'),
  (13, 30500, 'Expert'),        (14, 36600, 'Expert'),
  (15, 43500, 'Master'),        (16, 51200, 'Master'),
  (17, 59800, 'Elite'),         (18, 69300, 'Elite'),
  (19, 79800, 'Champion'),      (20, 91300, 'Champion'),
  (21,103900, 'Legend'),        (22,117600, 'Legend'),
  (23,132500, 'Legend'),        (24,148600, 'Legend'),
  (25,166000, 'Legend')
on conflict (level) do update set
  xp_required = excluded.xp_required, title = excluded.title;


-- ##########################################################################
-- ##  0002_config.sql
-- ##########################################################################

-- ============================================================================
-- Seed 0002 · Configuration
-- ----------------------------------------------------------------------------
-- Every business rule the spec says must be configurable lives here as data.
-- None of these numbers appears in a component, a constant, or a formula in
-- application code. Changing any of them mid-season is an admin action.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Scoring (spec §12, §17)
-- ----------------------------------------------------------------------------
insert into scoring_rules (season_id, version, rules, is_active)
select s.id, 1, $json${
  "daily": {
    "base": 100,
    "wrong": 0,
    "completion_bonus": 50,
    "accuracy_floor": 1.0,
    "speed_bonus_weight": 0.0,
    "difficulty_mult": { "EASY": 1.0, "MEDIUM": 1.25, "HARD": 1.6 }
  },

  "speed": {
    "base": 60,
    "wrong": -15,
    "completion_bonus": 0,
    "round_seconds": 60,
    "speed_reference_ms": 12000,
    "speed_bonus_weight": 1.0,
    "min_response_ms": 400,
    "accuracy_floor": 0.5,
    "difficulty_mult": { "EASY": 1.0, "MEDIUM": 1.25, "HARD": 1.6 }
  },

  "mission": {
    "base": 100, "wrong": 0, "completion_bonus": 200,
    "accuracy_floor": 0.8, "speed_bonus_weight": 0.25,
    "speed_reference_ms": 20000,
    "difficulty_mult": { "EASY": 1.0, "MEDIUM": 1.25, "HARD": 1.6 }
  },

  "boss": {
    "base": 150, "wrong": -25, "completion_bonus": 500,
    "accuracy_floor": 0.6, "speed_bonus_weight": 0.5,
    "speed_reference_ms": 15000,
    "difficulty_mult": { "EASY": 1.0, "MEDIUM": 1.4, "HARD": 2.0 }
  },

  "xp": {
    "correct": 100,
    "wrong": 10,
    "session_complete": 150,
    "daily_all_subjects": 400,
    "streak_day": 50
  },

  "overall_weights": {
    "daily": 0.30, "speed": 0.20, "mission": 0.25, "boss": 0.25
  }
}$json$::jsonb, true
from seasons s where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id, version) do update set rules = excluded.rules;

-- Notes on the numbers above:
--
--  daily.accuracy_floor = 1.0 and speed_bonus_weight = 0.0
--    Daily Challenge is a fixed 10-question set, identical for everyone, with
--    no clock. It is a fairness board: rewarding speed there would punish the
--    student who reads carefully. Speed pays in Speedy, where it is the point.
--
--  speed.wrong = -15 alongside accuracy_floor = 0.5
--    Two independent brakes on volume-spamming. The penalty bites per question;
--    the floor scales the whole round. A student answering 100 at 40% accuracy
--    keeps 70% of an already-degraded total; one answering 30 at 95% keeps
--    97.5% of a clean one.
--
--  xp.wrong = 10
--    A wrong answer still earns XP because XP measures participation, not
--    ability. Zeroing it would push weak students to stop playing, which is the
--    opposite of what the campaign is for. Competition points, which are what
--    the leaderboard ranks, pay nothing for a wrong answer.

-- ----------------------------------------------------------------------------
-- Difficulty engine (spec §21–23)
-- ----------------------------------------------------------------------------
insert into difficulty_config (season_id, config)
select s.id, $json${
  "weights": {
    "incorrect": 0.45,
    "time": 0.25,
    "level": 0.20,
    "discrimination": 0.10
  },
  "threshold_early": 50,
  "threshold_stable": 200,
  "labels": { "easy_max": 33, "medium_max": 66 },
  "review": { "min_discrimination": 0.10 },
  "recalc_cron": "15 3 * * *"
}$json$::jsonb
from seasons s where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id) do update set config = excluded.config, updated_at = now();

-- ----------------------------------------------------------------------------
-- Adaptive selection (spec §24)
-- ----------------------------------------------------------------------------
insert into selection_profiles (season_id, profiles)
select s.id, $json${
  "bands": [
    { "key": "unseeded",   "min_attempts": 0,  "max_accuracy": null,
      "mix": { "EASY": 0.30, "MEDIUM": 0.50, "HARD": 0.20 } },
    { "key": "developing", "min_attempts": 10, "max_accuracy": 0.45,
      "mix": { "EASY": 0.50, "MEDIUM": 0.40, "HARD": 0.10 } },
    { "key": "steady",     "min_attempts": 10, "max_accuracy": 0.75,
      "mix": { "EASY": 0.20, "MEDIUM": 0.50, "HARD": 0.30 } },
    { "key": "strong",     "min_attempts": 10, "max_accuracy": 1.01,
      "mix": { "EASY": 0.10, "MEDIUM": 0.50, "HARD": 0.40 } }
  ],
  "rolling_window": 30,
  "repeat_cooldown_days": 14,
  "max_per_topic_ratio": 0.4,
  "calibration_slot_rate": 0.10
}$json$::jsonb
from seasons s where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id) do update set profiles = excluded.profiles, updated_at = now();

-- calibration_slot_rate = 0.10
--   One question in ten is drawn from the LOWEST sample-size pool rather than
--   the best-calibrated one. Without it, adaptive selection starves new
--   questions of the attempts they need to ever become calibrated, and the bank
--   permanently splits into a well-measured core and an unmeasured tail.

-- ----------------------------------------------------------------------------
-- Mode configuration
-- ----------------------------------------------------------------------------
insert into mode_configs (season_id, mode, config)
select s.id, m.mode, m.config::jsonb from seasons s
join (values
  ('DAILY', '{"questions_per_subject":10,"session_expiry_minutes":45,"one_run_per_day":true,"adaptive":false}'),
  ('SPEED', '{"round_seconds":60,"max_questions":60,"session_expiry_minutes":10,"unlimited_rounds":true,"adaptive":true}'),
  ('MISSION','{"session_expiry_minutes":60,"adaptive":false,"enabled":false}'),
  ('BOSS',  '{"session_expiry_minutes":45,"adaptive":false,"enabled":false}')
) as m(mode, config) on true
where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id, mode) do update set config = excluded.config, updated_at = now();

-- MISSION and BOSS carry enabled:false. Their tables, scoring weights and API
-- paths all exist; only the flag is off. Switching them on in October is a
-- config update, not a migration against live competition data.

-- ----------------------------------------------------------------------------
-- Awards (spec §16)
-- ----------------------------------------------------------------------------
insert into award_definitions (code, name, description, category, rules) values
  ('OVERALL_CHAMPION', 'EduPass Overall Champion',
   'Highest weighted score across all game modes.', 'OVERALL',
   '{"top_n":3}'),

  ('DAILY_CHAMPION', 'Daily Challenge Champion',
   'Highest accumulated Daily Challenge score for the season.', 'DAILY',
   '{"top_n":3}'),

  ('SPEED_CHAMPION', 'Speedy Challenge Champion',
   'Highest accumulated Speedy Challenge score for the season.', 'SPEED',
   '{"top_n":3}'),

  ('CONSISTENCY_CHAMPION', 'Consistency Champion',
   'Most consistent participation across the season.', 'CONSISTENCY',
   '{"top_n":3,"min_active_days":20,
     "weights":{"active_days":0.45,"daily_completion":0.35,"streak":0.20}}'),

  ('MOST_IMPROVED', 'Most Improved',
   'Largest genuine improvement between the first and second month.', 'IMPROVED',
   '{"top_n":3,"min_attempts_per_window":150,"min_active_days_per_window":10,
     "shrinkage_k":50}'),

  ('SCHOOL_CHAMPION', 'School Champion',
   'Highest mean score among schools meeting the participation minimum.', 'SCHOOL',
   '{"top_n":3,"min_participants":5}')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, rules = excluded.rules;

-- Per-subject champions, one award row per active subject.
insert into award_definitions (code, name, description, category, subject_id, rules)
select
  'SUBJECT_CHAMPION_' || s.code,
  s.name_en || ' Champion',
  'Highest ' || s.name_en || ' score for the season.',
  'SUBJECT', s.id, '{"top_n":3,"min_attempts":100}'::jsonb
from subjects s where s.is_active
on conflict (code) do update set name = excluded.name, rules = excluded.rules;


-- ##########################################################################
-- ##  0003_demo_questions.sql
-- ##########################################################################

-- ============================================================================
-- Seed 0003 · Demo question bank
-- ----------------------------------------------------------------------------
-- DELIBERATELY SMALL. Spec §46/§47: build the engine first, expand the bank
-- through the import tool later. This is 25 questions — five per subject — and
-- exists only so the game loop, scoring and difficulty engine are testable
-- end to end.
--
-- Every row is source_type = 'EDUPASS' and rights_cleared = true. NOTHING here
-- is presented as an official SPM paper. When real past-year or trial content
-- is imported it must carry its own source_type and its own rights_cleared
-- flag, which defaults to false.
--
-- difficulty_score here is ADMIN-assigned, as it must be for a cold bank. The
-- difficulty engine will blend its own estimate in from ~50 attempts onward.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Questions
-- ----------------------------------------------------------------------------
insert into questions (
  code, subject_id, topic_id, form, question_type, stem, explanation,
  difficulty_score, difficulty_label, difficulty_source,
  source_type, source_name, rights_cleared, status
)
select
  q.code, s.id, t.id, q.form, q.qtype, q.stem, q.explanation,
  q.score,
  case when q.score <= 33 then 'EASY' when q.score <= 66 then 'MEDIUM' else 'HARD' end,
  'ADMIN', 'EDUPASS', 'Demo / Practice', true, 'ACTIVE'
from (values
  -- ===================== MATHEMATICS =====================
  ('MATH-D0001','MATH','Quadratic Functions and Equations',4,'MCQ',
   'What are the roots of the quadratic equation x² − 5x + 6 = 0?',
   'Factorise: x² − 5x + 6 = (x − 2)(x − 3). Setting each factor to zero gives x = 2 and x = 3.',
   25),
  ('MATH-D0002','MATH','Number Bases',4,'MCQ',
   'Convert the binary number 1101₂ to base 10.',
   '1101₂ = 1(2³) + 1(2²) + 0(2¹) + 1(2⁰) = 8 + 4 + 0 + 1 = 13.',
   30),
  ('MATH-D0003','MATH','Measures of Dispersion',4,'MCQ',
   'The set of data is 4, 7, 7, 9, 13. What is the interquartile range?',
   'With 5 values, Q1 is the median of the lower half (4, 7) = 5.5 and Q3 is the median of the upper half (9, 13) = 11. IQR = 11 − 5.5 = 5.5.',
   62),
  ('MATH-D0004','MATH','Consumer Mathematics',4,'MCQ',
   'A shirt priced at RM80 is offered at a 15% discount. What is the selling price?',
   'Discount = 15% × RM80 = RM12. Selling price = RM80 − RM12 = RM68.',
   20),
  ('MATH-D0005','MATH','Matrices',5,'MCQ',
   'Given matrix A = (3 1; 2 4), what is the determinant of A?',
   'For a 2×2 matrix (a b; c d), the determinant is ad − bc = (3)(4) − (1)(2) = 12 − 2 = 10.',
   45),

  -- ===================== SCIENCE =====================
  ('SCI-D0001','SCIENCE','Electricity and Magnetism',4,'MCQ',
   'A resistor of 10 Ω carries a current of 2 A. What is the potential difference across it?',
   'By Ohm''s law, V = IR = 2 A × 10 Ω = 20 V.',
   28),
  ('SCI-D0002','SCIENCE','Heredity and Variation',4,'MCQ',
   'Which of the following best describes a gene?',
   'A gene is a segment of DNA that carries the instructions for a particular characteristic. Chromosomes are the structures that carry many genes.',
   35),
  ('SCI-D0003','SCIENCE','Light and Optics',4,'MCQ',
   'An object is placed 30 cm from a converging lens of focal length 10 cm. What is the image distance?',
   'Using 1/f = 1/u + 1/v: 1/10 = 1/30 + 1/v, so 1/v = 1/10 − 1/30 = 2/30, giving v = 15 cm.',
   72),
  ('SCI-D0004','SCIENCE','Carbon Compounds',5,'TRUE_FALSE',
   'Ethanol can be produced from glucose through the process of fermentation.',
   'True. Yeast converts glucose to ethanol and carbon dioxide in the absence of oxygen.',
   22),
  ('SCI-D0005','SCIENCE','Motion and Force',5,'MCQ',
   'A car accelerates uniformly from rest to 20 m/s in 5 s. What is its acceleration?',
   'a = (v − u)/t = (20 − 0)/5 = 4 m/s².',
   26),

  -- ===================== BAHASA MELAYU =====================
  ('BM-D0001','BM','Peribahasa dan Simpulan Bahasa',4,'MCQ',
   'Apakah maksud peribahasa "bagai aur dengan tebing"?',
   '"Bagai aur dengan tebing" bermaksud hubungan yang saling bantu-membantu dan bergantung antara satu sama lain.',
   30),
  ('BM-D0002','BM','Tatabahasa: Kata dan Frasa',4,'MCQ',
   'Pilih ayat yang menggunakan kata sendi nama dengan betul.',
   'Kata sendi "di" digunakan untuk tempat, manakala "pada" digunakan untuk masa, orang dan benda abstrak.',
   42),
  ('BM-D0003','BM','Kesalahan Bahasa',4,'MCQ',
   'Kenal pasti ayat yang mengandungi kesalahan penggunaan imbuhan.',
   'Imbuhan "meN-" berubah mengikut huruf pertama kata dasar. "Mensyukuri" adalah betul kerana kata dasar bermula dengan huruf "s" yang tidak digugurkan bagi kata pinjaman.',
   58),
  ('BM-D0004','BM','Tatabahasa: Ayat',4,'MCQ',
   'Ayat manakah yang merupakan ayat pasif?',
   'Ayat pasif menekankan objek yang menerima perbuatan, biasanya menggunakan imbuhan "di-" pada kata kerja.',
   38),
  ('BM-D0005','BM','Komsas: Puisi dan Sajak',5,'MCQ',
   'Dalam pantun, apakah fungsi dua baris pertama?',
   'Dua baris pertama dalam pantun empat kerat ialah pembayang maksud, yang membina rima dan gambaran sebelum maksud sebenar disampaikan pada dua baris terakhir.',
   32),

  -- ===================== ENGLISH =====================
  ('ENG-D0001','ENGLISH','Grammar: Subject-Verb Agreement',4,'MCQ',
   'Choose the sentence with correct subject-verb agreement.',
   'When a sentence begins with "Neither ... nor", the verb agrees with the subject nearest to it.',
   45),
  ('ENG-D0002','ENGLISH','Grammar: Tenses',4,'MCQ',
   'Select the correct form: "By the time we arrived, the film ___ already."',
   'The past perfect ("had started") is used for an action completed before another past action.',
   40),
  ('ENG-D0003','ENGLISH','Idioms and Phrasal Verbs',5,'MCQ',
   'What does the idiom "to bite the bullet" mean?',
   '"To bite the bullet" means to force yourself to endure a painful or unpleasant situation that is unavoidable.',
   35),
  ('ENG-D0004','ENGLISH','Prepositions and Connectors',4,'MCQ',
   'Choose the correct preposition: "She has been living ___ Kuala Lumpur since 2019."',
   '"In" is used with cities, countries and other enclosed or bounded areas.',
   18),
  ('ENG-D0005','ENGLISH','Reading Comprehension',4,'MCQ',
   'A writer states: "The proposal, though ambitious, rests on assumptions few would accept." What is the writer''s attitude towards the proposal?',
   'The concession "though ambitious" followed by a criticism of its assumptions signals scepticism rather than outright hostility or support.',
   68),

  -- ===================== SEJARAH =====================
  ('SEJ-D0001','SEJARAH','Kemerdekaan Negara',5,'MCQ',
   'Pada tarikh manakah Persekutuan Tanah Melayu mencapai kemerdekaan?',
   'Persekutuan Tanah Melayu mencapai kemerdekaan pada 31 Ogos 1957, diisytiharkan oleh Tunku Abdul Rahman di Stadium Merdeka.',
   15),
  ('SEJ-D0002','SEJARAH','Pembentukan Malaysia',5,'MCQ',
   'Negeri manakah yang menyertai pembentukan Malaysia pada 16 September 1963 tetapi keluar pada tahun 1965?',
   'Singapura menyertai Malaysia pada 16 September 1963 dan berpisah pada 9 Ogos 1965.',
   28),
  ('SEJ-D0003','SEJARAH','Malayan Union dan Persekutuan Tanah Melayu',5,'MCQ',
   'Apakah sebab utama penentangan orang Melayu terhadap Malayan Union?',
   'Penentangan berpunca daripada pengurangan kuasa Raja-Raja Melayu dan pemberian kerakyatan secara jus soli yang dianggap mengancam kedudukan orang Melayu.',
   55),
  ('SEJ-D0004','SEJARAH','Warisan Kesultanan Melayu Melaka',4,'MCQ',
   'Siapakah pengasas Kesultanan Melayu Melaka?',
   'Parameswara mengasaskan Melaka sekitar tahun 1400 selepas berundur dari Palembang dan Temasik.',
   20),
  ('SEJ-D0005','SEJARAH','Perkembangan Nasionalisme',4,'TRUE_FALSE',
   'Kesatuan Melayu Muda (KMM) ditubuhkan dengan matlamat mencapai kemerdekaan melalui kerjasama dengan British.',
   'Salah. KMM menentang penjajahan British dan bercita-cita menyatukan Tanah Melayu dengan Indonesia (Melayu Raya).',
   60)
) as q(code, subject_code, topic_name, form, qtype, stem, explanation, score)
join subjects s on s.code = q.subject_code
left join topics t on t.subject_id = s.id and t.name = q.topic_name
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Options
-- ----------------------------------------------------------------------------
insert into question_options (question_id, label, content, is_correct, sort_order)
select qq.id, o.label, o.content, o.correct, o.ord
from (values
  ('MATH-D0001','A','x = 2 and x = 3',   true, 1),
  ('MATH-D0001','B','x = −2 and x = −3', false,2),
  ('MATH-D0001','C','x = 1 and x = 6',   false,3),
  ('MATH-D0001','D','x = 5 and x = 6',   false,4),

  ('MATH-D0002','A','11', false,1),
  ('MATH-D0002','B','13', true, 2),
  ('MATH-D0002','C','14', false,3),
  ('MATH-D0002','D','15', false,4),

  ('MATH-D0003','A','4.0', false,1),
  ('MATH-D0003','B','5.5', true, 2),
  ('MATH-D0003','C','6.0', false,3),
  ('MATH-D0003','D','9.0', false,4),

  ('MATH-D0004','A','RM65', false,1),
  ('MATH-D0004','B','RM68', true, 2),
  ('MATH-D0004','C','RM70', false,3),
  ('MATH-D0004','D','RM72', false,4),

  ('MATH-D0005','A','10', true, 1),
  ('MATH-D0005','B','14', false,2),
  ('MATH-D0005','C','−10',false,3),
  ('MATH-D0005','D','6',  false,4),

  ('SCI-D0001','A','5 V',  false,1),
  ('SCI-D0001','B','12 V', false,2),
  ('SCI-D0001','C','20 V', true, 3),
  ('SCI-D0001','D','0.2 V',false,4),

  ('SCI-D0002','A','A structure made of protein that carries traits', false,1),
  ('SCI-D0002','B','A segment of DNA that codes for a characteristic', true, 2),
  ('SCI-D0002','C','A complete set of chromosomes in a cell',          false,3),
  ('SCI-D0002','D','A type of cell found only in reproductive organs', false,4),

  ('SCI-D0003','A','7.5 cm', false,1),
  ('SCI-D0003','B','15 cm',  true, 2),
  ('SCI-D0003','C','20 cm',  false,3),
  ('SCI-D0003','D','30 cm',  false,4),

  ('SCI-D0004','A','True',  true, 1),
  ('SCI-D0004','B','False', false,2),

  ('SCI-D0005','A','2 m/s²',   false,1),
  ('SCI-D0005','B','4 m/s²',   true, 2),
  ('SCI-D0005','C','5 m/s²',   false,3),
  ('SCI-D0005','D','100 m/s²', false,4),

  ('BM-D0001','A','Hubungan yang saling bantu-membantu',      true, 1),
  ('BM-D0001','B','Perselisihan yang berpanjangan',           false,2),
  ('BM-D0001','C','Perkara yang mustahil dilakukan',          false,3),
  ('BM-D0001','D','Seseorang yang tidak berpendirian tetap',  false,4),

  ('BM-D0002','A','Dia tinggal pada Kuala Lumpur.',           false,1),
  ('BM-D0002','B','Buku itu diletakkan di atas meja.',        true, 2),
  ('BM-D0002','C','Mereka bertemu di hari Isnin.',            false,3),
  ('BM-D0002','D','Surat itu dihantar di ayahnya.',           false,4),

  ('BM-D0003','A','Kami mensyukuri nikmat yang diterima.',    false,1),
  ('BM-D0003','B','Dia mempelajari bahasa Jepun.',            false,2),
  ('BM-D0003','C','Pelajar itu mentaati arahan guru.',        true, 3),
  ('BM-D0003','D','Kerajaan mengumumkan dasar baharu.',       false,4),

  ('BM-D0004','A','Ali membaca buku itu.',                    false,1),
  ('BM-D0004','B','Buku itu dibaca oleh Ali.',                true, 2),
  ('BM-D0004','C','Ali sedang membaca di perpustakaan.',      false,3),
  ('BM-D0004','D','Bacalah buku itu, Ali.',                   false,4),

  ('BM-D0005','A','Menyampaikan maksud sebenar',              false,1),
  ('BM-D0005','B','Membina pembayang maksud',                 true, 2),
  ('BM-D0005','C','Memberikan kesimpulan cerita',             false,3),
  ('BM-D0005','D','Menyatakan nama penulis',                  false,4),

  ('ENG-D0001','A','Neither the teacher nor the students was ready.',  false,1),
  ('ENG-D0001','B','Neither the students nor the teacher was ready.',  true, 2),
  ('ENG-D0001','C','Neither the students nor the teacher were ready.', false,3),
  ('ENG-D0001','D','Neither the teacher or the students were ready.',  false,4),

  ('ENG-D0002','A','has started',  false,1),
  ('ENG-D0002','B','started',      false,2),
  ('ENG-D0002','C','had started',  true, 3),
  ('ENG-D0002','D','was starting', false,4),

  ('ENG-D0003','A','To speak without thinking',                   false,1),
  ('ENG-D0003','B','To endure something painful but unavoidable', true, 2),
  ('ENG-D0003','C','To act with unnecessary aggression',          false,3),
  ('ENG-D0003','D','To make a costly mistake',                    false,4),

  ('ENG-D0004','A','at', false,1),
  ('ENG-D0004','B','on', false,2),
  ('ENG-D0004','C','in', true, 3),
  ('ENG-D0004','D','to', false,4),

  ('ENG-D0005','A','Enthusiastic support', false,1),
  ('ENG-D0005','B','Complete indifference',false,2),
  ('ENG-D0005','C','Reasoned scepticism',  true, 3),
  ('ENG-D0005','D','Open hostility',       false,4),

  ('SEJ-D0001','A','31 Ogos 1957',    true, 1),
  ('SEJ-D0001','B','16 September 1963',false,2),
  ('SEJ-D0001','C','31 Ogos 1963',    false,3),
  ('SEJ-D0001','D','1 Februari 1948', false,4),

  ('SEJ-D0002','A','Sarawak',   false,1),
  ('SEJ-D0002','B','Sabah',     false,2),
  ('SEJ-D0002','C','Singapura', true, 3),
  ('SEJ-D0002','D','Brunei',    false,4),

  ('SEJ-D0003','A','Kerana cukai yang terlalu tinggi dikenakan',            false,1),
  ('SEJ-D0003','B','Kerana kuasa Raja-Raja Melayu dikurangkan dan kerakyatan jus soli diperkenalkan', true, 2),
  ('SEJ-D0003','C','Kerana bahasa Inggeris dijadikan bahasa rasmi tunggal', false,3),
  ('SEJ-D0003','D','Kerana Tanah Melayu digabungkan dengan Indonesia',      false,4),

  ('SEJ-D0004','A','Sultan Mansur Shah', false,1),
  ('SEJ-D0004','B','Parameswara',        true, 2),
  ('SEJ-D0004','C','Tun Perak',          false,3),
  ('SEJ-D0004','D','Sultan Muzaffar Shah',false,4),

  ('SEJ-D0005','A','Benar', false,1),
  ('SEJ-D0005','B','Salah', true, 2)
) as o(qcode, label, content, correct, ord)
join questions qq on qq.code = o.qcode
on conflict (question_id, label) do nothing;

-- ----------------------------------------------------------------------------
-- Daily Challenges for the season
-- ----------------------------------------------------------------------------
-- Generates one challenge row per subject per day across the whole campaign,
-- so the mode is playable from 1 September without an admin having to create
-- anything by hand. Question sets are attached by the scheduler function below
-- as each day opens, which keeps the set unpredictable ahead of time.
insert into daily_challenges (season_id, subject_id, challenge_date, question_count, status)
select s.id, sub.id, d::date, 10, 'SCHEDULED'
from seasons s
cross join generate_series(s.starts_on, s.ends_on, interval '1 day') d
cross join subjects sub
where s.code = 'SPM_GAMES_2026_S1' and sub.is_active
on conflict (season_id, subject_id, challenge_date) do nothing;

-- ----------------------------------------------------------------------------
-- Daily Challenge question scheduler
-- ----------------------------------------------------------------------------
/**
 * Attaches a fixed, identical question set to every Daily Challenge opening on
 * the given date, then marks them OPEN.
 *
 * The set is deliberately NOT adaptive: a leaderboard built on differing
 * question sets is not a fair comparison, so every student in Malaysia sees
 * the same ten questions in the same order on the same day (spec §10).
 *
 * Run once per day, shortly after midnight MYT.
 */
create or replace function open_daily_challenges(p_date date default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_date  date := coalesce(p_date, my_today());
  v_row   record;
  v_count integer := 0;
begin
  for v_row in
    select dc.id, dc.subject_id, dc.question_count
    from daily_challenges dc
    where dc.challenge_date = v_date and dc.status = 'SCHEDULED'
  loop
    insert into daily_challenge_questions (daily_challenge_id, question_id, position)
    select v_row.id, q.id, row_number() over ()
    from (
      select id from questions
      where subject_id = v_row.subject_id and status = 'ACTIVE'
      -- A stable per-day shuffle: same set for everyone, different each day,
      -- and not guessable from the previous day's set.
      order by md5(id::text || v_date::text)
      limit v_row.question_count
    ) q
    on conflict do nothing;

    update daily_challenges set status = 'OPEN' where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;


-- ##########################################################################
-- ##  0004_prizes.sql
-- ##########################################################################

-- ============================================================================
-- Seed 0004 · Prizes
-- ----------------------------------------------------------------------------
-- PLACEHOLDER VALUES. These are structurally correct and visually complete so
-- the dashboard can be reviewed, but every title and amount here is a guess
-- and must be replaced before anything is published to students.
--
-- Advertising a prize you cannot honour is the fastest way to lose a school's
-- trust, so treat these as wireframe copy, not commitments.
-- ============================================================================

insert into award_prizes (season_id, award_id, rank, title, subtitle, value_myr, image_alt)
select s.id, a.id, p.rank, p.title, p.subtitle, p.value_myr, p.image_alt
from seasons s
-- The VALUES list has to come before the join that references p: SQL resolves
-- FROM entries left to right, so p is not in scope until it is listed.
cross join (values
  -- ---- Overall Champion: the headline prizes ---------------------------
  ('OVERALL_CHAMPION', 1, 'MacBook Air M3 13"',      'Plus RM3,000 EduPass scholarship credit', 7500.00, 'Laptop prize'),
  ('OVERALL_CHAMPION', 2, 'iPad Air + Apple Pencil', 'Plus RM1,500 EduPass credit',             4200.00, 'Tablet prize'),
  ('OVERALL_CHAMPION', 3, 'Samsung Galaxy Tab S9',   'Plus RM800 EduPass credit',               2600.00, 'Tablet prize'),

  -- ---- Daily Challenge --------------------------------------------------
  ('DAILY_CHAMPION', 1, 'RM2,000 cash',        'Plus a one-year EduPass Pro account', 2000.00, 'Cash prize'),
  ('DAILY_CHAMPION', 2, 'RM1,200 cash',        null,                                  1200.00, 'Cash prize'),
  ('DAILY_CHAMPION', 3, 'RM600 cash',          null,                                   600.00, 'Cash prize'),

  -- ---- Speedy Challenge -------------------------------------------------
  ('SPEED_CHAMPION', 1, 'RM2,000 cash',        'Plus a gaming headset',               2000.00, 'Cash prize'),
  ('SPEED_CHAMPION', 2, 'RM1,200 cash',        null,                                  1200.00, 'Cash prize'),
  ('SPEED_CHAMPION', 3, 'RM600 cash',          null,                                   600.00, 'Cash prize'),

  -- ---- Consistency ------------------------------------------------------
  ('CONSISTENCY_CHAMPION', 1, 'RM1,500 cash',  'For showing up, every single week',   1500.00, 'Cash prize'),
  ('CONSISTENCY_CHAMPION', 2, 'RM900 cash',    null,                                   900.00, 'Cash prize'),
  ('CONSISTENCY_CHAMPION', 3, 'RM500 cash',    null,                                   500.00, 'Cash prize'),

  -- ---- Most Improved ----------------------------------------------------
  ('MOST_IMPROVED', 1, 'RM1,500 cash',         'Plus a full SPM revision bundle',     1500.00, 'Cash prize'),
  ('MOST_IMPROVED', 2, 'RM900 cash',           null,                                   900.00, 'Cash prize'),
  ('MOST_IMPROVED', 3, 'RM500 cash',           null,                                   500.00, 'Cash prize'),

  -- ---- School Champion --------------------------------------------------
  ('SCHOOL_CHAMPION', 1, 'RM5,000 for the school', 'Plus a trophy and an EduPass workshop', 5000.00, 'School trophy'),
  ('SCHOOL_CHAMPION', 2, 'RM3,000 for the school', null,                                    3000.00, 'School trophy'),
  ('SCHOOL_CHAMPION', 3, 'RM1,500 for the school', null,                                    1500.00, 'School trophy')
) as p(award_code, rank, title, subtitle, value_myr, image_alt)
join award_definitions a on a.code = p.award_code
where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id, award_id, rank) do update set
  title = excluded.title, subtitle = excluded.subtitle,
  value_myr = excluded.value_myr, image_alt = excluded.image_alt;

-- ---- Subject Champions, one set per active subject ------------------------
insert into award_prizes (season_id, award_id, rank, title, subtitle, value_myr, image_alt)
select s.id, a.id, p.rank, p.title, p.subtitle, p.value_myr, 'Subject prize'
from seasons s
join subjects sub on sub.is_active
join award_definitions a on a.code = 'SUBJECT_CHAMPION_' || sub.code
join (values
  (1, 'RM1,000 cash', 'Plus a subject revision bundle', 1000.00),
  (2, 'RM600 cash',   null,                              600.00),
  (3, 'RM300 cash',   null,                              300.00)
) as p(rank, title, subtitle, value_myr) on true
where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id, award_id, rank) do update set
  title = excluded.title, subtitle = excluded.subtitle,
  value_myr = excluded.value_myr;

-- ---- Display order on the dashboard --------------------------------------
update award_definitions set sort_order = case code
  when 'OVERALL_CHAMPION'      then 1
  when 'DAILY_CHAMPION'        then 2
  when 'SPEED_CHAMPION'        then 3
  when 'SCHOOL_CHAMPION'       then 4
  when 'CONSISTENCY_CHAMPION'  then 5
  when 'MOST_IMPROVED'         then 6
  else 10 end;


-- ##########################################################################
-- ##  0005_flags.sql
-- ##########################################################################

-- ============================================================================
-- Seed 0005 · Feature flags
-- ----------------------------------------------------------------------------
-- Defaults are chosen for a site that is LIVE but mid-build: the two finished
-- modes are on, everything unfinished is off but still walkable by an admin.
--
-- `visible_to_admin` is what makes it possible to develop Missions and Boss
-- against production data without exposing half-built screens to students.
-- ============================================================================

insert into feature_flags (key, label, description, category, enabled, visible_to_admin, sort_order) values
  -- ---- Game modes --------------------------------------------------------
  ('mode.daily', 'Daily Challenge',
   'Ten questions per subject per day. Feeds the Daily leaderboard.',
   'MODE', true, true, 1),

  ('mode.speed', 'Speedy Challenge',
   'Sixty-second timed rounds, unlimited. Feeds the Speedy leaderboard.',
   'MODE', true, true, 2),

  ('mode.mission', 'Subject Missions',
   'Topic-by-topic progression. Under construction — admin preview only.',
   'MODE', false, true, 3),

  ('mode.boss', 'Weekly Boss Battle',
   'Weekly 20-question event with rising difficulty. Under construction — admin preview only.',
   'MODE', false, true, 4),

  -- ---- Competition surfaces ---------------------------------------------
  ('competition.registration', 'Student registration',
   'Allows new students to sign up and complete a profile.',
   'COMPETITION', true, true, 10),

  ('competition.leaderboard', 'Leaderboards',
   'Public ranking pages. Turn off to freeze rankings during an investigation.',
   'COMPETITION', true, true, 11),

  ('competition.prizes', 'Prize showcase',
   'Prize values on the dashboard and the prizes page. Keep off until sponsors are confirmed.',
   'COMPETITION', false, true, 12),

  ('competition.scoring', 'Live scoring',
   'Master switch. Off means students can play but nothing is recorded to leaderboards.',
   'COMPETITION', true, true, 13),

  -- ---- Sign-in methods ---------------------------------------------------
  -- Phone is the better guard against duplicate accounts, but every SMS costs
  -- money through an external provider. Off until that contract exists.
  ('auth.phone', 'Sign in by phone (SMS)',
   'Needs an SMS provider configured in Supabase. Each message is billed.',
   'COMPETITION', false, true, 5),

  ('auth.email', 'Sign in by email',
   'No external provider needed. Weaker duplicate-account guard than phone.',
   'COMPETITION', true, true, 6),

  -- ---- Content -----------------------------------------------------------
  ('content.explanations', 'Answer explanations',
   'Shows the explanation after a wrong answer.',
   'CONTENT', true, true, 20),

  ('content.study_areas', 'Study area suggestions',
   'The "you might enjoy exploring" panel on the dashboard.',
   'CONTENT', true, true, 21),

  ('content.behaviour_signals', 'Behaviour insights',
   'The "what we are learning about you" panel.',
   'CONTENT', true, true, 22)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  sort_order = excluded.sort_order;
-- NOTE: `enabled` is deliberately NOT overwritten on conflict. Re-running the
-- seed must never silently switch a feature back on after an admin turned it
-- off during an incident.
