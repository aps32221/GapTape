// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IInsurancePool.sol";
import "./interfaces/IOracle.sol";

/// @notice Section 5.3. On Monday open: (1) read the real open price, (2) diff it
/// against the frozen weekend synthetic reference, (3) if the position is
/// insured and the gap crosses its policy threshold, pull an insurance payout to
/// cover the collateral gap, (4) liquidate against the now-topped-up collateral.
/// All four steps run inside one call so there is no window between the claim
/// payout and the liquidation for MEV to exploit (R5 mitigation: atomic tx).
/// Permissionless by design so any of several redundant keepers can call it
/// (R5 mitigation: no single Keeper is a point of failure).
contract UnifiedLiquidationEngine {
    ILendingPool public immutable lendingPool;
    IInsurancePool public immutable insurancePool;
    IOracle public immutable oracle;
    IERC20 public immutable stableToken;

    event LiquidationProcessed(
        uint256 indexed positionId,
        int256 realPrice,
        int256 syntheticPrice,
        uint256 gapBps,
        bool insured,
        bool claimTriggered,
        uint256 claimPaid,
        bool liquidationSuccess,
        uint256 badDebt
    );
    event LiquidationDelayed(uint256 indexed positionId, IOracle.PriceState state);

    constructor(address lendingPool_, address insurancePool_, address oracle_, address stableToken_) {
        lendingPool = ILendingPool(lendingPool_);
        insurancePool = IInsurancePool(insurancePool_);
        oracle = IOracle(oracle_);
        stableToken = IERC20(stableToken_);
    }

    function processMondayOpen(uint256 positionId) external returns (bool liquidationSuccess, uint256 badDebt) {
        IOracle.PriceState state = oracle.latestState();
        if (state == IOracle.PriceState.Stale) {
            // Reuse the oracle's own confidence marker: don't liquidate against a
            // feed we don't trust yet, wait for it to recover instead of guessing.
            emit LiquidationDelayed(positionId, state);
            return (false, 0);
        }

        (int256 realPrice, ) = oracle.latestAnswer();
        int256 syntheticPrice = oracle.weekendSyntheticPrice();
        uint256 gapBps = _gapBps(realPrice, syntheticPrice);

        ILendingPool.Position memory position = lendingPool.getPosition(positionId);

        bool claimTriggered = false;
        uint256 claimPaid = 0;

        if (position.insured) {
            IInsurancePool.Policy memory policy = insurancePool.getPolicyByPosition(positionId);
            if (policy.active && gapBps >= policy.gapThresholdBps) {
                uint256 shortfall = lendingPool.previewShortfall(positionId, realPrice);
                if (shortfall > 0) {
                    claimPaid = insurancePool.triggerClaim(positionId, shortfall);
                    claimTriggered = true;
                    if (claimPaid > 0) {
                        stableToken.approve(address(lendingPool), claimPaid);
                        lendingPool.topUpCollateral(positionId, claimPaid);
                    }
                }
            }
        }

        (liquidationSuccess, badDebt) = lendingPool.liquidate(positionId);

        emit LiquidationProcessed(
            positionId,
            realPrice,
            syntheticPrice,
            gapBps,
            position.insured,
            claimTriggered,
            claimPaid,
            liquidationSuccess,
            badDebt
        );
    }

    function _gapBps(int256 realPrice, int256 syntheticPrice) private pure returns (uint256) {
        if (syntheticPrice == 0) return 0;
        int256 diff = realPrice - syntheticPrice;
        if (diff < 0) diff = -diff;
        return uint256((diff * 10000) / syntheticPrice);
    }
}
