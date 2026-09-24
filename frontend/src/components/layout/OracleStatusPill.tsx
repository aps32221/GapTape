import { useOracle } from "../../hooks/useBackend";
import { fmtPrice8 } from "../../lib/format";

const STATE_DOT: Record<string, string> = {
  Live: "bg-safe-500",
  Synthetic: "bg-lender-500",
  Stale: "bg-danger-500",
  Degraded: "bg-danger-500",
};

export function OracleStatusPill() {
  const { data, isLoading } = useOracle();

  if (isLoading || !data) {
    return <span className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-ink-400">oracle: —</span>;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[data.state_name] ?? "bg-ink-400"}`} />
      <span className="text-ink-300">{data.state_name}</span>
      <span className="mono text-ink-100">{fmtPrice8(data.price)}</span>
    </div>
  );
}
