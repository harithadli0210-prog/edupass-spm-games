import Link from "next/link";
import { Gift, Play } from "lucide-react";
import { formatPoints } from "@/lib/utils";
import { appPath, t, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * Dashboard hero.
 *
 * One job: make the prize pool and the next action unmissable in the first
 * screenful. The illustration is decorative and drops away below `sm`, where
 * that space is worth more to the copy and the buttons.
 */
export function HeroBanner({
  name,
  prizePool,
  daysRemaining,
  dict,
  lang,
}: {
  name: string;
  /** Null while prizes are switched off — the badge and CTA drop out cleanly. */
  prizePool: number | null;
  daysRemaining: number;
  dict: Dictionary;
  lang: Locale;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 px-6 py-7 sm:px-8 sm:py-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/15 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-accent-400/30 blur-3xl"
      />

      <div className="relative flex items-center gap-8">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
            <Gift size={13} strokeWidth={2.5} />
            {prizePool != null
              ? `RM ${formatPoints(prizePool)} ${dict.hero.inPrizes}`
              : dict.hero.seasonBadge}
          </span>

          <h1 className="mt-3 font-display text-[26px] font-extrabold leading-[1.12] text-white sm:text-[32px]">
            {dict.hero.headline}
          </h1>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
            {t(dict.hero.sub, { days: daysRemaining, name })}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href={appPath(lang, "/play/daily")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-display text-sm font-bold text-brand-600 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <Play size={15} strokeWidth={3} className="fill-brand-600" />
              {dict.hero.playToday}
            </Link>
            {prizePool != null && (
              <Link
                href={appPath(lang, "/prizes")}
                className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-white/45 px-5 font-display text-sm font-bold text-white transition-colors duration-200 hover:bg-white/15"
              >
                {dict.hero.viewPrizes}
              </Link>
            )}
          </div>
        </div>

        <HeroArt className="hidden h-[168px] w-[210px] shrink-0 lg:block" />
      </div>
    </section>
  );
}

/** Decorative: a trophy on a podium ringed by floating tokens. */
function HeroArt({ className }: { className?: string }) {
  const CREAM = "#FFF4E2";
  const GOLD = "#FFC24D";
  const GOLD_DEEP = "#F0A020";

  return (
    <svg viewBox="0 0 210 168" className={className} fill="none" aria-hidden>
      <ellipse cx="105" cy="146" rx="76" ry="12" fill="#fff" opacity="0.14" />

      {/* podium */}
      <rect x="66" y="112" width="78" height="30" rx="6" fill={CREAM} opacity="0.95" />
      <rect x="40" y="124" width="30" height="18" rx="5" fill="#fff" opacity="0.7" />
      <rect x="140" y="130" width="30" height="12" rx="5" fill="#fff" opacity="0.55" />

      {/* trophy */}
      <path d="M84 42h42v30a21 21 0 0 1-42 0V42Z" fill={GOLD} />
      <path d="M84 42h42v9a21 21 0 0 1-42 0v-9Z" fill={GOLD_DEEP} opacity="0.35" />
      <path d="M84 48h-12a13 13 0 0 0 13 17" stroke={CREAM} strokeWidth="6" strokeLinecap="round" />
      <path d="M126 48h12a13 13 0 0 1-13 17" stroke={CREAM} strokeWidth="6" strokeLinecap="round" />
      <rect x="98" y="93" width="14" height="14" fill={GOLD_DEEP} />
      <path d="M86 107h38a5 5 0 0 1 5 5v4H81v-4a5 5 0 0 1 5-5Z" fill={CREAM} />
      <path d="M105 52l4 8.4 9.2 1.3-6.6 6.4 1.6 9.1-8.2-4.3-8.2 4.3 1.6-9.1-6.6-6.4 9.2-1.3L105 52Z" fill="#fff" />

      {/* floating tokens */}
      <g opacity="0.95">
        <circle cx="40" cy="52" r="13" fill="#fff" opacity="0.85" />
        <text x="40" y="57" textAnchor="middle" fontSize="12" fontWeight="800" fill="#6846d6" fontFamily="Poppins, sans-serif">XP</text>
      </g>
      <circle cx="168" cy="40" r="10" fill={GOLD} />
      <circle cx="182" cy="86" r="7" fill="#fff" opacity="0.7" />
      <circle cx="26" cy="98" r="6" fill={GOLD} opacity="0.85" />
    </svg>
  );
}
