import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  right,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; right?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-300">{label}</span>
        {right}
      </div>
      <input
        className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 font-mono text-sm text-ink-50 outline-none placeholder:text-ink-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40"
        {...rest}
      />
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </label>
  );
}
