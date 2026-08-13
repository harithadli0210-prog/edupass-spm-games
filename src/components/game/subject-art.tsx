/**
 * Subject illustrations for the game cards.
 *
 * One shared visual language across all five, which is what keeps a colourful
 * grid coherent rather than chaotic:
 *
 *   · Cream (#FFF4E2) and white are the primary fills, so the same artwork
 *     reads correctly over any of the five card gradients.
 *   · Exactly one warm accent (#FFC24D) per scene, for the "hero" element.
 *   · Translucent white blobs behind each subject sit on the card colour and
 *     tie the art to its background.
 *   · Every scene is drawn in the same 120 x 96 box with the subject sitting
 *     on the same baseline, so the five cards line up optically.
 *
 * Inline SVG rather than image files: no extra requests on a phone connection,
 * and the art inherits crispness at any density.
 */

const CREAM = "#FFF4E2";
const ACCENT = "#FFC24D";
const ACCENT_DEEP = "#F0A020";
const INK = "#2A2350";
const SHADE = "#E8D6BC";

type ArtProps = { className?: string };

const BOX = "0 0 120 96";

/** Soft translucent backdrop shared by every scene. */
function Backdrop() {
  return (
    <g opacity="0.22">
      <circle cx="86" cy="26" r="26" fill="#fff" />
      <circle cx="30" cy="70" r="18" fill="#fff" />
      <circle cx="104" cy="72" r="10" fill="#fff" />
    </g>
  );
}

/** Bahasa Melayu — an open book with a quill and drifting letter tiles. */
export function BmArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <Backdrop />
      {/* book */}
      <path d="M18 68V36c0-3 2-5 5-4l33 8v34l-33-8c-3-1-5-3-5-2Z" fill={CREAM} />
      <path d="M102 68V36c0-3-2-5-5-4l-33 8v34l33-8c3-1 5-3 5-2Z" fill="#fff" />
      <path d="M56 40v34l4 3 4-3V40l-4-2-4 2Z" fill={SHADE} />
      <g stroke={SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M27 45l21 5M27 53l21 5M27 61l14 3" />
      </g>
      <g stroke={SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.55">
        <path d="M93 45l-21 5M93 53l-21 5M93 61l-14 3" />
      </g>
      {/* quill */}
      <path
        d="M84 14c-9 2-16 9-19 18l-3 9 9-3c9-3 15-10 17-19l-4-5Z"
        fill={ACCENT}
      />
      <path d="M88 10l-6 6 4 5 6-6-4-5Z" fill={ACCENT_DEEP} />
      <path
        d="M62 41l14-15"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* letter tiles */}
      <g>
        <rect x="14" y="12" width="19" height="19" rx="5" fill="#fff" />
        <text
          x="23.5"
          y="26"
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill={INK}
          fontFamily="Poppins, sans-serif"
        >
          B
        </text>
      </g>
      <g>
        <rect x="36" y="4" width="16" height="16" rx="4.5" fill={ACCENT} />
        <text
          x="44"
          y="16"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill={INK}
          fontFamily="Poppins, sans-serif"
        >
          M
        </text>
      </g>
    </svg>
  );
}

/** English — stacked alphabet blocks with a speech bubble. */
export function EnglishArt({ className }: ArtProps) {
  const block = (
    x: number,
    y: number,
    size: number,
    face: string,
    top: string,
    side: string,
    letter: string,
    fs: number,
  ) => (
    <g>
      {/* isometric top + side, so the blocks read as solid objects */}
      <path d={`M${x} ${y} l${size / 2} -${size / 3} l${size} 0 l-${size / 2} ${size / 3} Z`} fill={top} />
      <path d={`M${x + size} ${y} l${size / 2} -${size / 3} l0 ${size} l-${size / 2} ${size / 3} Z`} fill={side} />
      <rect x={x} y={y} width={size} height={size} rx="4" fill={face} />
      <text
        x={x + size / 2}
        y={y + size / 2 + fs / 3}
        textAnchor="middle"
        fontSize={fs}
        fontWeight="800"
        fill={INK}
        fontFamily="Poppins, sans-serif"
      >
        {letter}
      </text>
    </g>
  );

  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <Backdrop />
      {block(20, 54, 28, "#fff", "#F3E7D4", SHADE, "A", 16)}
      {block(54, 54, 28, CREAM, "#F3E7D4", SHADE, "B", 16)}
      {block(37, 24, 28, ACCENT, "#FFD98A", ACCENT_DEEP, "C", 16)}
      {/* speech bubble */}
      <g>
        <path
          d="M78 14h24a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H92l-7 7v-7h-7a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6Z"
          fill="#fff"
        />
        <g fill={INK} opacity="0.4">
          <circle cx="84" cy="26" r="2.6" />
          <circle cx="92" cy="26" r="2.6" />
          <circle cx="100" cy="26" r="2.6" />
        </g>
      </g>
    </svg>
  );
}

/** Mathematics — a calculator with geometry solids and a floating pi. */
export function MathArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <Backdrop />
      {/* calculator */}
      <rect x="26" y="26" width="48" height="62" rx="9" fill="#fff" />
      <rect x="32" y="33" width="36" height="14" rx="4" fill={INK} opacity="0.85" />
      <text
        x="64"
        y="44"
        textAnchor="end"
        fontSize="9"
        fontWeight="700"
        fill={ACCENT}
        fontFamily="Poppins, sans-serif"
      >
        42
      </text>
      <g fill={SHADE}>
        <rect x="32" y="52" width="9" height="8" rx="2.5" />
        <rect x="45" y="52" width="9" height="8" rx="2.5" />
        <rect x="58" y="52" width="9" height="8" rx="2.5" />
        <rect x="32" y="64" width="9" height="8" rx="2.5" />
        <rect x="45" y="64" width="9" height="8" rx="2.5" />
        <rect x="32" y="76" width="22" height="8" rx="2.5" />
      </g>
      <rect x="58" y="64" width="9" height="20" rx="2.5" fill={ACCENT} />
      {/* geometry */}
      <path d="M78 88l14-26 14 26H78Z" fill={CREAM} />
      <circle cx="92" cy="34" r="13" fill={ACCENT} />
      <circle cx="88" cy="30" r="4" fill="#fff" opacity="0.55" />
      {/* pi */}
      <text
        x="16"
        y="30"
        fontSize="24"
        fontWeight="800"
        fill="#fff"
        fontFamily="Poppins, sans-serif"
      >
        π
      </text>
    </svg>
  );
}

/** Science — a bubbling flask with an orbiting atom. */
export function ScienceArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <Backdrop />
      {/* flask */}
      <path
        d="M46 22h16v20l19 33a9 9 0 0 1-8 13H35a9 9 0 0 1-8-13l19-33V22Z"
        fill="#fff"
        opacity="0.95"
      />
      <path
        d="M39 60h30l12 21a7 7 0 0 1-6 11H33a7 7 0 0 1-6-11l12-21Z"
        fill={ACCENT}
      />
      <path d="M42 20h24a3 3 0 0 1 0 6H42a3 3 0 0 1 0-6Z" fill={CREAM} />
      <g fill="#fff" opacity="0.75">
        <circle cx="46" cy="76" r="4" />
        <circle cx="60" cy="82" r="3" />
        <circle cx="54" cy="70" r="2.4" />
      </g>
      {/* bubbles escaping */}
      <g fill="#fff" opacity="0.6">
        <circle cx="52" cy="14" r="3.4" />
        <circle cx="62" cy="7" r="2.4" />
      </g>
      {/* atom */}
      <g transform="translate(93 30)">
        <ellipse rx="16" ry="6.5" fill="none" stroke={CREAM} strokeWidth="2.6" />
        <ellipse
          rx="16"
          ry="6.5"
          fill="none"
          stroke={CREAM}
          strokeWidth="2.6"
          transform="rotate(60)"
        />
        <ellipse
          rx="16"
          ry="6.5"
          fill="none"
          stroke={CREAM}
          strokeWidth="2.6"
          transform="rotate(120)"
        />
        <circle r="4.5" fill={ACCENT_DEEP} />
      </g>
    </svg>
  );
}

/** Sejarah — a classical column, an unrolled scroll and a keris hilt. */
export function SejarahArt({ className }: ArtProps) {
  return (
    <svg viewBox={BOX} className={className} fill="none" aria-hidden>
      <Backdrop />
      {/* column */}
      <g>
        <rect x="24" y="30" width="30" height="6" rx="2" fill={CREAM} />
        <rect x="21" y="24" width="36" height="7" rx="3" fill="#fff" />
        <rect x="28" y="36" width="22" height="44" rx="3" fill="#fff" />
        <g stroke={SHADE} strokeWidth="2" opacity="0.8">
          <path d="M34 40v36M39 40v36M44 40v36" />
        </g>
        <rect x="20" y="79" width="38" height="8" rx="3" fill={CREAM} />
      </g>
      {/* scroll */}
      <g>
        <path d="M62 50h34a5 5 0 0 1 0 10H62a5 5 0 0 1 0-10Z" fill={CREAM} />
        <rect x="62" y="56" width="34" height="26" fill="#fff" />
        <path d="M62 78h34a5 5 0 0 1 0 10H62a5 5 0 0 1 0-10Z" fill={CREAM} />
        <g stroke={SHADE} strokeWidth="2" strokeLinecap="round" opacity="0.85">
          <path d="M68 64h22M68 70h22M68 76h14" />
        </g>
      </g>
      {/* keris hilt, the one accent */}
      <g transform="translate(88 8) rotate(18)">
        <path d="M6 0c4 0 7 3 7 7s-3 6-7 6-7-2-7-6 3-7 7-7Z" fill={ACCENT} />
        <rect x="1" y="12" width="10" height="4" rx="2" fill={ACCENT_DEEP} />
        <path d="M4 16h4l-1 22-1 3-1-3-1-22Z" fill={CREAM} />
      </g>
    </svg>
  );
}

const ART: Record<string, (props: ArtProps) => React.JSX.Element> = {
  BM: BmArt,
  ENGLISH: EnglishArt,
  MATH: MathArt,
  SCIENCE: ScienceArt,
  SEJARAH: SejarahArt,
};

export function SubjectArt({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const Art = ART[code] ?? MathArt;
  return <Art className={className} />;
}
