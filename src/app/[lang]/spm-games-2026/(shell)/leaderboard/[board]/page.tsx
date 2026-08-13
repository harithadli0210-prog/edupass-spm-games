import { notFound } from "next/navigation";
import { TabStrip } from "@/components/ui/tabs";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { currentStudent } from "@/lib/supabase/server";
import { appPath, getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { LEADERBOARDS, type LeaderboardKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const ORDER: LeaderboardKey[] = [
  "overall",
  "daily",
  "speed",
  "subject",
  "school",
  "consistency",
  "improved",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; board: string }>;
}) {
  const { lang, board } = await params;
  const dict = getDictionary((isLocale(lang) ? lang : "en") as Locale);
  const tab = dict.leaderboard.tabs[board as LeaderboardKey];
  return { title: tab ? `${tab} — ${dict.leaderboard.title}` : dict.leaderboard.title };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ lang: string; board: string }>;
}) {
  const { lang, board } = await params;
  if (!LEADERBOARDS.includes(board as LeaderboardKey)) notFound();

  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);
  const key = board as LeaderboardKey;

  const student = await currentStudent();
  const data = await getLeaderboard({ board: key, studentId: student!.id });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          {dict.leaderboard.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{dict.leaderboard.blurbs[key]}</p>
      </div>

      <TabStrip
        items={ORDER.map((k) => ({
          key: k,
          label: dict.leaderboard.tabs[k],
          href: appPath(locale, `/leaderboard/${k}`),
        }))}
        activeKey={key}
      />

      <LeaderboardTable board={key} data={data} dict={dict} />
    </div>
  );
}
