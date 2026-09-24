import type { Abi } from "viem";

import engineAbiJson from "../abi/UnifiedLiquidationEngine.json";
import insurancePoolAbiJson from "../abi/InsurancePool.json";
import lendingPoolAbiJson from "../abi/LendingPool.json";
import erc20AbiJson from "../abi/MockERC20.json";
import oracleAbiJson from "../abi/MockOracle.json";

export const abis = {
  erc20: erc20AbiJson as Abi,
  oracle: oracleAbiJson as Abi,
  lendingPool: lendingPoolAbiJson as Abi,
  insurancePool: insurancePoolAbiJson as Abi,
  engine: engineAbiJson as Abi,
};

export const RISK_TIERS = [
  { id: 0, label: "5% gap", description: "Tightest trigger, highest premium" },
  { id: 1, label: "10% gap", description: "Balanced trigger and premium" },
  { id: 2, label: "20% gap", description: "Tail-only trigger, lowest premium" },
] as const;

export const OPEN_RATIO_BPS = 15000n; // 150%, uninsured
export const OPEN_RATIO_INSURED_BPS = 13000n; // 130%, insured
