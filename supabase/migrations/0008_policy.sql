-- ============================================================================
-- EduPass · SPM Games — 0008 · Competition policy
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
