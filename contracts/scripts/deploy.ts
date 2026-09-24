import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PRICE_DECIMALS = 100_000_000n;
const TOKEN_DECIMALS = 10n ** 18n;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GapTape with account:", deployer.address);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const stock = await MockERC20.deploy("Tokenized AAPL", "tAAPL", 18);
  await stock.waitForDeployment();

  const stable = await MockERC20.deploy("Mock USD", "mUSD", 18);
  await stable.waitForDeployment();

  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy(150n * PRICE_DECIMALS);
  await oracle.waitForDeployment();
  await (await oracle.setWeekendSynthetic(150n * PRICE_DECIMALS)).wait();

  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(await stock.getAddress(), await stable.getAddress(), await oracle.getAddress());
  await lendingPool.waitForDeployment();

  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const insurancePool = await InsurancePool.deploy(await stable.getAddress());
  await insurancePool.waitForDeployment();

  const Engine = await ethers.getContractFactory("UnifiedLiquidationEngine");
  const engine = await Engine.deploy(
    await lendingPool.getAddress(),
    await insurancePool.getAddress(),
    await oracle.getAddress(),
    await stable.getAddress()
  );
  await engine.waitForDeployment();

  await (await lendingPool.setInsurancePool(await insurancePool.getAddress())).wait();
  await (await lendingPool.setLiquidationEngine(await engine.getAddress())).wait();
  await (await insurancePool.setLendingPool(await lendingPool.getAddress())).wait();
  await (await insurancePool.setLiquidationEngine(await engine.getAddress())).wait();

  // seed some demo funds so a freshly cloned repo has something to look at
  await (await stock.faucet(50_000n * TOKEN_DECIMALS)).wait();
  await (await stable.faucet(5_000_000n * TOKEN_DECIMALS)).wait();

  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    stock: await stock.getAddress(),
    stable: await stable.getAddress(),
    oracle: await oracle.getAddress(),
    lendingPool: await lendingPool.getAddress(),
    insurancePool: await insurancePool.getAddress(),
    engine: await engine.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(addresses, null, 2));

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${addresses.chainId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(addresses, null, 2));
  console.log("Wrote", outFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
