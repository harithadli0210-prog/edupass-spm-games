import { supabaseAdmin } from "@/lib/supabase/server";
import type { SelectionProfiles } from "@/lib/config";
import type { DifficultyLabel } from "@/lib/types";

/**
 * Adaptive question selection (spec §24).
 *
 * The important decision here: band assignment does NOT read student level.
 *
 * Level is a function of XP, and XP rewards participation — a student who plays
 * a great deal is high-level whether or not they are any good. Banding on level
 * would serve hard questions to a diligent but struggling student and easy ones
 * to a strong student who plays rarely, which is backwards. The band comes from
 * a rolling accuracy window in the specific subject instead.
 */

export interface SelectionContext {
  studentId: string;
  seasonId: string;
  subjectId: string;
  count: number;
  profiles: SelectionProfiles;
}

export interface SelectedQuestion {
  id: string;
  difficulty_label: DifficultyLabel;
  topic_id: string | null;
  is_calibration: boolean;
}

/* -------------------------------------------------------------------------- */
/* Banding                                                                     */
/* -------------------------------------------------------------------------- */

export async function resolveBand(
  ctx: Pick<SelectionContext, "studentId" | "seasonId" | "subjectId" | "profiles">,
) {
  const { data } = await supabaseAdmin()
    .from("student_subject_stats")
    .select("recent_attempts, recent_correct, attempts")
    .eq("student_id", ctx.studentId)
    .eq("season_id", ctx.seasonId)
    .eq("subject_id", ctx.subjectId)
    .maybeSingle();

  const bands = ctx.profiles.bands;
  const unseeded = bands.find((b) => b.key === "unseeded") ?? bands[0];

  // Too little history to band on. Serving a middling mix and watching what
  // happens is more informative than guessing from level.
  if (!data || data.recent_attempts < 10) return unseeded;

  const accuracy = data.recent_correct / Math.max(1, data.recent_attempts);

  // Bands are ordered by ascending max_accuracy; first match wins.
  const candidates = bands
    .filter((b) => b.key !== "unseeded" && b.max_accuracy != null)
    .sort((a, b) => (a.max_accuracy ?? 0) - (b.max_accuracy ?? 0));

  return candidates.find((b) => accuracy < (b.max_accuracy ?? 1)) ?? unseeded;
}

/* -------------------------------------------------------------------------- */
/* Quota maths                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Turn a difficulty mix into whole-question counts.
 *
 * Largest-remainder rather than rounding each independently, so ten questions
 * at 50/40/10 always yields exactly ten and never nine or eleven.
 */
export function allocate(
  mix: Record<string, number>,
  total: number,
): Record<DifficultyLabel, number> {
  const labels: DifficultyLabel[] = ["EASY", "MEDIUM", "HARD"];
  const exact = labels.map((l) => ({ label: l, want: (mix[l] ?? 0) * total }));

  const out = { EASY: 0, MEDIUM: 0, HARD: 0 } as Record<DifficultyLabel, number>;
  let assigned = 0;
  for (const e of exact) {
    out[e.label] = Math.floor(e.want);
    assigned += out[e.label];
  }

  const remainders = exact
    .map((e) => ({ label: e.label, rem: e.want - Math.floor(e.want) }))
    .sort((a, b) => b.rem - a.rem);

  let i = 0;
  while (assigned < total && remainders.length > 0) {
    out[remainders[i % remainders.length].label] += 1;
    assigned += 1;
    i += 1;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Pick a question set for one session.
 *
 * Filters applied, in order of importance:
 *   1. ACTIVE questions in the subject only.
 *   2. Nothing the student has attempted within repeat_cooldown_days.
 *   3. The band's easy/medium/hard mix.
 *   4. Topic spread — no single topic may exceed max_per_topic_ratio.
 *
 * Then calibration slots: a configured share of the set is drawn from the
 * LOWEST sample-size pool instead of the best-calibrated one. Without this,
 * adaptive selection starves new questions of the attempts they need to ever
 * become calibrated, and the bank splits permanently into a well-measured core
 * and an unmeasured tail.
 */
export async function selectQuestions(
  ctx: SelectionContext,
): Promise<SelectedQuestion[]> {
  const db = supabaseAdmin();
  const band = await resolveBand(ctx);

  const cooldown = new Date();
  cooldown.setDate(cooldown.getDate() - ctx.profiles.repeat_cooldown_days);

  const { data: recent } = await db
    .from("question_attempts")
    .select("question_id")
    .eq("student_id", ctx.studentId)
    .gte("created_at", cooldown.toISOString());

  const seen = new Set((recent ?? []).map((r) => r.question_id as string));

  const calibrationCount = Math.round(
    ctx.count * ctx.profiles.calibration_slot_rate,
  );
  const adaptiveCount = ctx.count - calibrationCount;
  const quota = allocate(band.mix, adaptiveCount);

  const picked: SelectedQuestion[] = [];
  const usedIds = new Set<string>();
  const topicTally = new Map<string, number>();
  const topicCap = Math.max(
    1,
    Math.ceil(ctx.count * ctx.profiles.max_per_topic_ratio),
  );

  const admit = (q: {
    id: string;
    difficulty_label: DifficultyLabel;
    topic_id: string | null;
  }) => {
    if (usedIds.has(q.id) || seen.has(q.id)) return false;
    const key = q.topic_id ?? "none";
    if ((topicTally.get(key) ?? 0) >= topicCap) return false;
    topicTally.set(key, (topicTally.get(key) ?? 0) + 1);
    usedIds.add(q.id);
    return true;
  };

  // ---- Adaptive slots, one query per difficulty band ----------------------
  for (const label of ["EASY", "MEDIUM", "HARD"] as DifficultyLabel[]) {
    const want = quota[label];
    if (want <= 0) continue;

    // Over-fetch so the cooldown and topic-cap filters have room to reject
    // without leaving the set short.
    const { data } = await db
      .from("questions")
      .select("id, difficulty_label, topic_id")
      .eq("subject_id", ctx.subjectId)
      .eq("status", "ACTIVE")
      .eq("difficulty_label", label)
      .limit(want * 8);

    const pool = shuffle(data ?? []);
    for (const q of pool) {
      if (picked.filter((p) => p.difficulty_label === label).length >= want) break;
      if (admit(q as never)) {
        picked.push({
          id: q.id as string,
          difficulty_label: q.difficulty_label as DifficultyLabel,
          topic_id: (q.topic_id as string) ?? null,
          is_calibration: false,
        });
      }
    }
  }

  // ---- Calibration slots ---------------------------------------------------
  if (calibrationCount > 0) {
    const { data } = await db
      .from("questions")
      .select("id, difficulty_label, topic_id, question_difficulty_stats(sample_size)")
      .eq("subject_id", ctx.subjectId)
      .eq("status", "ACTIVE")
      .limit(calibrationCount * 12);

    const pool = (data ?? [])
      .map((q) => ({
        ...q,
        sample:
          (q.question_difficulty_stats as { sample_size: number }[] | null)?.[0]
            ?.sample_size ?? 0,
      }))
      .sort((a, b) => a.sample - b.sample);

    for (const q of pool) {
      if (picked.filter((p) => p.is_calibration).length >= calibrationCount) break;
      if (admit(q as never)) {
        picked.push({
          id: q.id as string,
          difficulty_label: q.difficulty_label as DifficultyLabel,
          topic_id: (q.topic_id as string) ?? null,
          is_calibration: true,
        });
      }
    }
  }

  // ---- Backfill ------------------------------------------------------------
  // A thin bank, or an aggressive cooldown, can leave the set short. Better a
  // repeat than an eight-question "ten question" challenge, so the cooldown is
  // the constraint that gets dropped first.
  if (picked.length < ctx.count) {
    const { data } = await db
      .from("questions")
      .select("id, difficulty_label, topic_id")
      .eq("subject_id", ctx.subjectId)
      .eq("status", "ACTIVE")
      .limit(ctx.count * 6);

    for (const q of shuffle(data ?? [])) {
      if (picked.length >= ctx.count) break;
      if (usedIds.has(q.id as string)) continue;
      usedIds.add(q.id as string);
      picked.push({
        id: q.id as string,
        difficulty_label: q.difficulty_label as DifficultyLabel,
        topic_id: (q.topic_id as string) ?? null,
        is_calibration: false,
      });
    }
  }

  return shuffle(picked).slice(0, ctx.count);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
