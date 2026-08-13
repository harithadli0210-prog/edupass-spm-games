-- ============================================================================
-- EduPass · SPM Games — 0007 · Phone verification
-- ----------------------------------------------------------------------------
-- Sign-in and phone verification are deliberately separate concerns.
--
-- Students sign in with email, which costs nothing and works today. The phone
-- number on their profile is what stops one person entering several times, but
-- verifying it is only worth doing for students who are actually in contention
-- for a prize — the top few hundred, not all fifty thousand.
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
