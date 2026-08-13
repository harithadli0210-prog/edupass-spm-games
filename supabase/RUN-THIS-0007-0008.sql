-- ============================================================================
-- JALANKAN INI DALAM SUPABASE SQL EDITOR
--
-- Dua migration baharu:
--   0007  pengesahan telefon (WhatsApp OTP)
--   0008  polisi pertandingan
--
-- Selamat dijalankan berulang kali.
-- ============================================================================
-- ============================================================================
-- EduPass Â· SPM Games â€” 0007 Â· Phone verification
-- ----------------------------------------------------------------------------
-- Sign-in and phone verification are deliberately separate concerns.
--
-- Students sign in with email, which costs nothing and works today. The phone
-- number on their profile is what stops one person entering several times, but
-- verifying it is only worth doing for students who are actually in contention
-- for a prize â€” the top few hundred, not all fifty thousand.
--
-- Verifying lazily turns a five-figure SMS/WhatsApp bill into a trivial one,
-- and it keeps the sign-up flow free of a step that would lose students at the
-- door.
--
-- This migration only prepares the ground. The delivery channel (WhatsApp via
-- Meta Cloud API, SMS via a provider, or a manual admin check) is a later
-- decision, and nothing here commits to one.
-- ============================================================================

alter table student_profiles
  add column if not exists phone_verified     boolean not null default false,
  add column if not exists phone_verified_at  timestamptz,
  add column if not exists phone_verify_channel text
    check (phone_verify_channel in ('WHATSAPP','SMS','MANUAL'));

-- Finding who still needs verifying, cheaply.
create index if not exists student_profiles_unverified
  on student_profiles (phone_verified)
  where phone_verified = false;

-- ----------------------------------------------------------------------------
-- One-time codes.
--
-- Only the hash is stored: a leaked table should not hand out live codes. The
-- attempt counter is what stops a six-digit code being brute-forced, which is
-- otherwise a few thousand requests.
-- ----------------------------------------------------------------------------
create table if not exists phone_verifications (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  phone_e164   text not null,
  code_hash    text not null,
  channel      text not null default 'WHATSAPP'
               check (channel in ('WHATSAPP','SMS')),
  attempts     smallint not null default 0,
  max_attempts smallint not null default 5,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists phone_verifications_student
  on phone_verifications (student_id, created_at desc);

alter table phone_verifications enable row level security;

-- No student policy at all: codes are issued and checked by the server. A
-- client that could read this table could read its own code, which defeats the
-- point of sending it to a device.
drop policy if exists admin_phone_verifications on phone_verifications;
create policy admin_phone_verifications on phone_verifications
  for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- Who is worth verifying right now.
--
-- Ranked students whose phone is still unverified. Feed this to whichever
-- channel is chosen, in rank order, and stop when the prize positions are
-- covered.
-- ----------------------------------------------------------------------------
create or replace function students_pending_verification(
  p_top_n int default 500,
  p_season_id uuid default null
)
returns table (student_id uuid, display_name text, phone_e164 text, rank bigint)
language sql stable security definer set search_path = public, lb as $$
  select o.student_id, o.display_name, p.phone_e164, o.rank::bigint
  from lb.overall o
  join student_profiles p on p.student_id = o.student_id
  where o.season_id = coalesce(p_season_id, current_season_id())
    and o.rank <= p_top_n
    and p.phone_verified = false
  order by o.rank;
$$;


-- ============================================================================
-- EduPass Â· SPM Games â€” 0008 Â· Competition policy
-- ----------------------------------------------------------------------------
-- The rules a student can be held to must be (a) published, and (b) the same
-- numbers the code actually enforces. Keeping them in one config row is what
-- stops the page saying "7 days" while the job runs on 14.
--
-- Every value here appears verbatim on the public rules page.
-- ============================================================================

create table if not exists competition_policy (
  season_id   uuid primary key references seasons(id) on delete cascade,
  policy      jsonb not null,
  version     integer not null default 1,
  -- Rules can change mid-season, but students must be told. This is the date
  -- shown at the top of the published page.
  effective_from date not null default current_date,
  updated_at  timestamptz not null default now()
);

drop trigger if exists competition_policy_updated on competition_policy;
create trigger competition_policy_updated before update on competition_policy
  for each row execute function set_updated_at();

alter table competition_policy enable row level security;

-- Public: these are the terms people are entering under.
drop policy if exists read_policy on competition_policy;
create policy read_policy on competition_policy for select using (true);

drop policy if exists admin_policy on competition_policy;
create policy admin_policy on competition_policy
  for all using (is_admin()) with check (is_admin());

insert into competition_policy (season_id, policy)
select s.id, $json${
  "eligibility": {
    "min_age": 13,
    "guardian_consent_below": 18,
    "residency": "Malaysia",
    "entry_fee_myr": 0
  },

  "accounts": {
    "max_per_person": 1,
    "identified_by": "phone_number",
    "duplicate_rule": "EARLIEST_REGISTRATION_KEPT",
    "duplicate_rule_note": "Where two accounts verify the same phone number, the account registered first is kept and the later one is removed from prize eligibility."
  },

  "verification": {
    "required_for_prizes": true,
    "channel": "WHATSAPP",
    "triggered_at_rank": 500,
    "response_window_days": 7,
    "code_length": 6,
    "code_expiry_minutes": 10,
    "max_attempts": 5,
    "unverified_consequence": "Play and appear on leaderboards continues; prize eligibility is suspended until verified."
  },

  "fair_play": {
    "prohibited": [
      "Using more than one account",
      "Automated tools, scripts or bots",
      "Sharing an account with another person",
      "Sharing answers during a live Daily Challenge",
      "Interfering with the service or other participants"
    ],
    "review_before_action": true,
    "appeal_window_days": 7
  },

  "prizes": {
    "substitution_allowed": true,
    "claim_window_days": 30,
    "transferable": false,
    "taxes_borne_by": "recipient",
    "school_prizes_paid_to": "school"
  },

  "results": {
    "final_at": "2026-10-31T23:59:59+08:00",
    "verification_period_days": 14,
    "tie_break": ["higher_accuracy", "fewer_total_attempts", "earlier_registration"]
  },

  "data": {
    "public_fields": ["display_name", "school", "state"],
    "never_public": ["full_name", "phone", "email", "postcode"],
    "retention_months": 24,
    "controller": "EduPass",
    "contact": "spmgames@edupass.my"
  }
}$json$::jsonb
from seasons s
where s.code = 'SPM_GAMES_2026_S1'
on conflict (season_id) do update set
  policy = excluded.policy, updated_at = now();

