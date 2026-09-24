// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IInsurancePool.sol";
import "./interfaces/IOracle.sol";

/// @notice P2P tokenized-stock lending market (Section 5.1). Lenders supply the
/// tokenized stock and earn a utilization-based rate; borrowers post stablecoin
/// collateral to borrow stock for shorting. Positions can opt into gap insurance
/// at open, which is rewarded with a lower collateral requirement (5.1 "有投保
/// 部位可享較低抵押率優惠") because the tail risk is now backstopped by the pool.
contract LendingPool is ILendingPool, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stockToken;
    IERC20 public immutable stableToken;
    IOracle public oracle;
    IInsurancePool public insurancePool;
    address public liquidationEngine;

    // --- lender side -------------------------------------------------------
    mapping(address => uint256) public lenderDeposits;
    uint256 public totalStockSupplied;
    uint256 public totalStockBorrowed;

    // interest accrual is intentionally simplified to a per-second index for the
    // demo; a production version would checkpoint per-position like Aave/Compound.
    uint256 public constant BASE_RATE_BPS = 200; // 2% APR floor
    uint256 public constant UTILIZATION_SLOPE_BPS = 1800; // up to +18% APR at 100% utilization

    // --- borrower side -------------------------------------------------------
    mapping(uint256 => Position) private positions;
    uint256 public nextPositionId = 1;

    uint256 public constant OPEN_RATIO_BPS = 15000; // 150% required to open, uninsured
    uint256 public constant OPEN_RATIO_INSURED_BPS = 13000; // 130% required to open, insured
    uint256 public constant MAINTENANCE_RATIO_BPS = 11000; // 110% maintenance, uninsured
    uint256 public constant MAINTENANCE_RATIO_INSURED_BPS = 10500; // 105% maintenance, insured

    event StockDeposited(address indexed lender, uint256 amount);
    event StockWithdrawn(address indexed lender, uint256 amount);
    event PositionOpened(
        uint256 indexed positionId,
        address indexed borrower,
        uint256 stockAmount,
        uint256 collateralAmount,
        bool insured,
        uint256 policyId
    );
    event CollateralToppedUp(uint256 indexed positionId, uint256 amount, uint256 newCollateral);
    event PositionLiquidated(uint256 indexed positionId, bool success, uint256 shortfall);

    modifier onlyLiquidationEngine() {
        require(msg.sender == liquidationEngine, "LendingPool: not engine");
        _;
    }

    constructor(address stockToken_, address stableToken_, address oracle_) Ownable(msg.sender) {
        stockToken = IERC20(stockToken_);
        stableToken = IERC20(stableToken_);
        oracle = IOracle(oracle_);
    }

    // --- admin wiring (bootstrap only, three contracts have a circular ref) --
    function setInsurancePool(address pool) external onlyOwner {
        insurancePool = IInsurancePool(pool);
    }

    function setLiquidationEngine(address engine) external onlyOwner {
        liquidationEngine = engine;
    }

    // --- lender flows --------------------------------------------------------
    function depositStock(uint256 amount) external nonReentrant {
        require(amount > 0, "LendingPool: zero amount");
        stockToken.safeTransferFrom(msg.sender, address(this), amount);
        lenderDeposits[msg.sender] += amount;
        totalStockSupplied += amount;
        emit StockDeposited(msg.sender, amount);
    }

    function withdrawStock(uint256 amount) external nonReentrant {
        require(lenderDeposits[msg.sender] >= amount, "LendingPool: exceeds deposit");
        require(totalStockSupplied - totalStockBorrowed >= amount, "LendingPool: insufficient idle liquidity");
        lenderDeposits[msg.sender] -= amount;
        totalStockSupplied -= amount;
        stockToken.safeTransfer(msg.sender, amount);
        emit StockWithdrawn(msg.sender, amount);
    }

    function utilizationBps() public view returns (uint256) {
        if (totalStockSupplied == 0) return 0;
        return (totalStockBorrowed * 10000) / totalStockSupplied;
    }

    function borrowRateBps() public view returns (uint256) {
        return BASE_RATE_BPS + (utilizationBps() * UTILIZATION_SLOPE_BPS) / 10000;
    }

    // --- borrower flows --------------------------------------------------------
    function openShort(
        uint256 stockAmount,
        uint256 collateralAmount,
        bool buyInsurance,
        uint8 tier
    ) external nonReentrant returns (uint256 positionId) {
        require(stockAmount > 0, "LendingPool: zero size");
        require(totalStockSupplied - totalStockBorrowed >= stockAmount, "LendingPool: insufficient liquidity");

        (int256 price, ) = oracle.latestAnswer();
        require(price > 0, "LendingPool: bad price");

        uint256 requiredRatio = buyInsurance ? OPEN_RATIO_INSURED_BPS : OPEN_RATIO_BPS;
        uint256 notional = _notionalOf(stockAmount, price);
        require(collateralAmount * 10000 >= notional * requiredRatio, "LendingPool: undercollateralized");

        stableToken.safeTransferFrom(msg.sender, address(this), collateralAmount);

        totalStockBorrowed += stockAmount;
        positionId = nextPositionId++;

        uint256 policyId;
        if (buyInsurance) {
            require(address(insurancePool) != address(0), "LendingPool: no insurance pool set");
            (policyId, ) = insurancePool.buyPolicy(positionId, msg.sender, tier, notional);
        }

        positions[positionId] = Position({
            borrower: msg.sender,
            stockAmount: stockAmount,
            collateralAmount: collateralAmount,
            openPrice: uint256(price),
            insured: buyInsurance,
            policyId: policyId,
            active: true,
            defaulted: false
        });

        emit PositionOpened(positionId, msg.sender, stockAmount, collateralAmount, buyInsurance, policyId);
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function _notionalOf(uint256 stockAmount, int256 price) private pure returns (uint256) {
        return (stockAmount * uint256(price)) / 1e8;
    }

    function notionalAt(uint256 positionId, int256 markPrice) public view returns (uint256) {
        return _notionalOf(positions[positionId].stockAmount, markPrice);
    }

    function collateralRatioBpsAt(uint256 positionId, int256 markPrice) public view returns (uint256) {
        uint256 notional = notionalAt(positionId, markPrice);
        if (notional == 0) return type(uint256).max;
        return (positions[positionId].collateralAmount * 10000) / notional;
    }

    function isHealthy(uint256 positionId, int256 markPrice) public view returns (bool) {
        Position storage p = positions[positionId];
        uint256 maintenance = p.insured ? MAINTENANCE_RATIO_INSURED_BPS : MAINTENANCE_RATIO_BPS;
        return collateralRatioBpsAt(positionId, markPrice) >= maintenance;
    }

    /// @notice How much extra collateral would be needed so liquidation fully
    /// repays the debt (collateral == notional) at the given mark price. This is
    /// exactly the "collateral gap" the insurance pool advances on Monday open.
    function previewShortfall(uint256 positionId, int256 markPrice) public view returns (uint256 shortfall) {
        Position storage p = positions[positionId];
        uint256 notional = _notionalOf(p.stockAmount, markPrice);
        if (p.collateralAmount >= notional) return 0;
        return notional - p.collateralAmount;
    }

    function topUpCollateral(uint256 positionId, uint256 amount) external onlyLiquidationEngine nonReentrant {
        require(positions[positionId].active, "LendingPool: inactive position");
        stableToken.safeTransferFrom(msg.sender, address(this), amount);
        positions[positionId].collateralAmount += amount;
        emit CollateralToppedUp(positionId, amount, positions[positionId].collateralAmount);
    }

    /// @notice Executes the terminal step of the liquidation sequence (5.3, step
    /// 4): seize collateral against the debt at the current oracle price. Must
    /// only be called after the engine has already applied any insurance top-up.
    function liquidate(uint256 positionId) external onlyLiquidationEngine nonReentrant returns (bool success, uint256 shortfall) {
        Position storage p = positions[positionId];
        require(p.active, "LendingPool: inactive position");

        (int256 price, ) = oracle.latestAnswer();
        uint256 notional = _notionalOf(p.stockAmount, price);

        p.active = false;
        totalStockBorrowed -= p.stockAmount;

        if (p.collateralAmount >= notional) {
            success = true;
            shortfall = 0;
            // Seized collateral repays the lender pool; any excess above the
            // debt is the borrower's remaining equity and stays in reserve here
            // rather than being auto-refunded, kept simple for the demo.
        } else {
            success = false;
            shortfall = notional - p.collateralAmount;
            p.defaulted = true;
        }

        emit PositionLiquidated(positionId, success, shortfall);
    }
}
