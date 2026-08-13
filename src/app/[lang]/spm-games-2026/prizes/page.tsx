import { Gift } from "lucide-react";
import { getPrizePool, getPrizes } from "@/lib/queries/prizes";
import { PrizeShowcase } from "@/components/prizes/prize-showcase";
import { EmptyState } from "@/components/ui/states";
import { formatPoints } from "@/lib/utils";
import { getDictionary, isLocale, t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return { title: getDictionary((isLocale(lang) ? lang : "en") as Locale).prizes.title };
}

export default async function PrizesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = getDictionary((isLocale(lang) ? lang : "en") as Locale);
  const [categories, pool] = await Promise.all([getPrizes(), getPrizePool()]);

  const main = categories.filter((c) => c.category !== "SUBJECT");
  const subject = categories.filter((c) => c.category === "SUBJECT");

  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-lg bg-gradient-to-br from-warning to-[#C33D18] px-6 py-7 text-white sm:px-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/20 blur-2xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] backdrop-blur-sm">
            <Gift size={13} strokeWidth={2.5} />
            {dict.prizes.poolBadge}
          </span>
          <p className="tnum mt-3 font-display text-[40px] font-extrabold leading-none sm:text-[52px]">
            RM {formatPoints(pool)}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/85">
            {t(dict.prizes.poolSub, { count: categories.length })}
          </p>
        </div>
      </section>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Gift size={24} strokeWidth={2} />}
          title={dict.dashboard.prizesEmptyTitle}
          description={dict.dashboard.prizesEmptyBody}
        />
      ) : (
        <>
          <section>
            <h2 className="mb-4 font-display text-xl font-bold text-ink">
              {dict.prizes.mainCategories}
            </h2>
            <PrizeShowcase categories={main} dict={dict} />
          </section>

          {subject.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-xl font-bold text-ink">
                {dict.prizes.subjectChampions}
              </h2>
              <p className="mb-4 text-sm text-muted">
                {dict.prizes.subjectChampionsSub}
              </p>
              <PrizeShowcase categories={subject} dict={dict} />
            </section>
          )}
        </>
      )}

      <p className="rounded-md border border-line bg-white p-4 text-xs leading-relaxed text-muted">
        {dict.prizes.disclaimer}
      </p>
    </div>
  );
}
