import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/config";
import { PREVIEW } from "@/lib/preview";
import { privacyEn, rulesEn, type PolicyDoc } from "@/content/policy.en";
import { privacyMs, rulesMs } from "@/content/policy.ms";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const DOCS: Record<"rules" | "privacy", Record<Locale, PolicyDoc>> = {
  rules: { en: rulesEn, ms: rulesMs },
  privacy: { en: privacyEn, ms: privacyMs },
};

/**
 * A policy document plus the date it took effect.
 *
 * The prose lives in src/content and the numbers live in competition_policy,
 * so a rule change is a config edit and a copy edit rather than a deploy. The
 * effective date comes from the database precisely so that "these rules changed
 * on X" is a fact about the record, not a hard-coded string someone forgets to
 * update.
 */
export async function getPolicyDoc(
  kind: "rules" | "privacy",
  lang: Locale = DEFAULT_LOCALE,
): Promise<{ doc: PolicyDoc; effectiveFrom: string }> {
  const doc = DOCS[kind][lang] ?? DOCS[kind][DEFAULT_LOCALE];
  const fallback = "1 September 2026";

  if (PREVIEW) return { doc, effectiveFrom: fallback };

  try {
    const season = await getActiveSeason();
    const { data } = await supabaseAdmin()
      .from("competition_policy")
      .select("effective_from")
      .eq("season_id", season.id)
      .maybeSingle();

    if (!data?.effective_from) return { doc, effectiveFrom: fallback };

    return {
      doc,
      effectiveFrom: new Date(`${data.effective_from}T00:00:00+08:00`)
        .toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
    };
  } catch {
    // The rules must render even if the config table has not been migrated yet.
    return { doc, effectiveFrom: fallback };
  }
}
