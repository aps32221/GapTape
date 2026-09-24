import type { ReactNode } from "react";

type Tone = "brand" | "lender" | "borrower" | "writer" | "safe" | "danger" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-500/15 text-brand-400 ring-1 ring-inset ring-brand-500/30",
  lender: "bg-lender-500/15 text-lender-400 ring-1 ring-inset ring-lender-500/30",
  borrower: "bg-borrower-500/15 text-borrower-400 ring-1 ring-inset ring-borrower-500/30",
  writer: "bg-writer-500/15 text-writer-400 ring-1 ring-inset ring-writer-500/30",
  safe: "bg-safe-500/15 text-safe-400 ring-1 ring-inset ring-safe-500/30",
  danger: "bg-danger-500/15 text-danger-400 ring-1 ring-inset ring-danger-500/30",
  neutral: "bg-ink-700/60 text-ink-200 ring-1 ring-inset ring-ink-600",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
