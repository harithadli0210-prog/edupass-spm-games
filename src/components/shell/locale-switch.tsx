"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import {
  LOCALES,
  LOCALE_SHORT,
  localeFromPath,
  switchLocalePath,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Language switch.
 *
 * Keeps the reader on the same page rather than dumping them at the dashboard —
 * switching language mid-way through the leaderboard should show the same
 * leaderboard, not start over.
 *
 * `prefetch={false}` because the other language is rarely clicked, and
 * prefetching it would double the payload of every page for no benefit.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const pathname = usePathname();
  const current = localeFromPath(pathname);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-surface-2 p-1",
        className,
      )}
    >
      <Languages
        size={15}
        strokeWidth={2}
        className="ml-2 mr-0.5 shrink-0 text-muted"
        aria-hidden
      />
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={switchLocalePath(pathname, locale)}
            prefetch={false}
            hrefLang={locale}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full px-2.5 py-1 font-display text-[11px] font-bold transition-colors duration-150",
              active
                ? "bg-white text-brand-600 shadow-soft"
                : "text-muted hover:text-brand-600",
            )}
          >
            {LOCALE_SHORT[locale]}
          </Link>
        );
      })}
    </div>
  );
}
