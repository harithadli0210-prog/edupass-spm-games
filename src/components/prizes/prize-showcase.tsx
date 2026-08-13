import { PrizeImage } from "@/components/prizes/prize-art";
import { cn, formatPoints } from "@/lib/utils";
import type { PrizeCategory } from "@/lib/queries/prizes";
import type { Dictionary } from "@/lib/i18n";

/**
 * Prize showcase.
 *
 * Each category card leads with its first-place prize — image, title and value
 * — because that is the number a student actually weighs when deciding whether
 * to enter. Second and third sit underneath as compact rows so the whole
 * category is legible without a tap, but never competes with the headline.
 *
 * The image slot resolves to real photography as soon as award_prizes.image_url
 * is populated; until then PrizeImage draws a placeholder, so the section is
 * presentable before any assets exist.
 */

const RANK_STYLES = [
  "bg-warning text-white", // 1st
  "bg-line-strong text-brand-900", // 2nd
  "bg-[#c98b52] text-white", // 3rd
];

const CATEGORY_TINT: Record<string, string> = {
  OVERALL: "from-[#FFC24D] to-[#F0A020]",
  DAILY: "from-[#5A9AFA] to-[#145FD8]",
  SPEED: "from-[#8E70E4] to-[#5334BB]",
  SCHOOL: "from-[#2CC488] to-[#08804E]",
  CONSISTENCY: "from-[#F2734A] to-[#C33D18]",
  IMPROVED: "from-[#F569AC] to-[#CF2178]",
  SUBJECT: "from-[#5A9AFA] to-[#145FD8]",
};

export function PrizeShowcase({
  categories,
  limit,
  dict,
}: {
  categories: PrizeCategory[];
  limit?: number;
  dict: Dictionary;
}) {
  const shown = limit ? categories.slice(0, limit) : categories;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map((category) => {
        const [first, ...rest] = category.prizes;
        if (!first) return null;
        const tint = CATEGORY_TINT[category.category] ?? CATEGORY_TINT.SUBJECT;

        return (
          <article
            key={category.code}
            className="flex flex-col overflow-hidden rounded-xl border border-line bg-white"
          >
            {/* Headline prize */}
            <div className={cn("relative bg-gradient-to-br p-4", tint)}>
              <span
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/25 blur-2xl"
              />
              <div className="relative flex items-center gap-4">
                <div className="flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/25 p-1.5 backdrop-blur-sm">
                  <PrizeImage
                    title={first.title}
                    imageUrl={first.image_url}
                    imageAlt={first.image_alt}
                    className="size-full"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                    {dict.prizes.firstPlace}
                  </span>
                  <h3 className="mt-1.5 truncate font-display text-[15px] font-bold text-white">
                    {first.title}
                  </h3>
                  {first.value_myr != null && (
                    <p className="tnum font-display text-lg font-extrabold leading-tight text-white">
                      RM {formatPoints(first.value_myr)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Category + runners-up */}
            <div className="flex flex-1 flex-col p-4">
              <h4 className="font-display text-sm font-bold text-ink">
                {category.name}
              </h4>
              {first.subtitle && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {first.subtitle}
                </p>
              )}

              {rest.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                  {rest.map((prize) => (
                    <li key={prize.rank} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-sm font-display text-[11px] font-bold tabular-nums",
                          RANK_STYLES[prize.rank - 1] ?? "bg-surface-2 text-muted",
                        )}
                      >
                        {prize.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-body">
                        {prize.title}
                      </span>
                      {prize.value_myr != null && (
                        <span className="tnum shrink-0 text-xs font-bold text-muted">
                          RM {formatPoints(prize.value_myr)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {category.prizes.some((p) => p.sponsor_name) && (
                <p className="mt-3 text-[11px] text-faint">
                  {dict.prizes.sponsoredBy}{" "}
                  {[...new Set(category.prizes.map((p) => p.sponsor_name).filter(Boolean))].join(
                    ", ",
                  )}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
