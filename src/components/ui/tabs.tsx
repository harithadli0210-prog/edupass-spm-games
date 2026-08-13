"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Horizontally scrolling tab strip.
 *
 * The leaderboard has seven tabs and the performance page has six subject
 * filters — neither fits across a 360px phone, so the strip scrolls rather than
 * wrapping to two rows or collapsing into a dropdown. Spec §35.
 */
export function TabStrip({
  items,
  activeKey,
  className,
}: {
  items: { key: string; label: string; href: string }[];
  activeKey: string;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-150",
              active
                ? "bg-brand-500 text-white"
                : "bg-surface-2 text-muted hover:bg-brand-200 hover:text-brand-700",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same strip, driven by state instead of routes (performance page filters). */
export function ToggleStrip({
  items,
  activeKey,
  onChange,
  className,
}: {
  items: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-none flex gap-1.5 overflow-x-auto pb-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-150",
              active
                ? "bg-brand-500 text-white"
                : "bg-surface-2 text-muted hover:bg-brand-200 hover:text-brand-700",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
