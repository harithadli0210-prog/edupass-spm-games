"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, Target, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubjectIcon } from "@/components/ui/subject-icon";
import { formatDuration, formatPercent, formatPoints } from "@/lib/utils";
import { appPath, localeFromPath, t, type Dictionary } from "@/lib/i18n";
import type { SessionSummary } from "@/lib/types";

/**
 * End-of-round summary.
 *
 * The accuracy factor is shown explicitly rather than folded silently into the
 * total. A student who answers fast and badly should be able to see exactly
 * where their points went — an invisible penalty reads as a bug, and a visible
 * one changes behaviour.
 */
export function SessionSummaryCard({
  summary,
  dict,
}: {
  summary: SessionSummary;
  dict: Dictionary;
}) {
  const lang = localeFromPath(usePathname());
  const gateApplied = summary.accuracy_factor < 1;
  const levelledUp = summary.level_after > summary.level_before;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex max-w-lg flex-col gap-5"
    >
      {levelledUp && (
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-bg p-4"
        >
          <Sparkles size={24} strokeWidth={2} className="shrink-0 text-warning-ink" />
          <div>
            <div className="font-display text-base font-bold text-ink">
              {t(dict.game.levelUp, { level: summary.level_after })}
            </div>
            <div className="text-sm text-muted">
              {t(dict.game.levelUpBody, { from: summary.level_before })}
            </div>
          </div>
        </motion.div>
      )}

      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <div className="mb-4 flex justify-center">
          <SubjectIcon code={summary.subject_code} size="lg" active />
        </div>

        <div className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {dict.game.roundScore}
        </div>
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
          className="tnum font-display text-[52px] font-extrabold leading-none text-brand-500"
        >
          {formatPoints(summary.final_points)}
        </motion.div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
          <SummaryStat
            icon={<Target size={16} strokeWidth={2} />}
            label={dict.common.accuracy}
            value={formatPercent(summary.accuracy)}
          />
          <SummaryStat
            icon={<Timer size={16} strokeWidth={2} />}
            label={dict.game.avgTime}
            value={formatDuration(summary.avg_response_ms)}
          />
          <SummaryStat
            icon={<Zap size={16} strokeWidth={2} />}
            label={dict.common.xp}
            value={`+${formatPoints(summary.xp_awarded)}`}
          />
        </div>
      </div>

      {/* Show the arithmetic. */}
      <div className="rounded-lg border border-line bg-white p-5">
        <ul className="flex flex-col gap-2.5 text-sm">
          <li className="flex justify-between">
            <span className="text-muted">
              {t(dict.game.correctOf, {
                correct: summary.correct,
                answered: summary.answered,
              })}
            </span>
            <span className="tnum font-semibold text-ink">
              {formatPoints(summary.raw_points)}
            </span>
          </li>
          {gateApplied && (
            <li className="flex justify-between">
              <span className="text-muted">
                {t(dict.game.accuracyMultiplier, {
                  factor: summary.accuracy_factor.toFixed(2),
                })}
              </span>
              <span className="tnum font-semibold text-danger-ink">
                &minus;
                {formatPoints(
                  summary.raw_points - Math.round(summary.raw_points * summary.accuracy_factor),
                )}
              </span>
            </li>
          )}
          {summary.completion_bonus > 0 && (
            <li className="flex justify-between">
              <span className="text-muted">{dict.game.completionBonus}</span>
              <span className="tnum font-semibold text-success-ink">
                +{formatPoints(summary.completion_bonus)}
              </span>
            </li>
          )}
          <li className="flex justify-between border-t border-line pt-2.5">
            <span className="font-display font-semibold text-ink">
              {dict.game.total}
            </span>
            <span className="tnum font-display font-bold text-ink">
              {formatPoints(summary.final_points)}
            </span>
          </li>
        </ul>

        {gateApplied && (
          <p className="mt-4 rounded-md bg-surface p-3 text-xs leading-relaxed text-muted">
            {dict.game.gateNote}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button
          variant="primary"
          fullWidth
          onClick={() => window.location.reload()}
        >
          {dict.game.playAgain}
        </Button>
        <Link
          href={appPath(lang)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-brand-500 bg-white px-7 font-display text-[15px] font-semibold text-brand-900 transition-colors duration-200 hover:bg-brand-500 hover:text-white"
        >
          {dict.game.backHome}
          <ArrowRight size={18} strokeWidth={2} />
        </Link>
      </div>
    </motion.div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-brand-500">{icon}</span>
      <span className="tnum font-display text-base font-bold text-ink">{value}</span>
      <span className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</span>
    </div>
  );
}
