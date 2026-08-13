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
