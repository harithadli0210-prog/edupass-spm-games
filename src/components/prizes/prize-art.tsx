/**
 * Prize artwork.
 *
 * `image_url` on award_prizes is nullable, so this fills the slot until real
 * photography exists. Drawn rather than a grey box: an empty rectangle makes
 * the prize section look unfinished, and the prizes are the reason a student
 * enters at all.
 *
 * The moment a URL is set on the row, PrizeImage swaps to the photo and the
 * placeholder disappears with no code change.
 */

const CREAM = "#FFF4E2";
const GOLD = "#FFC24D";
const GOLD_DEEP = "#F0A020";
const INK = "#2A2350";

type ArtProps = { className?: string };
const BOX = "0 0 96 96";

/** Laptop / device prizes. */
function DeviceArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <rect x="16" y="22" width="64" height="42" rx="6" fill="#fff" />
      <rect x="21" y="27" width="54" height="32" rx="3" fill={INK} opacity="0.85" />
      <path d="M30 36h20M30 43h34M30 50h26" stroke={GOLD} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <path d="M8 68h80a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6Z" fill={CREAM} />
      <rect x="38" y="64" width="20" height="4" rx="2" fill={CREAM} />
    </svg>
  );
}

/** Cash prizes. */
function CashArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <rect x="12" y="34" width="66" height="40" rx="6" fill={CREAM} transform="rotate(-8 45 54)" />
      <rect x="18" y="30" width="66" height="40" rx="6" fill="#fff" />
      <circle cx="51" cy="50" r="13" fill={GOLD} />
      <text
        x="51"
        y="56"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill={INK}
        fontFamily="Poppins, sans-serif"
      >
        RM
      </text>
      <circle cx="27" cy="39" r="3" fill={GOLD_DEEP} opacity="0.5" />
      <circle cx="75" cy="61" r="3" fill={GOLD_DEEP} opacity="0.5" />
    </svg>
  );
}

/** Trophy — schools and overall. */
function TrophyArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <path d="M28 16h40v22a20 20 0 0 1-40 0V16Z" fill={GOLD} />
      <path d="M28 16h40v8a20 20 0 0 1-40 0v-8Z" fill={GOLD_DEEP} opacity="0.35" />
      <path d="M28 20h-9a11 11 0 0 0 11 15" stroke={CREAM} strokeWidth="5" strokeLinecap="round" />
      <path d="M68 20h9a11 11 0 0 1-11 15" stroke={CREAM} strokeWidth="5" strokeLinecap="round" />
      <rect x="42" y="58" width="12" height="14" fill={GOLD_DEEP} />
      <path d="M28 72h40a5 5 0 0 1 5 5v5H23v-5a5 5 0 0 1 5-5Z" fill={CREAM} />
      <path d="M48 26l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1L48 26Z" fill="#fff" />
    </svg>
  );
}

/** Books and bundles. */
function BundleArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <rect x="20" y="56" width="56" height="12" rx="3" fill={CREAM} />
      <rect x="24" y="42" width="48" height="14" rx="3" fill="#fff" />
      <rect x="18" y="28" width="60" height="14" rx="3" fill={GOLD} />
      <path d="M34 28v14M62 42v14M40 56v12" stroke={INK} strokeWidth="2" opacity="0.18" />
      <path d="M48 10l3 7 7 1-5 5 1.2 7-6.2-3.3L41.8 30 43 23l-5-5 7-1 3-7Z" fill={GOLD_DEEP} />
    </svg>
  );
}

const BY_KEYWORD: [RegExp, (p: ArtProps) => React.JSX.Element][] = [
  [/macbook|ipad|tab|laptop|phone|device|headset/i, DeviceArt],
  [/cash|rm\s?\d|credit/i, CashArt],
  [/school|trophy/i, TrophyArt],
  [/bundle|book|revision|workshop/i, BundleArt],
];

/** Picks artwork from the prize title, so new prizes get sensible art free. */
export function PrizeArt({ title, className }: { title: string; className?: string }) {
  const match = BY_KEYWORD.find(([pattern]) => pattern.test(title));
  const Art = match ? match[1] : TrophyArt;
  return <Art className={className} />;
}

/** The image slot: real photo when it exists, drawn placeholder when it doesn't. */
export function PrizeImage({
  title,
  imageUrl,
  imageAlt,
  className,
}: {
  title: string;
  imageUrl: string | null;
  imageAlt: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // Plain <img> rather than next/image: prize photography comes from
      // sponsors on hosts we cannot know ahead of time, and next/image needs
      // every remote host allow-listed at build time.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={imageAlt ?? title}
        className={`size-full object-contain ${className ?? ""}`}
      />
    );
  }
  return <PrizeArt title={title} className={className} />;
}
