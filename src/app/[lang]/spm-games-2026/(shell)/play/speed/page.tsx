import { getSubjects } from "@/lib/queries/subjects";
import { GameLauncher } from "@/components/game/game-launcher";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SpeedPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);
  const subjects = await getSubjects(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{dict.play.speedTitle}</h1>
        <p className="mt-1 text-sm text-muted">{dict.play.speedSub}</p>
      </div>

      {/* Stated up front, because a scoring rule a student discovers only by
          losing points feels arbitrary rather than fair. */}
      <div className="rounded-md border border-line bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-ink">
          {dict.play.scoringTitle}
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
          <li>{dict.play.scoring1}</li>
          <li>{dict.play.scoring2}</li>
          <li>{dict.play.scoring3}</li>
          <li>{dict.play.scoring4}</li>
        </ul>
      </div>

      <GameLauncher mode="SPEED" subjects={subjects} dict={dict} />
    </div>
  );
}
