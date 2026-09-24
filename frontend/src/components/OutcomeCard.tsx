import type { LiquidationResultDto } from "../lib/api";
import { Badge } from "./ui/Badge";
import { fmtUsd, bpsToPercent } from "../lib/format";

export function OutcomeCard({ label, result }: { label: string; result: LiquidationResultDto | undefined }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-800/40 p-5 text-center text-sm text-ink-400">
        {label}: waiting for a run…
      </div>
    );
  }

  if (result.delayed) {
    return (
      <div className="rounded-xl border border-lender-500/40 bg-lender-500/5 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-lender-400">{label}</div>
        <div className="mt-2 text-lg font-bold text-ink-50">Liquidation delayed</div>
        <p className="mt-1 text-sm text-ink-300">Oracle state is {result.oracle_state}. The engine waits for a trustworthy feed instead of guessing.</p>
      </div>
    );
  }

  const protectedOutcome = result.insured && result.claim_triggered;
  const badDebt = !result.liquidation_success;

  const tone = badDebt ? "border-danger-500/50 bg-danger-500/5" : protectedOutcome ? "border-safe-500/50 bg-safe-500/5" : "border-ink-700 bg-ink-800/40";

  return (
    <div className={`rounded-xl border p-5 ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-300">{label}</div>
        {result.insured ? <Badge tone="writer">Insured</Badge> : <Badge tone="neutral">Uninsured</Badge>}
      </div>

      <div className="mt-3 text-2xl font-extrabold">
        {badDebt ? (
          <span className="text-danger-400">Liquidation failed — bad debt</span>
        ) : (
          <span className="text-safe-400">Liquidated cleanly</span>
        )}
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-ink-300">
        <Row label="Gap vs. weekend reference" value={result.gap_bps ? bpsToPercent(result.gap_bps) : "—"} />
        {result.claim_triggered && <Row label="Insurance claim paid" value={fmtUsd(result.claim_paid ?? "0")} accent="text-writer-400" />}
        {badDebt && <Row label="Bad debt created" value={fmtUsd(result.bad_debt ?? "0")} accent="text-danger-400" />}
      </div>

      <div className="mt-4 truncate font-mono text-[10px] text-ink-500" title={result.tx_hash}>
        tx {result.tx_hash}
      </div>
    </div>
  );
}

function Row({ label, value, accent = "text-ink-100" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={`mono ${accent}`}>{value}</span>
    </div>
  );
}
