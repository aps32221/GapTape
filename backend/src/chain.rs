use std::sync::Arc;

use ethers::middleware::SignerMiddleware;
use ethers::prelude::*;
use ethers::providers::{Http, Provider};
use ethers::signers::{LocalWallet, Signer};

use crate::config::Config;

pub type Client = SignerMiddleware<Provider<Http>, LocalWallet>;

// Each contract gets its own module: every one of them inherits Ownable, and
// abigen! re-generates inherited event/call types (OwnershipTransferred, etc.)
// per invocation, which collide if two live in the same module scope.
pub mod mock_erc20 {
    use ethers::prelude::*;
    abigen!(MockErc20Contract, "../shared/abi/MockERC20.json");
}
pub mod mock_oracle {
    use ethers::prelude::*;
    abigen!(MockOracleContract, "../shared/abi/MockOracle.json");
}
pub mod lending_pool {
    use ethers::prelude::*;
    abigen!(LendingPoolContract, "../shared/abi/LendingPool.json");
}
pub mod insurance_pool {
    // Deliberately not `ethers::prelude::*` here: the prelude's gas-escalator
    // `Policy` trait collides with the `Policy` struct this ABI generates.
    use ethers::contract::abigen;
    abigen!(InsurancePoolContract, "../shared/abi/InsurancePool.json");
}
pub mod engine {
    use ethers::prelude::*;
    abigen!(UnifiedLiquidationEngineContract, "../shared/abi/UnifiedLiquidationEngine.json");
}

pub use engine::UnifiedLiquidationEngineContract;
pub use insurance_pool::InsurancePoolContract;
pub use lending_pool::LendingPoolContract;
pub use mock_erc20::MockErc20Contract;
pub use mock_oracle::MockOracleContract;

pub use engine::{LiquidationDelayedFilter, LiquidationProcessedFilter};
pub use insurance_pool::Policy;
pub use lending_pool::Position;

#[derive(Clone)]
pub struct Chain {
    pub client: Arc<Client>,
    pub stock: MockErc20Contract<Client>,
    pub stable: MockErc20Contract<Client>,
    pub oracle: MockOracleContract<Client>,
    pub lending_pool: LendingPoolContract<Client>,
    pub insurance_pool: InsurancePoolContract<Client>,
    pub engine: UnifiedLiquidationEngineContract<Client>,
}

impl Chain {
    pub async fn connect(config: &Config) -> anyhow::Result<Self> {
        let provider = Provider::<Http>::try_from(config.rpc_url.as_str())?;
        let chain_id = provider.get_chainid().await?.as_u64();

        let wallet: LocalWallet = config.keeper_private_key.parse::<LocalWallet>()?.with_chain_id(chain_id);
        let client = Arc::new(SignerMiddleware::new(provider, wallet));

        let stock_addr: Address = config.deployment.stock.parse()?;
        let stable_addr: Address = config.deployment.stable.parse()?;
        let oracle_addr: Address = config.deployment.oracle.parse()?;
        let lending_pool_addr: Address = config.deployment.lending_pool.parse()?;
        let insurance_pool_addr: Address = config.deployment.insurance_pool.parse()?;
        let engine_addr: Address = config.deployment.engine.parse()?;

        Ok(Self {
            stock: MockErc20Contract::new(stock_addr, client.clone()),
            stable: MockErc20Contract::new(stable_addr, client.clone()),
            oracle: MockOracleContract::new(oracle_addr, client.clone()),
            lending_pool: LendingPoolContract::new(lending_pool_addr, client.clone()),
            insurance_pool: InsurancePoolContract::new(insurance_pool_addr, client.clone()),
            engine: UnifiedLiquidationEngineContract::new(engine_addr, client.clone()),
            client,
        })
    }
}
