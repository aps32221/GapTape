import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  accent = "text-ink-50",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}
