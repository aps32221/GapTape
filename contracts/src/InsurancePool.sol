// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IInsurancePool.sol";

/// @notice Parametric gap insurance pool (Section 5.2). Underwriters fund the
/// pool and earn a share of every premium; borrowers pay a premium at position
/// open to cap their weekend gap-risk at one of three tiers. Claims are paid out
/// automatically by the liquidation engine, no manual review (5.2 "無需人工審核").
contract InsurancePool is IInsurancePool, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RiskTier {
        uint256 gapThresholdBps; // gap size that triggers a claim
        uint256 baseRateBps; // base premium rate, bps of coverage cap
    }

    IERC20 public immutable stableToken;
    address public lendingPool;
    address public liquidationEngine;
    address public feeRecipient;

    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10% of every premium (Section 9)
    uint256 public constant WITHDRAWAL_LOCK = 3 days; // R4 mitigation: queued exits

    RiskTier[3] public tiers; // 0 = 5% gap, 1 = 10% gap, 2 = 20% gap

    uint256 public totalPoolLiquidity;
    uint256 public totalLocked; // sum of coverage caps for active policies
    uint256 public totalShares;
    mapping(address => uint256) public underwriterShares;

    struct WithdrawalRequest {
        uint256 shares;
        uint256 unlockTime;
        bool executed;
    }
    mapping(address => WithdrawalRequest) public withdrawalRequests;

    mapping(uint256 => Policy) private policies;
    mapping(uint256 => uint256) private policyIdByPosition;
    uint256 public nextPolicyId = 1;

    event Underwritten(address indexed underwriter, uint256 amount, uint256 shares);
    event WithdrawalRequested(address indexed underwriter, uint256 shares, uint256 unlockTime);
    event WithdrawalExecuted(address indexed underwriter, uint256 shares, uint256 amount);
    event PolicyBought(uint256 indexed policyId, uint256 indexed positionId, address holder, uint8 tier, uint256 coverageCap, uint256 premium);
    event ClaimTriggered(uint256 indexed positionId, uint256 indexed policyId, uint256 requested, uint256 paid, bool isPartial);

    modifier onlyLendingPool() {
        require(msg.sender == lendingPool, "InsurancePool: not lending pool");
        _;
    }

    modifier onlyLiquidationEngine() {
        require(msg.sender == liquidationEngine, "InsurancePool: not engine");
        _;
    }

    constructor(address stableToken_) Ownable(msg.sender) {
        stableToken = IERC20(stableToken_);
        feeRecipient = msg.sender;

        tiers[0] = RiskTier({ gapThresholdBps: 500, baseRateBps: 400 }); // 5% gap, 4% premium
        tiers[1] = RiskTier({ gapThresholdBps: 1000, baseRateBps: 250 }); // 10% gap, 2.5% premium
        tiers[2] = RiskTier({ gapThresholdBps: 2000, baseRateBps: 120 }); // 20% gap, 1.2% premium
    }

    function setLendingPool(address pool) external onlyOwner {
        lendingPool = pool;
    }

    function setLiquidationEngine(address engine) external onlyOwner {
        liquidationEngine = engine;
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
    }

    // --- underwriter flows ---------------------------------------------------
    function underwrite(uint256 amount) external nonReentrant {
        require(amount > 0, "InsurancePool: zero amount");
        stableToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 sharesToMint = totalShares == 0 ? amount : (amount * totalShares) / totalPoolLiquidity;
        totalShares += sharesToMint;
        underwriterShares[msg.sender] += sharesToMint;
        totalPoolLiquidity += amount;

        emit Underwritten(msg.sender, amount, sharesToMint);
    }

    function requestWithdrawal(uint256 shares) external {
        require(underwriterShares[msg.sender] >= shares, "InsurancePool: exceeds shares");
        withdrawalRequests[msg.sender] = WithdrawalRequest({
            shares: shares,
            unlockTime: block.timestamp + WITHDRAWAL_LOCK,
            executed: false
        });
        emit WithdrawalRequested(msg.sender, shares, block.timestamp + WITHDRAWAL_LOCK);
    }

    function executeWithdrawal() external nonReentrant {
        WithdrawalRequest storage req = withdrawalRequests[msg.sender];
        require(req.shares > 0 && !req.executed, "InsurancePool: no request");
        require(block.timestamp >= req.unlockTime, "InsurancePool: still locked");

        uint256 amount = (req.shares * totalPoolLiquidity) / totalShares;
        uint256 available = totalPoolLiquidity > totalLocked ? totalPoolLiquidity - totalLocked : 0;
        require(amount <= available, "InsurancePool: insufficient unlocked liquidity");

        req.executed = true;
        underwriterShares[msg.sender] -= req.shares;
        totalShares -= req.shares;
        totalPoolLiquidity -= amount;

        stableToken.safeTransfer(msg.sender, amount);
        emit WithdrawalExecuted(msg.sender, req.shares, amount);
    }

    function underwriterValue(address underwriter) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (underwriterShares[underwriter] * totalPoolLiquidity) / totalShares;
    }

    // --- pricing ---------------------------------------------------------
    function utilizationBps() public view returns (uint256) {
        if (totalPoolLiquidity == 0) return 10000;
        uint256 u = (totalLocked * 10000) / totalPoolLiquidity;
        return u > 10000 ? 10000 : u;
    }

    function quotePremium(uint256 coverageCap, uint8 tier) public view returns (uint256 premium) {
        require(tier < 3, "InsurancePool: bad tier");
        uint256 effectiveRateBps = (tiers[tier].baseRateBps * (10000 + utilizationBps())) / 10000;
        premium = (coverageCap * effectiveRateBps) / 10000;
    }

    // --- policy lifecycle ---------------------------------------------------
    function buyPolicy(
        uint256 positionId,
        address holder,
        uint8 tier,
        uint256 coverageCap
    ) external onlyLendingPool nonReentrant returns (uint256 policyId, uint256 premium) {
        require(tier < 3, "InsurancePool: bad tier");
        premium = quotePremium(coverageCap, tier);

        stableToken.safeTransferFrom(holder, address(this), premium);

        uint256 fee = (premium * PLATFORM_FEE_BPS) / 10000;
        if (fee > 0) stableToken.safeTransfer(feeRecipient, fee);
        totalPoolLiquidity += premium - fee;
        totalLocked += coverageCap;

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            positionId: positionId,
            holder: holder,
            tier: tier,
            gapThresholdBps: tiers[tier].gapThresholdBps,
            coverageCap: coverageCap,
            premiumPaid: premium,
            active: true,
            claimed: false
        });
        policyIdByPosition[positionId] = policyId;

        emit PolicyBought(policyId, positionId, holder, tier, coverageCap, premium);
    }

    function triggerClaim(uint256 positionId, uint256 gapAmount) external onlyLiquidationEngine nonReentrant returns (uint256 payout) {
        uint256 policyId = policyIdByPosition[positionId];
        Policy storage policy = policies[policyId];
        require(policy.active && !policy.claimed, "InsurancePool: no active policy");

        uint256 requested = gapAmount > policy.coverageCap ? policy.coverageCap : gapAmount;
        payout = requested > totalPoolLiquidity ? totalPoolLiquidity : requested; // R1: pro-rata if pool is thin

        policy.claimed = true;
        policy.active = false;
        totalLocked -= policy.coverageCap;
        totalPoolLiquidity -= payout;

        if (payout > 0) stableToken.safeTransfer(msg.sender, payout);

        emit ClaimTriggered(positionId, policyId, requested, payout, payout < requested ? true : false);
    }

    function getPolicyByPosition(uint256 positionId) external view returns (Policy memory) {
        return policies[policyIdByPosition[positionId]];
    }
}
