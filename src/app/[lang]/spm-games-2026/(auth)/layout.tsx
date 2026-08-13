import { LocaleSwitch } from "@/components/shell/locale-switch";

/**
 * Sign-in and onboarding shell.
 *
 * Deliberately without the sidebar. Every destination in it — Dashboard,
 * Leaderboard, Prizes — is unreachable until the student has an account, so
 * showing them is offering doors that do not open. One task on screen, nothing
 * to click past it.
 *
 * The language switch stays, because a student who cannot read the form needs
 * it before anything else.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-surface">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-50 to-transparent"
      />

      <header className="relative flex justify-end px-4 py-4 sm:px-6">
        <LocaleSwitch />
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pb-24 sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
