import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/config";
import { PREVIEW, PREVIEW_SUBJECT_STATS, PREVIEW_TREND } from "@/lib/preview";

export interface TrendPoint {
  date: string;
  attempts: number;
  accuracy: number;
  avg_response_ms: number;
}

export interface DifficultyBreakdown {
  label: "EASY" | "MEDIUM" | "HARD";
  attempts: number;
  accuracy: number;
}

/**
 * Performance page data.
 *
 * Trend is bucketed by Malaysian calendar date, not by UTC — a student playing
 * at 1am MYT is on today's line, not yesterday's.
 */
export async function getPerformance(studentId: string, subjectCode?: string) {
  if (PREVIEW) return previewPerformance(subjectCode);

  const season = await getActiveSeason();
  const db = supabaseAdmin();

  let subjectId: string | null = null;
  if (subjectCode && subjectCode !== "ALL") {
    const { data } = await db
      .from("subjects")
      .select("id")
      .eq("code", subjectCode)
      .maybeSingle();
    subjectId = data?.id ?? null;
  }

  let query = db
    .from("question_attempts")
    .select("created_at, is_correct, response_time_ms, difficulty_label_at_attempt")
    .eq("student_id", studentId)
    .eq("season_id", season.id)
    .order("created_at");

  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data: attempts } = await query;
  const rows = attempts ?? [];

  // --- Trend ---------------------------------------------------------------
  const byDay = new Map<string, { n: number; correct: number; ms: number }>();
  for (const row of rows) {
    const date = new Date(
      new Date(row.created_at as string).getTime() + 8 * 3600_000,
    )
      .toISOString()
      .slice(0, 10);

    const bucket = byDay.get(date) ?? { n: 0, correct: 0, ms: 0 };
    bucket.n += 1;
    bucket.correct += row.is_correct ? 1 : 0;
    bucket.ms += row.response_time_ms as number;
    byDay.set(date, bucket);
  }

  const trend: TrendPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      attempts: b.n,
      accuracy: b.correct / b.n,
      avg_response_ms: Math.round(b.ms / b.n),
    }));

  // --- Difficulty ----------------------------------------------------------
  const byDifficulty = new Map<string, { n: number; correct: number }>();
  for (const row of rows) {
    const label = row.difficulty_label_at_attempt as string;
    const bucket = byDifficulty.get(label) ?? { n: 0, correct: 0 };
    bucket.n += 1;
    bucket.correct += row.is_correct ? 1 : 0;
    byDifficulty.set(label, bucket);
  }

  const difficulty: DifficultyBreakdown[] = (
    ["EASY", "MEDIUM", "HARD"] as const
  ).map((label) => {
    const bucket = byDifficulty.get(label);
    return {
      label,
      attempts: bucket?.n ?? 0,
      accuracy: bucket && bucket.n > 0 ? bucket.correct / bucket.n : 0,
    };
  });

  const totals = {
    attempts: rows.length,
    correct: rows.filter((r) => r.is_correct).length,
    accuracy: rows.length ? rows.filter((r) => r.is_correct).length / rows.length : 0,
    avg_response_ms: rows.length
      ? Math.round(
          rows.reduce((sum, r) => sum + (r.response_time_ms as number), 0) /
            rows.length,
        )
      : 0,
  };

  return { trend, difficulty, totals };
}

/* -------------------------------------------------------------------------- */

/** Fixture performance data, used only when SPM_PREVIEW=1. */
function previewPerformance(subjectCode?: string) {
  const subject = PREVIEW_SUBJECT_STATS.find((s) => s.code === subjectCode);
  const scale = subject ? subject.attempts / 862 : 1;
  const shift = subject ? subject.mastery - 0.775 : 0;

  const trend: TrendPoint[] = PREVIEW_TREND.map((p) => ({
    ...p,
    attempts: Math.max(1, Math.round(p.attempts * scale)),
    accuracy: Math.max(0.1, Math.min(0.98, p.accuracy + shift)),
  }));

  const attempts = subject ? subject.attempts : 862;
  const accuracy = subject ? subject.mastery : 668 / 862;

  // Accuracy falls away with difficulty, which is what the difficulty engine
  // exists to detect — the preview data should show that shape, not a flat one.
  const difficulty: DifficultyBreakdown[] = [
    { label: "EASY", attempts: Math.round(attempts * 0.31), accuracy: Math.min(0.97, accuracy + 0.14) },
    { label: "MEDIUM", attempts: Math.round(attempts * 0.48), accuracy },
    { label: "HARD", attempts: Math.round(attempts * 0.21), accuracy: Math.max(0.2, accuracy - 0.22) },
  ];

  return {
    trend,
    difficulty,
    totals: {
      attempts,
      correct: Math.round(attempts * accuracy),
      accuracy,
      avg_response_ms: subject ? 7400 + (1 - subject.mastery) * 4200 : 7840,
    },
  };
}
