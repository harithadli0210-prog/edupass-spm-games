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
