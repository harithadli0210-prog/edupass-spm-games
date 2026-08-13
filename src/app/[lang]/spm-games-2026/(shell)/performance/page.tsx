import Link from "next/link";
import { LineChart, Target, Timer, TrendingUp } from "lucide-react";
import { currentStudent } from "@/lib/supabase/server";
import { getSubjects } from "@/lib/queries/subjects";
import { getPerformance } from "@/lib/queries/performance";
import { getStudentSummary } from "@/lib/queries/summary";
import { Stat } from "@/components/ui/stat";
import { SectionHeading } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { TabStrip } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { TrendChart } from "@/components/performance/trend-chart";
import { formatDuration, formatPercent, formatPoints } from "@/lib/utils";
import { appPath, getDictionary, isLocale, t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return {
    title: getDictionary((isLocale(lang) ? lang : "en") as Locale).performance.title,
  };
}

export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { lang } = await params;
  const { subject = "ALL" } = await searchParams;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);

  const student = await currentStudent();
  const [subjects, performance, summary] = await Promise.all([
    getSubjects(locale),
    getPerformance(student!.id, subject),
    getStudentSummary(student!.id, student!.display_name, locale),
  ]);

  const tabs = [
    { key: "ALL", label: dict.dashboard.overall, href: appPath(locale, "/performance") },
    ...subjects.map((s) => ({
      key: s.code,
      label: s.name,
      href: appPath(locale, `/performance?subject=${s.code}`),
    })),
  ];

  const difficultyLabel = {
    EASY: dict.performance.easy,
    MEDIUM: dict.performance.medium,
    HARD: dict.performance.hard,
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          {dict.performance.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{dict.performance.sub}</p>
      </div>

      <TabStrip items={tabs} activeKey={subject} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={dict.performance.overallScore}
          value={formatPoints(summary.stats.overall_points)}
          icon={<TrendingUp size={16} strokeWidth={2} />}
          tone="brand"
        />
        <Stat
          label={dict.common.accuracy}
          value={formatPercent(performance.totals.accuracy)}
          hint={`${formatPoints(performance.totals.correct)} ${dict.common.correct}`}
          icon={<Target size={16} strokeWidth={2} />}
        />
        <Stat
          label={dict.performance.avgResponse}
          value={formatDuration(performance.totals.avg_response_ms)}
          icon={<Timer size={16} strokeWidth={2} />}
        />
        <Stat
          label={dict.common.questions}
          value={formatPoints(performance.totals.attempts)}
          hint={t(dict.performance.activeDays, { days: summary.stats.active_days })}
          icon={<LineChart size={16} strokeWidth={2} />}
        />
      </div>

      <section>
        <SectionHeading
          title={dict.performance.accuracyOverTime}
          description={dict.performance.accuracyOverTimeSub}
        />
        {performance.trend.length < 2 ? (
          <EmptyState
            icon={<LineChart size={24} strokeWidth={2} />}
            title={dict.performance.notEnoughDays}
            description={dict.performance.notEnoughDaysBody}
            action={
              <Link
                href={appPath(locale, "/play")}
                className="inline-flex h-11 items-center rounded-full bg-brand-500 px-5 font-display text-sm font-semibold text-white"
              >
                {dict.performance.playARound}
              </Link>
            }
          />
        ) : (
          <div className="rounded-md border border-line bg-white p-4">
            <TrendChart data={performance.trend} label={dict.common.accuracy} />
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title={dict.performance.byDifficulty}
          description={dict.performance.byDifficultySub}
        />
        {performance.totals.attempts === 0 ? (
          <EmptyState
            icon={<Target size={24} strokeWidth={2} />}
            title={dict.performance.noQuestions}
            description={dict.performance.noQuestionsBody}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {performance.difficulty.map((d) => (
              <div
                key={d.label}
                className="flex min-h-[104px] flex-col justify-between rounded-md border border-line bg-white p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                    {difficultyLabel[d.label]}
                  </span>
                  <span className="tnum font-display text-xl font-bold text-ink">
                    {d.attempts > 0 ? formatPercent(d.accuracy) : "—"}
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar
                    value={d.accuracy * 100}
                    size="sm"
                    tone={
                      d.label === "EASY"
                        ? "success"
                        : d.label === "MEDIUM"
                          ? "warning"
                          : "danger"
                    }
                    label={`${difficultyLabel[d.label]} ${dict.common.accuracy}`}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    {d.attempts} {dict.common.questions}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
