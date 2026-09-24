import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageShell } from "../components/layout/PageShell";

const RISKS = [
  {
    id: "R1",
    title: "Insurance pool solvency — correlated tail risk",
    priority: true,
    problem:
      "Parametric pricing assumes gap events are independent, but a macro shock (Fed surprise, geopolitical event) can gap many tickers the same weekend. Premium income is priced per-event; payouts are a correlated tail.",
    mitigations: [
      "Per-asset and pool-wide exposure caps — new policies pause past the limit",
      "Dynamic premiums that scale with systemic-risk signals, not a flat rate",
      "Pro-rata payout when the pool is thin, instead of insolvency on one event",
      "(post-hackathon) external reinsurance layer or cross-protocol risk sharing",
    ],
  },
  {
    id: "R2",
    title: "Oracle single point of failure",
    problem:
      "Claims depend entirely on the synthetic price. Thin weekend DEX liquidity could be manipulated to overpay a claim; a stale or lagging feed means a real gap goes unpaid.",
    mitigations: [
      "Cross-source deviation checks mark the feed Degraded instead of paying blind",
      "A settlement delay window absorbs sharp instantaneous reversals",
      "A weight cap on any single thin-liquidity DEX source",
    ],
  },
  {
    id: "R3",
    title: "Adverse selection & moral hazard",
    priority: true,
    problem:
      "Buyers who insure are disproportionately the ones who already suspect elevated risk (pre-earnings, rumor-stage M&A) — and once downside is capped, they're incentivized to take on more leverage.",
    mitigations: [
      "Event-window premium surcharges ahead of known catalysts",
      "Leverage caps tied to insured status, so cover isn't a leverage unlock",
      "Co-pay: claims never repay 100%, so the insured still bears a slice",
    ],
  },
  {
    id: "R4",
    title: "Underwriter run",
    problem:
      "If capital can exit instantly, rational underwriters pull out right before a known high-risk weekend — capital and risk end up inversely correlated exactly when it matters most.",
    mitigations: [
      "Lock-up and a queued withdrawal request (this repo: 3 days)",
      "A decaying exit fee that penalizes a rush of withdrawals",
      "Splitting capital into long-term underwriting vs. floating liquidity tranches",
    ],
  },
  {
    id: "R5",
    title: "Liquidation sequencing & MEV",
    problem:
      "The read → judge-claim → advance → liquidate sequence could be front-run if split across transactions, or stalled if run by one centralized keeper.",
    mitigations: [
      "The whole sequence runs in a single atomic call (this repo: processMondayOpen)",
      "Multiple redundant keepers race for the call — permissionless, no single point of failure",
      "Private-mempool submission for the production liquidation path",
    ],
  },
  {
    id: "R6",
    title: "Collateral backing risk",
    problem:
      "Everything assumes the tokenized stock is a trustworthy mirror of the real share, which depends on the issuer's custody and redemption process — a risk this protocol can monitor but never fully control.",
    mitigations: [
      "Only list issuers with a verifiable proof-of-reserve",
      "Monitor on-chain price vs. official redemption price; flag deviations to Stale",
      "Disclose plainly: this is a monitored external dependency, not an eliminated risk",
    ],
  },
];

export default function RisksPage() {
  return (
    <PageShell
      badge={<Badge tone="danger">Protocol Risks</Badge>}
      title="What can make the protocol itself fail or be drained"
      subtitle="Distinct from user-facing risk: these are about whether the protocol can be gamed or run out of solvency. R1 and R3 are flagged in the source proposal as the two judges ask about most."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {RISKS.map((risk) => (
          <Card key={risk.id} className={risk.priority ? "border-brand-500/40" : undefined}>
            <CardHeader
              title={`${risk.id} · ${risk.title}`}
              right={risk.priority ? <Badge tone="brand">Judge favorite</Badge> : undefined}
            />
            <CardBody className="space-y-3 text-sm">
              <p className="text-ink-300">{risk.problem}</p>
              <ul className="space-y-1.5">
                {risk.mitigations.map((m) => (
                  <li key={m} className="flex gap-2 text-ink-400">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-safe-500" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
