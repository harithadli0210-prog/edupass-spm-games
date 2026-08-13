import { supabaseAdmin } from "@/lib/supabase/server";
import { PREVIEW, PREVIEW_SUBJECTS } from "@/lib/preview";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export interface SubjectOption {
  code: string;
  name: string;
}

/**
 * The active subject list, in display order, named in the reader's language.
 *
 * `subjects` has carried name_en and name_ms since the first migration, so
 * localising here is a column choice rather than a schema change.
 *
 * Note "Bahasa Melayu" and "English" are the same in both dictionaries — they
 * are the names of the subjects, not words to be translated.
 */
export async function getSubjects(
  lang: Locale = DEFAULT_LOCALE,
): Promise<SubjectOption[]> {
  if (PREVIEW) {
    return PREVIEW_SUBJECTS.map((s) => ({
      code: s.code,
      name: lang === "ms" ? s.name_ms : s.name_en,
    }));
  }

  const { data } = await supabaseAdmin()
    .from("subjects")
    .select("code, name_en, name_ms")
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []).map((s) => ({
    code: s.code as string,
    name: (lang === "ms" ? s.name_ms : s.name_en) as string,
  }));
}
