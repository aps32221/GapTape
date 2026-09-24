import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const TOKEN_DECIMALS = 10n ** 18n;

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "31337.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [, lender, borrowerUninsured, borrowerInsured, underwriter] = await ethers.getSigners();

  const stock = await ethers.getContractAt("MockERC20", deployment.stock);
  const stable = await ethers.getContractAt("MockERC20", deployment.stable);
  const lendingPool = await ethers.getContractAt("LendingPool", deployment.lendingPool);
  const insurancePool = await ethers.getContractAt("InsurancePool", deployment.insurancePool);

  console.log("Funding demo actors...");
  await (await stock.mint(lender.address, 10_000n * TOKEN_DECIMALS)).wait();
  await (await stable.mint(borrowerUninsured.address, 1_000_000n * TOKEN_DECIMALS)).wait();
  await (await stable.mint(borrowerInsured.address, 1_000_000n * TOKEN_DECIMALS)).wait();
  await (await stable.mint(underwriter.address, 1_000_000n * TOKEN_DECIMALS)).wait();

  console.log("Lender supplying liquidity...");
  await (await stock.connect(lender).approve(deployment.lendingPool, 10_000n * TOKEN_DECIMALS)).wait();
  await (await lendingPool.connect(lender).depositStock(10_000n * TOKEN_DECIMALS)).wait();

  console.log("Underwriter capitalizing the insurance pool...");
  await (await stable.connect(underwriter).approve(deployment.insurancePool, 500_000n * TOKEN_DECIMALS)).wait();
  await (await insurancePool.connect(underwriter).underwrite(500_000n * TOKEN_DECIMALS)).wait();

  const stockAmount = 100n * TOKEN_DECIMALS;
  const [price] = await (await ethers.getContractAt("MockOracle", deployment.oracle)).latestAnswer();
  const notional = (stockAmount * price) / 100_000_000n;

  console.log("Opening position #1 — uninsured, bare 150% collateral...");
  const collateralUninsured = (notional * 15000n) / 10000n;
  await (await stable.connect(borrowerUninsured).approve(deployment.lendingPool, collateralUninsured)).wait();
  await (await lendingPool.connect(borrowerUninsured).openShort(stockAmount, collateralUninsured, false, 0)).wait();

  console.log("Opening position #2 — insured tier 0 (5% gap), 130% collateral...");
  const collateralInsured = (notional * 13000n) / 10000n;
  const premium = await insurancePool.quotePremium(notional, 0);
  await (await stable.connect(borrowerInsured).approve(deployment.lendingPool, collateralInsured)).wait();
  await (await stable.connect(borrowerInsured).approve(deployment.insurancePool, premium)).wait();
  await (await lendingPool.connect(borrowerInsured).openShort(stockAmount, collateralInsured, true, 0)).wait();

  console.log("Freezing weekend synthetic reference at the current price...");
  await (await (await ethers.getContractAt("MockOracle", deployment.oracle)).setWeekendSynthetic(price)).wait();

  console.log("\nDemo seeded. Position #1 = uninsured, #2 = insured (tier 0, 5% gap).");
  console.log("Open the Gap Simulator page and run Monday open with a >5% gap to see the split outcome.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
