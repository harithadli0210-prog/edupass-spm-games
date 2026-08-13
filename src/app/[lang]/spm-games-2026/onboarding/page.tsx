import { supabaseAdmin } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { PREVIEW } from "@/lib/preview";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return {
    title: getDictionary((isLocale(lang) ? lang : "en") as Locale).onboarding.title,
  };
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);

  // Preview mode has no database; the form renders with empty pickers so the
  // layout can still be reviewed.
  const [states, districts] = PREVIEW
    ? [[], []]
    : await Promise.all([
        supabaseAdmin()
          .from("states")
          .select("id, name")
          .order("name")
          .then((r) => r.data ?? []),
        supabaseAdmin()
          .from("districts")
          .select("id, name, state_id")
          .order("name")
          .then((r) => r.data ?? []),
      ]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-2">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">
          {dict.onboarding.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{dict.onboarding.sub}</p>
      </header>

      <OnboardingForm
        states={states}
        districts={districts}
        dict={dict}
        lang={locale}
      />
    </div>
  );
}
