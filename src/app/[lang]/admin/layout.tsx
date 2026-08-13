import Link from "next/link";
import { notFound } from "next/navigation";
import { FileQuestion, ShieldCheck, ToggleLeft } from "lucide-react";
import { currentStudent } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { PREVIEW } from "@/lib/preview";
import { appPath, isLocale, type Locale } from "@/lib/i18n";

const NAV = [
  { path: "/admin/flags", label: "Switches", icon: ToggleLeft },
  { path: "/admin/questions", label: "Questions", icon: FileQuestion },
];

/**
 * Admin shell.
 *
 * Deliberately separate from the student shell, and gated at the layout so
 * every page underneath inherits the check — a per-page guard is one forgotten
 * import away from an open admin panel.
 *
 * `notFound()` rather than a 403: a non-admin should not learn that /admin
 * exists at all.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const student = await currentStudent();
  const allowed = PREVIEW || student?.is_admin;
  if (!allowed) notFound();

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[68px] max-w-5xl items-center gap-6 px-4 sm:px-6">
          <Link href={`/${locale}/admin/flags`} className="flex items-center gap-2.5">
            <Logo variant="icon" className="h-7" />
            <span className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
              <ShieldCheck size={17} strokeWidth={2.2} className="text-brand-500" />
              Admin
            </span>
          </Link>

          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.path}
                href={`/${locale}${item.path}`}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-sm font-semibold text-muted transition-colors hover:bg-brand-50 hover:text-brand-600"
              >
                <item.icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href={appPath(locale)}
            className="ml-auto font-display text-sm font-semibold text-brand-500"
          >
            Back to game
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
