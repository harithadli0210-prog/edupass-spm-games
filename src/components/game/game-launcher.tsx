"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { GameCard } from "@/components/game/game-card";
import {
  QuestionRunner,
  type StartedSession,
} from "@/components/game/question-runner";

interface Subject {
  code: string;
  name_en: string;
}

/**
 * Subject grid → live round.
 *
 * Renders as the colourful card grid, then swaps the whole area for the runner
 * once a round starts. Keeping both in one component means starting a game
 * never costs a page navigation, which matters most on Speedy where the clock
 * begins immediately.
 */
export function GameLauncher({
  mode,
  subjects,
  completedToday = [],
  mastery = {},
}: {
  mode: "DAILY" | "SPEED";
  subjects: Subject[];
  completedToday?: string[];
  mastery?: Record<string, { mastery: number; attempts: number }>;
}) {
  const router = useRouter();
  const [session, setSession] = useState<StartedSession | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) return <QuestionRunner session={session} />;

  const start = async (subjectCode: string) => {
    setStarting(subjectCode);
    setError(null);
    try {
      const res = await fetch("/api/spm/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, subject: subjectCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the round.");
      setSession(data as StartedSession);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the round.");
    } finally {
      setStarting(null);
    }
  };

  const metaFor = (code: string) => {
    const stat = mastery[code];
    if (mode === "DAILY") {
      return stat?.attempts
        ? `10 questions · ${Math.round(stat.mastery * 100)}% mastery`
        : "10 questions · once a day";
    }
    return stat?.attempts
      ? `60 seconds · ${Math.round(stat.mastery * 100)}% mastery`
      : "60 seconds · unlimited";
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg p-4 text-sm font-semibold text-danger-ink">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {subjects.map((subject) => (
          <GameCard
            key={subject.code}
            code={subject.code}
            name={subject.name_en}
            meta={metaFor(subject.code)}
            done={mode === "DAILY" && completedToday.includes(subject.code)}
            busy={starting === subject.code}
            disabled={starting !== null}
            onPlay={() => void start(subject.code)}
          />
        ))}
      </div>

      {mode === "DAILY" && completedToday.length === subjects.length && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-white p-4">
          <Lock size={20} strokeWidth={2} className="shrink-0 text-muted" />
          <p className="text-sm text-muted">
            All five subjects done for today. New questions unlock at midnight —
            or play Speedy Challenge now, it has no daily limit.
          </p>
        </div>
      )}
    </div>
  );
}
