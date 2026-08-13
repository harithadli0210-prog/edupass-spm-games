import { NextResponse } from "next/server";
import { currentStudent } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { LEADERBOARDS, type LeaderboardKey } from "@/lib/types";

/**
 * JSON access to the same boards the leaderboard page renders server-side.
 *
 * The page itself does not call this - it queries directly. This exists for
 * the admin screens and for anything that needs board data without a page.
 */
export async function GET(request: Request) {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const board = (url.searchParams.get("board") ?? "overall") as LeaderboardKey;

  if (!LEADERBOARDS.includes(board)) {
    return NextResponse.json({ error: "Unknown leaderboard." }, { status: 400 });
  }

  try {
    const data = await getLeaderboard({
      board,
      studentId: student.id,
      stateId: url.searchParams.get("state"),
      subjectCode: url.searchParams.get("subject"),
      limit: Math.min(Number(url.searchParams.get("limit") ?? 20), 100),
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("leaderboard failed", error);
    return NextResponse.json(
      { error: "Could not load the leaderboard." },
      { status: 500 },
    );
  }
}
