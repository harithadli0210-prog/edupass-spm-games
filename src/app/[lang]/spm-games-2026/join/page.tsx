import { Suspense } from "react";
import { JoinForm } from "@/components/auth/join-form";
import { Skeleton } from "@/components/ui/states";
import { Logo } from "@/components/brand/logo";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = getDictionary((isLocale(lang) ? lang : "en") as Locale);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-4">
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
        <JoinForm dict={dict} />
      </Suspense>

      <p className="text-center text-xs leading-relaxed text-muted">
        {dict.auth.privacyNote}
      </p>
    </div>
  );
}
