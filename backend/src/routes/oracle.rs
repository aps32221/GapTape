use axum::extract::State;
use axum::Json;
use ethers::types::I256;
use serde::Deserialize;
use serde_json::json;

use crate::error::ApiResult;
use crate::models::{state_name, OracleDto};
use crate::state::AppState;

pub async fn get_oracle(State(state): State<AppState>) -> ApiResult<Json<OracleDto>> {
    let chain = &state.chain;
    let (price, updated_at) = chain.oracle.latest_answer().call().await?;
    let price_state: u8 = chain.oracle.latest_state().call().await?;
    let weekend = chain.oracle.weekend_synthetic_price().call().await?;

    Ok(Json(OracleDto {
        price: price.to_string(),
        updated_at: updated_at.as_u64(),
        state: price_state,
        state_name: state_name(price_state).to_string(),
        weekend_synthetic_price: weekend.to_string(),
    }))
}

#[derive(Deserialize)]
pub struct PushPriceBody {
    pub price: i128,
    pub state: u8,
}

/// Keeper action: push a new tick. During the weekend the keeper marks it
/// Synthetic; on Monday it pushes the real print and flips to Live.
pub async fn push_price(State(state): State<AppState>, Json(body): Json<PushPriceBody>) -> ApiResult<Json<serde_json::Value>> {
    let chain = &state.chain;
    let price = I256::from(body.price);
    let call = chain.oracle.push_price(price, body.state);
    let pending = call.send().await?;
    let receipt = pending.await?;
    Ok(Json(json!({ "txHash": receipt.map(|r| format!("{:?}", r.transaction_hash)) })))
}

#[derive(Deserialize)]
pub struct FreezeWeekendBody {
    pub price: i128,
}

/// Friday close: freeze the weekend synthetic reference so Monday's real open
/// can be diffed against it.
pub async fn freeze_weekend(State(state): State<AppState>, Json(body): Json<FreezeWeekendBody>) -> ApiResult<Json<serde_json::Value>> {
    let chain = &state.chain;
    let price = I256::from(body.price);
    let call = chain.oracle.set_weekend_synthetic(price);
    let pending = call.send().await?;
    let receipt = pending.await?;
    Ok(Json(json!({ "txHash": receipt.map(|r| format!("{:?}", r.transaction_hash)) })))
}
