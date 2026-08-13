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

  -- Off until custom SMTP is configured AND the email template carries
  -- {{ .Token }}. Supabase locks templates behind SMTP, so on a fresh project
  -- the email contains a link and no code — and a code field would be asking
  -- for something that never arrives.
  (''auth.email_code'', ''Six-digit code in email'',
   ''Requires custom SMTP and {{ .Token }} in the email template. Off means students sign in by clicking the link.'',
   ''COMPETITION'', false, true, 7),

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
