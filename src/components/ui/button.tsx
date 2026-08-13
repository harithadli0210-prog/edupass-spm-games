import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The pill button from the EduPass marketing site, ported.
 *
 * The static site uses `border-radius:44px` on `.btn`; a full pill reproduces
 * that at every height, which is why this is the one place the radius scale is
 * intentionally bypassed.
 */

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-brand hover:bg-brand-600 active:shadow-none",
  secondary: "bg-brand-100 text-brand-900 hover:bg-brand-200",
  ghost: "bg-transparent text-brand-900 hover:bg-brand-100",
  outline:
    "bg-white text-brand-900 border-2 border-brand-500 hover:bg-brand-500 hover:text-white",
  danger: "bg-danger text-white hover:bg-danger-ink",
};

const SIZES: Record<Size, string> = {
  // 44px min height throughout — the iOS minimum tap target. Students play
  // this on phones; a 36px control is a mistap generator.
  sm: "h-11 px-5 text-sm gap-2",
  md: "h-12 px-7 text-[15px] gap-2.5",
  lg: "h-14 px-8 text-base gap-3",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-display font-semibold",
        "transition-[background-color,color,transform,box-shadow] duration-200",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
