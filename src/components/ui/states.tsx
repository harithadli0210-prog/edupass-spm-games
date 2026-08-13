import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/**
 * Loading, empty and error states.
 *
 * These matter unusually much here: on 1 September every student has zero
 * attempts, zero rank and no trend. The whole product's first impression is an
 * empty state, so they are built as first-class components rather than
 * afterthoughts — spec §49 items 16–18.
 */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-brand-100", className)}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-3 inline-flex size-12 items-center justify-center rounded-lg bg-brand-100 text-brand-500">
          {icon}
        </span>
      )}
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this just now. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-danger/25 bg-danger-bg px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-lg bg-white text-danger">
        <AlertCircle size={24} strokeWidth={2} />
      </span>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw size={16} strokeWidth={2} />
          Try again
        </Button>
      )}
    </div>
  );
}
