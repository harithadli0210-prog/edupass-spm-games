import { supabaseAdmin } from "@/lib/supabase/server";
import {
  PREVIEW,
  PREVIEW_MODE_CONFIG,
  PREVIEW_SCORING,
  PREVIEW_SCORING_RULES_ID,
  PREVIEW_SEASON,
} from "@/lib/preview";
import { isOn, modeFlagKey } from "@/lib/flags";
import type { GameMode, Season } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Shapes of the JSON stored in the config tables                             */
/* -------------------------------------------------------------------------- */

export interface ModeScoring {
  base: number;
  wrong: number;
  completion_bonus: number;
  accuracy_floor: number;
  speed_bonus_weight: number;
  speed_reference_ms?: number;
  round_seconds?: number;
  min_response_ms?: number;
  difficulty_mult: Record<string, number>;
}

export interface ScoringRules {
  daily: ModeScoring;
  speed: ModeScoring;
  mission: ModeScoring;
  boss: ModeScoring;
  xp: {
    correct: number;
    wrong: number;
    session_complete: number;
    daily_all_subjects: number;
    streak_day: number;
  };
  overall_weights: Record<string, number>;
}

export interface SelectionBand {
  key: string;
  min_attempts: number;
  max_accuracy: number | null;
  mix: Record<string, number>;
}

export interface SelectionProfiles {
  bands: SelectionBand[];
  rolling_window: number;
  repeat_cooldown_days: number;
  max_per_topic_ratio: number;
  calibration_slot_rate: number;
}

export interface ModeConfig {
  questions_per_subject?: number;
  round_seconds?: number;
  max_questions?: number;
  session_expiry_minutes: number;
  one_run_per_day?: boolean;
  unlimited_rounds?: boolean;
  adaptive: boolean;
  enabled?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Loader                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Configuration is read from the database, never from constants in code.
 *
 * Cached in-process for a minute: gameplay reads this on every question, and
 * hitting Postgres for the scoring table on each answer would add a round trip
 * to the hottest path in the product. A minute is short enough that an admin
 * changing a weight sees it take effect while they are still watching.
 */
const TTL_MS = 60_000;

interface Cached<T> {
  value: T;
  at: number;
}
const cache = new Map<string, Cached<unknown>>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Cached<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await load();
  cache.set(key, { value, at: Date.now() });
  return value;
}

/** Clears the config cache. Call after an admin write. */
export function invalidateConfig() {
  cache.clear();
}

export async function getActiveSeason(): Promise<Season> {
  if (PREVIEW) return PREVIEW_SEASON;
  return cached("season", async () => {
    const { data, error } = await supabaseAdmin()
      .from("seasons")
      .select("*")
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(
        "No ACTIVE season. Seed one before the campaign opens — every score, " +
          "leaderboard and award is scoped by season_id.",
      );
    }
    return data as Season;
  });
}

export async function getScoringRules(seasonId: string): Promise<ScoringRules> {
  return (await getActiveScoringRules(seasonId)).rules;
}

/** The active rule set together with its id, which sessions pin themselves to. */
export async function getActiveScoringRules(
  seasonId: string,
): Promise<{ id: string; rules: ScoringRules }> {
  if (PREVIEW) return { id: PREVIEW_SCORING_RULES_ID, rules: PREVIEW_SCORING };
  return cached(`scoring:${seasonId}`, async () => {
    const { data, error } = await supabaseAdmin()
      .from("scoring_rules")
      .select("id, rules")
      .eq("season_id", seasonId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No active scoring_rules for season ${seasonId}`);
    return { id: data.id as string, rules: data.rules as ScoringRules };
  });
}

/**
 * The exact rule set a session was started under.
 *
 * Cached by id rather than by season, because superseded versions are still
 * needed to finish sessions that began before an admin published a change.
 */
export async function getScoringRulesById(id: string): Promise<ScoringRules> {
  if (PREVIEW) return PREVIEW_SCORING;
  return cached(`scoring-id:${id}`, async () => {
    const { data, error } = await supabaseAdmin()
      .from("scoring_rules")
      .select("rules")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Unknown scoring_rules ${id}`);
    return data.rules as ScoringRules;
  });
}

export async function getSelectionProfiles(
  seasonId: string,
): Promise<SelectionProfiles> {
  return cached(`selection:${seasonId}`, async () => {
    const { data, error } = await supabaseAdmin()
      .from("selection_profiles")
      .select("profiles")
      .eq("season_id", seasonId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No selection_profiles for season ${seasonId}`);
    return data.profiles as SelectionProfiles;
  });
}

/**
 * Mode settings, with availability resolved from the feature flag.
 *
 * Availability lives in `feature_flags`, never in `mode_configs.enabled` —
 * two switches for one decision is how a mode ends up half-on. mode_configs
 * carries the numbers (round length, question count); the flag carries the
 * on/off. An admin passing `isAdmin` gets modes that are off for students,
 * which is what makes building Missions and Boss on the live site possible.
 */
export async function getModeConfig(
  seasonId: string,
  mode: GameMode,
  isAdmin = false,
): Promise<ModeConfig> {
  const enabled = await isOn(modeFlagKey(mode), isAdmin);

  if (PREVIEW) {
    return { ...(PREVIEW_MODE_CONFIG[mode] as ModeConfig), enabled };
  }

  const base = await cached(`mode:${seasonId}:${mode}`, async () => {
    const { data, error } = await supabaseAdmin()
      .from("mode_configs")
      .select("config")
      .eq("season_id", seasonId)
      .eq("mode", mode)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No mode_config for ${mode}`);
    return data.config as ModeConfig;
  });

  return { ...base, enabled };
}

/** Everything a session needs, resolved in one place and pinned onto it. */
export async function getSessionConfig(mode: GameMode, isAdmin = false) {
  const season = await getActiveSeason();
  const [scoringRules, modeConfig, selection] = await Promise.all([
    getActiveScoringRules(season.id),
    getModeConfig(season.id, mode, isAdmin),
    getSelectionProfiles(season.id),
  ]);
  return {
    season,
    scoring: scoringRules.rules,
    scoringRulesId: scoringRules.id,
    modeConfig,
    selection,
  };
}
