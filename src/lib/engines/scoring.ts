import { clamp } from "@/lib/utils";
import type { ModeScoring, ScoringRules } from "@/lib/config";
import type { DifficultyLabel, GameMode } from "@/lib/types";

/**
 * The scoring engine.
 *
 * Pure functions over a config object. Nothing here reads the database, holds
 * state, or knows about React — which is what makes it testable and what keeps
 * the formula out of UI components (spec §12).
 *
 * The rules object is always the session's frozen `config_snapshot`, never the
 * live table. An admin changing a weight mid-season must not retroactively
 * rewrite a game that has already started.
 */

export function modeRules(rules: ScoringRules, mode: GameMode): ModeScoring {
  return rules[mode.toLowerCase() as keyof ScoringRules] as ModeScoring;
}

/* -------------------------------------------------------------------------- */
/* Per-question                                                                */
/* -------------------------------------------------------------------------- */

export interface QuestionScore {
  points: number;
  speed_bonus: number;
  xp: number;
}

/**
 * Score a single answer.
 *
 * Speed pays only on a correct answer. Paying a speed bonus for a fast wrong
 * answer would reward guessing, which is precisely the behaviour the accuracy
 * gate at round close exists to punish.
 */
export function scoreQuestion(
  rules: ScoringRules,
  mode: GameMode,
  args: {
    isCorrect: boolean;
    responseTimeMs: number;
    difficultyLabel: DifficultyLabel;
  },
): QuestionScore {
  const m = modeRules(rules, mode);
  const xpRules = rules.xp;

  if (!args.isCorrect) {
    return { points: m.wrong, speed_bonus: 0, xp: xpRules.wrong };
  }

  const difficultyMult = m.difficulty_mult[args.difficultyLabel] ?? 1;
  const base = m.base * difficultyMult;

  // Linear decay from full bonus at 0ms to zero at the reference time. A curve
  // would be marginally prettier and considerably harder for a student to
  // reason about; the payoff should be obvious from playing.
  const ref = m.speed_reference_ms ?? 0;
  const speedRatio =
    ref > 0 ? clamp((ref - args.responseTimeMs) / ref, 0, 1) : 0;

  const bonus = base * speedRatio * m.speed_bonus_weight;

  return {
    points: Math.round(base + bonus),
    speed_bonus: Math.round(bonus),
    xp: xpRules.correct,
  };
}

/* -------------------------------------------------------------------------- */
/* Round close — the accuracy gate                                             */
/* -------------------------------------------------------------------------- */

/**
 * The answer to "why doesn't 100 sloppy answers beat 20 careful ones".
 *
 * Per-question points alone still reward volume: answer enough questions and
 * the total climbs regardless of accuracy. Scaling the whole round by an
 * accuracy factor closes that.
 *
 *   factor = floor + (1 - floor) x accuracy
 *
 * With the Speedy floor of 0.5, a student answering 100 questions at 40%
 * accuracy keeps 70% of a total already savaged by 60 wrong answers at -15
 * each; a student answering 30 at 95% keeps 97.5% of a clean one. Speed still
 * pays — but on top of accuracy, never instead of it.
 *
 * Daily's floor is 1.0, which disables the gate. Daily is a fixed ten-question
 * set with no clock, so there is no volume to game.
 */
export function accuracyFactor(
  rules: ScoringRules,
  mode: GameMode,
  args: { answered: number; correct: number },
): number {
  const m = modeRules(rules, mode);
  if (args.answered === 0) return 0;
  const accuracy = args.correct / args.answered;
  return m.accuracy_floor + (1 - m.accuracy_floor) * accuracy;
}

export interface SessionScore {
  raw_points: number;
  accuracy: number;
  accuracy_factor: number;
  completion_bonus: number;
  final_points: number;
  bonus_xp: number;
}

export function scoreSession(
  rules: ScoringRules,
  mode: GameMode,
  args: {
    rawPoints: number;
    answered: number;
    correct: number;
    /** Only a session played to the end earns the completion bonus. */
    completed: boolean;
  },
): SessionScore {
  const m = modeRules(rules, mode);
  const accuracy = args.answered > 0 ? args.correct / args.answered : 0;
  const factor = accuracyFactor(rules, mode, args);
  const bonus = args.completed ? m.completion_bonus : 0;

  return {
    raw_points: args.rawPoints,
    accuracy,
    accuracy_factor: factor,
    completion_bonus: bonus,
    final_points: Math.max(0, Math.round(args.rawPoints * factor) + bonus),
    bonus_xp: args.completed ? rules.xp.session_complete : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Response-time validation                                                    */
/* -------------------------------------------------------------------------- */

export interface TimingVerdict {
  /** Server-derived, always. The client's own number is never trusted. */
  responseTimeMs: number;
  suspicious: boolean;
  reason?: string;
}

/**
 * Response time is `answered_at - served_at`, both stamped by Postgres.
 *
 * A time below the floor is not merely fast — a human cannot read a question,
 * parse four options and tap one in under ~400ms. Those answers score zero and
 * raise a flag, but they are NOT rejected: a false positive that blocks a real
 * student mid-competition is worse than a cheat who gets caught in review.
 */
export function validateTiming(
  rules: ScoringRules,
  mode: GameMode,
  args: { servedAt: string; answeredAt: Date; clientElapsedMs?: number },
): TimingVerdict {
  const m = modeRules(rules, mode);
  const floor = m.min_response_ms ?? 400;
  const served = new Date(args.servedAt).getTime();
  const elapsed = Math.max(0, args.answeredAt.getTime() - served);

  if (elapsed < floor) {
    return {
      responseTimeMs: elapsed,
      suspicious: true,
      reason: "IMPOSSIBLE_RESPONSE_TIME",
    };
  }

  // A large gap between the client's claim and the server's measurement means
  // a throttled tab, a slow network, or a tampered clock. Worth recording;
  // never worth acting on by itself.
  if (
    args.clientElapsedMs != null &&
    Math.abs(args.clientElapsedMs - elapsed) > 5000
  ) {
    return { responseTimeMs: elapsed, suspicious: true, reason: "CLOCK_DRIFT" };
  }

  return { responseTimeMs: elapsed, suspicious: false };
}
