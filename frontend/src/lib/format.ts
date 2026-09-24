import { formatUnits, parseUnits } from "viem";

export function fmtToken(raw: string | bigint, decimals = 18, fractionDigits = 2): string {
  const value = formatUnits(BigInt(raw), decimals);
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: 0 });
}

export function fmtUsd(raw: string | bigint, decimals = 18, fractionDigits = 2): string {
  return `$${fmtToken(raw, decimals, fractionDigits)}`;
}

/** Oracle prices are 8-decimal fixed point, Chainlink-style. */
export function fmtPrice8(raw: string | bigint): string {
  return fmtUsd(raw, 8, 2);
}

export function bpsToPercent(bps: string | bigint, fractionDigits = 1): string {
  const value = Number(bps) / 100;
  return `${value.toFixed(fractionDigits)}%`;
}

export function toRawUnits(amount: string, decimals = 18): bigint {
  if (!amount || Number.isNaN(Number(amount))) return 0n;
  return parseUnits(amount, decimals);
}

export function shortAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
