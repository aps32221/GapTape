use std::sync::Arc;

use crate::chain::Chain;

#[derive(Clone)]
pub struct AppState {
    pub chain: Arc<Chain>,
}
