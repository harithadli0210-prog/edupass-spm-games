import * as React from "react";
import { cn } from "@/lib/utils";
import type { DifficultyLabel } from "@/lib/types";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-100 text-brand-600",
  success: "bg-success-bg text-success-ink",
  warning: "bg-warning-bg text-warning-ink",
  danger: "bg-danger-bg text-danger-ink",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "font-display text-[11px] font-bold uppercase tracking-[0.06em]",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Difficulty is the one place a three-colour scale is justified, and it reuses
 * the existing semantic tokens rather than introducing new hues. Subjects
 * deliberately do NOT get colours — see SubjectIcon.
 */
export function DifficultyBadge({ label }: { label: DifficultyLabel }) {
  const tone = (
    { EASY: "success", MEDIUM: "warning", HARD: "danger" } as const
  )[label];
  return <Badge tone={tone}>{label}</Badge>;
}
