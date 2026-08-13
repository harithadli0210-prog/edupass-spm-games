import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 12840 → "12,840" */
export function formatPoints(n: number): string {
  return new Intl.NumberFormat("en-MY").format(Math.round(n));
}

/** 184 → "#184" */
export function formatRank(n: number | null | undefined): string {
  return n == null ? "—" : `#${new Intl.NumberFormat("en-MY").format(n)}`;
}

/** 0.8412 → "84%" */
export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 6432 → "6.4s" */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** 65 → "01:05" — the gameplay timer. */
export function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Malaysian time. The whole country is UTC+8 with no DST, so a fixed offset is
 * correct and avoids pulling in a timezone database.
 *
 * This matters more than it looks: "which day is it" decides which Daily
 * Challenge a student is allowed to play. Deriving that from the server's UTC
 * clock would roll the challenge over at 8am local time.
 */
export const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The current calendar date in Malaysia, as `YYYY-MM-DD`. */
export function malaysiaDate(at: Date = new Date()): string {
  return new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Good morning" / "Good afternoon" / "Good evening", by Malaysian clock. */
export function greeting(at: Date = new Date()): string {
  const hour = new Date(at.getTime() + MYT_OFFSET_MS).getUTCHours();
  if (hour < 12) return "Good morning";
  if (hour < 19) return "Good afternoon";
  return "Good evening";
}
