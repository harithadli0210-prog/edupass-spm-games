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
