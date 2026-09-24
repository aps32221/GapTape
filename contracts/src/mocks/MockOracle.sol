// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IOracle.sol";

/// @notice Stands in for the previously-designed "weekend-aware reference price
/// oracle" this protocol depends on. A trusted keeper (the Rust backend in this
/// repo) pushes updates; production would replace this with the real oracle
/// contract without touching any of the consumers below, since they only ever
/// talk to the IOracle interface.
contract MockOracle is IOracle, Ownable {
    int256 private _answer;
    uint256 private _updatedAt;
    PriceState private _state;
    int256 private _weekendSynthetic;

    event PriceUpdated(int256 price, PriceState state, uint256 updatedAt);
    event WeekendSyntheticSet(int256 price);

    constructor(int256 initialPrice) Ownable(msg.sender) {
        _answer = initialPrice;
        _weekendSynthetic = initialPrice;
        _state = PriceState.Live;
        _updatedAt = block.timestamp;
    }

    function latestAnswer() external view returns (int256 price, uint256 updatedAt) {
        return (_answer, _updatedAt);
    }

    function latestState() external view returns (PriceState state) {
        return _state;
    }

    function weekendSyntheticPrice() external view returns (int256 price) {
        return _weekendSynthetic;
    }

    /// @notice Keeper pushes a new tick. During the weekend the keeper marks the
    /// state Synthetic; on Monday it pushes the real print and flips to Live.
    function pushPrice(int256 price, PriceState state) external onlyOwner {
        _answer = price;
        _state = state;
        _updatedAt = block.timestamp;
        emit PriceUpdated(price, state, block.timestamp);
    }

    /// @notice Freezes Friday's close-derived synthetic reference so Monday's
    /// real open can be diffed against it.
    function setWeekendSynthetic(int256 price) external onlyOwner {
        _weekendSynthetic = price;
        emit WeekendSyntheticSet(price);
    }
}
