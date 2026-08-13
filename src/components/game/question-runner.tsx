"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { DifficultyBadge } from "@/components/ui/badge";
import { SubjectIcon } from "@/components/ui/subject-icon";
import { ErrorState } from "@/components/ui/states";
import { SessionSummaryCard } from "@/components/game/session-summary";
import { cn, formatClock } from "@/lib/utils";
import type { AnswerResult, ServedQuestion, SessionSummary } from "@/lib/types";

export interface StartedSession {
  session_id: string;
  mode: "DAILY" | "SPEED";
  subject_code: string;
  total_questions: number;
  round_seconds: number | null;
  expires_at: string;
  /** Shipped with the start response, so the round opens without a fetch. */
  first_question: ServedQuestion | null;
}

type Phase = "loading" | "question" | "feedback" | "finished" | "error";

/**
 * Module scope on purpose: reading the clock is impure, and the React Compiler
 * correctly refuses it inside a component body. The elapsed figure is only ever
 * sent for drift comparison - the server derives the real response time from
 * its own served_at stamp.
 */
function nowMs(): number {
  return Date.now();
}

function elapsedSince(startMs: number): number {
  return nowMs() - startMs;
}

/**
 * The gameplay loop.
 *
 * Pace is the whole design here. Feedback renders as an inline strip beneath
 * the options and the next question arrives on a short timer - a modal per
 * question would double the taps and destroy a 60-second Speedy round
 * (spec section 33).
 */
export function QuestionRunner({ session }: { session: StartedSession }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(
    session.first_question ? "question" : "loading",
  );
  const [question, setQuestion] = useState<ServedQuestion | null>(
    session.first_question,
  );
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [answered, setAnswered] = useState(0);

  const shownAt = useRef<number>(0);
  const submitting = useRef(false);

  const deadline = useRef<number>(new Date(session.expires_at).getTime());
  const [remaining, setRemaining] = useState<number | null>(
    session.round_seconds ? session.round_seconds : null,
  );

  /* ---------------------------------------------------------------------- */

  const finish = useCallback(async () => {
    try {
      const res = await fetch(`/api/spm/sessions/${session.session_id}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not finish the round.");
      setSummary(data as SessionSummary);
      setPhase("finished");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish the round.");
      setPhase("error");
    }
  }, [session.session_id, router]);

  const loadNext = useCallback(async () => {
    try {
      const res = await fetch(`/api/spm/sessions/${session.session_id}/next`);
      const data = await res.json();

      if (!res.ok) {
        // A closed session is the expected end of a Speedy round, not a fault.
        if (data.code === "SESSION_CLOSED") return finish();
        throw new Error(data.error ?? "Could not load the question.");
      }

      if (data.exhausted || !data.question) return finish();

      setQuestion(data.question as ServedQuestion);
      setSelected(null);
      setResult(null);
      shownAt.current = nowMs();
      setPhase("question");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the question.");
      setPhase("error");
    }
  }, [session.session_id, finish]);

  // The first question arrived with the start response, so there is no
  // fetch-on-mount here at all. Every later question is loaded from the answer
  // handler, which is an event rather than an effect.
  useEffect(() => {
    shownAt.current = nowMs();
  }, []);

  /* ---- Round clock ------------------------------------------------------ */
  useEffect(() => {
    if (!session.round_seconds) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((deadline.current - nowMs()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(tick);
        void finish();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [session.round_seconds, finish]);

  /* ---- Answer ----------------------------------------------------------- */
  const answer = async (optionId: string) => {
    if (submitting.current || phase !== "question" || !question) return;
    submitting.current = true;
    setSelected(optionId);

    try {
      const res = await fetch(`/api/spm/sessions/${session.session_id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: question.question_id,
          option_id: optionId,
          client_elapsed_ms: elapsedSince(shownAt.current),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "SESSION_CLOSED") return finish();
        throw new Error(data.error ?? "Could not record your answer.");
      }

      const answerResult = data as AnswerResult;
      setResult(answerResult);
      setPoints(answerResult.running_points);
      setAnswered(answerResult.running_answered);
      setPhase("feedback");

      // A correct answer needs only a beat of confirmation. A wrong one holds
      // longer so the explanation is actually readable - the explanation is the
      // learning, and rushing past it wastes the only teaching moment the
      // format has.
      const dwell = answerResult.is_correct ? 900 : 2600;
      setTimeout(() => {
        submitting.current = false;
        void loadNext();
      }, dwell);
    } catch (e) {
      submitting.current = false;
      setError(e instanceof Error ? e.message : "Could not record your answer.");
      setPhase("error");
    }
  };

  /* ---------------------------------------------------------------------- */

  if (phase === "error") {
    return (
      <ErrorState
        title="The round hit a problem"
        description={error ?? undefined}
        onRetry={() => {
          setError(null);
          setPhase("loading");
          void loadNext();
        }}
      />
    );
  }

  if (phase === "finished" && summary) {
    return <SessionSummaryCard summary={summary} />;
  }

  const total = session.total_questions;
  const isSpeed = session.mode === "SPEED";
  const timeLow = remaining != null && remaining <= 10;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* ---- Status bar ---- */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SubjectIcon code={session.subject_code} size="sm" />
          <div>
            <div className="font-display text-sm font-semibold text-ink">
              {question?.subject_code ?? session.subject_code}
            </div>
            <div className="tnum text-xs text-muted">
              {isSpeed
                ? `${answered} answered`
                : `Question ${String(question?.position ?? answered + 1).padStart(2, "0")} / ${total}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Points
            </div>
            <motion.div
              key={points}
              initial={{ y: -3, opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              className="tnum font-display text-lg font-bold leading-none text-ink"
            >
              {points}
            </motion.div>
          </div>

          {remaining != null && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 font-display font-bold tabular-nums transition-colors",
                timeLow ? "bg-danger-bg text-danger-ink" : "bg-white text-ink",
              )}
            >
              <Timer size={16} strokeWidth={2.4} />
              {formatClock(remaining)}
            </div>
          )}
        </div>
      </div>

      {!isSpeed && (
        <ProgressBar value={answered} max={total} label="Round progress" />
      )}

      {/* ---- Question ---- */}
      <AnimatePresence mode="wait">
        {question && (
          <motion.div
            key={question.question_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-lg border border-line bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <DifficultyBadge label={question.difficulty_label} />
                {question.topic_name && (
                  <span className="truncate text-xs text-muted">
                    {question.topic_name}
                  </span>
                )}
              </div>
              <p className="text-[17px] leading-relaxed text-ink">{question.stem}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              {question.options.map((option) => {
                const isPicked = selected === option.option_id;
                const isRight =
                  result != null && result.correct_option_id === option.option_id;
                const isWrongPick = result != null && isPicked && !result.is_correct;

                return (
                  <motion.button
                    key={option.option_id}
                    onClick={() => answer(option.option_id)}
                    disabled={phase !== "question"}
                    animate={isWrongPick ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                    transition={{ duration: 0.32 }}
                    className={cn(
                      "flex min-h-[60px] items-center gap-3 rounded-md border-2 bg-white p-4 text-left transition-colors duration-150",
                      "disabled:cursor-default",
                      !result && "border-line hover:border-brand-400 active:bg-brand-50",
                      !result && isPicked && "border-brand-500 bg-brand-50",
                      isRight && "border-success bg-success-bg",
                      isWrongPick && "border-danger bg-danger-bg",
                      result && !isRight && !isWrongPick && "opacity-55",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-sm font-display text-sm font-bold",
                        isRight
                          ? "bg-success text-white"
                          : isWrongPick
                            ? "bg-danger text-white"
                            : "bg-surface-2 text-brand-600",
                      )}
                    >
                      {isRight ? (
                        <Check size={18} strokeWidth={3} />
                      ) : isWrongPick ? (
                        <X size={18} strokeWidth={3} />
                      ) : (
                        option.label
                      )}
                    </span>
                    <span className="text-[15px] leading-snug text-body">
                      {option.content}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Inline feedback ---- */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "rounded-md border p-4",
                result.is_correct
                  ? "border-success/30 bg-success-bg"
                  : "border-danger/30 bg-danger-bg",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span
                  className={cn(
                    "font-display text-base font-bold",
                    result.is_correct ? "text-success-ink" : "text-danger-ink",
                  )}
                >
                  {result.is_correct ? "Correct" : "Not quite"}
                </span>
                {result.points_awarded !== 0 && (
                  <span className="tnum font-display text-sm font-semibold text-ink">
                    {result.points_awarded > 0 ? "+" : ""}
                    {result.points_awarded} points
                  </span>
                )}
                {result.speed_bonus > 0 && (
                  <span className="tnum text-sm font-semibold text-warning-ink">
                    +{result.speed_bonus} speed
                  </span>
                )}
                <span className="tnum text-sm text-muted">+{result.xp_awarded} XP</span>
              </div>

              {!result.is_correct && result.explanation && (
                <p className="mt-2 text-sm leading-relaxed text-body">
                  {result.explanation}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSpeed && phase === "question" && (
        <Button variant="ghost" size="sm" onClick={() => void finish()}>
          End round early
        </Button>
      )}
    </div>
  );
}

