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
npm run db:migrate -- --seed   # create the schema and seed it
npm run db:check               # verify
npm run dev
```

### Scripts

| Command | Does |
|---|---|
| `npm run db:migrate -- --dry` | List the SQL files that would run |
| `npm run db:migrate` | Apply `supabase/migrations/` in order |
| `npm run db:migrate -- --seed` | Migrations, then `supabase/seed/` |
| `npm run db:check` | Connection, schema, seed and readiness report — never prints a key |
| `npm run questions:check` | Validate question batches without writing |
| `npm run questions:import` | Load them |
| `npm run typecheck` / `lint` | The usual |

`db:migrate` records what ran in a `_migrations` table, so re-running is safe.
Each file applies inside a transaction: a failure rolls that file back whole
rather than leaving the schema half-built. It needs `DATABASE_URL` in
`.env.local` — use the **Session pooler** string from Supabase, not the direct
`db.*.supabase.co` host, which is IPv6-only on most projects.

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
supabase/migrations/0001_schema.sql        tables, indexes, constraints, feature flags
supabase/migrations/0002_rls.sql           row level security
supabase/migrations/0003_leaderboards.sql  materialised views + read RPCs
supabase/migrations/0004_engines.sql       scoring writes + difficulty engine
supabase/migrations/0005_functions.sql     school matching, behaviour signals
supabase/migrations/0006_prizes.sql        award_prizes

supabase/seed/0001_reference.sql           season, states, districts, subjects, topics, levels
supabase/seed/0002_config.sql              scoring, difficulty, selection, modes, awards
supabase/seed/0003_demo_questions.sql      25 demo questions + daily challenge scheduler
supabase/seed/0004_prizes.sql              PLACEHOLDER prize values — replace before launch
supabase/seed/0005_flags.sql               feature switches
```

Then enable **Phone** auth in the Supabase dashboard and connect an SMS provider.
Supabase's test phone numbers work without a paid SMS provider while building.

### Scheduled jobs

Three jobs need to run. `pg_cron` is the simplest option:

```sql
-- Open the day's Daily Challenges, just after midnight MYT (16:05 UTC)
select cron.schedule('open-daily', '5 16 * * *', $$select open_daily_challenges()$$);

-- Fast boards: one row per student, cheap.
select cron.schedule('lb-fast', '*/5 * * * *', $$select refresh_leaderboards_fast()$$);

-- Most Improved aggregates the WHOLE attempts table. Nightly, never per-minute.
select cron.schedule('lb-slow', '40 18 * * *', $$select refresh_leaderboards_slow()$$);

-- Difficulty, behaviour signals, topic rollups.
select cron.schedule('difficulty', '15 19 * * *', $$select recompute_question_difficulty()$$);
select cron.schedule('signals',    '30 19 * * *', $$select recompute_behaviour_signals()$$);
select cron.schedule('topics',     '45 19 * * *', $$select recompute_topic_stats()$$);

-- Keep monthly attempt partitions ahead of the calendar.
select cron.schedule('partitions', '0 3 1 * *', $$select ensure_attempt_partitions(current_date, 6)$$);
```

Without `open-daily`, Daily Challenges stay `SCHEDULED` and nobody can play them.

---

## What is live, and what is not

| Mode | Status |
|---|---|
| Daily Challenge | Live |
| Speedy Challenge | Live |
| Subject Missions | Schema and scoring exist; flag `mode.mission` off |
| Weekly Boss | Schema and scoring exist; flag `mode.boss` off |

Availability lives in `feature_flags`, managed at **`/{lang}/admin/flags`**. Each
feature has two switches:

- **Live** — students see it
- **Admin** — you can still reach it while Live is off

Live off + Admin on is the working state for anything under construction: it
runs on the real site, against real data, and no student can see it. Turning
Missions or Boss on is a switch and a question set, never a migration against
live competition data.

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

Each session pins `game_sessions.scoring_rules_id` at start, so changing a
weight mid-season never retroactively rewrites a finished game. A foreign key
rather than a JSON copy: `scoring_rules` rows are versioned and never updated in
place, so the id is as immutable as a snapshot would be, at 16 bytes instead of
~800 across millions of rows.

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

### Bilingual by construction

Routes are `/{lang}/spm-games-2026/*`, mirroring edupass.my so the app slots in
behind a Cloudflare route with no basePath and no link rewriting. `[lang]` is the
root layout, so `<html lang>` reflects the page's actual language.

`src/lib/i18n/en.ts` defines the dictionary shape and `ms.ts` must satisfy it —
a missing Malay string is a build error, not an English word appearing mid
sentence. Subject names come from `subjects.name_en` / `name_ms`, so they
localise from the database rather than a hard-coded map.

### Storage shape

`question_attempts` is partitioned by month. It is the only table that reaches
tens of millions of rows, and partitioning makes end-of-season archival a
`DROP TABLE` rather than a delete across 20 million rows.

Indexes are kept deliberately few — at ~600 bytes a row, indexes cost more than
the data, so each one has to earn its place against a query that actually runs.
There is no analytics event per question: `question_attempts` already records
everything, and a parallel row would duplicate the largest table in the database
for no information gain.

---

## Outstanding before launch

- [ ] **Question bank.** 25 demo questions ship here. Daily + Speedy across five
      subjects needs 125 at an absolute minimum; 150+ per subject is where the
      difficulty engine behaves as designed. This is the critical path — see
      `content/questions/README.md`.
- [ ] **Prize values are invented.** Everything in `supabase/seed/0004_prizes.sql`
      is placeholder copy. Replace it, or switch `competition.prizes` off, before
      anyone sees the site.
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
