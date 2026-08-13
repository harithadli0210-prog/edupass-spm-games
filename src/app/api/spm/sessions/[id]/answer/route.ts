import { NextResponse } from "next/server";
import { z } from "zod";
import { currentStudent } from "@/lib/supabase/server";
import { GameError, submitAnswer } from "@/lib/engines/session";
import { rateLimit } from "@/lib/rate-limit";
import { PREVIEW, previewSubmitAnswer } from "@/lib/preview";

const Body = z.object({
  question_id: z.string().uuid(),
  /** Null is a deliberate skip or a timeout, and is recorded as incorrect. */
  option_id: z.string().uuid().nullable(),
  client_elapsed_ms: z.number().int().min(0).max(600_000).optional(),
});

const PreviewBody = z.object({
  question_id: z.string().min(1),
  option_id: z.string().min(1).nullable(),
  client_elapsed_ms: z.number().int().min(0).max(600_000).optional(),
});

/**
 * The only endpoint that ever discloses a correct answer — and only after the
 * student has committed to theirs.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // A Speedy round can legitimately produce an answer every second or so. This
  // ceiling sits far above human play and far below a script.
  const limited = await rateLimit(`answer:${student.id}`, 600, 60);
  if (limited) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (PREVIEW) {
    // Preview question ids are "m1#3", not UUIDs, so they get their own shape.
    const preview = PreviewBody.safeParse(body);
    if (!preview.success) {
      return NextResponse.json({ error: "Invalid answer." }, { status: 400 });
    }
    try {
      return NextResponse.json(
        previewSubmitAnswer({
          sessionId: id,
          questionId: preview.data.question_id,
          optionId: preview.data.option_id,
        }),
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Preview error." },
        { status: 409 },
      );
    }
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid answer." }, { status: 400 });
  }

  try {
    const result = await submitAnswer({
      studentId: student.id,
      sessionId: id,
      questionId: parsed.data.question_id,
      optionId: parsed.data.option_id,
      clientElapsedMs: parsed.data.client_elapsed_ms,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("submitAnswer failed", error);
    return NextResponse.json({ error: "Could not record your answer." }, { status: 500 });
  }
}
