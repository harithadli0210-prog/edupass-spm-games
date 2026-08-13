"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Gamepad2,
  Gift,
  LayoutDashboard,
  FileText,
  LifeBuoy,
  ShieldCheck,
  Rocket,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { appPath, localeFromPath, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Item {
  path: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  match?: string;
}

export function Sidebar({ dict }: { dict: Dictionary }) {
  const pathname = usePathname();
  const lang = localeFromPath(pathname);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: dict.nav.myDesk,
      items: [
        { path: "", label: dict.nav.dashboard, icon: LayoutDashboard, exact: true },
        { path: "/performance", label: dict.nav.progress, icon: BarChart3 },
      ],
    },
    {
      title: dict.nav.compete,
      items: [
        { path: "/play", label: dict.nav.miniGames, icon: Gamepad2 },
        {
          path: "/leaderboard/overall",
          label: dict.nav.leaderboard,
          icon: Trophy,
          match: "/leaderboard",
        },
        { path: "/prizes", label: dict.nav.prizes, icon: Gift },
      ],
    },
    {
      title: dict.nav.support,
      items: [
        { path: "/help", label: dict.nav.help, icon: LifeBuoy },
        { path: "/rules", label: dict.policy.rules, icon: FileText },
        { path: "/privacy", label: dict.policy.privacy, icon: ShieldCheck },
      ],
    },
  ];

  const isActive = (item: Item) => {
    const href = appPath(lang, item.path);
    if (item.exact) return pathname === href || pathname === `${href}/`;
    return pathname.startsWith(appPath(lang, item.match ?? item.path));
  };

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-white lg:flex">
      <Link
        href={appPath(lang)}
        className="flex h-[78px] items-center px-6"
        aria-label="edupass.my — SPM Games"
      >
        <Logo variant="full" className="h-7" priority />
      </Link>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
              {group.title}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.path}>
                    <Link
                      href={appPath(lang, item.path)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-sm px-3 py-2.5 font-display text-sm font-semibold transition-colors duration-150",
                        active
                          ? "bg-brand-500 text-white shadow-brand"
                          : "text-muted hover:bg-brand-50 hover:text-brand-600",
                      )}
                    >
                      <item.icon size={20} strokeWidth={2} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-4">
          <LocaleSwitch />

          {/* Points at the EduPass funnel rather than a paid tier — that is
              what the game exists to feed. */}
          <div className="overflow-hidden rounded-md bg-gradient-to-br from-brand-500 to-accent-500 p-4 text-white">
            <Rocket size={22} strokeWidth={2} className="mb-2" />
            <p className="font-display text-sm font-bold leading-snug">
              {dict.nav.upsellTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/80">
              {dict.nav.upsellBody}
            </p>
            <a
              href={`https://edupass.my/${lang}/`}
              className="mt-3 inline-flex rounded-full bg-white px-3.5 py-2 font-display text-xs font-bold text-brand-600"
            >
              {dict.nav.upsellCta}
            </a>
          </div>
        </div>
      </nav>
    </aside>
  );
}
