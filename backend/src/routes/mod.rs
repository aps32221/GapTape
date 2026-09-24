mod demo;
mod misc;
mod oracle;
mod pools;
mod positions;

use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::CorsLayer;

use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(misc::health))
        .route("/config", get(misc::get_config))
        .route("/faucet", post(misc::faucet))
        .route("/oracle", get(oracle::get_oracle))
        .route("/oracle/push", post(oracle::push_price))
        .route("/oracle/freeze-weekend", post(oracle::freeze_weekend))
        .route("/positions/{id}", get(positions::get_position))
        .route("/pools/lending", get(pools::get_lending_stats))
        .route("/pools/insurance", get(pools::get_insurance_stats))
        .route("/demo/process/{id}", post(demo::process_position))
        .route("/demo/scenario", post(demo::run_scenario))
        .layer(CorsLayer::permissive())
        .with_state(state)
}
