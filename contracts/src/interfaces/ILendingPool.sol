// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILendingPool {
    struct Position {
        address borrower;
        uint256 stockAmount; // size of the short, denominated in the tokenized stock
        uint256 collateralAmount; // stablecoin collateral currently backing the position
        uint256 openPrice; // oracle price at position open, 8 decimals
        bool insured;
        uint256 policyId;
        bool active;
        bool defaulted;
    }

    function getPosition(uint256 positionId) external view returns (Position memory);

    function previewShortfall(uint256 positionId, int256 markPrice) external view returns (uint256 shortfall);

    function topUpCollateral(uint256 positionId, uint256 amount) external;

    function liquidate(uint256 positionId) external returns (bool success, uint256 shortfall);
}
