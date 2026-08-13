import Link from "next/link";
import { Sidebar } from "@/components/shell/sidebar";
import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/brand/logo";

/**
 * App shell.
 *
 * Sidebar on desktop, bottom bar on mobile. The header keeps the marketing
 * site's proportions — 78px tall, tinted translucent brand-100 — so crossing
 * from edupass.html into the game doesn't feel like landing on a different
 * product.
 */
export default function SpmGamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-brand-200/70 bg-brand-100/85 backdrop-blur-md lg:bg-white/85">
          <div className="flex h-[78px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href="/spm-games"
              className="flex items-center gap-2.5 lg:hidden"
              aria-label="EduPass — SPM Games"
            >
              <Logo variant="full" className="h-6" priority />
              <span className="hidden rounded-full bg-brand-500 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-white xs:inline sm:inline">
                SPM Games
              </span>
            </Link>

            <span className="hidden font-display text-sm font-semibold text-muted lg:block">
              SPM Games 2026 · Season 1
            </span>

            <AppNav />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
