import Link from "next/link";
import { Sidebar } from "@/components/shell/sidebar";
import { AppNav } from "@/components/app-nav";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { Logo } from "@/components/brand/logo";
import { appPath, getDictionary, isLocale, type Locale } from "@/lib/i18n";

/**
 * App shell.
 *
 * Sidebar on desktop, bottom bar on mobile. The header keeps the marketing
 * site's 78px proportions so crossing from edupass.my into the game does not
 * feel like landing on a different product.
 */
export default async function SpmGamesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar dict={dict} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-brand-200/70 bg-brand-100/85 backdrop-blur-md lg:bg-white/85">
          <div className="flex h-[78px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href={appPath(locale)}
              className="flex items-center gap-2.5 lg:hidden"
              aria-label="edupass.my — SPM Games"
            >
              <Logo variant="full" className="h-6" priority />
            </Link>

            <span className="hidden font-display text-sm font-semibold text-muted lg:block">
              {dict.hero.seasonBadge}
            </span>

            <div className="flex items-center gap-3">
              <LocaleSwitch className="lg:hidden" />
              <AppNav dict={dict} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
