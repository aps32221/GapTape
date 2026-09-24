use axum::extract::{Path, State};
use axum::Json;
use ethers::abi::RawLog;
use ethers::contract::EthLogDecode;
use ethers::types::{I256, U256};
use serde::Deserialize;

use crate::chain::{Chain, LiquidationDelayedFilter, LiquidationProcessedFilter};
use crate::error::ApiResult;
use crate::models::{state_name, LiquidationResultDto};
use crate::state::AppState;

/// Runs the exact sequence Section 5.3 describes: read the real price, diff it
/// against the frozen weekend synthetic, pay an insurance claim into the
/// collateral gap if the position is insured and the gap crosses its policy
/// threshold, then liquidate. All in the one on-chain call `processMondayOpen`
/// makes atomically; this just submits it and decodes the resulting event.
async fn process_position_inner(chain: &Chain, id: u64) -> ApiResult<LiquidationResultDto> {
    let pid = U256::from(id);
    let call = chain.engine.process_monday_open(pid);
    let pending = call.send().await?;
    let receipt = pending.await?.ok_or_else(|| anyhow::anyhow!("transaction was not mined"))?;

    let mut dto = LiquidationResultDto {
        position_id: id,
        delayed: false,
        oracle_state: None,
        real_price: None,
        synthetic_price: None,
        gap_bps: None,
        insured: None,
        claim_triggered: None,
        claim_paid: None,
        liquidation_success: None,
        bad_debt: None,
        tx_hash: format!("{:?}", receipt.transaction_hash),
    };

    for log in receipt.logs.iter() {
        let raw = RawLog { topics: log.topics.clone(), data: log.data.to_vec() };

        if let Ok(ev) = LiquidationProcessedFilter::decode_log(&raw) {
            dto.real_price = Some(ev.real_price.to_string());
            dto.synthetic_price = Some(ev.synthetic_price.to_string());
            dto.gap_bps = Some(ev.gap_bps.to_string());
            dto.insured = Some(ev.insured);
            dto.claim_triggered = Some(ev.claim_triggered);
            dto.claim_paid = Some(ev.claim_paid.to_string());
            dto.liquidation_success = Some(ev.liquidation_success);
            dto.bad_debt = Some(ev.bad_debt.to_string());
        } else if let Ok(ev) = LiquidationDelayedFilter::decode_log(&raw) {
            dto.delayed = true;
            dto.oracle_state = Some(state_name(ev.state).to_string());
        }
    }

    Ok(dto)
}

pub async fn process_position(State(state): State<AppState>, Path(id): Path<u64>) -> ApiResult<Json<LiquidationResultDto>> {
    let dto = process_position_inner(&state.chain, id).await?;
    Ok(Json(dto))
}

#[derive(Deserialize)]
pub struct ScenarioBody {
    pub weekend_price: i128,
    pub monday_price: i128,
    pub position_ids: Vec<u64>,
}

/// The "彩排 Demo" button: freeze Friday's close as the weekend synthetic
/// reference, push Monday's real (gapped) open, then run every position in
/// the comparison side by side so insured vs. uninsured outcomes land in one
/// response.
pub async fn run_scenario(State(state): State<AppState>, Json(body): Json<ScenarioBody>) -> ApiResult<Json<Vec<LiquidationResultDto>>> {
    let chain = &state.chain;

    let weekend_price = I256::from(body.weekend_price);
    chain.oracle.push_price(weekend_price, 1u8).send().await?.await?; // Synthetic
    chain.oracle.set_weekend_synthetic(weekend_price).send().await?.await?;

    let monday_price = I256::from(body.monday_price);
    chain.oracle.push_price(monday_price, 0u8).send().await?.await?; // Live

    let mut results = Vec::with_capacity(body.position_ids.len());
    for id in body.position_ids {
        results.push(process_position_inner(chain, id).await?);
    }

    Ok(Json(results))
}
