# EduPass — SPM Games 2026

Season 1 runs **1 September – 31 October 2026**.

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase. The design tokens
are lifted from the existing EduPass marketing site so the game reads as part of
the same product, not a separate one.

---

## Setup

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project values
npm run dev
```

### Preview mode — no database needed

Set `SPM_PREVIEW=1` in `.env.local` and every screen is reachable without
Supabase:

```
SPM_PREVIEW=1
```

Auth is bypassed, all queries return fixtures from `src/lib/preview/`, and
gameplay runs in memory. The scoring is **not** faked — `src/lib/preview/engine.ts`
calls the real engine in `src/lib/engines/scoring.ts` with the same config the
seed installs, so the speed bonus, difficulty multiplier and accuracy gate all
behave exactly as they will in production. Only persistence is absent.

The flag is read in `currentStudent()`, the config loaders and the three query
modules, so no page or component contains a preview branch. Deleting
`src/lib/preview/` and the guarded blocks removes the feature entirely.

**Never set this in production** — it hands every visitor a signed-in session as
a fixture student.

### Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client. RLS applies. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS. Never import into a Client Component. |

### Database

Run in order against your Supabase project:

```
supabase/migrations/0001_schema.sql        tables, indexes, constraints
supabase/migrations/0002_rls.sql           row level security
supabase/migrations/0003_leaderboards.sql  materialised views + read RPCs
supabase/migrations/0004_engines.sql       scoring writes + difficulty engine
supabase/migrations/0005_functions.sql     school matching, behaviour signals

supabase/seed/0001_reference.sql           season, states, districts, subjects, topics, levels
supabase/seed/0002_config.sql              scoring, difficulty, selection, modes, awards
supabase/seed/0003_demo_questions.sql      25 demo questions + daily challenge scheduler
```

Then enable **Phone** auth in the Supabase dashboard and connect an SMS provider.

### Scheduled jobs

Three jobs need to run. `pg_cron` is the simplest option:

```sql
-- Open the day's Daily Challenges, just after midnight MYT (16:05 UTC)
select cron.schedule('open-daily', '5 16 * * *', $$select open_daily_challenges()$$);

-- Refresh every leaderboard
select cron.schedule('refresh-lb', '*/5 * * * *', $$select refresh_leaderboards()$$);

-- Recalculate question difficulty and behaviour signals, nightly
select cron.schedule('difficulty', '15 19 * * *', $$select recompute_question_difficulty()$$);
select cron.schedule('signals',    '30 19 * * *', $$select recompute_behaviour_signals()$$);
```

Without `open-daily`, Daily Challenges stay `SCHEDULED` and nobody can play them.

---

## What is live, and what is not

| Mode | Status |
|---|---|
| Daily Challenge | Live |
| Speedy Challenge | Live |
| Subject Missions | Schema and scoring exist; `mode_configs.enabled = false` |
| Weekly Boss | Schema and scoring exist; `mode_configs.enabled = false` |

Missions and Boss are switched on by flipping `enabled` in `mode_configs` and
populating their question sets. No migration is needed against live competition
data.

---

## Architecture notes

### Nothing the client sends is trusted

The browser receives question text and options. It does **not** receive
`is_correct`, does not compute points, and does not decide how long an answer
took.

`session_questions.served_at` is stamped by Postgres when a question is handed
over; `answered_at` when the answer arrives. Response time is the difference.
There is no INSERT or UPDATE policy for students on `question_attempts`,
`xp_transactions`, `game_sessions` or any stats table — those writes exist only
through the service role. `question_options` has RLS enabled and no student
policy at all, so `is_correct` returns zero rows to any client.

### Configuration is data

Nothing in `src/` hard-codes a business rule. Scoring weights, difficulty
thresholds, selection mixes, XP rates, level curves, round lengths and award
qualification gates all live in `scoring_rules`, `difficulty_config`,
`selection_profiles`, `level_thresholds`, `mode_configs` and
`award_definitions`. Config is cached in-process for 60 seconds.

Each session freezes the rules onto `game_sessions.config_snapshot` at start, so
changing a weight mid-season never retroactively rewrites a finished game.

### Overall score is an index, not a sum

Speedy is unlimited and Daily is capped at 50 questions a day, so raw Speedy
totals run an order of magnitude higher. Applying the 30/20/25/25 weights to raw
points would make the 20% weight dominate and the published weights would be
fiction.

`recompute_overall_points()` normalises each mode to a 0–1000 index against that
mode's 99th-percentile scorer for the season, then applies the weights. The
percentile is recomputed on every refresh, so the weights hold on day one and on
31 October.

### The accuracy gate

Per-question points alone reward volume. At round close the whole total is
scaled:

```
factor = accuracy_floor + (1 − accuracy_floor) × accuracy
```

With Speedy's floor of 0.5, 100 questions at 40% accuracy keeps 70% of a total
already reduced by 60 wrong answers at −15 each; 30 questions at 95% keeps
97.5% of a clean one. Daily's floor is 1.0, which disables the gate — it is a
fixed ten-question set with no clock, so there is no volume to game.

### Difficulty is measured, not guessed

`recompute_question_difficulty()` is deterministic statistics over real attempt
data. Four components — incorrect rate (0.45), median response time as a z-score
within subject (0.25), top-quartile accuracy (0.20) and classical discrimination
(0.10).

The computed score is *blended* into the admin's rather than switching at a
threshold, so live scoring is never jolted mid-competition:

```
w = clamp(0, 1, (attempts − 50) / 150)
score = admin × (1 − w) + computed × w
```

Confidence is not just sample size: when the four components disagree, the
estimate is discounted even at large n and the question is flagged for review.

**Cold start is real.** On 1 September every question has zero attempts and
every difficulty value is the admin's. The engine produces nothing meaningful
for roughly the first fortnight, which is why authoring-time difficulty
assignment matters.

### Calibration slots

One question in ten (`selection_profiles.calibration_slot_rate`) is drawn from
the *lowest* sample-size pool. Without this, adaptive selection starves new
questions of attempts and the bank splits permanently into a measured core and
an unmeasured tail.

### Privacy is structural

`students` holds the display name; `student_profiles` holds phone, email and
postcode. Leaderboards join `students` only — `student_profiles` is not in any
board's query graph, so a leaderboard query *cannot* leak a phone number.

---

## Outstanding before launch

- [ ] **Question bank.** 25 demo questions ship here. Daily + Speedy across five
      subjects needs 125 at an absolute minimum; 250+ is comfortable. This is
      the critical path.
- [ ] **Privacy notice.** The consent checkbox is wired; the notice it refers to
      does not exist yet. Participants are minors.
- [ ] **MOE school registry.** Seeding it moves most students onto an exact
      match and keeps the `/admin/schools` merge queue small.
- [ ] **Full district list.** Currently abridged to main districts per state.
- [ ] **Rate limiting.** `src/lib/rate-limit.ts` is in-process and does not
      coordinate across instances. Move to Postgres or Upstash before real
      traffic.
- [ ] **Admin screens.** The API and schema support them; the UI is not built.
- [ ] **Marketing page fixes.** `spmgames.html` still says "24 Ogos 2026" and
      shows a fake 62% progress bar; its CTA points at a dead `#notify` anchor.
