import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and guards the play routes.
 *
 * The gate order matters: signed out → /join, signed in but no profile →
 * /onboarding. A student must not reach a question before the profile that
 * puts them on a leaderboard exists (spec §8).
 */
export async function proxy(request: NextRequest) {
  // Preview mode has no auth to refresh and no profile to check. Bypassing the
  // whole guard here is what makes every page reachable without a database.
  if (process.env.SPM_PREVIEW === "1") {
    if (request.nextUrl.pathname === "/spm-games/join") {
      const url = request.nextUrl.clone();
      url.pathname = "/spm-games";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === "/spm-games/join" || path.startsWith("/spm-games/about");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/spm-games/join";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path !== "/spm-games/onboarding" && !isPublic) {
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("consent_at")
      .eq("student_id", user.id)
      .maybeSingle();

    if (!profile?.consent_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/spm-games/onboarding";
      return NextResponse.redirect(url);
    }
  }

  if (user && path === "/spm-games/join") {
    const url = request.nextUrl.clone();
    url.pathname = "/spm-games";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/spm-games/:path*"],
};
