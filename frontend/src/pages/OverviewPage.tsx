import { Link } from "react-router-dom";

import { ArchitectureDiagram } from "../components/ArchitectureDiagram";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { StatTile } from "../components/ui/StatTile";
import { useInsuranceStats, useLendingStats, useOracle } from "../hooks/useBackend";
import { bpsToPercent, fmtPrice8, fmtToken, fmtUsd } from "../lib/format";

export default function OverviewPage() {
  const oracle = useOracle();
  const lending = useLendingStats();
  const insurance = useInsuranceStats();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <Badge tone="brand">P2P Weekend Short Market · Built on BNB Chain</Badge>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink-50 sm:text-5xl">
            Shorting tokenized stocks<span className="text-glow-brand text-brand-500"> survives the weekend.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-300">
            On-chain markets trade 24/7, but TradFi reference prices freeze at Friday close. That gap is why nobody lets you
            borrow stock to short over the weekend — a Monday gap-up can blow through collateral before anyone can react.
            GapTape wires a parametric gap insurance layer directly into the lending market's liquidation path, so lenders,
            shorts, and underwriters can all price that risk instead of avoiding it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/demo">
              <Button variant="primary">Run the weekend-gap simulator</Button>
            </Link>
            <Link to="/borrower">
              <Button variant="secondary">Open a short position</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader title="Live protocol state" subtitle="Polled from the Rust keeper / API service" />
          <CardBody className="grid grid-cols-2 gap-3">
            <StatTile label="Reference price" value={oracle.data ? fmtPrice8(oracle.data.price) : "—"} sub={oracle.data?.state_name} accent="text-brand-400" />
            <StatTile
              label="Weekend synthetic"
              value={oracle.data ? fmtPrice8(oracle.data.weekend_synthetic_price) : "—"}
              sub="frozen Friday-close reference"
            />
            <StatTile
              label="Lending utilization"
              value={lending.data ? bpsToPercent(lending.data.utilization_bps) : "—"}
              sub={lending.data ? `${fmtToken(lending.data.total_stock_borrowed)} / ${fmtToken(lending.data.total_stock_supplied)} tAAPL` : undefined}
              accent="text-lender-400"
            />
            <StatTile
              label="Insurance pool"
              value={insurance.data ? fmtUsd(insurance.data.total_pool_liquidity) : "—"}
              sub={insurance.data ? `${bpsToPercent(insurance.data.utilization_bps)} committed` : undefined}
              accent="text-writer-400"
            />
          </CardBody>
        </Card>
      </section>

      <section className="mt-16">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-ink-50">Lending + insurance + oracle, wired into one liquidation path</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-400">
            Premiums and claims aren't a bolted-on product — they're read directly by the same engine that liquidates
            positions on Monday open, so the payout and the liquidation happen atomically.
          </p>
        </div>
        <ArchitectureDiagram />
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <RoleCard
          to="/lender"
          tone="lender"
          title="Lenders"
          body="Deposit tokenized stock, earn a utilization-based rate. Your collateral exposure is backstopped by the insurance pool, not left naked over the weekend."
        />
        <RoleCard
          to="/borrower"
          tone="borrower"
          title="Shorts"
          body="Borrow against stablecoin collateral. Add gap insurance at open to cap your worst-case loss and unlock a lower collateral requirement."
        />
        <RoleCard
          to="/underwriter"
          tone="writer"
          title="Underwriters"
          body="Fund the pool, earn a cut of every premium — a Lloyd's-style risk-capital role with dynamic, utilization-aware pricing."
        />
      </section>
    </main>
  );
}

function RoleCard({ to, tone, title, body }: { to: string; tone: "lender" | "borrower" | "writer"; title: string; body: string }) {
  const ring = { lender: "hover:border-lender-500/50", borrower: "hover:border-borrower-500/50", writer: "hover:border-writer-500/50" }[tone];
  return (
    <Link to={to}>
      <Card className={`h-full transition ${ring}`}>
        <CardBody>
          <Badge tone={tone}>{title}</Badge>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">{body}</p>
        </CardBody>
      </Card>
    </Link>
  );
}
