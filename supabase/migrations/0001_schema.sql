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
