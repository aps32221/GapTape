use serde::Serialize;

pub fn state_name(state: u8) -> &'static str {
    match state {
        0 => "Live",
        1 => "Synthetic",
        2 => "Stale",
        3 => "Degraded",
        _ => "Unknown",
    }
}

#[derive(Serialize)]
pub struct OracleDto {
    pub price: String,
    pub updated_at: u64,
    pub state: u8,
    pub state_name: String,
    pub weekend_synthetic_price: String,
}

#[derive(Serialize)]
pub struct TierDto {
    pub tier: u8,
    pub gap_threshold_bps: String,
    pub base_rate_bps: String,
    pub label: String,
}

#[derive(Serialize)]
pub struct LendingPoolStatsDto {
    pub total_stock_supplied: String,
    pub total_stock_borrowed: String,
    pub utilization_bps: String,
    pub borrow_rate_bps: String,
}

#[derive(Serialize)]
pub struct InsurancePoolStatsDto {
    pub total_pool_liquidity: String,
    pub total_locked: String,
    pub utilization_bps: String,
    pub tiers: Vec<TierDto>,
}

#[derive(Serialize)]
pub struct PolicyDto {
    pub position_id: String,
    pub holder: String,
    pub tier: u8,
    pub gap_threshold_bps: String,
    pub coverage_cap: String,
    pub premium_paid: String,
    pub active: bool,
    pub claimed: bool,
}

#[derive(Serialize)]
pub struct PositionDto {
    pub position_id: u64,
    pub borrower: String,
    pub stock_amount: String,
    pub collateral_amount: String,
    pub open_price: String,
    pub insured: bool,
    pub active: bool,
    pub defaulted: bool,
    pub mark_notional: String,
    pub collateral_ratio_bps: String,
    pub healthy: bool,
    pub policy: Option<PolicyDto>,
}

#[derive(Serialize)]
pub struct LiquidationResultDto {
    pub position_id: u64,
    pub delayed: bool,
    pub oracle_state: Option<String>,
    pub real_price: Option<String>,
    pub synthetic_price: Option<String>,
    pub gap_bps: Option<String>,
    pub insured: Option<bool>,
    pub claim_triggered: Option<bool>,
    pub claim_paid: Option<String>,
    pub liquidation_success: Option<bool>,
    pub bad_debt: Option<String>,
    pub tx_hash: String,
}
