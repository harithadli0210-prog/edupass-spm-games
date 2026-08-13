"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

/**
 * Used for question progress, XP-to-next-level and subject mastery.
 *
 * The width transition is the animation — no shimmer, no stripes, no pulse.
 * Spec §34: motion should feel premium, which mostly means restrained.
 */
export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  size = "md",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  className?: string;
  label?: string;
}) {
  const pct = clamp((value / (max || 1)) * 100, 0, 100);

  const fill = {
    brand: "bg-brand-500",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-brand-100",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
