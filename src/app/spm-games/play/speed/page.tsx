import { getSubjects } from "@/lib/queries/subjects";
import { GameLauncher } from "@/components/game/game-launcher";

export const metadata = { title: "Speedy Challenge" };
export const dynamic = "force-dynamic";

export default async function SpeedPage() {
  const subjects = await getSubjects();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Speedy Challenge</h1>
        <p className="mt-1 text-sm text-muted">
          Sixty seconds, as many questions as you can. Play as often as you like —
          there is no daily limit.
        </p>
      </div>

      {/* Stated up front, because a scoring rule a student discovers only by
          losing points feels arbitrary rather than fair. */}
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-ink">
          How the score works
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
          <li>Faster correct answers earn a bigger speed bonus.</li>
          <li>Harder questions are worth more.</li>
          <li>Wrong answers cost points.</li>
          <li>
            Your round total is scaled by accuracy — answering 100 questions badly
            will not beat answering 20 well.
          </li>
        </ul>
      </div>

      <GameLauncher mode="SPEED" subjects={subjects} />
    </div>
  );
}
