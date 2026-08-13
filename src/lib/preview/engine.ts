import { scoreQuestion, scoreSession } from "@/lib/engines/scoring";
import {
  PREVIEW_MODE_CONFIG,
  PREVIEW_QUESTIONS,
  PREVIEW_SCORING,
  type PreviewQuestion,
} from "@/lib/preview/fixtures";
import type {
  AnswerResult,
  GameMode,
  ServedQuestion,
  SessionSummary,
} from "@/lib/types";

/**
 * In-memory game loop for preview mode.
 *
 * Runs the REAL scoring engine from src/lib/engines/scoring.ts against the real
 * config shape — the speed bonus, the difficulty multiplier and the accuracy
 * gate all behave exactly as they will in production. Only persistence is
 * faked. That makes this useful for judging whether the scoring actually feels
 * right to play, which is the thing hardest to tell from a spec.
 */

interface PreviewSessionQuestion {
  question: PreviewQuestion;
  position: number;
  servedAt: number | null;
  answeredAt: number | null;
}

interface PreviewSession {
  id: string;
  mode: GameMode;
  subjectCode: string;
  questions: PreviewSessionQuestion[];
  expiresAt: number;
  status: "ACTIVE" | "COMPLETED";
  rawPoints: number;
  answered: number;
  correct: number;
  xp: number;
  responseTimes: number[];
}

// Module-level, so it survives across requests within one dev process. Cleared
// on restart, which is fine — nothing here is meant to persist.
const sessions = new Map<string, PreviewSession>();

let counter = 0;
function nextId() {
  counter += 1;
  return `preview-session-${counter}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function previewStartSession(mode: GameMode, subjectCode: string) {
  const config =
    PREVIEW_MODE_CONFIG[mode as keyof typeof PREVIEW_MODE_CONFIG] ??
    PREVIEW_MODE_CONFIG.DAILY;

  const pool = PREVIEW_QUESTIONS.filter((q) => q.subject_code === subjectCode);
  if (pool.length === 0) {
    throw new Error(`No preview questions for ${subjectCode}`);
  }

  const wanted =
    mode === "SPEED"
      ? Math.min(config.max_questions ?? 30, pool.length * 4)
      : Math.min(config.questions_per_subject ?? 10, pool.length);

  // The preview bank is small, so Speedy cycles through it rather than running
  // out after four questions. Daily uses each question once.
  const picked: PreviewQuestion[] = [];
  while (picked.length < wanted) {
    picked.push(...shuffle(pool));
  }

  const roundSeconds = config.round_seconds ?? null;
  const expiresAt =
    Date.now() +
    (roundSeconds
      ? (roundSeconds + 5) * 1000
      : config.session_expiry_minutes * 60_000);

  const session: PreviewSession = {
    id: nextId(),
    mode,
    subjectCode,
    questions: picked.slice(0, wanted).map((question, i) => ({
      question,
      position: i + 1,
      servedAt: null,
      answeredAt: null,
    })),
    expiresAt,
    status: "ACTIVE",
    rawPoints: 0,
    answered: 0,
    correct: 0,
    xp: 0,
    responseTimes: [],
  };

  sessions.set(session.id, session);

  return {
    session_id: session.id,
    mode,
    subject_code: subjectCode,
    total_questions: session.questions.length,
    round_seconds: roundSeconds,
    expires_at: new Date(expiresAt).toISOString(),
    first_question: previewServeNext(session.id),
  };
}

export function previewServeNext(sessionId: string): ServedQuestion | null {
  const session = sessions.get(sessionId);
  if (!session || session.status !== "ACTIVE") return null;

  const next = session.questions.find(
    (sq) => sq.servedAt === null && sq.answeredAt === null,
  );
  if (!next) return null;

  next.servedAt = Date.now();

  return {
    // Position-scoped so a repeated question inside one Speedy round is still
    // a distinct answerable slot.
    question_id: `${next.question.id}#${next.position}`,
    position: next.position,
    question_type: "MCQ",
    stem: next.question.stem,
    stem_media: null,
    options: next.question.options.map((o) => ({
      option_id: o.id,
      label: o.label,
      content: o.content,
    })),
    subject_code: next.question.subject_code,
    topic_name: next.question.topic_name,
    difficulty_label: next.question.difficulty_label,
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}

export function previewSubmitAnswer(args: {
  sessionId: string;
  questionId: string;
  optionId: string | null;
}): AnswerResult {
  const session = sessions.get(args.sessionId);
  if (!session) throw new Error("Session not found");

  const position = Number(args.questionId.split("#")[1]);
  const sq = session.questions.find((x) => x.position === position);
  if (!sq) throw new Error("Question not in this round");
  if (sq.answeredAt) throw new Error("Already answered");

  const answeredAt = Date.now();
  const responseTimeMs = Math.max(0, answeredAt - (sq.servedAt ?? answeredAt));
  sq.answeredAt = answeredAt;

  const correctOption = sq.question.options.find((o) => o.correct)!;
  const isCorrect = args.optionId === correctOption.id;

  const pastDeadline = answeredAt > session.expiresAt;
  const score = pastDeadline
    ? { points: 0, speed_bonus: 0, xp: 0 }
    : scoreQuestion(PREVIEW_SCORING, session.mode, {
        isCorrect,
        responseTimeMs,
        difficultyLabel: sq.question.difficulty_label,
      });

  session.rawPoints += score.points;
  session.answered += 1;
  session.correct += isCorrect ? 1 : 0;
  session.xp += score.xp;
  session.responseTimes.push(responseTimeMs);

  const remaining = session.questions.filter((x) => x.answeredAt === null).length;

  return {
    is_correct: isCorrect,
    correct_option_id: correctOption.id,
    explanation: sq.question.explanation,
    points_awarded: score.points,
    xp_awarded: score.xp,
    speed_bonus: score.speed_bonus,
    response_time_ms: responseTimeMs,
    running_points: session.rawPoints,
    running_correct: session.correct,
    running_answered: session.answered,
    questions_remaining: session.mode === "SPEED" ? null : remaining,
  };
}

export function previewComplete(sessionId: string): SessionSummary {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const unanswered = session.questions.filter((x) => x.answeredAt === null).length;
  const completed = session.mode === "SPEED" ? true : unanswered === 0;

  const scored = scoreSession(PREVIEW_SCORING, session.mode, {
    rawPoints: session.rawPoints,
    answered: session.answered,
    correct: session.correct,
    completed,
  });

  session.status = "COMPLETED";

  const avg =
    session.responseTimes.length > 0
      ? Math.round(
          session.responseTimes.reduce((a, b) => a + b, 0) /
            session.responseTimes.length,
        )
      : 0;

  return {
    session_id: session.id,
    mode: session.mode,
    subject_code: session.subjectCode,
    answered: session.answered,
    correct: session.correct,
    accuracy: scored.accuracy,
    raw_points: scored.raw_points,
    accuracy_factor: scored.accuracy_factor,
    final_points: scored.final_points,
    completion_bonus: scored.completion_bonus,
    xp_awarded: session.xp + scored.bonus_xp,
    avg_response_ms: avg,
    level_before: 12,
    // Show the level-up state occasionally so that path is reviewable too.
    level_after: scored.final_points > 600 ? 13 : 12,
  };
}
