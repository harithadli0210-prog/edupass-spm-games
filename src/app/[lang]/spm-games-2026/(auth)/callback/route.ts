import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { APP_SEGMENT, DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

/**
 * Magic-link landing.
 *
 * Supabase's default email template ships a link, not a code, and the template
 * cannot be edited without custom SMTP. So the link has to work — otherwise
 * sign-in is blocked behind an SMTP contract the project may not have yet.
 *
 * Once custom SMTP is configured and the template carries {{ .Token }}, the
 * six-digit code path in JoinForm works too. Both routes lead to the same
 * session; neither is preferred, and having both means a student who cannot
 * open the link on the device they are playing on can still type the code.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const home = `/${locale}/${APP_SEGMENT}`;

  // Only same-origin relative paths, so a crafted link cannot bounce a signed-in
  // student off to another site.
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : home;

  if (!code) {
    return NextResponse.redirect(
      new URL(`${home}/join?error=missing_code`, url.origin),
    );
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`${home}/join?error=link_expired`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
