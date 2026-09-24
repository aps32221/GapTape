const fs = require("fs");
const path = require("path");

const ARTIFACTS_ROOT = path.join(__dirname, "..", "artifacts", "src");
const OUT_DIR = path.join(__dirname, "..", "..", "shared", "abi");

const TARGETS = [
  ["mocks/MockERC20.sol/MockERC20.json", "MockERC20.json"],
  ["mocks/MockOracle.sol/MockOracle.json", "MockOracle.json"],
  ["LendingPool.sol/LendingPool.json", "LendingPool.json"],
  ["InsurancePool.sol/InsurancePool.json", "InsurancePool.json"],
  ["UnifiedLiquidationEngine.sol/UnifiedLiquidationEngine.json", "UnifiedLiquidationEngine.json"],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [src, outName] of TARGETS) {
  const full = path.join(ARTIFACTS_ROOT, src);
  const artifact = JSON.parse(fs.readFileSync(full, "utf8"));
  const outPath = path.join(OUT_DIR, outName);
  fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
  console.log("wrote", outPath);
}
