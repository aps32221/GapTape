use axum::extract::State;
use axum::Json;
use ethers::types::U256;

use crate::error::ApiResult;
use crate::models::{InsurancePoolStatsDto, LendingPoolStatsDto, TierDto};
use crate::state::AppState;

pub async fn get_lending_stats(State(state): State<AppState>) -> ApiResult<Json<LendingPoolStatsDto>> {
    let chain = &state.chain;
    let total_supplied = chain.lending_pool.total_stock_supplied().call().await?;
    let total_borrowed = chain.lending_pool.total_stock_borrowed().call().await?;
    let utilization = chain.lending_pool.utilization_bps().call().await?;
    let borrow_rate = chain.lending_pool.borrow_rate_bps().call().await?;

    Ok(Json(LendingPoolStatsDto {
        total_stock_supplied: total_supplied.to_string(),
        total_stock_borrowed: total_borrowed.to_string(),
        utilization_bps: utilization.to_string(),
        borrow_rate_bps: borrow_rate.to_string(),
    }))
}

const TIER_LABELS: [&str; 3] = ["5% gap", "10% gap", "20% gap"];

pub async fn get_insurance_stats(State(state): State<AppState>) -> ApiResult<Json<InsurancePoolStatsDto>> {
    let chain = &state.chain;
    let total_liquidity = chain.insurance_pool.total_pool_liquidity().call().await?;
    let total_locked = chain.insurance_pool.total_locked().call().await?;
    let utilization = chain.insurance_pool.utilization_bps().call().await?;

    let mut tiers = Vec::with_capacity(3);
    for i in 0u8..3 {
        let (gap_threshold_bps, base_rate_bps): (U256, U256) = chain.insurance_pool.tiers(U256::from(i)).call().await?;
        tiers.push(TierDto {
            tier: i,
            gap_threshold_bps: gap_threshold_bps.to_string(),
            base_rate_bps: base_rate_bps.to_string(),
            label: TIER_LABELS[i as usize].to_string(),
        });
    }

    Ok(Json(InsurancePoolStatsDto {
        total_pool_liquidity: total_liquidity.to_string(),
        total_locked: total_locked.to_string(),
        utilization_bps: utilization.to_string(),
        tiers,
    }))
}
