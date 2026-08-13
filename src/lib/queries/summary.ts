import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/config";
import { malaysiaDate } from "@/lib/utils";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  PREVIEW,
  PREVIEW_SEASON,
  PREVIEW_SIGNALS,
  PREVIEW_SUBJECTS,
  PREVIEW_SUBJECT_STATS,
} from "@/lib/preview";

/**
 * The dashboard payload.
 *
 * Shared by the Server Component and the /api/spm/me/summary route so the two
 * can never drift — a Server Component calling its own API over HTTP would mean
 * an extra hop and a second copy of this shape.
 */
export async function getStudentSummary(
  studentId: string,
  displayName: string,
  lang: Locale = DEFAULT_LOCALE,
) {
  if (PREVIEW) return previewSummary(displayName, lang);

  const season = await getActiveSeason();
  const db = supabaseAdmin();
  const today = malaysiaDate();

  const [stats, subjectStats, rank, signals, levels, todaySessions] = await Promise.all([
    db
      .from("student_season_stats")
      .select("*")
      .eq("student_id", studentId)
      .eq("season_id", season.id)
      .maybeSingle(),

    db
      .from("student_subject_stats")
      .select("subject_id, attempts, correct, mastery, points, subjects(code, name_en, name_ms)")
      .eq("student_id", studentId)
      .eq("season_id", season.id),

    db.rpc("leaderboard_me", {
      p_board: "overall",
      p_season_id: season.id,
      p_subject_id: null,
    }),

    db
      .from("student_behaviour_signals")
      .select("signal, value, confidence, sample_size")
      .eq("student_id", studentId)
      .eq("season_id", season.id)
      .order("value", { ascending: false }),

    db.from("level_thresholds").select("level, xp_required, title").order("level"),

    db
      .from("game_sessions")
      .select("id, mode, status, subjects(code)")
      .eq("student_id", studentId)
      .gte("started_at", `${today}T00:00:00+08:00`),
  ]);

  const s = stats.data;
  const xp = s?.xp ?? 0;
  const allLevels = levels.data ?? [];
  const currentLevel = s?.level ?? 1;
  const thisLevel = allLevels.find((l) => l.level === currentLevel);
  const nextLevel = allLevels.find((l) => l.level === currentLevel + 1);

  const mine = (rank.data ?? [])[0] as
    | { rank: number; points: number; total_participants: number }
    | undefined;

  // A signal is only shown once there is evidence behind it. Telling a student
  // on day one that they are a "Fast Thinker" is noise, and it devalues the
  // signals that are real (spec §27).
  const evidenced = (signals.data ?? []).filter(
    (sig) => Number(sig.confidence) >= 0.3 && Number(sig.value) >= 0.6,
  );

  const dailyCompleted = [
    ...new Set(
      (todaySessions.data ?? [])
        .filter((x) => x.mode === "DAILY" && x.status === "COMPLETED")
        .map((x) => (x.subjects as unknown as { code: string } | null)?.code)
        .filter(Boolean) as string[],
    ),
  ];

  return {
    student: { display_name: displayName },
    season: {
      code: season.code,
      name: season.name,
      starts_on: season.starts_on,
      ends_on: season.ends_on,
      days_remaining: Math.max(
        0,
        Math.ceil(
          (new Date(`${season.ends_on}T23:59:59+08:00`).getTime() - Date.now()) /
            86_400_000,
        ),
      ),
    },
    stats: {
      overall_points: s?.overall_points ?? 0,
      daily_points: s?.daily_points ?? 0,
      speed_points: s?.speed_points ?? 0,
      xp,
      level: currentLevel,
      level_title: thisLevel?.title ?? "Newcomer",
      xp_into_level: xp - (thisLevel?.xp_required ?? 0),
      xp_for_next: nextLevel
        ? nextLevel.xp_required - (thisLevel?.xp_required ?? 0)
        : null,
      current_streak: s?.current_streak ?? 0,
      active_days: s?.active_days ?? 0,
      questions_answered: s?.questions_answered ?? 0,
      questions_correct: s?.questions_correct ?? 0,
      accuracy:
        s && s.questions_answered > 0
          ? s.questions_correct / s.questions_answered
          : 0,
      avg_response_ms:
        s && s.questions_answered > 0
          ? Math.round(Number(s.total_response_ms) / s.questions_answered)
          : 0,
    },
    rank: mine
      ? { position: Number(mine.rank), total: Number(mine.total_participants) }
      : null,
    subjects: (subjectStats.data ?? []).map((row) => {
      const subject = row.subjects as unknown as {
        code: string;
        name_en: string;
        name_ms: string;
      };
      return {
        code: subject.code,
        name: lang === "ms" ? subject.name_ms : subject.name_en,
        attempts: row.attempts as number,
        mastery: Number(row.mastery),
        points: row.points as number,
      };
    }),
    signals: evidenced.map((sig) => ({
      signal: sig.signal as string,
      value: Number(sig.value),
      confidence: Number(sig.confidence),
    })),
    today: { daily_completed: dailyCompleted },
  };
}

export type StudentSummary = Awaited<ReturnType<typeof getStudentSummary>>;

/** Mid-season figures for one student, used only when SPM_PREVIEW=1. */
function previewSummary(displayName: string, lang: Locale) {
  const xp = 18420;
  return {
    student: { display_name: displayName },
    season: {
      code: PREVIEW_SEASON.code,
      name: PREVIEW_SEASON.name,
      starts_on: PREVIEW_SEASON.starts_on,
      ends_on: PREVIEW_SEASON.ends_on,
      days_remaining: 39,
    },
    stats: {
      overall_points: 12840,
      daily_points: 8420,
      speed_points: 6180,
      xp,
      level: 12,
      level_title: "Specialist",
      xp_into_level: xp - 16300,
      xp_for_next: 20400 - 16300,
      current_streak: 7,
      active_days: 21,
      questions_answered: 862,
      questions_correct: 668,
      accuracy: 668 / 862,
      avg_response_ms: 7840,
    },
    rank: { position: 184, total: 12483 },
    subjects: PREVIEW_SUBJECT_STATS.map((s) => ({
      ...s,
      name:
        lang === "ms"
          ? (PREVIEW_SUBJECTS.find((x) => x.code === s.code)?.name_ms ?? s.name)
          : s.name,
    })),
    signals: PREVIEW_SIGNALS,
    today: { daily_completed: ["MATH", "SCIENCE"] },
  };
}
