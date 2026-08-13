"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented one-time-code input.
 *
 * Six boxes rather than one field, because the shape of the input tells the
 * student how long the code is before they type anything — no hint text
 * required, and no way to submit four digits and wonder why it failed.
 *
 * The behaviours that matter on a phone:
 *   · typing advances, backspace on an empty box steps back
 *   · pasting the whole code from the email fills every box
 *   · the numeric keypad opens, not the full keyboard
 *   · completing the last digit submits, saving a deliberate tap
 *
 * The boxes are inputs rather than a styled single field so that each one is
 * individually focusable, which is what makes correcting a middle digit
 * possible without retyping the rest.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid,
  disabled,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const setAt = (index: number, digit: string) => {
    const chars = value.padEnd(length, " ").split("");
    chars[index] = digit || " ";
    commit(chars.join("").replace(/\s+$/, "").trimEnd());
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    setAt(index, digit);
    if (index < length - 1) boxes.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]?.trim()) {
        setAt(index, "");
      } else if (index > 0) {
        // Empty box: step back and clear that one instead, which is what
        // holding backspace is meant to do.
        setAt(index - 1, "");
        boxes.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      boxes.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    commit(pasted);
    boxes.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div
      className="flex justify-between gap-2"
      onPaste={handlePaste}
      role="group"
      aria-label={label}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`${label ?? "Digit"} ${i + 1}`}
          value={digits[i]?.trim() ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-full min-w-0 rounded-md border-2 bg-white text-center",
            "font-display text-xl font-bold tabular-nums text-ink",
            "transition-colors duration-150",
            "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
            "disabled:bg-surface disabled:text-muted",
            invalid ? "border-danger" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
