import Link from "next/link";
import { CalendarCheck, Swords, Target, Zap } from "lucide-react";
import { currentStudent } from "@/lib/supabase/server";
import { getActiveSeason, getModeConfig } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { appPath, getDictionary, isLocale, type Locale } from "@/lib/i18n";
import type { GameMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);

  const student = await currentStudent();
  const season = await getActiveSeason();
  const isAdmin = Boolean(student?.is_admin);

  const modes: {
    mode: GameMode;
    path: string;
    title: string;
    blurb: string;
    icon: typeof Zap;
  }[] = [
    { mode: "DAILY", path: "/play/daily", title: dict.play.daily, blurb: dict.play.dailyBlurb, icon: CalendarCheck },
    { mode: "SPEED", path: "/play/speed", title: dict.play.speed, blurb: dict.play.speedBlurb, icon: Zap },
    { mode: "MISSION", path: "/play/missions", title: dict.play.mission, blurb: dict.play.missionBlurb, icon: Target },
    { mode: "BOSS", path: "/play/boss", title: dict.play.boss, blurb: dict.play.bossBlurb, icon: Swords },
  ];

  const configs = await Promise.all(
    modes.map(async (m) => {
      const config = await getModeConfig(season.id, m.mode, isAdmin);
      // Resolved a second time as a student would see it, so an admin can tell
      // at a glance which cards only they can reach.
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
        <h1 className="font-display text-2xl font-bold text-ink">{dict.play.chooseMode}</h1>
        <p className="mt-1 text-sm text-muted">{dict.play.chooseModeSub}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {configs.map((m) =>
          m.enabled ? (
            <Link
              key={m.mode}
              href={appPath(locale, m.path)}
              className="flex min-h-[132px] flex-col gap-2 rounded-md border border-line bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-sm bg-brand-100 text-brand-600">
                <m.icon size={20} strokeWidth={2} />
              </span>
              <span className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                {m.title}
                {m.adminOnly && <Badge tone="warning">{dict.common.adminOnly}</Badge>}
              </span>
              <span className="text-sm text-muted">{m.blurb}</span>
            </Link>
          ) : (
            <div
              key={m.mode}
              className="flex min-h-[132px] flex-col gap-2 rounded-md border border-dashed border-line-strong bg-surface p-5"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-sm bg-white text-faint">
                <m.icon size={20} strokeWidth={2} />
              </span>
              <span className="flex items-center gap-2 font-display text-base font-semibold text-muted">
                {m.title}
                <Badge tone="neutral">{dict.common.soon}</Badge>
              </span>
              <span className="text-sm text-muted">{m.blurb}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
