import Link from "next/link";
import { CalendarCheck, Swords, Target, Zap } from "lucide-react";
import { currentStudent } from "@/lib/supabase/server";
import { getActiveSeason, getModeConfig } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import type { GameMode } from "@/lib/types";

export const metadata = { title: "Play" };
export const dynamic = "force-dynamic";

const MODES: {
  mode: GameMode;
  href: string;
  title: string;
  blurb: string;
  icon: typeof Zap;
}[] = [
  {
    mode: "DAILY",
    href: "/spm-games/play/daily",
    title: "Daily Challenge",
    blurb: "10 questions per subject, every day. Points build all season.",
    icon: CalendarCheck,
  },
  {
    mode: "SPEED",
    href: "/spm-games/play/speed",
    title: "Speedy Challenge",
    blurb: "60 seconds. Answer as many as you can — accuracy still counts.",
    icon: Zap,
  },
  {
    mode: "MISSION",
    href: "/spm-games/play/missions",
    title: "Subject Missions",
    blurb: "Work through a subject topic by topic.",
    icon: Target,
  },
  {
    mode: "BOSS",
    href: "/spm-games/play/boss",
    title: "Weekly Boss",
    blurb: "One subject, 20 questions, rising difficulty.",
    icon: Swords,
  },
];

export default async function PlayPage() {
  const student = await currentStudent();
  const season = await getActiveSeason();
  const isAdmin = Boolean(student?.is_admin);

  const configs = await Promise.all(
    MODES.map(async (m) => {
      const config = await getModeConfig(season.id, m.mode, isAdmin);
      // Resolve the mode a second time as a student would see it, so an admin
      // can tell at a glance which cards are only visible to them.
      const publicConfig = await getModeConfig(season.id, m.mode, false);
      return {
        ...m,
        enabled: config.enabled !== false,
        adminOnly: config.enabled !== false && publicConfig.enabled === false,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Choose a mode</h1>
        <p className="mt-1 text-sm text-muted">
          Daily and Speedy have their own leaderboards. Both feed your overall rank.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {configs.map((m) =>
          m.enabled ? (
            <Link
              key={m.mode}
              href={m.href}
              className="flex min-h-[132px] flex-col gap-2 rounded-lg border border-line bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-brand-100 text-brand-600">
                <m.icon size={20} strokeWidth={2} />
              </span>
              <span className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                {m.title}
                {m.adminOnly && <Badge tone="warning">Admin only</Badge>}
              </span>
              <span className="text-sm text-muted">{m.blurb}</span>
            </Link>
          ) : (
            <div
              key={m.mode}
              className="flex min-h-[132px] flex-col gap-2 rounded-lg border border-dashed border-line-strong bg-surface p-5"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-white text-faint">
                <m.icon size={20} strokeWidth={2} />
              </span>
              <span className="flex items-center gap-2 font-display text-base font-semibold text-muted">
                {m.title}
                <Badge tone="neutral">Soon</Badge>
              </span>
              <span className="text-sm text-muted">{m.blurb}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
