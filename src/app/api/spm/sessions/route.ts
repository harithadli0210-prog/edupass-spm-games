import { NextResponse } from "next/server";
import { z } from "zod";
import { currentStudent } from "@/lib/supabase/server";
import { GameError, startSession } from "@/lib/engines/session";
import { rateLimit } from "@/lib/rate-limit";
import { PREVIEW, previewStartSession } from "@/lib/preview";

const Body = z.object({
  mode: z.enum(["DAILY", "SPEED", "MISSION", "BOSS"]),
  subject: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (student.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }

  // Starting a session builds a question set and writes rows. Cheap to call,
  // not free — 20 an hour is well above real play and well below abuse.
  const limited = await rateLimit(`session:${student.id}`, 20, 3600);
  if (limited) {
    return NextResponse.json(
      { error: "Too many rounds started. Take a breath and try again shortly." },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (PREVIEW) {
    return NextResponse.json(
      previewStartSession(parsed.data.mode, parsed.data.subject),
      { status: 201 },
    );
  }

  try {
    const session = await startSession({
      studentId: student.id,
      mode: parsed.data.mode,
      subjectCode: parsed.data.subject,
      // Lets an admin start a round in a mode that is switched off for
      // students, which is how Missions and Boss get tested on the live site.
      isAdmin: student.is_admin,
      clientMeta: {
        ua: request.headers.get("user-agent") ?? undefined,
      },
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("startSession failed", error);
    return NextResponse.json({ error: "Could not start the round." }, { status: 500 });
  }
}
