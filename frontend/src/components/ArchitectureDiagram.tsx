import type { ReactNode } from "react";

function FlowConnector({ direction }: { direction: "converge" | "diverge" }) {
  const cols = [16.67, 50, 83.33];
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full text-ink-600">
      {cols.map((x) => (
        <path
          key={x}
          d={direction === "converge" ? `M${x} 0 L50 32` : `M50 0 L${x} 32`}
          stroke="currentColor"
          strokeWidth="0.6"
          fill="none"
        />
      ))}
      <circle cx="50" cy={direction === "converge" ? 32 : 0} r="1.4" className="fill-brand-500" />
    </svg>
  );
}

function Node({
  title,
  detail,
  toneClass,
  wide = false,
}: {
  title: string;
  detail: string;
  toneClass: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-ink-900/90 px-4 py-3 text-center shadow-lg ${toneClass} ${wide ? "mx-auto max-w-md" : ""}`}>
      <div className="text-sm font-bold text-ink-50">{title}</div>
      <div className="mt-1 text-xs leading-snug text-ink-300">{detail}</div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-4">{children}</div>;
}

export function ArchitectureDiagram() {
  return (
    <div className="mx-auto max-w-4xl">
      <Row>
        <Node title="Lender" detail="Supplies tokenized stock, earns utilization-based interest" toneClass="border-lender-500/40" />
        <Node title="Borrower / Short" detail="Posts collateral, borrows to short, optionally buys gap insurance" toneClass="border-borrower-500/40" />
        <Node title="Underwriter" detail="Capitalizes the pool, earns a share of every premium" toneClass="border-writer-500/40" />
      </Row>

      <FlowConnector direction="converge" />

      <Row>
        <Node title="Lending Pool" detail="Utilization-based rate, insurance-discounted collateral ratio" toneClass="border-ink-500" />
        <Node title="Insurance Pool" detail="Dynamic premiums, tiered gap thresholds, automatic claims" toneClass="border-ink-500" />
        <Node title="Reference Oracle" detail="Live / Synthetic / Stale weekend-aware price feed" toneClass="border-ink-500" />
      </Row>

      <FlowConnector direction="converge" />

      <Node
        title="Unified Liquidation Engine"
        detail="Monday open → diff vs. weekend synthetic → pay insurance claim into the gap → liquidate, all in one atomic call"
        toneClass="border-brand-500/60 shadow-[0_0_32px_rgba(240,185,11,0.15)]"
        wide
      />

      <FlowConnector direction="diverge" />

      <Row>
        <Node title="Protected" detail="Gap covered by insurance, collateral topped up, no bad debt" toneClass="border-safe-500/40" />
        <Node title="Loss capped" detail="Short's max loss was locked in at policy purchase" toneClass="border-safe-500/40" />
        <Node title="Uninsured control" detail="Collateral insufficient → liquidation fails → bad debt" toneClass="border-danger-500/40" />
      </Row>
    </div>
  );
}
