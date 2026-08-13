import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/config";
import { PREVIEW, PREVIEW_PRIZES } from "@/lib/preview";

export interface Prize {
  rank: number;
  title: string;
  subtitle: string | null;
  value_myr: number | null;
  image_url: string | null;
  image_alt: string | null;
  sponsor_name: string | null;
}

export interface PrizeCategory {
  code: string;
  name: string;
  description: string | null;
  category: string;
  subject_code: string | null;
  prizes: Prize[];
}

/** Prize categories in display order, each with its placings. */
export async function getPrizes(): Promise<PrizeCategory[]> {
  if (PREVIEW) return PREVIEW_PRIZES;

  const season = await getActiveSeason();
  const db = supabaseAdmin();

  const { data } = await db
    .from("award_definitions")
    .select(
      `code, name, description, category, sort_order,
       subjects ( code ),
       award_prizes ( rank, title, subtitle, value_myr, image_url, image_alt, sponsor_name, season_id )`,
    )
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? [])
    .map((row) => ({
      code: row.code as string,
      name: row.name as string,
      description: row.description as string | null,
      category: row.category as string,
      subject_code:
        (row.subjects as unknown as { code: string } | null)?.code ?? null,
      prizes: ((row.award_prizes ?? []) as (Prize & { season_id: string })[])
        .filter((p) => p.season_id === season.id)
        .sort((a, b) => a.rank - b.rank),
    }))
    .filter((c) => c.prizes.length > 0);
}

/** Total advertised value across every prize in the season. */
export async function getPrizePool(): Promise<number> {
  const categories = await getPrizes();
  return categories.reduce(
    (sum, c) => sum + c.prizes.reduce((s, p) => s + (p.value_myr ?? 0), 0),
    0,
  );
}
