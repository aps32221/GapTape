import type { ReactNode } from "react";

export function PageShell({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          {badge}
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-50">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm text-ink-300">{subtitle}</p>}
        </div>
      </div>
      {children}
    </main>
  );
}
