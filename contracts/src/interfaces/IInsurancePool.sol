// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInsurancePool {
    struct Policy {
        uint256 positionId;
        address holder;
        uint8 tier; // index into risk tiers (5% / 10% / 20% gap thresholds)
        uint256 gapThresholdBps; // basis points of gap required to trigger a claim
        uint256 coverageCap; // maximum payout, stablecoin, 18 decimals
        uint256 premiumPaid;
        bool active;
        bool claimed;
    }

    function buyPolicy(
        uint256 positionId,
        address holder,
        uint8 tier,
        uint256 coverageCap
    ) external returns (uint256 policyId, uint256 premium);

    function triggerClaim(uint256 positionId, uint256 gapAmount) external returns (uint256 payout);

    function getPolicyByPosition(uint256 positionId) external view returns (Policy memory);

    function quotePremium(uint256 coverageCap, uint8 tier) external view returns (uint256 premium);
}
