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
