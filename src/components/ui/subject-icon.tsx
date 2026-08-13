import {
  BookOpenText,
  FlaskConical,
  Landmark,
  Languages,
  Sigma,
  BookMarked,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One icon library, one stroke width, one container size.
 *
 * Spec §3 is explicit that subjects must NOT each get their own bright colour,
 * so every subject renders in the same neutral brand container. Subjects are
 * distinguished by glyph, never by hue. The map is keyed by subject `code` and
 * covers the two subjects that are not in the MVP but are already anticipated
 * in the schema, so adding them later is a seed row and nothing else.
 */
const ICONS: Record<string, LucideIcon> = {
  BM: Languages,
  ENGLISH: BookOpenText,
  MATH: Sigma,
  SCIENCE: FlaskConical,
  SEJARAH: Landmark,
  PENDIDIKAN_ISLAM: BookMarked,
  PENDIDIKAN_MORAL: Scale,
};

const BOX = {
  sm: "size-8 rounded-sm",
  md: "size-10 rounded-md",
  lg: "size-12 rounded-lg",
} as const;

/** Icon glyph sizes are locked to the 16/20/24 scale from spec §4. */
const GLYPH = { sm: 16, md: 20, lg: 24 } as const;

export function SubjectIcon({
  code,
  size = "md",
  active,
  className,
}: {
  code: string;
  size?: keyof typeof BOX;
  active?: boolean;
  className?: string;
}) {
  const Icon = ICONS[code] ?? BookOpenText;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        BOX[size],
        active ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-600",
        className,
      )}
      aria-hidden
    >
      <Icon size={GLYPH[size]} strokeWidth={2} />
    </span>
  );
}
