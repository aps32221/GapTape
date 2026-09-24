use axum::extract::State;
use axum::Json;
use ethers::types::{Address, U256};
use serde::Deserialize;
use serde_json::json;

use crate::error::ApiResult;
use crate::state::AppState;

pub async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

pub async fn get_config(State(state): State<AppState>) -> Json<serde_json::Value> {
    let chain = &state.chain;
    Json(json!({
        "stock": format!("{:?}", chain.stock.address()),
        "stable": format!("{:?}", chain.stable.address()),
        "oracle": format!("{:?}", chain.oracle.address()),
        "lendingPool": format!("{:?}", chain.lending_pool.address()),
        "insurancePool": format!("{:?}", chain.insurance_pool.address()),
        "engine": format!("{:?}", chain.engine.address()),
    }))
}

#[derive(Deserialize)]
pub struct FaucetBody {
    pub address: String,
    pub stock_amount: String,
    pub stable_amount: String,
}

/// Lets a demo participant paste their wallet address and get funded without
/// needing gas of their own first; the keeper wallet pays for the mint txs.
pub async fn faucet(State(state): State<AppState>, Json(body): Json<FaucetBody>) -> ApiResult<Json<serde_json::Value>> {
    let chain = &state.chain;
    let addr: Address = body.address.parse()?;
    let stock_amount = U256::from_dec_str(&body.stock_amount)?;
    let stable_amount = U256::from_dec_str(&body.stable_amount)?;

    let stock_receipt = chain.stock.mint(addr, stock_amount).send().await?.await?;
    let stable_receipt = chain.stable.mint(addr, stable_amount).send().await?.await?;

    Ok(Json(json!({
        "stockTx": stock_receipt.map(|r| format!("{:?}", r.transaction_hash)),
        "stableTx": stable_receipt.map(|r| format!("{:?}", r.transaction_hash)),
    })))
}
