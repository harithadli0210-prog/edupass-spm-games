import { NextResponse } from "next/server";
import { z } from "zod";
import { currentStudent, supabaseAdmin } from "@/lib/supabase/server";
import { getFlags, invalidateFlags } from "@/lib/flags";
import { PREVIEW, previewSetFlag } from "@/lib/preview";

const Body = z.object({
  key: z.string().min(1).max(64),
  enabled: z.boolean().optional(),
  visible_to_admin: z.boolean().optional(),
});

export async function GET() {
  const student = await currentStudent();
  if (!student?.is_admin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  return NextResponse.json({ flags: await getFlags() });
}

export async function PATCH(request: Request) {
  const student = await currentStudent();
  if (!student?.is_admin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { key, ...changes } = parsed.data;

  if (PREVIEW) {
    previewSetFlag(key, changes);
    invalidateFlags();
    return NextResponse.json({ ok: true, flags: await getFlags() });
  }

  const { error } = await supabaseAdmin()
    .from("feature_flags")
    .update({ ...changes, updated_by: student.id })
    .eq("key", key);

  if (error) {
    console.error("flag update failed", error);
    return NextResponse.json({ error: "Could not update the switch." }, { status: 500 });
  }

  // Flags are cached for 15s; clearing here makes an admin toggle feel instant
  // rather than leaving them wondering whether it took.
  invalidateFlags();

  return NextResponse.json({ ok: true, flags: await getFlags() });
}
