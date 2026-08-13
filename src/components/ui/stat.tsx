import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The dashboard's headline numbers: rank, overall score, XP, streak.
 *
 * All four render at identical height regardless of how many digits the value
 * carries — a rank of "#7" and a score of "12,840" must not produce tiles of
 * different sizes sitting next to each other.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "brand" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[104px] flex-col justify-between rounded-lg border border-line bg-white p-4",
        tone === "brand" && "border-brand-200 bg-brand-50",
        tone === "warning" && "border-warning/25 bg-warning-bg",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={cn(
              "shrink-0",
              tone === "warning" ? "text-warning-ink" : "text-brand-500",
            )}
          >
            {icon}
          </span>
        )}
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
      </div>
      <div>
        <div className="tnum font-display text-[28px] font-bold leading-none text-ink">
          {value}
        </div>
        {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
}
