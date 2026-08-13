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
