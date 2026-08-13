import { NextResponse } from "next/server";
import { currentStudent, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { ProfileSchema } from "@/lib/validation";
import { resolveSchool } from "@/lib/schools";
import { getActiveSeason } from "@/lib/config";

/**
 * Onboarding write (spec §8).
 *
 * Eight fields, one submit. The school string is resolved to a school row here
 * rather than stored raw, so the School Champion board has a real identity to
 * aggregate on from the first student who signs up.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = ProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const db = supabaseAdmin();

  // Duplicate guards, checked before the write so the student gets a sentence
  // rather than a constraint violation. The unique indexes remain the real
  // enforcement — this is only for the error message.
  const { data: clash } = await db
    .from("student_profiles")
    .select("student_id, phone_e164, email")
    .or(`phone_e164.eq.${input.phone},email.eq.${input.email}`)
    .neq("student_id", user.id)
    .maybeSingle();

  if (clash) {
    return NextResponse.json(
      {
        error:
          clash.phone_e164 === input.phone
            ? "That phone number is already registered for SPM Games."
            : "That email is already registered for SPM Games.",
      },
      { status: 409 },
    );
  }

  const school = await resolveSchool({
    rawName: input.school_name,
    stateId: input.state_id,
    districtId: input.district_id ?? null,
  });

  const { error: studentError } = await db
    .from("students")
    .upsert({ id: user.id, display_name: input.display_name }, { onConflict: "id" });

  if (studentError) {
    console.error("student upsert failed", studentError);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }

  const { error: profileError } = await db.from("student_profiles").upsert(
    {
      student_id: user.id,
      full_name: input.full_name,
      phone_e164: input.phone,
      email: input.email,
      school_id: school.school_id,
      school_name_raw: input.school_name,
      state_id: input.state_id,
      district_id: input.district_id ?? null,
      postcode: input.postcode,
      consent_at: new Date().toISOString(),
      guardian_consent: input.guardian_consent,
    },
    { onConflict: "student_id" },
  );

  if (profileError) {
    if (profileError.code === "23505") {
      return NextResponse.json(
        { error: "That phone number or email is already registered." },
        { status: 409 },
      );
    }
    console.error("profile upsert failed", profileError);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }

  const season = await getActiveSeason();
  await db.from("analytics_events").insert({
    student_id: user.id,
    season_id: season.id,
    event: "student_registered",
    properties: {
      state_id: input.state_id,
      school_match: school.method,
      school_similarity: school.similarity,
    },
  });

  return NextResponse.json({
    ok: true,
    school: { id: school.school_id, name: school.name, method: school.method },
  });
}

/** Whether onboarding is done — used to gate the play routes. */
export async function GET() {
  const student = await currentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("student_profiles")
    .select("full_name, school_name_raw, state_id, district_id, postcode, consent_at")
    .eq("student_id", student.id)
    .maybeSingle();

  return NextResponse.json({
    complete: Boolean(data?.consent_at),
    display_name: student.display_name,
    profile: data ?? null,
  });
}
