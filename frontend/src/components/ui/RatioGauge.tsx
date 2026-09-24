export function RatioGauge({
  ratioBps,
  maintenanceBps,
  openBps,
  healthy,
}: {
  ratioBps: number;
  maintenanceBps: number;
  openBps: number;
  healthy: boolean;
}) {
  const max = Math.max(ratioBps, openBps) * 1.15;
  const pct = (v: number) => Math.min(100, (v / max) * 100);

  return (
    <div className="w-full">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full transition-all ${healthy ? "bg-safe-500" : "bg-danger-500"}`}
          style={{ width: `${pct(ratioBps)}%` }}
        />
        <div className="absolute top-0 h-full w-px bg-ink-300/60" style={{ left: `${pct(maintenanceBps)}%` }} />
        <div className="absolute top-0 h-full w-px bg-brand-400/70" style={{ left: `${pct(openBps)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-400">
        <span>0%</span>
        <span>maintenance {(maintenanceBps / 100).toFixed(0)}%</span>
        <span>open min {(openBps / 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
