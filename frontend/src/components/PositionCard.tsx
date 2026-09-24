import type { PositionDto } from "../lib/api";
import { Badge } from "./ui/Badge";
import { RatioGauge } from "./ui/RatioGauge";
import { fmtPrice8, fmtUsd, bpsToPercent } from "../lib/format";

const OPEN_RATIO_BPS = 15000;
const OPEN_RATIO_INSURED_BPS = 13000;
const MAINTENANCE_RATIO_BPS = 11000;
const MAINTENANCE_RATIO_INSURED_BPS = 10500;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function PositionCard({ position }: { position: PositionDto }) {
  const neverOpened = position.borrower.toLowerCase() === ZERO_ADDRESS;
  const openRatio = position.insured ? OPEN_RATIO_INSURED_BPS : OPEN_RATIO_BPS;
  const maintenanceRatio = position.insured ? MAINTENANCE_RATIO_INSURED_BPS : MAINTENANCE_RATIO_BPS;

  if (neverOpened) {
    return (
      <div className="rounded-xl border border-dashed border-ink-700 bg-ink-800/30 p-4 text-center text-sm text-ink-400">
        Position #{position.position_id} hasn't been opened yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-ink-100">#{position.position_id}</span>
          {position.insured ? <Badge tone="writer">Insured · Tier {position.policy?.tier}</Badge> : <Badge tone="neutral">Uninsured</Badge>}
          {!position.active && position.defaulted && <Badge tone="danger">Defaulted</Badge>}
          {!position.active && !position.defaulted && <Badge tone="safe">Closed</Badge>}
          {position.active && <Badge tone={position.healthy ? "safe" : "danger"}>{position.healthy ? "Healthy" : "At risk"}</Badge>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <div className="text-ink-400">Open price</div>
          <div className="mono text-ink-100">{fmtPrice8(position.open_price)}</div>
        </div>
        <div>
          <div className="text-ink-400">Collateral</div>
          <div className="mono text-ink-100">{fmtUsd(position.collateral_amount)}</div>
        </div>
        <div>
          <div className="text-ink-400">Mark notional</div>
          <div className="mono text-ink-100">{fmtUsd(position.mark_notional)}</div>
        </div>
        <div>
          <div className="text-ink-400">Collateral ratio</div>
          <div className="mono text-ink-100">{bpsToPercent(position.collateral_ratio_bps)}</div>
        </div>
      </div>

      {position.active && (
        <div className="mt-3">
          <RatioGauge
            ratioBps={Number(position.collateral_ratio_bps)}
            maintenanceBps={maintenanceRatio}
            openBps={openRatio}
            healthy={position.healthy}
          />
        </div>
      )}

      {position.policy && (
        <div className="mt-3 border-t border-ink-700 pt-3 text-xs text-ink-400">
          Coverage cap {fmtUsd(position.policy.coverage_cap)} · premium paid {fmtUsd(position.policy.premium_paid)} · triggers at{" "}
          {bpsToPercent(position.policy.gap_threshold_bps)} gap
          {position.policy.claimed && <span className="ml-2 text-writer-400">· claim paid out</span>}
        </div>
      )}
    </div>
  );
}
