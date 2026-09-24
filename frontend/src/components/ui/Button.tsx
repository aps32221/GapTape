import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-[0_0_24px_rgba(240,185,11,0.25)]",
  secondary: "bg-ink-700 text-ink-50 hover:bg-ink-600 ring-1 ring-inset ring-ink-600",
  ghost: "bg-transparent text-ink-200 hover:bg-ink-800 ring-1 ring-inset ring-ink-700",
  danger: "bg-danger-500 text-ink-950 hover:brightness-110",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
