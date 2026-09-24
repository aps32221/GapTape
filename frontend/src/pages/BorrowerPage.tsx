import { useMemo, useState } from "react";
import { decodeEventLog } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { PositionCard } from "../components/PositionCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { TxStatusBanner } from "../components/ui/TxStatusBanner";
import { PageShell } from "../components/layout/PageShell";
import { useDeployment, useInsuranceStats, useOracle, usePosition } from "../hooks/useBackend";
import { useMyPositions } from "../hooks/useMyPositions";
import { useTxStatus } from "../hooks/useTxStatus";
import { abis, OPEN_RATIO_BPS, OPEN_RATIO_INSURED_BPS, RISK_TIERS } from "../lib/contracts";
import { fmtToken, fmtUsd, toRawUnits } from "../lib/format";

export default function BorrowerPage() {
  const { address, isConnected } = useAccount();
  const deployment = useDeployment();
  const oracle = useOracle();
  const insuranceStats = useInsuranceStats();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { status, message, run } = useTxStatus();
  const myPositions = useMyPositions(address);

  const [stockAmount, setStockAmount] = useState("100");
  const [collateralOverride, setCollateralOverride] = useState<string>("");
  const [insured, setInsured] = useState(true);
  const [tier, setTier] = useState<0 | 1 | 2>(0);

  const lendingPool = deployment.data?.lendingPool as `0x${string}` | undefined;
  const insurancePool = deployment.data?.insurancePool as `0x${string}` | undefined;
  const stable = deployment.data?.stable as `0x${string}` | undefined;

  const stockRaw = toRawUnits(stockAmount || "0");
  const priceRaw = oracle.data ? BigInt(oracle.data.price) : 0n; // 8 decimals
  const notionalRaw = (stockRaw * priceRaw) / 100_000_000n; // 18-decimal stable-equivalent

  const requiredRatio = insured ? OPEN_RATIO_INSURED_BPS : OPEN_RATIO_BPS;
  const requiredCollateralRaw = (notionalRaw * requiredRatio) / 10000n;
  const collateralRaw = collateralOverride ? toRawUnits(collateralOverride) : requiredCollateralRaw;

  const premiumQuote = useReadContract({
    address: insurancePool,
    abi: abis.insurancePool,
    functionName: "quotePremium",
    args: [notionalRaw, tier],
    query: { enabled: Boolean(insurancePool && insured && notionalRaw > 0n), refetchInterval: 6000 },
  });

  const stableBalance = useReadContract({
    address: stable,
    abi: abis.erc20,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(stable && address), refetchInterval: 6000 },
  });

  const collateralOk = collateralRaw >= requiredCollateralRaw && collateralRaw > 0n;

  async function handleOpen() {
    if (!lendingPool || !stable || !address || !publicClient || !collateralOk || stockRaw <= 0n) return;
    await run("Opening short position", async () => {
      const approveCollateralHash = await writeContractAsync({
        address: stable,
        abi: abis.erc20,
        functionName: "approve",
        args: [lendingPool, collateralRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveCollateralHash });

      if (insured && insurancePool && premiumQuote.data !== undefined) {
        const approvePremiumHash = await writeContractAsync({
          address: stable,
          abi: abis.erc20,
          functionName: "approve",
          args: [insurancePool, premiumQuote.data as bigint],
        });
        await publicClient.waitForTransactionReceipt({ hash: approvePremiumHash });
      }

      const openHash = await writeContractAsync({
        address: lendingPool,
        abi: abis.lendingPool,
        functionName: "openShort",
        args: [stockRaw, collateralRaw, insured, tier],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: openHash });

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== lendingPool.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: abis.lendingPool, data: log.data, topics: log.topics, eventName: "PositionOpened" });
          const newId = Number((decoded.args as unknown as { positionId: bigint }).positionId);
          myPositions.add(newId);
        } catch {
          // not the event we're looking for
        }
      }

      setCollateralOverride("");
      await Promise.all([stableBalance.refetch(), insuranceStats.refetch()]);
    });
  }

  const tierInfo = useMemo(() => RISK_TIERS[tier], [tier]);

  return (
    <PageShell
      badge={<Badge tone="borrower">Short &amp; Insure</Badge>}
      title="Borrow tokenized stock to short, cap the weekend gap"
      subtitle="Post stablecoin collateral against the pool's tAAPL. Add gap insurance to lock your worst-case loss and unlock a lower collateral requirement."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Open a position" subtitle={oracle.data ? `Reference price ${fmtUsd(oracle.data.price, 8)}` : undefined} />
          <CardBody className="space-y-4">
            <Field
              label="Short size"
              placeholder="100"
              value={stockAmount}
              onChange={(e) => setStockAmount(e.target.value)}
              right={<span className="text-xs text-ink-400">tAAPL</span>}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-300">Gap insurance</span>
                <button
                  onClick={() => setInsured((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition ${insured ? "bg-writer-500" : "bg-ink-600"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink-950 transition ${insured ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
              {insured && (
                <div className="grid grid-cols-3 gap-2">
                  {RISK_TIERS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTier(t.id as 0 | 1 | 2)}
                      className={`rounded-lg border px-2 py-2 text-center text-xs transition ${
                        tier === t.id ? "border-writer-500 bg-writer-500/10 text-writer-300" : "border-ink-600 text-ink-300 hover:border-ink-500"
                      }`}
                    >
                      <div className="font-semibold">{t.label}</div>
                      <div className="mt-0.5 text-[10px] text-ink-400">
                        {insuranceStats.data?.tiers[t.id] ? `${(Number(insuranceStats.data.tiers[t.id].base_rate_bps) / 100).toFixed(1)}%+ premium` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Field
              label="Collateral"
              placeholder={fmtToken(requiredCollateralRaw)}
              value={collateralOverride}
              onChange={(e) => setCollateralOverride(e.target.value)}
              right={
                <button className="text-xs text-brand-400 hover:underline" onClick={() => setCollateralOverride(fmtToken(requiredCollateralRaw, 18, 6))}>
                  use minimum
                </button>
              }
            />
            {!collateralOk && collateralOverride && <p className="text-xs text-danger-400">Below the required {fmtUsd(requiredCollateralRaw)} minimum.</p>}

            <div className="rounded-lg border border-ink-700 bg-ink-800/60 p-3 text-xs text-ink-300">
              <div className="flex justify-between py-0.5">
                <span>Notional at open</span>
                <span className="mono">{fmtUsd(notionalRaw)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Required collateral ({insured ? "130%" : "150%"})</span>
                <span className="mono">{fmtUsd(requiredCollateralRaw)}</span>
              </div>
              {insured && (
                <div className="flex justify-between py-0.5">
                  <span>Premium ({tierInfo.label} trigger)</span>
                  <span className="mono">{premiumQuote.data !== undefined ? fmtUsd(premiumQuote.data as bigint) : "—"}</span>
                </div>
              )}
              <div className="flex justify-between py-0.5 text-ink-400">
                <span>Your mUSD balance</span>
                <span className="mono">{stableBalance.data !== undefined ? fmtUsd(stableBalance.data as bigint) : "—"}</span>
              </div>
            </div>

            <Button className="w-full" disabled={!isConnected || !collateralOk || stockRaw <= 0n} onClick={handleOpen}>
              {insured ? "Approve, insure & open short" : "Approve & open short"}
            </Button>
            <TxStatusBanner status={status} message={message} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Why insure" />
          <CardBody className="space-y-3 text-sm leading-relaxed text-ink-300">
            <p>
              An uninsured short only has to post <span className="text-ink-100">150%</span> collateral, but a Monday gap-up with no backstop
              can blow straight through it — the liquidation fails and the shortfall becomes bad debt for the pool.
            </p>
            <p>
              Insuring drops your requirement to <span className="text-writer-400">130%</span> and lets the insurance pool advance the
              collateral gap the instant the real open crosses your tier's threshold — capping your worst case at the premium you paid.
            </p>
            <p className="text-ink-400">
              See it side by side on the <a href="/demo" className="text-brand-400 hover:underline">Gap Simulator</a> once you've opened a pair
              of positions.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-300">Your positions</h2>
        {myPositions.ids.length === 0 ? (
          <p className="text-sm text-ink-400">No positions opened from this browser yet.</p>
        ) : (
          <div className="space-y-3">
            {myPositions.ids.map((id) => (
              <PositionRow key={id} id={id} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function PositionRow({ id }: { id: number }) {
  const { data } = usePosition(id);
  if (!data) return null;
  return <PositionCard position={data} />;
}
