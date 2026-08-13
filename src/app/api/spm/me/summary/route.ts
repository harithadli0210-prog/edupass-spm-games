import { NextResponse } from "next/server";
import { currentStudent } from "@/lib/supabase/server";
import { getStudentSummary } from "@/lib/queries/summary";

/** Everything the dashboard needs, in one round trip. */
export async function GET() {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const summary = await getStudentSummary(student.id, student.display_name);
  return NextResponse.json(summary);
}
