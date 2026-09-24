import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { StatTile } from "../components/ui/StatTile";
import { TxStatusBanner } from "../components/ui/TxStatusBanner";
import { PageShell } from "../components/layout/PageShell";
import { useDeployment, useLendingStats } from "../hooks/useBackend";
import { useTxStatus } from "../hooks/useTxStatus";
import { api } from "../lib/api";
import { abis } from "../lib/contracts";
import { bpsToPercent, fmtToken, toRawUnits } from "../lib/format";

export default function LenderPage() {
  const { address, isConnected } = useAccount();
  const deployment = useDeployment();
  const lendingStats = useLendingStats();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { status, message, run } = useTxStatus();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const stock = deployment.data?.stock as `0x${string}` | undefined;
  const lendingPool = deployment.data?.lendingPool as `0x${string}` | undefined;

  const stockBalance = useReadContract({
    address: stock,
    abi: abis.erc20,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(stock && address), refetchInterval: 6000 },
  });

  const myDeposit = useReadContract({
    address: lendingPool,
    abi: abis.lendingPool,
    functionName: "lenderDeposits",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(lendingPool && address), refetchInterval: 6000 },
  });

  async function refreshAll() {
    await Promise.all([stockBalance.refetch(), myDeposit.refetch(), lendingStats.refetch()]);
  }

  async function handleDeposit() {
    if (!stock || !lendingPool || !address || !publicClient) return;
    const raw = toRawUnits(depositAmount);
    if (raw <= 0n) return;
    await run("Depositing tokenized stock", async () => {
      const approveHash = await writeContractAsync({ address: stock, abi: abis.erc20, functionName: "approve", args: [lendingPool, raw] });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const depositHash = await writeContractAsync({ address: lendingPool, abi: abis.lendingPool, functionName: "depositStock", args: [raw] });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      setDepositAmount("");
      await refreshAll();
    });
  }

  async function handleWithdraw() {
    if (!lendingPool || !publicClient) return;
    const raw = toRawUnits(withdrawAmount);
    if (raw <= 0n) return;
    await run("Withdrawing tokenized stock", async () => {
      const hash = await writeContractAsync({ address: lendingPool, abi: abis.lendingPool, functionName: "withdrawStock", args: [raw] });
      await publicClient.waitForTransactionReceipt({ hash });
      setWithdrawAmount("");
      await refreshAll();
    });
  }

  async function handleFaucet() {
    if (!address) return;
    await run("Requesting faucet funds", async () => {
      await api.faucet(address, toRawUnits("5000").toString(), toRawUnits("500000").toString());
      await refreshAll();
    });
  }

  return (
    <PageShell
      badge={<Badge tone="lender">Lender</Badge>}
      title="Supply tokenized stock, earn a utilization-based rate"
      subtitle="Your deposit backs the short side of the market. Collateral risk on the weekend gap is carried by the insurance pool, not by you."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pool state" subtitle="tAAPL lending pool, read live from the keeper API" />
          <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total supplied" value={lendingStats.data ? fmtToken(lendingStats.data.total_stock_supplied) : "—"} sub="tAAPL" />
            <StatTile label="Total borrowed" value={lendingStats.data ? fmtToken(lendingStats.data.total_stock_borrowed) : "—"} sub="tAAPL" />
            <StatTile
              label="Utilization"
              value={lendingStats.data ? bpsToPercent(lendingStats.data.utilization_bps) : "—"}
              accent="text-lender-400"
            />
            <StatTile
              label="Borrow rate (APR)"
              value={lendingStats.data ? bpsToPercent(lendingStats.data.borrow_rate_bps) : "—"}
              accent="text-brand-400"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Your position" />
          <CardBody className="space-y-3">
            <StatTile label="Wallet balance" value={stockBalance.data !== undefined ? fmtToken(stockBalance.data as bigint) : "—"} sub="tAAPL" />
            <StatTile label="Your deposit" value={myDeposit.data !== undefined ? fmtToken(myDeposit.data as bigint) : "—"} sub="tAAPL" accent="text-lender-400" />
            <Button variant="ghost" className="w-full" disabled={!isConnected} onClick={handleFaucet}>
              Get demo tAAPL + mUSD
            </Button>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Deposit" />
          <CardBody className="space-y-4">
            <Field
              label="Amount"
              placeholder="0.0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              right={<span className="text-xs text-ink-400">tAAPL</span>}
            />
            <Button className="w-full" disabled={!isConnected || !depositAmount} onClick={handleDeposit}>
              Approve &amp; deposit
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Withdraw" />
          <CardBody className="space-y-4">
            <Field
              label="Amount"
              placeholder="0.0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              right={<span className="text-xs text-ink-400">tAAPL</span>}
            />
            <Button variant="secondary" className="w-full" disabled={!isConnected || !withdrawAmount} onClick={handleWithdraw}>
              Withdraw
            </Button>
            <p className="text-xs text-ink-400">Limited to idle liquidity — supply not currently lent out to a short.</p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <TxStatusBanner status={status} message={message} />
      </div>
    </PageShell>
  );
}
