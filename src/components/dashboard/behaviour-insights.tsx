import {
  Brain,
  Clock,
  Flame,
  Gauge,
  Languages,
  Microscope,
  Repeat,
  Sigma,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

/**
 * "What we're learning about you" (spec §26–27).
 *
 * These are signals, never diagnoses. The wording is chosen accordingly:
 * observations about how a student has played, not claims about who they are.
 * Nothing here is presented as psychological assessment.
 *
 * The section stays empty until the signals have real evidence behind them.
 * Inventing an insight for a student who has answered four questions would be
 * both wrong and, once they noticed, corrosive to everything else on the page.
 */
const LABELS: Record<string, { label: string; icon: LucideIcon; note: string }> = {
  FAST_THINKER: {
    label: "Fast thinker",
    icon: Zap,
    note: "You answer noticeably quicker than most players.",
  },
  CAREFUL_RESPONDER: {
    label: "Careful responder",
    icon: Clock,
    note: "You take your time and it shows in your accuracy.",
  },
  ANALYTICAL: {
    label: "Analytical",
    icon: Brain,
    note: "You do well on questions that need working out.",
  },
  DIFFICULTY_TOLERANT: {
    label: "Handles hard questions",
    icon: Gauge,
    note: "Your accuracy holds up on the toughest questions.",
  },
  PRESSURE_PERFORMER: {
    label: "Strong under time pressure",
    icon: Target,
    note: "Your accuracy stays high in timed rounds.",
  },
  MATHEMATICAL_STRONG: {
    label: "Strong in Mathematics",
    icon: Sigma,
    note: "Mathematics is among your best subjects.",
  },
  SCIENCE_STRONG: {
    label: "Strong in Science",
    icon: Microscope,
    note: "Science is among your best subjects.",
  },
  LANGUAGE_STRONG: {
    label: "Strong in languages",
    icon: Languages,
    note: "You perform well across BM and English.",
  },
  CONSISTENT: {
    label: "Consistent",
    icon: Flame,
    note: "You show up and play regularly.",
  },
  PERSISTENT: {
    label: "Persistent",
    icon: Repeat,
    note: "You come back to topics until they click.",
  },
};

export function BehaviourInsights({
  signals,
  hasPlayed,
}: {
  signals: { signal: string; value: number; confidence: number }[];
  hasPlayed: boolean;
}) {
  const shown = signals
    .filter((s) => LABELS[s.signal])
    .slice(0, 3); // Three at most — this section must not become a wall.

  return (
    <section>
      <SectionHeading
        title="What we're learning about you"
        description="Based on how you've played so far."
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Brain size={24} strokeWidth={2} />}
          title={hasPlayed ? "Still watching" : "Play a few rounds first"}
          description={
            hasPlayed
              ? "A few more rounds and your playing patterns will start showing up here."
              : "Once you've played, this is where we'll show what your answers suggest about how you learn."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((signal) => {
            const meta = LABELS[signal.signal];
            return (
              <div
                key={signal.signal}
                className="flex items-start gap-3 rounded-lg border border-line bg-white p-4"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-600">
                  <meta.icon size={20} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-ink">
                    {meta.label}
                  </div>
                  <p className="text-sm text-muted">{meta.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
