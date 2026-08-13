# Going live

Order matters. Each step assumes the one before it worked.

---

## 1. Supabase project

Create a project, then run the SQL in this exact order (SQL Editor, or
`supabase db push` if you adopt the CLI):

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_leaderboards.sql
supabase/migrations/0004_engines.sql
supabase/migrations/0005_functions.sql
supabase/migrations/0006_prizes.sql

supabase/seed/0001_reference.sql
supabase/seed/0002_config.sql
supabase/seed/0003_demo_questions.sql
supabase/seed/0004_prizes.sql
supabase/seed/0005_flags.sql
```

`0001` will not run before `scoring_rules` exists in the same file — it is
self-ordering, but the files themselves are not. Do not skip or reorder.

### Auth

Dashboard → Authentication → Providers → **Phone**. Connect an SMS provider.

For testing before you pay for SMS, add **test phone numbers** with fixed OTPs
under the same screen. Those sign in without sending a message.

### Make yourself an admin

After signing in once so your row exists:

```sql
update students set is_admin = true where id = '<your-auth-user-id>';
```

Everything under `/admin` returns 404 to non-admins, so do this before you go
looking for the switchboard.

---

## 2. Scheduled jobs

Enable `pg_cron`, then:

```sql
-- Open each day's Daily Challenges. Without this nobody can play Daily.
select cron.schedule('open-daily', '5 16 * * *',
  $$select open_daily_challenges()$$);

-- Fast leaderboards: reads one row per student.
select cron.schedule('lb-fast', '*/5 * * * *',
  $$select refresh_leaderboards_fast()$$);

-- Most Improved aggregates the whole attempts table. Nightly, never per-minute.
select cron.schedule('lb-slow', '40 18 * * *',
  $$select refresh_leaderboards_slow()$$);

-- Difficulty, behaviour signals, topic rollups.
select cron.schedule('difficulty', '15 19 * * *',
  $$select recompute_question_difficulty()$$);
select cron.schedule('signals', '30 19 * * *',
  $$select recompute_behaviour_signals()$$);
select cron.schedule('topics', '45 19 * * *',
  $$select recompute_topic_stats()$$);

-- Keep attempt partitions ahead of the calendar.
select cron.schedule('partitions', '0 3 1 * *',
  $$select ensure_attempt_partitions(current_date, 6)$$);
```

Times are UTC. `5 16 * * *` is 00:05 in Malaysia.

Run `select refresh_leaderboards();` once by hand after seeding, or every board
is empty until the first cron tick.

---

## 3. Questions

The bank ships with 25 demo questions. That is enough to test the loop and not
enough to run a campaign — see `content/questions/README.md`.

```bash
npm run questions:check      # validate
npm run questions:import     # load
```

---

## 4. Email delivery

Sign-in is by email, so delivery is not a nice-to-have — if it fails, nobody
can log in.

### While building

Supabase's built-in email is rate limited to a few messages an hour and its
templates are locked. Connecting any SMTP provider unlocks both. Resend is the
least friction: sign up, create an API key, then fill in Supabase under
**Project Settings → Authentication → SMTP Settings**:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `re_...` API key |
| Sender | `onboarding@resend.dev` |

With that sender you can only email the address you registered with — enough to
test, not to launch.

Once SMTP is live, edit the **Confirm signup** and **Magic Link** templates to
include `{{ .Token }}`, then switch on `auth.email_code` in `/admin/flags`. The
six-digit code field returns with no deploy.

### Before launch

Verify a domain in Resend and change the Sender field. Nothing in the codebase
changes.

**Send from a subdomain**, e.g. `spmgames@send.edupass.my`. If sending
reputation is ever damaged it does not follow the main domain, so mail to
schools and sponsors keeps arriving.

Add the SPF, DKIM and DMARC records Resend provides to Cloudflare DNS. All
three are required, not advisable: since 2024 Gmail spam-files or rejects bulk
senders without them, and most students use Gmail. Fifty thousand sign-in
emails landing in spam is the campaign stalling on day one.

Allow one to two weeks — DNS takes time to propagate, and you want real test
sends before students arrive.

### Volume

About one email per student to sign in, plus re-logins. At 50,000 students the
free tier is far short; budget a paid tier. Still an order of magnitude cheaper
than SMS.

---

## 5. Deploy

Vercel is the path of least resistance for Next 16.

**Environment variables:**

| Variable | Scope |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** |

**`SPM_PREVIEW` must not be set in production.** It bypasses authentication and
hands every visitor an admin session. Set it only in local `.env.local`.

### Serving under the existing domain

The static marketing site and this app are separate deployments. To keep one
domain, put a rewrite in front so `/spm-games/*` reaches the Next app and
everything else reaches the static site. Otherwise the navbar exists in two
codebases and will drift.

---

## 6. Before students arrive

- [ ] **Prizes are placeholders.** Every value in `0004_prizes.sql` is invented.
      Replace them, or turn `competition.prizes` off in the switchboard, before
      anyone sees the site. Advertising a prize you cannot honour is the fastest
      way to lose a school.
- [ ] **Privacy notice.** The consent checkbox points at a document that does
      not exist yet. Participants are minors.
- [ ] **Question bank** at 150+ per subject.
- [ ] **Rights cleared** on anything from a commercial source.
- [ ] **MOE school registry** seeded, so most students hit an exact match and
      the merge queue stays small.
- [ ] **Rate limiting** moved off in-process (`src/lib/rate-limit.ts`) to
      Postgres or Upstash — it does not coordinate across instances.
- [ ] **Load test.** Simulate ~10k concurrent answering and watch p95.
- [ ] Compute tier scaled up for the campaign, and scheduled back down on
      1 November. This is a 61-day event; do not provision it annually.

---

## 7. The switchboard

`/admin/flags`. Two switches per feature:

- **Live** — students see it
- **Admin** — you can still reach it while Live is off

Live off + Admin on is the working state for anything under construction. That
is how Subject Missions and Weekly Boss are configured now: they run on the real
site, against real data, and no student can see them.

Flags cache for 15 seconds, so a change is visible almost immediately.

Useful during an incident: `competition.scoring` off lets students keep playing
while nothing is written to leaderboards.

---

## 8. After 31 October

1. Keep `question_difficulty_stats`, `student_season_stats`,
   `student_subject_stats` — small, and the basis of every EduPass
   recommendation later.
2. Export `question_attempts` partitions to cold storage.
3. `drop table question_attempts_202609, question_attempts_202610;`

Partitioning is why step 3 is instant rather than a multi-million-row delete.
