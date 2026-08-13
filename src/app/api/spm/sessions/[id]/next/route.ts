import { NextResponse } from "next/server";
import { currentStudent } from "@/lib/supabase/server";
import { GameError, serveNext } from "@/lib/engines/session";
import { PREVIEW, previewServeNext } from "@/lib/preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  if (PREVIEW) {
    const question = previewServeNext(id);
    return NextResponse.json({ question, exhausted: question === null });
  }

  try {
    const question = await serveNext({ studentId: student.id, sessionId: id });

    // Null means the set is exhausted; the client should call /complete.
    if (!question) {
      return NextResponse.json({ question: null, exhausted: true });
    }
    return NextResponse.json({ question, exhausted: false });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("serveNext failed", error);
    return NextResponse.json({ error: "Could not load the question." }, { status: 500 });
  }
}
