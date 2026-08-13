import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Form controls for the onboarding profile (spec §8).
 *
 * Deliberately plain: eight fields, one column, large targets. This screen sits
 * between a student and their first game, so every element of friction here is
 * a drop-off.
 */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="font-display text-sm font-semibold text-ink"
      >
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-danger-ink">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

const CONTROL =
  "h-12 w-full rounded-md border bg-white px-4 text-[15px] text-body " +
  "placeholder:text-faint transition-colors duration-150 " +
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 " +
  "disabled:bg-surface disabled:text-muted";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <input
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(CONTROL, invalid ? "border-danger" : "border-line", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <select
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      CONTROL,
      "appearance-none bg-[length:16px] bg-[right:16px_center] bg-no-repeat pr-11",
      // Chevron as a data URI so it costs no request and no icon component.
      "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%235b638c%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m4 6 4 4 4-4%22/></svg>')]",
      invalid ? "border-danger" : "border-line",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";
