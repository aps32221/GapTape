import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { StatTile } from "../components/ui/StatTile";
import { TxStatusBanner } from "../components/ui/TxStatusBanner";
import { PageShell } from "../components/layout/PageShell";
import { useDeployment, useInsuranceStats } from "../hooks/useBackend";
import { useTxStatus } from "../hooks/useTxStatus";
import { api } from "../lib/api";
import { abis } from "../lib/contracts";
import { bpsToPercent, fmtUsd, toRawUnits } from "../lib/format";

export default function UnderwriterPage() {
  const { address, isConnected } = useAccount();
  const deployment = useDeployment();
  const insuranceStats = useInsuranceStats();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { status, message, run } = useTxStatus();

  const [amount, setAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");

  const insurancePool = deployment.data?.insurancePool as `0x${string}` | undefined;
  const stable = deployment.data?.stable as `0x${string}` | undefined;

  const myShares = useReadContract({
    address: insurancePool,
    abi: abis.insurancePool,
    functionName: "underwriterShares",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(insurancePool && address), refetchInterval: 6000 },
  });

  const myValue = useReadContract({
    address: insurancePool,
    abi: abis.insurancePool,
    functionName: "underwriterValue",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(insurancePool && address), refetchInterval: 6000 },
  });

  const withdrawalRequest = useReadContract({
    address: insurancePool,
    abi: abis.insurancePool,
    functionName: "withdrawalRequests",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(insurancePool && address), refetchInterval: 6000 },
  });

  async function refreshAll() {
    await Promise.all([myShares.refetch(), myValue.refetch(), withdrawalRequest.refetch(), insuranceStats.refetch()]);
  }

  async function handleUnderwrite() {
    if (!insurancePool || !stable || !publicClient) return;
    const raw = toRawUnits(amount);
    if (raw <= 0n) return;
    await run("Underwriting the pool", async () => {
      const approveHash = await writeContractAsync({ address: stable, abi: abis.erc20, functionName: "approve", args: [insurancePool, raw] });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const underwriteHash = await writeContractAsync({ address: insurancePool, abi: abis.insurancePool, functionName: "underwrite", args: [raw] });
      await publicClient.waitForTransactionReceipt({ hash: underwriteHash });

      setAmount("");
      await refreshAll();
    });
  }

  async function handleRequestWithdrawal() {
    if (!insurancePool || !publicClient) return;
    const shares = toRawUnits(withdrawShares);
    if (shares <= 0n) return;
    await run("Queuing withdrawal (3-day lock)", async () => {
      const hash = await writeContractAsync({ address: insurancePool, abi: abis.insurancePool, functionName: "requestWithdrawal", args: [shares] });
      await publicClient.waitForTransactionReceipt({ hash });
      setWithdrawShares("");
      await refreshAll();
    });
  }

  async function handleExecuteWithdrawal() {
    if (!insurancePool || !publicClient) return;
    await run("Executing withdrawal", async () => {
      const hash = await writeContractAsync({ address: insurancePool, abi: abis.insurancePool, functionName: "executeWithdrawal", args: [] });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshAll();
    });
  }

  async function handleFaucet() {
    if (!address) return;
    await run("Requesting faucet funds", async () => {
      await api.faucet(address, toRawUnits("0").toString(), toRawUnits("1000000").toString());
      await refreshAll();
    });
  }

  const request = withdrawalRequest.data as readonly [bigint, bigint, boolean] | undefined;
  const unlockTime = request ? Number(request[1]) * 1000 : 0;
  const canExecute = request && request[0] > 0n && !request[2] && Date.now() >= unlockTime;

  return (
    <PageShell
      badge={<Badge tone="writer">Underwriter</Badge>}
      title="Capitalize the gap insurance pool"
      subtitle="A Lloyd's-style risk-capital role: fund the pool, earn a cut of every premium. Withdrawals queue behind a 3-day lock so capital can't flee right before a known risk event."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pool state" />
          <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Total liquidity" value={insuranceStats.data ? fmtUsd(insuranceStats.data.total_pool_liquidity) : "—"} accent="text-writer-400" />
            <StatTile label="Locked in policies" value={insuranceStats.data ? fmtUsd(insuranceStats.data.total_locked) : "—"} />
            <StatTile label="Utilization" value={insuranceStats.data ? bpsToPercent(insuranceStats.data.utilization_bps) : "—"} accent="text-brand-400" />
          </CardBody>
          <CardBody className="border-t border-ink-700">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-400">Risk tiers</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {insuranceStats.data?.tiers.map((t) => (
                <div key={t.tier} className="rounded-lg border border-ink-700 bg-ink-800/60 p-2 text-center text-xs">
                  <div className="font-semibold text-ink-100">{t.label}</div>
                  <div className="text-ink-400">base {bpsToPercent(t.base_rate_bps)}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Your position" />
          <CardBody className="space-y-3">
            <StatTile label="Your shares" value={myShares.data !== undefined ? (myShares.data as bigint).toString() : "—"} />
            <StatTile label="Redeemable value" value={myValue.data !== undefined ? fmtUsd(myValue.data as bigint) : "—"} accent="text-writer-400" />
            <Button variant="ghost" className="w-full" disabled={!isConnected} onClick={handleFaucet}>
              Get demo mUSD
            </Button>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Underwrite" />
          <CardBody className="space-y-4">
            <Field label="Amount" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} right={<span className="text-xs text-ink-400">mUSD</span>} />
            <Button className="w-full" disabled={!isConnected || !amount} onClick={handleUnderwrite}>
              Approve &amp; underwrite
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Withdraw" subtitle="Request, wait out the lock, then execute" />
          <CardBody className="space-y-4">
            <Field label="Shares to redeem" placeholder="0" value={withdrawShares} onChange={(e) => setWithdrawShares(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={!isConnected || !withdrawShares} onClick={handleRequestWithdrawal}>
                Request
              </Button>
              <Button variant="secondary" className="flex-1" disabled={!isConnected || !canExecute} onClick={handleExecuteWithdrawal}>
                Execute
              </Button>
            </div>
            {request && request[0] > 0n && !request[2] && (
              <p className="text-xs text-ink-400">
                {canExecute ? "Lock has cleared — ready to execute." : `Unlocks ${new Date(unlockTime).toLocaleString()}`}
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <TxStatusBanner status={status} message={message} />
      </div>
    </PageShell>
  );
}
