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

export const metadata = { title: "My performance" };
export const dynamic = "force-dynamic";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject = "ALL" } = await searchParams;
  const student = await currentStudent();

  const [subjects, performance, summary] = await Promise.all([
    getSubjects(),
    getPerformance(student!.id, subject),
    getStudentSummary(student!.id, student!.display_name),
  ]);

  const tabs = [
    { key: "ALL", label: "Overall", href: "/spm-games/performance" },
    ...subjects.map((s) => ({
      key: s.code,
      label: s.name_en,
      href: `/spm-games/performance?subject=${s.code}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">My performance</h1>
        <p className="mt-1 text-sm text-muted">
          How you&apos;re doing this season, and where the gaps are.
        </p>
      </div>

      <TabStrip items={tabs} activeKey={subject} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Overall score"
          value={formatPoints(summary.stats.overall_points)}
          icon={<TrendingUp size={16} strokeWidth={2} />}
          tone="brand"
        />
        <Stat
          label="Accuracy"
          value={formatPercent(performance.totals.accuracy)}
          hint={`${formatPoints(performance.totals.correct)} correct`}
          icon={<Target size={16} strokeWidth={2} />}
        />
        <Stat
          label="Avg response"
          value={formatDuration(performance.totals.avg_response_ms)}
          icon={<Timer size={16} strokeWidth={2} />}
        />
        <Stat
          label="Questions"
          value={formatPoints(performance.totals.attempts)}
          hint={`${summary.stats.active_days} active days`}
          icon={<LineChart size={16} strokeWidth={2} />}
        />
      </div>

      <section>
        <SectionHeading
          title="Accuracy over time"
          description="Each point is one day of play."
        />
        {performance.trend.length < 2 ? (
          <EmptyState
            icon={<LineChart size={24} strokeWidth={2} />}
            title="Not enough days yet"
            description="Play on at least two different days and your trend appears here."
            action={
              <Link
                href="/spm-games/play"
                className="inline-flex h-11 items-center rounded-full bg-brand-500 px-5 font-display text-sm font-semibold text-white"
              >
                Play a round
              </Link>
            }
          />
        ) : (
          <div className="rounded-lg border border-line bg-white p-4">
            <TrendChart data={performance.trend} />
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="By difficulty"
          description="Where your accuracy holds up, and where it drops."
        />
        {performance.totals.attempts === 0 ? (
          <EmptyState
            icon={<Target size={24} strokeWidth={2} />}
            title="No questions answered yet"
            description="This breaks down how you do on easy, medium and hard questions."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {performance.difficulty.map((d) => (
              <div
                key={d.label}
                className="flex min-h-[104px] flex-col justify-between rounded-lg border border-line bg-white p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                    {d.label}
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
                    label={`${d.label} accuracy`}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    {d.attempts} questions
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
