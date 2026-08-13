import { supabaseAdmin } from "@/lib/supabase/server";
import { getScoringRulesById, getSessionConfig } from "@/lib/config";
import { selectQuestions } from "@/lib/engines/selection";
import { scoreQuestion, scoreSession, validateTiming } from "@/lib/engines/scoring";
import { malaysiaDate } from "@/lib/utils";
import type {
  AnswerResult,
  DifficultyLabel,
  GameMode,
  ServedQuestion,
  SessionSummary,
} from "@/lib/types";

/**
 * The server-authoritative game loop.
 *
 * The contract this file exists to enforce:
 *   · The browser never receives `is_correct` before it has committed.
 *   · The browser never computes points.
 *   · The browser never decides how long an answer took.
 *
 * A tampered client can lie about which option it picked, which only loses
 * points. It has no route to a fabricated score.
 */

export class GameError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_PROFILE"
      | "SEASON_CLOSED"
      | "MODE_DISABLED"
      | "ALREADY_PLAYED"
      | "NO_QUESTIONS"
      | "NOT_FOUND"
      | "SESSION_CLOSED"
      | "ALREADY_ANSWERED",
    readonly status = 400,
  ) {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/* Start                                                                       */
/* -------------------------------------------------------------------------- */

export async function startSession(args: {
  studentId: string;
  mode: GameMode;
  subjectCode: string;
  isAdmin?: boolean;
  clientMeta?: Record<string, unknown>;
}) {
  const db = supabaseAdmin();
  const { season, scoringRulesId, modeConfig, selection } =
    await getSessionConfig(args.mode, args.isAdmin ?? false);

  if (season.status !== "ACTIVE") {
    throw new GameError("The season is not open.", "SEASON_CLOSED", 403);
  }
  if (modeConfig.enabled === false) {
    throw new GameError("This game mode is not available yet.", "MODE_DISABLED", 403);
  }

  // A complete profile is the gate before the first game (spec §8).
  const { data: profile } = await db
    .from("student_profiles")
    .select("student_id, consent_at")
    .eq("student_id", args.studentId)
    .maybeSingle();

  if (!profile || !profile.consent_at) {
    throw new GameError("Complete your profile first.", "NO_PROFILE", 403);
  }

  const { data: subject } = await db
    .from("subjects")
    .select("id, code, is_active")
    .eq("code", args.subjectCode)
    .maybeSingle();

  if (!subject?.is_active) {
    throw new GameError("Unknown subject.", "NOT_FOUND", 404);
  }

  let dailyChallengeId: string | null = null;
  let questionIds: { id: string; is_calibration: boolean }[] = [];

  if (args.mode === "DAILY") {
    const today = malaysiaDate();
    const { data: challenge } = await db
      .from("daily_challenges")
      .select("id, status")
      .eq("season_id", season.id)
      .eq("subject_id", subject.id)
      .eq("challenge_date", today)
      .maybeSingle();

    if (!challenge || challenge.status !== "OPEN") {
      throw new GameError(
        "Today's challenge isn't open yet.",
        "NO_QUESTIONS",
        404,
      );
    }
    dailyChallengeId = challenge.id;

    // One run per subject per day. The DB carries a unique index too — this
    // check exists to return a friendly error rather than a constraint
    // violation.
    if (modeConfig.one_run_per_day) {
      const { data: existing } = await db
        .from("game_sessions")
        .select("id, status")
        .eq("student_id", args.studentId)
        .eq("daily_challenge_id", challenge.id)
        .neq("status", "ABANDONED")
        .maybeSingle();

      if (existing) {
        throw new GameError(
          existing.status === "ACTIVE"
            ? "You already have this challenge in progress."
            : "You've already played today's challenge for this subject.",
          "ALREADY_PLAYED",
          409,
        );
      }
    }

    // Daily is deliberately NOT adaptive: every student in Malaysia gets the
    // same ten questions in the same order. A leaderboard built on differing
    // question sets is not a fair comparison.
    const { data: set } = await db
      .from("daily_challenge_questions")
      .select("question_id, position")
      .eq("daily_challenge_id", challenge.id)
      .order("position");

    questionIds = (set ?? []).map((r) => ({
      id: r.question_id as string,
      is_calibration: false,
    }));
  } else {
    const count =
      modeConfig.max_questions ?? modeConfig.questions_per_subject ?? 10;

    const picked = await selectQuestions({
      studentId: args.studentId,
      seasonId: season.id,
      subjectId: subject.id,
      count,
      profiles: selection,
    });

    questionIds = picked.map((p) => ({ id: p.id, is_calibration: p.is_calibration }));
  }

  if (questionIds.length === 0) {
    throw new GameError(
      "No questions are available for this subject yet.",
      "NO_QUESTIONS",
      404,
    );
  }

  // Speedy is closed by the server at round_seconds regardless of what the
  // client believes, plus a small grace for the last answer in flight. A paused
  // or throttled tab cannot buy extra time.
  const expiresAt =
    args.mode === "SPEED" && modeConfig.round_seconds
      ? new Date(Date.now() + (modeConfig.round_seconds + 5) * 1000)
      : new Date(Date.now() + modeConfig.session_expiry_minutes * 60_000);

  const { data: session, error } = await db
    .from("game_sessions")
    .insert({
      student_id: args.studentId,
      season_id: season.id,
      mode: args.mode,
      subject_id: subject.id,
      daily_challenge_id: dailyChallengeId,
      // Pins the rule version this game is scored under. scoring_rules rows are
      // versioned and never updated in place, so the id is as immutable as a
      // JSON copy would be — at 16 bytes instead of ~800.
      scoring_rules_id: scoringRulesId,
      expires_at: expiresAt.toISOString(),
      client_meta: args.clientMeta ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;

  const rows = questionIds.map((q, i) => ({
    session_id: session.id,
    question_id: q.id,
    position: i + 1,
    is_calibration: q.is_calibration,
  }));

  const { error: sqError } = await db.from("session_questions").insert(rows);
  if (sqError) throw sqError;

  await logEvent(args.studentId, season.id, "game_started", {
    mode: args.mode,
    subject: subject.code,
    session_id: session.id,
    question_count: rows.length,
  });

  // The first question ships with the start response rather than costing a
  // second round trip. On a 60-second Speedy round, a wasted request before the
  // clock even starts is a meaningful slice of the student's time.
  const firstQuestion = await serveNext({
    studentId: args.studentId,
    sessionId: session.id,
  });

  return {
    session_id: session.id as string,
    mode: args.mode,
    subject_code: subject.code as string,
    total_questions: rows.length,
    round_seconds: modeConfig.round_seconds ?? null,
    expires_at: expiresAt.toISOString(),
    first_question: firstQuestion,
  };
}

/* -------------------------------------------------------------------------- */
/* Serve                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Hand the next question to the browser and stamp the moment it left.
 *
 * The select list here is the security boundary: question_options is queried
 * for id, label and content only. `is_correct` is not read, so it cannot be
 * serialised into the response by accident.
 */
export async function serveNext(args: {
  studentId: string;
  sessionId: string;
}): Promise<ServedQuestion | null> {
  const db = supabaseAdmin();

  const { data: session } = await db
    .from("game_sessions")
    .select("id, student_id, mode, status, expires_at")
    .eq("id", args.sessionId)
    .maybeSingle();

  if (!session || session.student_id !== args.studentId) {
    throw new GameError("Session not found.", "NOT_FOUND", 404);
  }
  if (session.status !== "ACTIVE") {
    throw new GameError("This round is already finished.", "SESSION_CLOSED", 409);
  }
  if (new Date(session.expires_at) < new Date()) {
    await db.from("game_sessions").update({ status: "EXPIRED" }).eq("id", session.id);
    throw new GameError("Time's up.", "SESSION_CLOSED", 409);
  }

  const { data: next } = await db
    .from("session_questions")
    .select(
      `id, position, question_id,
       questions (
         id, question_type, stem, stem_media, difficulty_label,
         subjects ( code ),
         topics ( name )
       )`,
    )
    .eq("session_id", session.id)
    .is("answered_at", null)
    .is("served_at", null)
    .order("position")
    .limit(1)
    .maybeSingle();

  if (!next) return null; // Set exhausted; the client should call /complete.

  const { data: options } = await db
    .from("question_options")
    .select("id, label, content") //  ← is_correct is deliberately absent
    .eq("question_id", next.question_id)
    .order("sort_order");

  const servedAt = new Date();
  await db
    .from("session_questions")
    .update({ served_at: servedAt.toISOString() })
    .eq("id", next.id);

  await db.rpc("increment_served", { p_session_id: session.id }).then(
    () => undefined,
    // Non-critical counter; never fail a serve over it.
    () => undefined,
  );

  const q = next.questions as unknown as {
    question_type: string;
    stem: string;
    stem_media: Record<string, unknown> | null;
    difficulty_label: DifficultyLabel;
    subjects: { code: string };
    topics: { name: string } | null;
  };

  return {
    question_id: next.question_id as string,
    position: next.position as number,
    question_type: q.question_type as ServedQuestion["question_type"],
    stem: q.stem,
    stem_media: q.stem_media,
    options: (options ?? []).map((o) => ({
      option_id: o.id as string,
      label: o.label as string,
      content: o.content as string,
    })),
    subject_code: q.subjects.code,
    topic_name: q.topics?.name ?? null,
    difficulty_label: q.difficulty_label,
    expires_at: session.expires_at as string,
  };
}

/* -------------------------------------------------------------------------- */
/* Answer                                                                      */
/* -------------------------------------------------------------------------- */

export async function submitAnswer(args: {
  studentId: string;
  sessionId: string;
  questionId: string;
  optionId: string | null;
  clientElapsedMs?: number;
}): Promise<AnswerResult> {
  const db = supabaseAdmin();

  const { data: session } = await db
    .from("game_sessions")
    .select("id, student_id, season_id, mode, status, expires_at, scoring_rules_id")
    .eq("id", args.sessionId)
    .maybeSingle();

  if (!session || session.student_id !== args.studentId) {
    throw new GameError("Session not found.", "NOT_FOUND", 404);
  }
  if (session.status !== "ACTIVE") {
    throw new GameError("This round is already finished.", "SESSION_CLOSED", 409);
  }

  const { data: sq } = await db
    .from("session_questions")
    .select("id, served_at, answered_at, question_id")
    .eq("session_id", session.id)
    .eq("question_id", args.questionId)
    .maybeSingle();

  if (!sq) throw new GameError("Question not in this round.", "NOT_FOUND", 404);
  if (sq.answered_at) {
    throw new GameError("Already answered.", "ALREADY_ANSWERED", 409);
  }
  if (!sq.served_at) {
    throw new GameError("Question was never served.", "NOT_FOUND", 409);
  }

  // Grading happens here, against the database, never against anything the
  // client sent.
  const { data: correctOption } = await db
    .from("question_options")
    .select("id")
    .eq("question_id", args.questionId)
    .eq("is_correct", true)
    .maybeSingle();

  const { data: question } = await db
    .from("questions")
    .select("difficulty_label, explanation")
    .eq("id", args.questionId)
    .maybeSingle();

  // A question with no correct option is a content bug, and grading against it
  // would mark every student wrong. Refuse rather than corrupt the attempt data
  // the difficulty engine is built on.
  if (!question || !correctOption) {
    throw new GameError(
      "This question is unavailable. Skip it and carry on.",
      "NOT_FOUND",
      404,
    );
  }

  const rules = await getScoringRulesById(session.scoring_rules_id as string);
  const mode = session.mode as GameMode;
  const answeredAt = new Date();

  const timing = validateTiming(rules, mode, {
    servedAt: sq.served_at as string,
    answeredAt,
    clientElapsedMs: args.clientElapsedMs,
  });

  const isCorrect = args.optionId != null && args.optionId === correctOption.id;

  // An answer past the round clock is recorded but scores nothing. Discarding
  // it entirely would lose the attempt data the difficulty engine needs.
  const pastDeadline = new Date(session.expires_at) < answeredAt;

  const score =
    timing.suspicious || pastDeadline
      ? { points: 0, speed_bonus: 0, xp: 0 }
      : scoreQuestion(rules, mode, {
          isCorrect,
          responseTimeMs: timing.responseTimeMs,
          difficultyLabel: question.difficulty_label as DifficultyLabel,
        });

  const { data: attempt, error } = await db.rpc("commit_attempt", {
    p_session_question_id: sq.id,
    p_selected_option_id: args.optionId,
    p_is_correct: isCorrect,
    p_response_time_ms: timing.responseTimeMs,
    p_client_elapsed_ms: args.clientElapsedMs ?? null,
    p_points: score.points,
    p_xp: score.xp,
    p_speed_bonus: score.speed_bonus,
    p_is_suspicious: timing.suspicious,
  });

  if (error) {
    // The unique index on session_questions turns a replayed submission into a
    // no-op rather than a double score.
    if (error.message?.includes("Already answered")) {
      throw new GameError("Already answered.", "ALREADY_ANSWERED", 409);
    }
    throw error;
  }

  const { data: after } = await db
    .from("game_sessions")
    .select("raw_points, questions_answered, questions_correct")
    .eq("id", session.id)
    .single();

  const { count: remaining } = await db
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .is("answered_at", null);

  // No analytics event per question, by design. `question_attempts` already
  // records the student, question, mode, correctness, timing and score for
  // every answer — emitting a parallel analytics row would duplicate the
  // largest table in the database for no information gain. Funnel events are
  // emitted at session boundaries instead.

  void attempt;

  return {
    is_correct: isCorrect,
    correct_option_id: correctOption.id as string,
    explanation: question.explanation as string | null,
    points_awarded: score.points,
    xp_awarded: score.xp,
    speed_bonus: score.speed_bonus,
    response_time_ms: timing.responseTimeMs,
    running_points: after?.raw_points ?? 0,
    running_correct: after?.questions_correct ?? 0,
    running_answered: after?.questions_answered ?? 0,
    questions_remaining: mode === "SPEED" ? null : (remaining ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Complete                                                                    */
/* -------------------------------------------------------------------------- */

export async function completeSession(args: {
  studentId: string;
  sessionId: string;
}): Promise<SessionSummary> {
  const db = supabaseAdmin();

  const { data: session } = await db
    .from("game_sessions")
    .select(
      `id, student_id, season_id, mode, status, raw_points, xp_awarded,
       questions_answered, questions_correct, scoring_rules_id,
       subjects ( code )`,
    )
    .eq("id", args.sessionId)
    .maybeSingle();

  if (!session || session.student_id !== args.studentId) {
    throw new GameError("Session not found.", "NOT_FOUND", 404);
  }

  const rules = await getScoringRulesById(session.scoring_rules_id as string);
  const mode = session.mode as GameMode;

  const { count: unanswered } = await db
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .is("answered_at", null);

  // Speedy is "completed" whenever the clock runs out — leaving questions
  // unanswered is the normal outcome. Daily requires the full set.
  const completed = mode === "SPEED" ? true : (unanswered ?? 0) === 0;

  const { data: before } = await db
    .from("student_season_stats")
    .select("level")
    .eq("student_id", args.studentId)
    .eq("season_id", session.season_id)
    .maybeSingle();

  const scored = scoreSession(rules, mode, {
    rawPoints: session.raw_points as number,
    answered: session.questions_answered as number,
    correct: session.questions_correct as number,
    completed,
  });

  const { error } = await db.rpc("finalize_session", {
    p_session_id: session.id,
    p_accuracy_factor: scored.accuracy_factor,
    p_completion_bonus: scored.completion_bonus,
    p_bonus_xp: scored.bonus_xp,
  });
  if (error) throw error;

  const { data: after } = await db
    .from("student_season_stats")
    .select("level")
    .eq("student_id", args.studentId)
    .eq("season_id", session.season_id)
    .maybeSingle();

  const answered = session.questions_answered as number;
  const { data: timings } = await db
    .from("question_attempts")
    .select("response_time_ms")
    .eq("session_id", session.id);

  const avgResponse =
    timings && timings.length > 0
      ? Math.round(
          timings.reduce((sum, t) => sum + (t.response_time_ms as number), 0) /
            timings.length,
        )
      : 0;

  await logEvent(args.studentId, session.season_id as string, "game_completed", {
    mode,
    session_id: session.id,
    points: scored.final_points,
    accuracy: scored.accuracy,
  });

  if ((after?.level ?? 1) > (before?.level ?? 1)) {
    await logEvent(args.studentId, session.season_id as string, "level_up", {
      from: before?.level ?? 1,
      to: after?.level ?? 1,
    });
  }

  return {
    session_id: session.id as string,
    mode,
    subject_code:
      (session.subjects as unknown as { code: string } | null)?.code ?? "",
    answered,
    correct: session.questions_correct as number,
    accuracy: scored.accuracy,
    raw_points: scored.raw_points,
    accuracy_factor: scored.accuracy_factor,
    final_points: scored.final_points,
    completion_bonus: scored.completion_bonus,
    xp_awarded: (session.xp_awarded as number) + scored.bonus_xp,
    avg_response_ms: avgResponse,
    level_before: before?.level ?? 1,
    level_after: after?.level ?? 1,
  };
}

/* -------------------------------------------------------------------------- */

async function logEvent(
  studentId: string,
  seasonId: string,
  event: string,
  properties: Record<string, unknown>,
) {
  // Analytics must never be able to fail a game action.
  try {
    await supabaseAdmin()
      .from("analytics_events")
      .insert({ student_id: studentId, season_id: seasonId, event, properties });
  } catch {
    /* swallowed by design */
  }
}
