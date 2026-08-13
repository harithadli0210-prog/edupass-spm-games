import { AlertTriangle, FileQuestion } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PREVIEW, PREVIEW_QUESTIONS, PREVIEW_SUBJECTS } from "@/lib/preview";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatPercent, formatPoints } from "@/lib/utils";
import type { DifficultyLabel } from "@/lib/types";

export const metadata = { title: "Questions" };
export const dynamic = "force-dynamic";

interface Row {
  code: string;
  subject: string;
  topic: string | null;
  difficulty_score: number;
  difficulty_label: DifficultyLabel;
  difficulty_source: string;
  source_type: string;
  rights_cleared: boolean;
  status: string;
  attempts: number;
  accuracy: number | null;
  confidence: number | null;
  maturity: string;
  needs_review: boolean;
}

async function loadRows(): Promise<{ rows: Row[]; counts: Record<string, number> }> {
  if (PREVIEW) {
    const rows: Row[] = PREVIEW_QUESTIONS.map((q) => ({
      code: q.id.toUpperCase(),
      subject: q.subject_code,
      topic: q.topic_name,
      difficulty_score:
        q.difficulty_label === "EASY" ? 25 : q.difficulty_label === "MEDIUM" ? 50 : 75,
      difficulty_label: q.difficulty_label,
      difficulty_source: "ADMIN",
      source_type: "EDUPASS",
      rights_cleared: true,
      status: "ACTIVE",
      attempts: 0,
      accuracy: null,
      confidence: null,
      maturity: "PROVISIONAL",
      needs_review: false,
    }));
    const counts: Record<string, number> = {};
    for (const s of PREVIEW_SUBJECTS) {
      counts[s.code] = rows.filter((r) => r.subject === s.code).length;
    }
    return { rows, counts };
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from("questions")
    .select(
      `code, difficulty_score, difficulty_label, difficulty_source, source_type,
       rights_cleared, status,
       subjects ( code ), topics ( name ),
       question_difficulty_stats ( attempts, accuracy, confidence, maturity, needs_review )`,
    )
    .order("code")
    .limit(500);

  const rows: Row[] = (data ?? []).map((q) => {
    const stats = (q.question_difficulty_stats ?? []) as {
      attempts: number;
      accuracy: number | null;
      confidence: number | null;
      maturity: string;
      needs_review: boolean;
    }[];
    const stat = stats[0];
    return {
      code: q.code as string,
      subject: (q.subjects as unknown as { code: string } | null)?.code ?? "—",
      topic: (q.topics as unknown as { name: string } | null)?.name ?? null,
      difficulty_score: q.difficulty_score as number,
      difficulty_label: q.difficulty_label as DifficultyLabel,
      difficulty_source: q.difficulty_source as string,
      source_type: q.source_type as string,
      rights_cleared: q.rights_cleared as boolean,
      status: q.status as string,
      attempts: stat?.attempts ?? 0,
      accuracy: stat?.accuracy ?? null,
      confidence: stat?.confidence ?? null,
      maturity: stat?.maturity ?? "PROVISIONAL",
      needs_review: stat?.needs_review ?? false,
    };
  });

  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.status === "ACTIVE") counts[row.subject] = (counts[row.subject] ?? 0) + 1;
  }
  return { rows, counts };
}

/** The floor below which Daily Challenge starts repeating within a fortnight. */
const MIN_PER_SUBJECT = 25;
const COMFORTABLE_PER_SUBJECT = 150;

export default async function AdminQuestionsPage() {
  const { rows, counts } = await loadRows();
  const subjects = PREVIEW
    ? PREVIEW_SUBJECTS
    : (
        await supabaseAdmin()
          .from("subjects")
          .select("code, name_en")
          .eq("is_active", true)
          .order("sort_order")
      ).data ?? [];

  const needsRights = rows.filter((r) => !r.rights_cleared && r.status === "ACTIVE");
  const needsReview = rows.filter((r) => r.needs_review);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Question bank</h1>
        <p className="mt-1 text-sm text-muted">
          Import with{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
            npm run questions:import
          </code>
          . See <code className="text-xs">content/questions/README.md</code>.
        </p>
      </div>

      {/* ---- Coverage ---- */}
      <section>
        <h2 className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          Coverage by subject
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {subjects.map((s) => {
            const n = counts[s.code] ?? 0;
            const tone =
              n >= COMFORTABLE_PER_SUBJECT
                ? "text-success"
                : n >= MIN_PER_SUBJECT
                  ? "text-warning-ink"
                  : "text-danger-ink";
            return (
              <div key={s.code} className="rounded-lg border border-line bg-white p-4">
                <p className="font-display text-xs font-semibold text-muted">
                  {s.name_en}
                </p>
                <p className={`tnum font-display text-2xl font-extrabold ${tone}`}>
                  {n}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {n < MIN_PER_SUBJECT
                    ? `${MIN_PER_SUBJECT - n} short of the floor`
                    : n < COMFORTABLE_PER_SUBJECT
                      ? `${COMFORTABLE_PER_SUBJECT - n} to comfortable`
                      : "Healthy"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Warnings ---- */}
      {(needsRights.length > 0 || needsReview.length > 0) && (
        <div className="flex flex-col gap-2">
          {needsRights.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-bg p-4">
              <AlertTriangle size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-warning-ink" />
              <div>
                <p className="font-display text-sm font-semibold text-ink">
                  {needsRights.length} active question(s) without rights cleared
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Confirm you have permission before the campaign goes public.
                  Set <code>rights_cleared</code> in the source file and re-import.
                </p>
              </div>
            </div>
          )}
          {needsReview.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-bg p-4">
              <AlertTriangle size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-danger-ink" />
              <div>
                <p className="font-display text-sm font-semibold text-ink">
                  {needsReview.length} question(s) flagged by the difficulty engine
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Low discrimination at a real sample size usually means the
                  wording is ambiguous or the answer key is wrong — not that the
                  question is hard.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Table ---- */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<FileQuestion size={24} strokeWidth={2} />}
          title="No questions yet"
          description="Drop a batch file in content/questions/ and run npm run questions:import."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                {["Code", "Subject", "Topic", "Difficulty", "Attempts", "Accuracy", "Confidence", "Source"].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2.5 text-left font-display text-[10px] font-bold uppercase tracking-[0.08em] text-muted"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink">
                    {r.code}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-body">
                    {r.subject}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-muted">
                    {r.topic ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <DifficultyBadge label={r.difficulty_label} />
                      <span className="tnum text-xs text-muted">{r.difficulty_score}</span>
                    </span>
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-2.5 text-xs text-body">
                    {formatPoints(r.attempts)}
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-2.5 text-xs text-body">
                    {r.accuracy != null ? formatPercent(Number(r.accuracy)) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                    {r.confidence != null ? (
                      <span className="tnum text-body">{Number(r.confidence).toFixed(2)}</span>
                    ) : (
                      <Badge tone="neutral">{r.maturity}</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted">
                        {r.source_type}
                      </span>
                      {!r.rights_cleared && <Badge tone="warning">Rights?</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
