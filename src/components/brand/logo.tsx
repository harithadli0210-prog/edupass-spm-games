import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The EduPass logo.
 *
 * The full wordmark is the same SVG the live site serves at
 * /brand/edupass-logo.svg, so the game and edupass.my render byte-identical
 * artwork. Vector, 7.6 KB, sharp at any density — preferred over the PNG
 * exports for anything on screen.
 *
 * The icon-only variant still comes from the PNG export, since the live site
 * does not publish a standalone mark.
 *
 * `priority` on the header instance: it is the largest above-the-fold element
 * on first paint, and lazy-loading it produces a visible pop.
 */

export function Logo({
  variant = "full",
  mono = false,
  className,
  priority = false,
}: {
  variant?: "full" | "icon";
  mono?: boolean;
  className?: string;
  priority?: boolean;
}) {
  if (variant === "full" && !mono) {
    return (
      <Image
        src="/brand/edupass-logo.svg"
        alt="edupass.my"
        width={6936}
        height={1080}
        priority={priority}
        className={cn("w-auto object-contain", className)}
      />
    );
  }

  const base = variant === "full" ? "edupass-wordmark" : "edupass-icon";
  const src = `/brand/${base}${mono ? "-mono" : ""}.png`;
  const size = variant === "full" ? { w: 3121, h: 505 } : { w: 1448, h: 1148 };

  return (
    <Image
      src={src}
      alt="edupass.my"
      width={size.w}
      height={size.h}
      priority={priority}
      className={cn("w-auto object-contain", className)}
    />
  );
}
