import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_SEGMENT, DEFAULT_LOCALE, LOCALES, isLocale } from "@/lib/i18n/config";

/**
 * Locale routing, session refresh and the play-route guard.
 *
 * Order matters:
 *   1. Bare paths get a locale prefix, so /spm-games-2026 never 404s.
 *   2. Signed out → /join
 *   3. Signed in without a profile → /onboarding
 *
 * A student must not reach a question before the profile that puts them on a
 * leaderboard exists.
 */

/** Best-effort locale from the browser, used only when the URL has none. */
function preferredLocale(request: NextRequest) {
  const header = request.headers.get("accept-language") ?? "";
  // Malay speakers send ms, ms-MY, or id (close enough that Malay serves them
  // far better than English would).
  if (/\b(ms|id)\b/i.test(header.split(",")[0] ?? "")) return "ms";
  return DEFAULT_LOCALE;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const hasLocale = segments.length > 0 && isLocale(segments[0]);

  // ---- 1. Locale prefixing ------------------------------------------------
  if (!hasLocale) {
    const url = request.nextUrl.clone();
    const lang = preferredLocale(request);
    url.pathname =
      pathname === "/" || pathname === ""
        ? `/${lang}/${APP_SEGMENT}`
        : `/${lang}${pathname}`;
    return NextResponse.redirect(url);
  }

  const lang = segments[0];
  const rest = `/${segments.slice(1).join("/")}`;
  const inApp = rest === `/${APP_SEGMENT}` || rest.startsWith(`/${APP_SEGMENT}/`);

  // Admin is English-only and gated inside its own layout.
  if (!inApp) return NextResponse.next({ request });

  const appPath = (p = "") => `/${lang}/${APP_SEGMENT}${p}`;

  // ---- Preview mode -------------------------------------------------------
  // No auth to refresh and no profile to check. Bypassing the guard is what
  // makes every page reachable without a database.
  if (process.env.SPM_PREVIEW === "1") {
    if (rest === `/${APP_SEGMENT}/join`) {
      const url = request.nextUrl.clone();
      url.pathname = appPath();
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

  const isPublic = rest === `/${APP_SEGMENT}/join`;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = appPath("/join");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && rest !== `/${APP_SEGMENT}/onboarding` && !isPublic) {
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("consent_at")
      .eq("student_id", user.id)
      .maybeSingle();

    if (!profile?.consent_at) {
      const url = request.nextUrl.clone();
      url.pathname = appPath("/onboarding");
      return NextResponse.redirect(url);
    }
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = appPath();
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except Next internals, the API, and static files. The locale
  // prefixer has to see bare paths, so this cannot be narrowed to /:lang/*.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)",
  ],
};

export const LOCALE_LIST = LOCALES;
