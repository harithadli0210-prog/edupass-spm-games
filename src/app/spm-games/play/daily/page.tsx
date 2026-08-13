import { currentStudent } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/queries/subjects";
import { getStudentSummary } from "@/lib/queries/summary";
import { GameLauncher } from "@/components/game/game-launcher";

export const metadata = { title: "Daily Challenge" };
export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const student = await currentStudent();
  const [subjects, summary] = await Promise.all([
    getSubjects(),
    getStudentSummary(student!.id, student!.display_name),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Daily Challenge</h1>
        <p className="mt-1 text-sm text-muted">
          Ten questions per subject. Everyone in Malaysia gets the same set today,
          so the ranking is a fair comparison.
        </p>
      </div>

      <GameLauncher
        mode="DAILY"
        subjects={subjects}
        completedToday={summary.today.daily_completed}
        mastery={Object.fromEntries(
          summary.subjects.map((s) => [
            s.code,
            { mastery: s.mastery, attempts: s.attempts },
          ]),
        )}
      />
    </div>
  );
}
