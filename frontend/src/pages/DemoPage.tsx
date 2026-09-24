import { useState } from "react";

import { OutcomeCard } from "../components/OutcomeCard";
import { PositionCard } from "../components/PositionCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { TxStatusBanner } from "../components/ui/TxStatusBanner";
import { PageShell } from "../components/layout/PageShell";
import { useOracle, usePosition } from "../hooks/useBackend";
import { useTxStatus } from "../hooks/useTxStatus";
import { api, type LiquidationResultDto } from "../lib/api";

export default function DemoPage() {
  const oracle = useOracle();
  const { status, message, run } = useTxStatus();

  const [positionA, setPositionA] = useState("1");
  const [positionB, setPositionB] = useState("2");
  const [weekendPrice, setWeekendPrice] = useState("150");
  const [mondayPrice, setMondayPrice] = useState("230");
  const [results, setResults] = useState<LiquidationResultDto[]>([]);

  const idA = Number(positionA) || 0;
  const idB = Number(positionB) || 0;
  const previewA = usePosition(idA);
  const previewB = usePosition(idB);

  const gapPct = weekendPrice && mondayPrice ? (((Number(mondayPrice) - Number(weekendPrice)) / Number(weekendPrice)) * 100).toFixed(1) : "0";

  async function handleRun() {
    if (!idA || !idB) return;
    await run("Fast-forwarding to Monday open", async () => {
      const weekendRaw = Math.round(Number(weekendPrice) * 1e8).toString();
      const mondayRaw = Math.round(Number(mondayPrice) * 1e8).toString();
      const res = await api.runScenario(weekendRaw, mondayRaw, [idA, idB]);
      setResults(res);
      await Promise.all([previewA.refetch(), previewB.refetch()]);
    });
  }

  const resultA = results.find((r) => r.position_id === idA);
  const resultB = results.find((r) => r.position_id === idB);

  return (
    <PageShell
      badge={<Badge tone="brand">Gap Simulator</Badge>}
      title="Rehearse Monday open: insured vs. uninsured, side by side"
      subtitle="The exact rehearsal the hackathon plan calls for — freeze Friday's close, push Monday's real (gapped) open, then run the unified liquidation engine on two comparable positions."
    >
      <Card className="mb-6">
        <CardBody className="text-sm leading-relaxed text-ink-300">
          <span className="font-semibold text-ink-100">How to use this page:</span> first supply liquidity on the{" "}
          <a href="/lender" className="text-lender-400 hover:underline">Lender</a> page, then open two comparable short positions on the{" "}
          <a href="/borrower" className="text-borrower-400 hover:underline">Short &amp; Insure</a> page — one with gap insurance, one
          without. Enter their position IDs below (the Borrower page lists yours), pick a weekend gap, and run it.
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Scenario controls" subtitle={oracle.data ? `Current on-chain reference: ${oracle.data.state_name}` : undefined} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Position A" value={positionA} onChange={(e) => setPositionA(e.target.value)} />
              <Field label="Position B" value={positionB} onChange={(e) => setPositionB(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Friday close (weekend synthetic)" value={weekendPrice} onChange={(e) => setWeekendPrice(e.target.value)} right={<span className="text-xs text-ink-400">USD</span>} />
              <Field label="Monday real open" value={mondayPrice} onChange={(e) => setMondayPrice(e.target.value)} right={<span className="text-xs text-ink-400">USD</span>} />
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-800/60 p-3 text-center">
              <div className="text-xs uppercase tracking-wider text-ink-400">Implied gap</div>
              <div className={`mt-1 font-mono text-2xl font-bold ${Number(gapPct) < 0 ? "text-danger-400" : "text-brand-400"}`}>{gapPct}%</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => { setWeekendPrice("150"); setMondayPrice("230"); }}>
                Buyout-rumor preset (+53%)
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => { setWeekendPrice("150"); setMondayPrice("108"); }}>
                Crash preset (-28%)
              </Button>
            </div>
            <Button className="w-full" onClick={handleRun}>
              Run Monday open
            </Button>
            <TxStatusBanner status={status} message={message} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <OutcomeCard label={`Position #${idA || "A"}`} result={resultA} />
            <OutcomeCard label={`Position #${idB || "B"}`} result={resultB} />
          </div>

          <Card>
            <CardHeader title="Position state (live)" />
            <CardBody className="space-y-3">
              {previewA.data && <PositionCard position={previewA.data} />}
              {previewB.data && <PositionCard position={previewB.data} />}
              {!previewA.data && !previewB.data && <p className="text-sm text-ink-400">Enter valid position IDs to preview their state.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
