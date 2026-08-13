import { NextResponse } from "next/server";
import { currentStudent } from "@/lib/supabase/server";
import { completeSession, GameError } from "@/lib/engines/session";
import { PREVIEW, previewComplete } from "@/lib/preview";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  if (PREVIEW) {
    try {
      return NextResponse.json(previewComplete(id));
    } catch {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
  }

  try {
    // finalize_session is idempotent — a retried call after a dropped
    // connection returns the same summary and never pays the bonus twice.
    const summary = await completeSession({ studentId: student.id, sessionId: id });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("completeSession failed", error);
    return NextResponse.json({ error: "Could not finish the round." }, { status: 500 });
  }
}
