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
