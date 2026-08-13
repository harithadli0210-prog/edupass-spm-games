import { Suspense } from "react";
import { JoinForm } from "@/components/auth/join-form";
import { Skeleton } from "@/components/ui/states";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Join" };

export default function JoinPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-4">
      <header className="flex flex-col items-center text-center">
        <Logo variant="full" className="mb-5 h-8" priority />
        <h1 className="font-display text-2xl font-bold text-ink">
          Join <span className="text-gradient">SPM Games 2026</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Free to enter, open to every SPM student in Malaysia. Sign in with your
          phone number to start playing.
        </p>
      </header>

      {/* JoinForm reads the `next` query param, so it needs a boundary to be
          prerenderable. */}
      <Suspense fallback={<Skeleton className="h-[168px] rounded-lg" />}>
        <JoinForm />
      </Suspense>

      <p className="text-center text-xs leading-relaxed text-muted">
        We use your phone number to sign you in and to keep the competition fair
        by preventing duplicate accounts. It is never shown on any leaderboard.
      </p>
    </div>
  );
}
