import { Gift } from "lucide-react";
import { getPrizePool, getPrizes } from "@/lib/queries/prizes";
import { PrizeShowcase } from "@/components/prizes/prize-showcase";
import { EmptyState } from "@/components/ui/states";
import { formatPoints } from "@/lib/utils";

export const metadata = { title: "Prizes" };
export const dynamic = "force-dynamic";

export default async function PrizesPage() {
  const [categories, pool] = await Promise.all([getPrizes(), getPrizePool()]);

  const main = categories.filter((c) => c.category !== "SUBJECT");
  const subject = categories.filter((c) => c.category === "SUBJECT");

  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-warning to-[#C33D18] px-6 py-7 text-white sm:px-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/20 blur-2xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] backdrop-blur-sm">
            <Gift size={13} strokeWidth={2.5} />
            Season 1 prize pool
          </span>
          <p className="tnum mt-3 font-display text-[40px] font-extrabold leading-none sm:text-[52px]">
            RM {formatPoints(pool)}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/85">
            Spread across {categories.length} categories. Every category has its
            own leaderboard, so there is more than one way to win.
          </p>
        </div>
      </section>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Gift size={24} strokeWidth={2} />}
          title="Prizes not announced yet"
          description="Prize details for this season will appear here once confirmed."
        />
      ) : (
        <>
          <section>
            <h2 className="mb-4 font-display text-xl font-bold text-ink">
              Main categories
            </h2>
            <PrizeShowcase categories={main} />
          </section>

          {subject.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-xl font-bold text-ink">
                Subject champions
              </h2>
              <p className="mb-4 text-sm text-muted">
                One set of prizes for each of the five SPM subjects.
              </p>
              <PrizeShowcase categories={subject} />
            </section>
          )}
        </>
      )}

      <p className="rounded-lg border border-line bg-white p-4 text-xs leading-relaxed text-muted">
        Prizes are indicative and may be substituted for items of equal or
        greater value. Winners are determined by the final season leaderboards on
        31 October 2026 and verified before any prize is awarded.
      </p>
    </div>
  );
}
