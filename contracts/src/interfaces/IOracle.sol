// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface into the pre-existing "weekend-aware reference price oracle"
/// this protocol integrates with (built in a prior design track). GapTape only
/// consumes it; MockOracle in this repo stands in for it during the hackathon.
interface IOracle {
    enum PriceState {
        Live, // market open, price is a real feed tick
        Synthetic, // market closed (weekend), price is a modeled reference
        Stale, // feed has not updated within its heartbeat, do not trust
        Degraded // cross-source deviation too large, treat with caution
    }

    /// @notice Latest answer for the asset, Chainlink-style.
    function latestAnswer() external view returns (int256 price, uint256 updatedAt);

    /// @notice Current confidence state of the feed.
    function latestState() external view returns (PriceState state);

    /// @notice Reference price synthesized for the asset while markets were closed
    /// (i.e. the Friday-close-derived weekend reference), frozen until the next
    /// real open price is pushed. This is what Monday's real open is compared against.
    function weekendSyntheticPrice() external view returns (int256 price);
}
