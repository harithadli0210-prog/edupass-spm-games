import { currentStudent } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/queries/subjects";
import { getStudentSummary } from "@/lib/queries/summary";
import { GameLauncher } from "@/components/game/game-launcher";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);

  const student = await currentStudent();
  const [subjects, summary] = await Promise.all([
    getSubjects(locale),
    getStudentSummary(student!.id, student!.display_name, locale),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{dict.play.dailyTitle}</h1>
        <p className="mt-1 text-sm text-muted">{dict.play.dailySub}</p>
      </div>

      <GameLauncher
        mode="DAILY"
        subjects={subjects}
        dict={dict}
        completedToday={summary.today.daily_completed}
        mastery={Object.fromEntries(
          summary.subjects.map((s) => [s.code, { mastery: s.mastery, attempts: s.attempts }]),
        )}
      />
    </div>
  );
}
