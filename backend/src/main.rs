mod chain;
mod config;
mod error;
mod models;
mod routes;
mod state;

use std::sync::Arc;

use crate::chain::Chain;
use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive("gaptape_backend=info".parse()?))
        .init();

    let config = Config::load()?;
    tracing::info!(rpc_url = %config.rpc_url, port = config.port, "starting GapTape keeper/API service");

    let chain = Chain::connect(&config).await?;
    tracing::info!(
        lending_pool = %config.deployment.lending_pool,
        insurance_pool = %config.deployment.insurance_pool,
        engine = %config.deployment.engine,
        "connected to contracts"
    );

    let state = AppState { chain: Arc::new(chain) };
    let app = routes::build_router(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!(port = config.port, "listening");
    axum::serve(listener, app).await?;

    Ok(())
}
