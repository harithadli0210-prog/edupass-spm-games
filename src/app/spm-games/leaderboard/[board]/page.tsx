import { notFound } from "next/navigation";
import { TabStrip } from "@/components/ui/tabs";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { currentStudent } from "@/lib/supabase/server";
import { LEADERBOARDS, type LeaderboardKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: { key: LeaderboardKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "daily", label: "Daily" },
  { key: "speed", label: "Speedy" },
  { key: "subject", label: "Subjects" },
  { key: "school", label: "Schools" },
  { key: "consistency", label: "Consistency" },
  { key: "improved", label: "Most Improved" },
];

const BLURBS: Record<LeaderboardKey, string> = {
  overall: "Daily and Speedy combined, weighted. The headline competition.",
  daily: "Daily Challenge points only, accumulated across the season.",
  speed: "Speedy Challenge points only, accumulated across the season.",
  subject: "Best in each subject.",
  school: "Ranked by average score, so a big school has no advantage.",
  consistency: "Rewards showing up regularly, not playing the most hours.",
  improved:
    "Biggest genuine improvement from September to October. Needs a real record in both months to qualify.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board } = await params;
  const tab = TABS.find((t) => t.key === board);
  return { title: tab ? `${tab.label} leaderboard` : "Leaderboard" };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board } = await params;
  if (!LEADERBOARDS.includes(board as LeaderboardKey)) notFound();

  const key = board as LeaderboardKey;
  const student = await currentStudent();
  const data = await getLeaderboard({ board: key, studentId: student!.id });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted">{BLURBS[key]}</p>
      </div>

      <TabStrip
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          href: `/spm-games/leaderboard/${t.key}`,
        }))}
        activeKey={key}
      />

      <LeaderboardTable board={key} data={data} />
    </div>
  );
}
