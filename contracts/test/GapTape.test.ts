import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const PRICE_DECIMALS = 100_000_000n; // 8 decimals, Chainlink-style
const TOKEN_DECIMALS = 10n ** 18n;

async function deploySuite() {
  const [deployer, lender, borrowerA, borrowerB, underwriter] = await ethers.getSigners();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const stock = await MockERC20.deploy("Tokenized AAPL", "tAAPL", 18);
  const stable = await MockERC20.deploy("Mock USD", "mUSD", 18);

  const openPrice = 150n * PRICE_DECIMALS; // $150.00
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy(openPrice);

  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(await stock.getAddress(), await stable.getAddress(), await oracle.getAddress());

  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const insurancePool = await InsurancePool.deploy(await stable.getAddress());

  const Engine = await ethers.getContractFactory("UnifiedLiquidationEngine");
  const engine = await Engine.deploy(
    await lendingPool.getAddress(),
    await insurancePool.getAddress(),
    await oracle.getAddress(),
    await stable.getAddress()
  );

  await lendingPool.setInsurancePool(await insurancePool.getAddress());
  await lendingPool.setLiquidationEngine(await engine.getAddress());
  await insurancePool.setLendingPool(await lendingPool.getAddress());
  await insurancePool.setLiquidationEngine(await engine.getAddress());

  // fund actors
  await stock.mint(lender.address, 10_000n * TOKEN_DECIMALS);
  await stable.mint(borrowerA.address, 1_000_000n * TOKEN_DECIMALS);
  await stable.mint(borrowerB.address, 1_000_000n * TOKEN_DECIMALS);
  await stable.mint(underwriter.address, 1_000_000n * TOKEN_DECIMALS);

  return { deployer, lender, borrowerA, borrowerB, underwriter, stock, stable, oracle, lendingPool, insurancePool, engine, openPrice };
}

describe("GapTape core flow", () => {
  it("lets a lender supply stock and a borrower open an uninsured short", async () => {
    const { lender, borrowerA, stock, stable, lendingPool } = await deploySuite();

    await stock.connect(lender).approve(await lendingPool.getAddress(), 1_000n * TOKEN_DECIMALS);
    await lendingPool.connect(lender).depositStock(1_000n * TOKEN_DECIMALS);
    expect(await lendingPool.totalStockSupplied()).to.equal(1_000n * TOKEN_DECIMALS);

    const stockAmount = 100n * TOKEN_DECIMALS;
    const notional = (stockAmount * (150n * PRICE_DECIMALS)) / PRICE_DECIMALS; // 15,000 mUSD
    const collateral = (notional * 15000n) / 10000n; // 150%

    await stable.connect(borrowerA).approve(await lendingPool.getAddress(), collateral);
    await expect(lendingPool.connect(borrowerA).openShort(stockAmount, collateral, false, 0)).to.emit(lendingPool, "PositionOpened");

    const position = await lendingPool.getPosition(1);
    expect(position.borrower).to.equal(borrowerA.address);
    expect(position.insured).to.equal(false);
  });

  it("compares an insured vs an uninsured position through a Monday gap-up", async () => {
    const { lender, borrowerA, borrowerB, underwriter, stock, stable, oracle, lendingPool, insurancePool, engine } = await deploySuite();

    // lender supplies liquidity
    await stock.connect(lender).approve(await lendingPool.getAddress(), 10_000n * TOKEN_DECIMALS);
    await lendingPool.connect(lender).depositStock(10_000n * TOKEN_DECIMALS);

    // underwriter capitalizes the insurance pool
    await stable.connect(underwriter).approve(await insurancePool.getAddress(), 500_000n * TOKEN_DECIMALS);
    await insurancePool.connect(underwriter).underwrite(500_000n * TOKEN_DECIMALS);

    const stockAmount = 100n * TOKEN_DECIMALS;
    const notional = (stockAmount * 150n * PRICE_DECIMALS) / PRICE_DECIMALS;

    // borrower A: uninsured, posts the bare 150% minimum
    const collateralA = (notional * 15000n) / 10000n;
    await stable.connect(borrowerA).approve(await lendingPool.getAddress(), collateralA);
    await lendingPool.connect(borrowerA).openShort(stockAmount, collateralA, false, 0);

    // borrower B: insured at tier 0 (5% gap threshold), gets the 130% discount,
    // and separately approves the insurance pool to pull the premium
    const collateralB = (notional * 13000n) / 10000n;
    const premium = await insurancePool.quotePremium(notional, 0);
    await stable.connect(borrowerB).approve(await lendingPool.getAddress(), collateralB);
    await stable.connect(borrowerB).approve(await insurancePool.getAddress(), premium);
    await lendingPool.connect(borrowerB).openShort(stockAmount, collateralB, true, 0);

    const policy = await insurancePool.getPolicyByPosition(2);
    expect(policy.active).to.equal(true);
    expect(policy.gapThresholdBps).to.equal(500n);

    // Friday close: freeze the weekend synthetic reference at the open price
    await oracle.setWeekendSynthetic(150n * PRICE_DECIMALS);

    // Monday open: a buyout-rumor gap-up (+53%) blows through both positions'
    // 150%/130% collateral buffers, the exact "weekend risk vacuum" scenario
    // this protocol exists to insure against
    const mondayPrice = 230n * PRICE_DECIMALS; // +53%
    await oracle.pushPrice(mondayPrice, 0 /* Live */);

    // --- uninsured position: liquidation fails, bad debt is created ---
    const txA = await engine.processMondayOpen(1);
    await expect(txA).to.emit(engine, "LiquidationProcessed");
    const [, positionA] = await Promise.all([txA.wait(), lendingPool.getPosition(1)]);
    expect(positionA.defaulted).to.equal(true);

    // --- insured position: the gap crosses the 5% threshold, insurance pays,
    // collateral is topped up, and liquidation succeeds cleanly ---
    const txB = await engine.processMondayOpen(2);
    await expect(txB).to.emit(engine, "LiquidationProcessed");
    const positionB = await lendingPool.getPosition(2);
    expect(positionB.defaulted).to.equal(false);
  });

  it("delays liquidation when the oracle reports Stale", async () => {
    const { lender, borrowerA, stock, stable, oracle, lendingPool, engine } = await deploySuite();

    await stock.connect(lender).approve(await lendingPool.getAddress(), 1_000n * TOKEN_DECIMALS);
    await lendingPool.connect(lender).depositStock(1_000n * TOKEN_DECIMALS);

    const stockAmount = 100n * TOKEN_DECIMALS;
    const notional = (stockAmount * 150n * PRICE_DECIMALS) / PRICE_DECIMALS;
    const collateral = (notional * 15000n) / 10000n;
    await stable.connect(borrowerA).approve(await lendingPool.getAddress(), collateral);
    await lendingPool.connect(borrowerA).openShort(stockAmount, collateral, false, 0);

    await oracle.pushPrice(150n * PRICE_DECIMALS, 2 /* Stale */);

    await expect(engine.processMondayOpen(1)).to.emit(engine, "LiquidationDelayed");
    const position = await lendingPool.getPosition(1);
    expect(position.active).to.equal(true); // untouched, still waiting on a trustworthy feed
  });
});
