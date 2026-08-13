import { supabaseAdmin } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/config";
import { PREVIEW, previewBoardRows } from "@/lib/preview";
import type { LeaderboardKey, LeaderboardRow } from "@/lib/types";

export interface SchoolRow {
  rank: number;
  school_id: string;
  school_name: string;
  state_name: string | null;
  participants: number;
  mean_points: number;
}

export interface LeaderboardPayload {
  board: LeaderboardKey;
  top: LeaderboardRow[];
  schools: SchoolRow[];
  you: { rank: number; points: number } | null;
  total_participants: number;
  points_to_top_100: number | null;
}

/**
 * A leaderboard page, assembled from three queries rather than one.
 *
 * The top rows, the caller's own position and the Top-100 cutoff are separate
 * lookups because the student's rank must be visible even at #4,812, where they
 * would never appear in any reasonable page of results (spec section 31).
 */
export async function getLeaderboard(args: {
  board: LeaderboardKey;
  studentId: string;
  stateId?: string | null;
  subjectCode?: string | null;
  limit?: number;
}): Promise<LeaderboardPayload> {
  if (PREVIEW) return previewLeaderboard(args.board);

  const season = await getActiveSeason();
  const db = supabaseAdmin();
  const limit = args.limit ?? 20;

  const empty: LeaderboardPayload = {
    board: args.board,
    top: [],
    schools: [],
    you: null,
    total_participants: 0,
    points_to_top_100: null,
  };

  if (args.board === "school") {
    const { data } = await db.rpc("leaderboard_schools", {
      p_season_id: season.id,
      p_state_id: args.stateId ?? null,
      p_limit: limit,
      p_offset: 0,
    });
    return { ...empty, schools: (data ?? []) as SchoolRow[] };
  }

  let subjectId: string | null = null;
  if (args.subjectCode) {
    const { data } = await db
      .from("subjects")
      .select("id")
      .eq("code", args.subjectCode)
      .maybeSingle();
    subjectId = data?.id ?? null;
  }

  const [{ data: top }, { data: me }] = await Promise.all([
    db.rpc("leaderboard_page", {
      p_board: args.board,
      p_season_id: season.id,
      p_state_id: args.stateId ?? null,
      p_district_id: null,
      p_school_id: null,
      p_subject_id: subjectId,
      p_limit: limit,
      p_offset: 0,
    }),
    db.rpc("leaderboard_me", {
      p_board: args.board,
      p_season_id: season.id,
      p_subject_id: subjectId,
    }),
  ]);

  const mine = (me ?? [])[0] as
    | {
        rank: number;
        points: number;
        total_participants: number;
        top_100_points: number | null;
      }
    | undefined;

  const rows: LeaderboardRow[] = (top ?? []).map(
    (r: {
      rank: number;
      student_id: string;
      display_name: string;
      school_name: string | null;
      state_name: string | null;
      points: number;
    }) => ({
      rank: Number(r.rank),
      student_id: r.student_id,
      display_name: r.display_name,
      school_name: r.school_name,
      state_name: r.state_name,
      points: Number(r.points),
      is_you: r.student_id === args.studentId,
    }),
  );

  return {
    board: args.board,
    top: rows,
    schools: [],
    you: mine ? { rank: Number(mine.rank), points: Number(mine.points) } : null,
    total_participants: mine ? Number(mine.total_participants) : rows.length,
    // "3,200 points to reach Top 100" - the most motivating number on the page.
    points_to_top_100:
      mine && mine.rank > 100 && mine.top_100_points != null
        ? Math.max(0, Math.round(Number(mine.top_100_points) - Number(mine.points)))
        : null,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * Fixture boards, used only when SPM_PREVIEW=1.
 *
 * The student deliberately sits at #184 rather than in the top 20, so the
 * "your position" bar and the points-to-Top-100 line are both exercised — they
 * are the parts of this page most worth reviewing.
 */
function previewLeaderboard(board: LeaderboardKey): LeaderboardPayload {
  const seed = board.length * 13;

  if (board === "school") {
    return {
      board,
      top: [],
      schools: [
        ["SMK Seri Bintang Utara", "W.P. Kuala Lumpur", 68, 14210],
        ["SMJK Chung Hwa", "Pulau Pinang", 52, 13840],
        ["SMKA Kuala Lumpur", "W.P. Kuala Lumpur", 91, 13120],
        ["SMK Bandar Utama Damansara", "Selangor", 77, 12960],
        ["SMK Batu Lintang", "Sarawak", 44, 12310],
        ["SMK Sultan Abdul Halim", "Kedah", 39, 11870],
        ["SMK Taman Melawati", "W.P. Kuala Lumpur", 61, 11540],
        ["SMK Likas", "Sabah", 33, 10980],
      ].map(([name, state, participants, mean], i) => ({
        rank: i + 1,
        school_id: `school-${i}`,
        school_name: name as string,
        state_name: state as string,
        participants: participants as number,
        mean_points: mean as number,
      })),
      you: null,
      total_participants: 0,
      points_to_top_100: null,
    };
  }

  const rows = previewBoardRows(seed);

  // "Most Improved" is measured in percentage-point gain, so its numbers are
  // an order of magnitude smaller than a points board.
  const scaled =
    board === "improved"
      ? rows.map((r, i) => ({ ...r, points: 3120 - i * 140 }))
      : rows;

  return {
    board,
    top: scaled,
    schools: [],
    you: { rank: 184, points: 12840 },
    total_participants: 12483,
    points_to_top_100: 3200,
  };
}
