"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Home, Trophy, TrendingUp, type LucideIcon } from "lucide-react";
import { appPath, localeFromPath, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Tablet strip plus the fixed mobile bottom bar.
 *
 * Bottom navigation rather than a hamburger: students play one-handed on a
 * phone, and all four destinations stay thumb-reachable. Icons are locked to
 * the 24px navigation step.
 */
export function AppNav({ dict }: { dict: Dictionary }) {
  const pathname = usePathname();
  const lang = localeFromPath(pathname);

  const items: {
    path: string;
    label: string;
    icon: LucideIcon;
    exact?: boolean;
    match?: string;
  }[] = [
    { path: "", label: dict.nav.home, icon: Home, exact: true },
    { path: "/play", label: dict.common.play, icon: Gamepad2 },
    {
      path: "/leaderboard/overall",
      label: dict.nav.ranking,
      icon: Trophy,
      match: "/leaderboard",
    },
    { path: "/performance", label: dict.nav.progress, icon: TrendingUp },
  ];

  const isActive = (item: (typeof items)[number]) => {
    const href = appPath(lang, item.path);
    if (item.exact) return pathname === href || pathname === `${href}/`;
    return pathname.startsWith(appPath(lang, item.match ?? item.path));
  };

  return (
    <>
      {/* Tablet only: below this the bottom bar takes over, above it the
          sidebar does. */}
      <nav className="hidden items-center gap-1 sm:flex lg:hidden">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              href={appPath(lang, item.path)}
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
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                href={appPath(lang, item.path)}
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
