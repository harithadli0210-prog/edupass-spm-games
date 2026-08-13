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
import type { Dictionary } from "@/lib/i18n";

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
const ICONS: Record<string, LucideIcon> = {
  FAST_THINKER: Zap,
  CAREFUL_RESPONDER: Clock,
  ANALYTICAL: Brain,
  DIFFICULTY_TOLERANT: Gauge,
  PRESSURE_PERFORMER: Target,
  MATHEMATICAL_STRONG: Sigma,
  SCIENCE_STRONG: Microscope,
  LANGUAGE_STRONG: Languages,
  CONSISTENT: Flame,
  PERSISTENT: Repeat,
};

export function BehaviourInsights({
  signals,
  hasPlayed,
  dict,
}: {
  signals: { signal: string; value: number; confidence: number }[];
  hasPlayed: boolean;
  dict: Dictionary;
}) {
  // Three at most — this section must not become a wall.
  const shown = signals.filter((s) => s.signal in ICONS).slice(0, 3);

  return (
    <section>
      <SectionHeading
        title={dict.insights.title}
        description={dict.insights.sub}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<Brain size={24} strokeWidth={2} />}
          title={hasPlayed ? dict.insights.stillWatching : dict.insights.playFirst}
          description={
            hasPlayed
              ? dict.insights.stillWatchingBody
              : dict.insights.playFirstBody
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((signal) => {
            const Icon = ICONS[signal.signal];
            const meta =
              dict.insights.signals[
                signal.signal as keyof typeof dict.insights.signals
              ];
            return (
              <div
                key={signal.signal}
                className="flex items-start gap-3 rounded-lg border border-line bg-white p-4"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-600">
                  <Icon size={20} strokeWidth={2} />
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
