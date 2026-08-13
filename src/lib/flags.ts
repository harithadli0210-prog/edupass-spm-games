import { supabaseAdmin } from "@/lib/supabase/server";
import { PREVIEW, previewFlags } from "@/lib/preview";

/**
 * Feature flags.
 *
 * Two states per flag, not one:
 *
 *   enabled          — what students get
 *   visible_to_admin — whether an admin can still reach it while it is off
 *
 * That second field is the whole point. It lets Missions and Boss be built
 * against the live site, with live data, without students ever seeing a
 * half-finished screen. `isOn()` takes the viewer into account, so a single
 * call site serves both audiences.
 */

export interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  category: "MODE" | "CONTENT" | "COMPETITION" | "GENERAL";
  enabled: boolean;
  visible_to_admin: boolean;
  sort_order: number;
}

const TTL_MS = 15_000;
let cache: { value: FeatureFlag[]; at: number } | null = null;

/** Clears the flag cache. Called after every admin toggle. */
export function invalidateFlags() {
  cache = null;
}

export async function getFlags(): Promise<FeatureFlag[]> {
  if (PREVIEW) return previewFlags();

  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const { data, error } = await supabaseAdmin()
    .from("feature_flags")
    .select("key, label, description, category, enabled, visible_to_admin, sort_order")
    .order("sort_order");

  if (error) {
    // A flag lookup must never take the site down. Failing closed would hide
    // working features; failing open would expose unfinished ones. So we fall
    // back to the last known good set, and to an empty set only on cold start.
    console.error("feature flag load failed", error);
    return cache?.value ?? [];
  }

  cache = { value: (data ?? []) as FeatureFlag[], at: Date.now() };
  return cache.value;
}

export async function getFlagMap(): Promise<Record<string, FeatureFlag>> {
  const flags = await getFlags();
  return Object.fromEntries(flags.map((f) => [f.key, f]));
}

/**
 * Whether a viewer should see a feature.
 *
 * Unknown keys return false — a typo hides a feature rather than exposing an
 * unfinished one, which is the safer direction to fail in.
 */
export async function isOn(key: string, isAdmin = false): Promise<boolean> {
  const flags = await getFlagMap();
  const flag = flags[key];
  if (!flag) return false;
  if (flag.enabled) return true;
  return isAdmin && flag.visible_to_admin;
}

/** Resolves several flags in one pass, for pages that gate on a handful. */
export async function resolveFlags(
  keys: string[],
  isAdmin = false,
): Promise<Record<string, boolean>> {
  const flags = await getFlagMap();
  return Object.fromEntries(
    keys.map((key) => {
      const flag = flags[key];
      return [key, flag ? flag.enabled || (isAdmin && flag.visible_to_admin) : false];
    }),
  );
}

/** Mode key for the flag table, e.g. "DAILY" → "mode.daily". */
export function modeFlagKey(mode: string): string {
  return `mode.${mode.toLowerCase()}`;
}
