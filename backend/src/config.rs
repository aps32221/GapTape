use std::fs;
use std::path::Path;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Deployment {
    #[serde(rename = "chainId")]
    pub chain_id: u64,
    pub stock: String,
    pub stable: String,
    pub oracle: String,
    #[serde(rename = "lendingPool")]
    pub lending_pool: String,
    #[serde(rename = "insurancePool")]
    pub insurance_pool: String,
    pub engine: String,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub rpc_url: String,
    pub keeper_private_key: String,
    pub port: u16,
    pub deployment: Deployment,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let _ = dotenvy::dotenv();

        let rpc_url = std::env::var("RPC_URL").unwrap_or_else(|_| "http://127.0.0.1:8545".to_string());
        // Hardhat's well-known account #0 — local demo only, never use in production.
        let keeper_private_key = std::env::var("KEEPER_PRIVATE_KEY").unwrap_or_else(|_| {
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80".to_string()
        });
        let port: u16 = std::env::var("PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(8080);

        let deployment = if let Ok(path) = std::env::var("DEPLOYMENT_FILE") {
            Self::read_deployment(Path::new(&path))?
        } else {
            let default_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../shared/deployments/31337.json");
            Self::read_deployment(&default_path)?
        };

        Ok(Self { rpc_url, keeper_private_key, port, deployment })
    }

    fn read_deployment(path: &Path) -> anyhow::Result<Deployment> {
        let raw = fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("failed to read deployment file {:?}: {}", path, e))?;
        let deployment: Deployment = serde_json::from_str(&raw)?;
        Ok(deployment)
    }
}
