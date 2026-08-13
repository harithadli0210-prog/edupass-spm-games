import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { cn, formatPoints, formatRank } from "@/lib/utils";
import type { LeaderboardPayload } from "@/lib/queries/leaderboard";
import type { Dictionary } from "@/lib/i18n";
import type { LeaderboardKey, LeaderboardRow } from "@/lib/types";

/**
 * Server-rendered. The tab strip navigates by route, so there is nothing here
 * that needs client state, a fetch, or a loading spinner - the ranked rows
 * arrive with the page.
 */
export function LeaderboardTable({
  board,
  data,
  dict,
}: {
  board: LeaderboardKey;
  data: LeaderboardPayload;
  dict: Dictionary;
}) {
  if (board === "school") {
    if (data.schools.length === 0) {
      return (
        <EmptyState
          icon={<Trophy size={24} strokeWidth={2} />}
          title={dict.leaderboard.noSchools}
          description={dict.leaderboard.noSchoolsBody}
        />
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {data.schools.map((school) => (
          <div
            key={school.school_id}
            className="flex min-h-[62px] items-center gap-3 rounded-lg border border-line bg-white px-4 py-3"
          >
            <RankBadge rank={school.rank} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm font-semibold text-ink">
                {school.school_name}
              </div>
              <div className="truncate text-xs text-muted">
                {[school.state_name, `${school.participants} ${dict.common.players}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="tnum font-display text-base font-bold text-ink">
              {formatPoints(school.mean_points)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.top.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={24} strokeWidth={2} />}
        title={dict.leaderboard.nobodyRanked}
        description={
          board === "improved"
            ? dict.leaderboard.improvedEmpty
            : dict.leaderboard.beFirst
        }
      />
    );
  }

  const youInTop = data.top.some((r) => r.is_you);

  return (
    <div className="flex flex-col gap-2">
      {data.top.map((row) => (
        <Row key={row.student_id} row={row} youLabel={dict.dashboard.you} />
      ))}

      {/* The student's own position stays visible however far down they are.
          This bar is the single most motivating element on the page. */}
      {!youInTop && data.you && (
        <div className="sticky bottom-[76px] mt-3 sm:bottom-4">
          <div className="rounded-lg border-2 border-brand-500 bg-white p-3 shadow-card">
            <div className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-brand-500">
              {dict.leaderboard.yourPosition}
            </div>
            <Row
              row={{
                rank: data.you.rank,
                student_id: "you",
                display_name: dict.dashboard.you,
                school_name: null,
                state_name: null,
                points: data.you.points,
                is_you: true,
              }}
              bare
              youLabel={dict.dashboard.you}
            />
            {data.points_to_top_100 != null && data.points_to_top_100 > 0 && (
              <p className="mt-2 text-center text-xs text-muted">
                <span className="tnum font-semibold text-ink">
                  {formatPoints(data.points_to_top_100)}
                </span>{" "}
                {dict.dashboard.pointsToTop100}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  bare,
  youLabel = "You",
}: {
  row: LeaderboardRow;
  bare?: boolean;
  youLabel?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[62px] items-center gap-3 px-4 py-3",
        !bare && "rounded-lg border bg-white",
        !bare && (row.is_you ? "border-brand-500 bg-brand-50" : "border-line"),
      )}
    >
      <RankBadge rank={row.rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold text-ink">
          {row.display_name}
          {row.is_you && (
            <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {youLabel}
            </span>
          )}
        </div>
        {(row.school_name || row.state_name) && (
          <div className="truncate text-xs text-muted">
            {[row.school_name, row.state_name].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      <div className="tnum font-display text-base font-bold text-ink">
        {formatPoints(row.points)}
      </div>
    </div>
  );
}

/** Top three carry weight; everyone else gets a plain, legible number. */
function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-warning text-white"
      : rank === 2
        ? "bg-line-strong text-brand-900"
        : rank === 3
          ? "bg-[#c98b52] text-white"
          : "bg-surface-2 text-muted";

  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold tabular-nums",
        medal,
      )}
    >
      {rank <= 3 ? rank : formatRank(rank).replace("#", "")}
    </span>
  );
}
