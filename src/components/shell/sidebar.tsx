"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Gamepad2,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  Rocket,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  match?: string;
  badge?: string;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "My Desk",
    items: [
      { href: "/spm-games", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/spm-games/performance", label: "My Progress", icon: BarChart3 },
    ],
  },
  {
    title: "Compete",
    items: [
      { href: "/spm-games/play", label: "Mini Games", icon: Gamepad2 },
      {
        href: "/spm-games/leaderboard/overall",
        label: "Leaderboard",
        icon: Trophy,
        match: "/spm-games/leaderboard",
      },
      { href: "/spm-games/prizes", label: "Prizes", icon: Gift },
    ],
  },
  {
    title: "Support",
    items: [{ href: "/spm-games/help", label: "Help Center", icon: LifeBuoy }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.match ?? item.href);

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-white lg:flex">
      <Link
        href="/spm-games"
        className="flex h-[78px] items-center px-6"
        aria-label="EduPass — SPM Games"
      >
        <Logo variant="full" className="h-7" priority />
      </Link>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-2">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
              {group.title}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm font-semibold transition-colors duration-150",
                        active
                          ? "bg-brand-500 text-white shadow-brand"
                          : "text-muted hover:bg-brand-50 hover:text-brand-600",
                      )}
                    >
                      <item.icon size={20} strokeWidth={2} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Sits at the bottom of the rail, mirroring the reference's upsell
            slot — but pointed at the EduPass funnel rather than a paid tier,
            which is what the game exists to feed. */}
        <div className="mt-auto overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 p-4 text-white">
          <Rocket size={22} strokeWidth={2} className="mb-2" />
          <p className="font-display text-sm font-bold leading-snug">
            Ready for what&apos;s next?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/80">
            Complete your EduPass profile to see courses matched to how you play.
          </p>
          <a
            href="https://edupass.my/forstudents.html"
            className="mt-3 inline-flex rounded-full bg-white px-3.5 py-2 font-display text-xs font-bold text-brand-600"
          >
            Explore courses
          </a>
        </div>
      </nav>
    </aside>
  );
}
