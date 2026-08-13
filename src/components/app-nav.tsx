"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Home, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/spm-games", label: "Home", icon: Home, exact: true },
  { href: "/spm-games/play", label: "Play", icon: Gamepad2 },
  { href: "/spm-games/leaderboard/overall", label: "Ranking", icon: Trophy, match: "/spm-games/leaderboard" },
  { href: "/spm-games/performance", label: "Progress", icon: TrendingUp },
];

/**
 * Top nav on desktop, fixed bottom bar on mobile.
 *
 * Bottom navigation is the right call here rather than a hamburger: students
 * play one-handed on a phone, and the four destinations are all thumb-reachable
 * at the bottom of the screen. Icon sizes are locked to the 24px navigation
 * step from spec §4.
 */
export function AppNav() {
  const pathname = usePathname();

  const isActive = (item: (typeof ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.match ?? item.href);

  return (
    <>
      {/* Tablet only. Below that the bottom bar takes over; above it the
          sidebar does, so this strip exists for the band in between. */}
      <nav className="hidden items-center gap-1 sm:flex lg:hidden">
        {ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-150",
                active
                  ? "bg-white text-brand-600 shadow-soft"
                  : "text-brand-900/70 hover:bg-white/60 hover:text-brand-600",
              )}
            >
              <item.icon size={20} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-4">
          {ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-brand-500" : "text-muted",
                )}
              >
                <item.icon size={24} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
