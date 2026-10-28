export const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
export const TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";

/**
 * Standard Stellar USDC has 7 decimal places (1 USDC = 10,000,000 base units / stroops).
 */
export const USDC_DECIMALS = 7;
export const STROOPS_PER_USDC = 10_000_000n;

/**
 * Convert human-readable token amount string to integer base units (bigint).
 */
export function parseUnits(value: string, decimals = USDC_DECIMALS): bigint {
  const [integerPart, fractionalPart = ""] = value.trim().split(".");
  const paddedFraction = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const combined = `${integerPart}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(combined);
}

/**
 * Convert base units (bigint) to human-readable string with fractional part.
 */
export function formatUnits(value: bigint, decimals = USDC_DECIMALS): string {
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;
  const str = abs.toString().padStart(decimals + 1, "0");
  const integerPart = str.slice(0, str.length - decimals);
  const fractionalPart = str.slice(str.length - decimals).replace(/0+$/, "");
  const formatted = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  return isNegative ? `-${formatted}` : formatted;
}
