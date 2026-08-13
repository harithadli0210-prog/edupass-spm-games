import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { PREVIEW, PREVIEW_STUDENT } from "@/lib/preview";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Request-scoped client carrying the student's session.
 *
 * Everything read through this client is filtered by RLS, so it is the right
 * choice for "show me my own data" and the wrong choice for anything that
 * writes a score.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * This is the ONLY thing that may write an attempt, a score or an XP row — see
 * 0002_rls.sql, where students have no insert/update policy on any of those
 * tables. Never import this into a Client Component; the service key must not
 * reach a browser bundle.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Server-side scoring cannot run without it.",
    );
  }
  return createClient(URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The authenticated student, or null. */
export async function currentStudent() {
  if (PREVIEW) return PREVIEW_STUDENT;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("students")
    .select("id, display_name, is_admin, status")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
}
