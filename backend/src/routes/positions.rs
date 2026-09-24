use axum::extract::{Path, State};
use axum::Json;
use ethers::types::U256;

use crate::chain::{Policy, Position};
use crate::error::ApiResult;
use crate::models::{PolicyDto, PositionDto};
use crate::state::AppState;

pub async fn get_position(State(state): State<AppState>, Path(id): Path<u64>) -> ApiResult<Json<PositionDto>> {
    let chain = &state.chain;
    let pid = U256::from(id);

    let position: Position = chain.lending_pool.get_position(pid).call().await?;
    let (mark_price, _) = chain.oracle.latest_answer().call().await?;

    let mark_notional = chain.lending_pool.notional_at(pid, mark_price).call().await?;
    let ratio = chain.lending_pool.collateral_ratio_bps_at(pid, mark_price).call().await?;
    let healthy = chain.lending_pool.is_healthy(pid, mark_price).call().await?;

    let policy = if position.insured {
        let policy: Policy = chain.insurance_pool.get_policy_by_position(pid).call().await?;
        Some(PolicyDto {
            position_id: policy.position_id.to_string(),
            holder: format!("{:?}", policy.holder),
            tier: policy.tier,
            gap_threshold_bps: policy.gap_threshold_bps.to_string(),
            coverage_cap: policy.coverage_cap.to_string(),
            premium_paid: policy.premium_paid.to_string(),
            active: policy.active,
            claimed: policy.claimed,
        })
    } else {
        None
    };

    Ok(Json(PositionDto {
        position_id: id,
        borrower: format!("{:?}", position.borrower),
        stock_amount: position.stock_amount.to_string(),
        collateral_amount: position.collateral_amount.to_string(),
        open_price: position.open_price.to_string(),
        insured: position.insured,
        active: position.active,
        defaulted: position.defaulted,
        mark_notional: mark_notional.to_string(),
        collateral_ratio_bps: ratio.to_string(),
        healthy,
        policy,
    }))
}
