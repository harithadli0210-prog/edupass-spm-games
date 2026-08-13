import { supabaseAdmin } from "@/lib/supabase/server";
import { PREVIEW, PREVIEW_SUBJECTS } from "@/lib/preview";

export interface SubjectOption {
  code: string;
  name_en: string;
}

/** The active subject list, in display order. */
export async function getSubjects(): Promise<SubjectOption[]> {
  if (PREVIEW) return PREVIEW_SUBJECTS;

  const { data } = await supabaseAdmin()
    .from("subjects")
    .select("code, name_en")
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []) as SubjectOption[];
}
