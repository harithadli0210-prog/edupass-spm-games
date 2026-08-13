import { Suspense } from "react";
import { JoinForm } from "@/components/auth/join-form";
import { Skeleton } from "@/components/ui/states";
import { Logo } from "@/components/brand/logo";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { resolveFlags } from "@/lib/flags";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = getDictionary((isLocale(lang) ? lang : "en") as Locale);

  // Phone stays hidden until an SMS provider exists, so a student is never
  // offered a sign-in route that cannot deliver a code.
  const flags = await resolveFlags(["auth.phone", "auth.email"]);
  const enabled = {
    phone: flags["auth.phone"],
    email: flags["auth.email"] || !flags["auth.phone"],
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center text-center">
        <Logo variant="full" className="mb-5 h-8" priority />
        <h1 className="font-display text-2xl font-bold text-ink">
          {dict.auth.joinTitle}
        </h1>
        <p className="mt-2 text-sm text-muted">{dict.auth.joinSub}</p>
      </header>

      {/* JoinForm reads the `next` query param, so it needs a boundary to be
          prerenderable. */}
      <Suspense fallback={<Skeleton className="h-[168px] rounded-md" />}>
        <JoinForm dict={dict} enabled={enabled} />
      </Suspense>

      <p className="text-center text-xs leading-relaxed text-muted">
        {dict.auth.privacyNote}
      </p>
    </div>
  );
}
