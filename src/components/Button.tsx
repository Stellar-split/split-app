import { forwardRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size    = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a full-width block button */
  fullWidth?: boolean;
  /** Renders a square icon-only button (removes horizontal padding) */
  iconOnly?: boolean;
  /** Show a loading spinner and disable interaction */
  loading?: boolean;
}

// ── Style maps ─────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-glow-sm focus-visible:ring-brand-400",
  secondary:
    "bg-surface-800 text-slate-200 hover:bg-surface-900/80 active:bg-surface-950 border border-white/[0.08] focus-visible:ring-brand-400",
  ghost:
    "text-slate-300 hover:text-white hover:bg-white/[0.07] active:bg-white/[0.12] focus-visible:ring-brand-400",
  danger:
    "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-400",
  outline:
    "border border-brand-500/50 text-brand-300 hover:border-brand-400 hover:bg-brand-600/10 active:bg-brand-600/20 focus-visible:ring-brand-400",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8  px-3   text-xs  gap-1.5 rounded-md",
  md: "h-10 px-4.5 text-sm  gap-2   rounded-lg",
  lg: "h-12 px-6   text-base gap-2.5 rounded-xl",
};

const ICON_ONLY_SIZE: Record<Size, string> = {
  sm: "h-8  w-8  rounded-md",
  md: "h-10 w-10 rounded-lg",
  lg: "h-12 w-12 rounded-xl",
};

// ── Component ──────────────────────────────────────────────────────────────

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      iconOnly = false,
      loading = false,
      disabled,
      className = "",
      children,
      ...rest
    },
    ref,
  ) => {
    const base = [
      "inline-flex items-center justify-center font-semibold",
      "transition-colors duration-150",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900",
      "disabled:pointer-events-none disabled:opacity-40",
      VARIANT_CLASSES[variant],
      iconOnly ? ICON_ONLY_SIZE[size] : SIZE_CLASSES[size],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={base} disabled={disabled || loading} {...rest}>
        {loading && (
          <svg
            className="animate-spin"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="7" cy="7" r="5"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="2"
            />
            <path
              d="M7 2a5 5 0 0 1 5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
