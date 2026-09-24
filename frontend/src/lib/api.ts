const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} -> ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface DeploymentConfig {
  stock: string;
  stable: string;
  oracle: string;
  lendingPool: string;
  insurancePool: string;
  engine: string;
}

export interface OracleDto {
  price: string;
  updated_at: number;
  state: number;
  state_name: "Live" | "Synthetic" | "Stale" | "Degraded";
  weekend_synthetic_price: string;
}

export interface LendingPoolStatsDto {
  total_stock_supplied: string;
  total_stock_borrowed: string;
  utilization_bps: string;
  borrow_rate_bps: string;
}

export interface TierDto {
  tier: number;
  gap_threshold_bps: string;
  base_rate_bps: string;
  label: string;
}

export interface InsurancePoolStatsDto {
  total_pool_liquidity: string;
  total_locked: string;
  utilization_bps: string;
  tiers: TierDto[];
}

export interface PolicyDto {
  position_id: string;
  holder: string;
  tier: number;
  gap_threshold_bps: string;
  coverage_cap: string;
  premium_paid: string;
  active: boolean;
  claimed: boolean;
}

export interface PositionDto {
  position_id: number;
  borrower: string;
  stock_amount: string;
  collateral_amount: string;
  open_price: string;
  insured: boolean;
  active: boolean;
  defaulted: boolean;
  mark_notional: string;
  collateral_ratio_bps: string;
  healthy: boolean;
  policy: PolicyDto | null;
}

export interface LiquidationResultDto {
  position_id: number;
  delayed: boolean;
  oracle_state: string | null;
  real_price: string | null;
  synthetic_price: string | null;
  gap_bps: string | null;
  insured: boolean | null;
  claim_triggered: boolean | null;
  claim_paid: string | null;
  liquidation_success: boolean | null;
  bad_debt: string | null;
  tx_hash: string;
}

export const api = {
  getConfig: () => request<DeploymentConfig>("/config"),
  getOracle: () => request<OracleDto>("/oracle"),
  pushPrice: (price: string, state: number) =>
    request<{ txHash: string | null }>("/oracle/push", { method: "POST", body: JSON.stringify({ price: Number(price), state }) }),
  freezeWeekend: (price: string) =>
    request<{ txHash: string | null }>("/oracle/freeze-weekend", { method: "POST", body: JSON.stringify({ price: Number(price) }) }),
  getLendingStats: () => request<LendingPoolStatsDto>("/pools/lending"),
  getInsuranceStats: () => request<InsurancePoolStatsDto>("/pools/insurance"),
  getPosition: (id: number) => request<PositionDto>(`/positions/${id}`),
  processPosition: (id: number) => request<LiquidationResultDto>(`/demo/process/${id}`, { method: "POST" }),
  runScenario: (weekendPrice: string, mondayPrice: string, positionIds: number[]) =>
    request<LiquidationResultDto[]>("/demo/scenario", {
      method: "POST",
      body: JSON.stringify({ weekend_price: Number(weekendPrice), monday_price: Number(mondayPrice), position_ids: positionIds }),
    }),
  faucet: (address: string, stockAmount: string, stableAmount: string) =>
    request<{ stockTx: string | null; stableTx: string | null }>("/faucet", {
      method: "POST",
      body: JSON.stringify({ address, stock_amount: stockAmount, stable_amount: stableAmount }),
    }),
};
