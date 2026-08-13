"use client";

import { Check, Play } from "lucide-react";
import { motion } from "motion/react";
import { SubjectArt } from "@/components/game/subject-art";
import { cn } from "@/lib/utils";

/**
 * The subject game card.
 *
 * Each subject owns a hue, but the structure is identical across all five —
 * same height, same art box, same button position, same type scale. That
 * repetition is what lets five saturated colours sit in one grid and still read
 * as a system rather than as noise.
 */

const SKINS: Record<
  string,
  { from: string; to: string; glow: string }
> = {
  BM: { from: "#F2734A", to: "#C33D18", glow: "#FFA98A" },
  ENGLISH: { from: "#F569AC", to: "#CF2178", glow: "#FFA0CB" },
  MATH: { from: "#5A9AFA", to: "#145FD8", glow: "#9CC4FF" },
  SCIENCE: { from: "#2CC488", to: "#08804E", glow: "#7BE7BC" },
  SEJARAH: { from: "#EDB944", to: "#BD8006", glow: "#FFD98A" },
};

export function GameCard({
  code,
  name,
  meta,
  done,
  busy,
  disabled,
  onPlay,
  doneLabel = "Done today",
  playLabel = "Play Now",
  busyLabel = "Starting",
}: {
  code: string;
  name: string;
  meta: string;
  done?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPlay: () => void;
  doneLabel?: string;
  playLabel?: string;
  busyLabel?: string;
}) {
  const skin = SKINS[code] ?? SKINS.MATH;

  return (
    <motion.button
      type="button"
      onClick={onPlay}
      disabled={disabled || done}
      whileHover={done ? undefined : { y: -4 }}
      whileTap={done ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex h-[186px] w-full flex-col justify-between overflow-hidden rounded-xl p-4 text-left",
        "shadow-[0_10px_24px_-8px_rgba(17,26,77,.35)]",
        "disabled:cursor-default",
        done && "opacity-95",
      )}
      style={{
        background: `linear-gradient(150deg, ${skin.from} 0%, ${skin.to} 100%)`,
      }}
    >
      {/* Depth: a soft light source top-right, mirrored by the art behind it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full opacity-40 blur-2xl"
        style={{ background: skin.glow }}
      />

      <SubjectArt
        code={code}
        className="pointer-events-none absolute -bottom-1 -right-2 h-[112px] w-[140px] opacity-95 transition-transform duration-300 group-hover:scale-105"
      />

      <div className="relative">
        <h3 className="font-display text-[17px] font-bold leading-tight text-white drop-shadow-sm">
          {name}
        </h3>
        <p className="mt-0.5 text-xs font-semibold text-white/75">{meta}</p>
      </div>

      <div className="relative">
        {done ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 font-display text-xs font-bold text-ink">
            <Check size={14} strokeWidth={3} className="text-success" />
            {doneLabel}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 font-display text-xs font-bold text-ink shadow-sm",
              "transition-transform duration-200 group-hover:scale-[1.04]",
            )}
          >
            {busy ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
            ) : (
              <Play size={13} strokeWidth={3} className="fill-ink" />
            )}
            {busy ? busyLabel : playLabel}
          </span>
        )}
      </div>
    </motion.button>
  );
}
