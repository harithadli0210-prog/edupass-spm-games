import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Used for auth (phone OTP) and for reads that RLS already
 * makes safe. It cannot see question_options, and it has no write policy on
 * any scoring table — see 0002_rls.sql.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
