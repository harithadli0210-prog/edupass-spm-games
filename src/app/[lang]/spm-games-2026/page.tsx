import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Gift,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { currentStudent } from "@/lib/supabase/server";
import { getStudentSummary } from "@/lib/queries/summary";
import { getSubjects } from "@/lib/queries/subjects";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { getPrizePool, getPrizes } from "@/lib/queries/prizes";
import { resolveFlags } from "@/lib/flags";
import {
  appPath,
  getDictionary,
  isLocale,
  t,
  type Locale,
} from "@/lib/i18n";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { MasteryRadar } from "@/components/dashboard/mastery-radar";
import { GameLauncher } from "@/components/game/game-launcher";
import { PrizeShowcase } from "@/components/prizes/prize-showcase";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectIcon } from "@/components/ui/subject-icon";
import { EmptyState } from "@/components/ui/states";
import { BehaviourInsights } from "@/components/dashboard/behaviour-insights";
import { StudyAreas } from "@/components/dashboard/study-areas";
import { cn, formatPercent, formatPoints, formatRank, greeting } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);

  const student = await currentStudent();
  const isAdmin = Boolean(student?.is_admin);

  const [summary, subjects, prizes, prizePool, board, flags] = await Promise.all([
    getStudentSummary(student!.id, student!.display_name, locale),
    getSubjects(locale),
    getPrizes(),
    getPrizePool(),
    getLeaderboard({ board: "overall", studentId: student!.id, limit: 3 }),
    resolveFlags(
      [
        "competition.prizes",
        "competition.leaderboard",
        "content.study_areas",
        "content.behaviour_signals",
      ],
      isAdmin,
    ),
  ]);

  const { stats, rank, signals } = summary;
  const masteryMap = Object.fromEntries(
    summary.subjects.map((s) => [s.code, { mastery: s.mastery, attempts: s.attempts }]),
  );
  const dailyDone = summary.today.daily_completed.length;

  return (
    <div className="flex flex-col gap-7">
      <HeroBanner
        name={summary.student.display_name}
        prizePool={flags["competition.prizes"] ? prizePool : null}
        daysRemaining={summary.season.days_remaining}
        dict={dict}
        lang={locale}
      />

      {/* ---- Overview ------------------------------------------------------ */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{greetingFor(dict)},</p>
            <h2 className="font-display text-xl font-bold text-ink">
              {summary.student.display_name}
            </h2>
          </div>
          <Link
            href={appPath(locale, "/performance")}
            className="flex items-center gap-1 font-display text-sm font-semibold text-brand-500"
          >
            {dict.dashboard.fullProgress} <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
          {/* Rank + level */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 p-5 text-white">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/15 blur-2xl"
            />
            <div className="relative flex items-center gap-2">
              <Trophy size={18} strokeWidth={2.2} className="text-warning" />
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">
                {dict.dashboard.malaysiaRank}
              </span>
            </div>
            <p className="tnum relative mt-2 font-display text-[40px] font-extrabold leading-none">
              {rank ? formatRank(rank.position) : "—"}
            </p>
            <p className="relative mt-1 text-xs text-white/70">
              {rank
                ? t(dict.dashboard.ofPlayers, { total: formatPoints(rank.total) })
                : dict.dashboard.playToGetRanked}
            </p>

            <div className="relative mt-5 border-t border-white/20 pt-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-display text-sm font-bold">
                  {dict.common.level} {stats.level} · {stats.level_title}
                </span>
                {stats.xp_for_next && (
                  <span className="tnum text-[11px] text-white/70">
                    {formatPoints(stats.xp_into_level)}/{formatPoints(stats.xp_for_next)} XP
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-warning"
                  style={{
                    width: `${stats.xp_for_next ? Math.min(100, (stats.xp_into_level / stats.xp_for_next) * 100) : 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Key numbers */}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              icon={<Sparkles size={16} strokeWidth={2.2} />}
              label={dict.dashboard.overall}
              value={formatPoints(stats.overall_points)}
              hint={dict.common.points}
            />
            <MiniStat
              icon={<Zap size={16} strokeWidth={2.2} />}
              label={dict.common.xp}
              value={formatPoints(stats.xp)}
              hint={`${dict.common.level} ${stats.level}`}
            />
            <MiniStat
              icon={<Flame size={16} strokeWidth={2.2} />}
              label={dict.common.streak}
              value={`${stats.current_streak}`}
              hint={stats.current_streak === 1 ? dict.common.day : dict.common.days}
              tone="warning"
            />
            <MiniStat
              icon={<Target size={16} strokeWidth={2.2} />}
              label={dict.common.accuracy}
              value={formatPercent(stats.accuracy)}
              hint={`${formatPoints(stats.questions_answered)} ${dict.common.answered}`}
            />
          </div>

          {/* Mastery radar */}
          <div className="rounded-xl border border-line bg-white p-4">
            <h3 className="font-display text-sm font-bold text-ink">
              {dict.dashboard.performance}
            </h3>
            {summary.subjects.length === 0 ? (
              <p className="mt-6 text-center text-xs text-muted">
                {dict.dashboard.performanceEmpty}
              </p>
            ) : (
              <MasteryRadar subjects={summary.subjects} />
            )}
          </div>
        </div>
      </section>

      {/* ---- Mini games ---------------------------------------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {dict.dashboard.miniGames}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {t(dict.dashboard.dailySubtitle, {
                done: dailyDone,
                total: subjects.length,
              })}
            </p>
          </div>
          <Link
            href={appPath(locale, "/play")}
            className="flex items-center gap-1 font-display text-sm font-semibold text-brand-500"
          >
            {dict.dashboard.allModes} <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>

        <GameLauncher
          mode="DAILY"
          subjects={subjects}
          completedToday={summary.today.daily_completed}
          mastery={masteryMap}
          dict={dict}
        />
      </section>

      {/* ---- Prizes -------------------------------------------------------- */}
      {flags["competition.prizes"] && (
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
              <Gift size={20} strokeWidth={2.2} className="text-warning" />
              {dict.dashboard.prizesTitle}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {t(dict.dashboard.prizesSubtitle, {
                pool: formatPoints(prizePool),
                count: prizes.length,
              })}
            </p>
          </div>
          <Link
            href={appPath(locale, "/prizes")}
            className="flex items-center gap-1 font-display text-sm font-semibold text-brand-500"
          >
            {dict.dashboard.allPrizes} <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>

        {prizes.length === 0 ? (
          <EmptyState
            icon={<Gift size={24} strokeWidth={2} />}
            title={dict.dashboard.prizesEmptyTitle}
            description={dict.dashboard.prizesEmptyBody}
          />
        ) : (
          <PrizeShowcase categories={prizes} limit={3} dict={dict} />
        )}
      </section>
      )}

      {/* ---- Leaderboard + mastery ---------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {flags["competition.leaderboard"] && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-display text-lg font-bold text-ink">
              {dict.dashboard.topOfMalaysia}
            </h2>
            <Link
              href={appPath(locale, "/leaderboard/overall")}
              className="flex items-center gap-1 font-display text-sm font-semibold text-brand-500"
            >
              {dict.dashboard.fullRanking} <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
            {board.top.slice(0, 3).map((row) => (
              <div key={row.student_id} className="flex items-center gap-3 py-1.5">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold",
                    row.rank === 1
                      ? "bg-warning text-white"
                      : row.rank === 2
                        ? "bg-line-strong text-brand-900"
                        : "bg-[#c98b52] text-white",
                  )}
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-ink">
                    {row.display_name}
                  </p>
                  <p className="truncate text-xs text-muted">{row.school_name}</p>
                </div>
                <span className="tnum font-display text-sm font-bold text-ink">
                  {formatPoints(row.points)}
                </span>
              </div>
            ))}

            {board.you && (
              <div className="mt-2 flex items-center gap-3 rounded-md border-2 border-brand-500 bg-brand-50 p-2.5">
                <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-500 font-display text-xs font-bold text-white">
                  {board.you.rank}
                </span>
                <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-ink">
                  {dict.dashboard.you}
                </p>
                <span className="tnum font-display text-sm font-bold text-ink">
                  {formatPoints(board.you.points)}
                </span>
              </div>
            )}

            {board.points_to_top_100 != null && board.points_to_top_100 > 0 && (
              <p className="mt-1 text-center text-xs text-muted">
                <span className="tnum font-semibold text-ink">
                  {formatPoints(board.points_to_top_100)}
                </span>{" "}
                {dict.dashboard.pointsToTop100}
              </p>
            )}
          </div>
        </section>
        )}

        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-ink">
            {dict.dashboard.subjectMastery}
          </h2>
          {summary.subjects.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={24} strokeWidth={2} />}
              title={dict.dashboard.masteryEmptyTitle}
              description={dict.dashboard.masteryEmptyBody}
            />
          ) : (
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white p-4">
              {summary.subjects.map((subject) => (
                <div key={subject.code} className="flex items-center gap-3">
                  <SubjectIcon code={subject.code} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate font-display text-sm font-semibold text-ink">
                        {subject.name}
                      </span>
                      <span className="tnum font-display text-sm font-bold text-ink">
                        {formatPercent(subject.mastery)}
                      </span>
                    </div>
                    <ProgressBar
                      value={subject.mastery * 100}
                      size="sm"
                      tone={
                        subject.mastery >= 0.75
                          ? "success"
                          : subject.mastery >= 0.5
                            ? "brand"
                            : "warning"
                      }
                      label={`${subject.name} mastery`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---- Behaviour + study areas --------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {flags["content.behaviour_signals"] && (
          <BehaviourInsights
            signals={signals}
            hasPlayed={stats.questions_answered > 0}
            dict={dict}
          />
        )}
        {flags["content.study_areas"] && (
          <StudyAreas
            signals={signals}
            subjects={summary.subjects}
            dict={dict}
            lang={locale}
          />
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[92px] flex-col justify-between rounded-xl border p-3.5",
        tone === "warning"
          ? "border-warning/25 bg-warning-bg"
          : "border-line bg-white",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={tone === "warning" ? "text-warning-ink" : "text-brand-500"}>
          {icon}
        </span>
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
      </div>
      <div>
        <p className="tnum font-display text-[22px] font-extrabold leading-none text-ink">
          {value}
        </p>
        <p className="mt-1 text-[11px] text-muted">{hint}</p>
      </div>
    </div>
  );
}

/** Time-of-day greeting in the reader's language. */
function greetingFor(dict: ReturnType<typeof getDictionary>) {
  const english = greeting();
  if (english === "Good morning") return dict.dashboard.goodMorning;
  if (english === "Good afternoon") return dict.dashboard.goodAfternoon;
  return dict.dashboard.goodEvening;
}
