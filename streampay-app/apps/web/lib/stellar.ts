import {
  StreamPayClient,
  TESTNET_RPC_URL,
  TESTNET_NETWORK_PASSPHRASE,
  formatUnits,
  parseUnits,
  USDC_DECIMALS,
} from "@streampay/sdk";
import freighter from "@stellar/freighter-api";

export const DEFAULT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || "CCMKR6Z7WICENMZFAXR6VVWCM2TLHSKXOF5Q6ODJC4LHGMCJ5ZWKJECX";
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || TESTNET_RPC_URL;
export const DEFAULT_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || TESTNET_NETWORK_PASSPHRASE;
export const DEFAULT_USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS || "CBGRKQQHFIVR6OXKTSOFONC53FFYMTZDAHJBHWQT6PC6EXQQFZ25Y5JC";

/**
 * Returns a configured instance of StreamPayClient.
 */
export function getStreamPayClient(): StreamPayClient {
  return new StreamPayClient({
    contractId: DEFAULT_CONTRACT_ID,
    rpcUrl: DEFAULT_RPC_URL,
    networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
  });
}

/**
 * Checks if Freighter wallet extension is detected.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await freighter.isConnected();
    return Boolean(res && res.isConnected);
  } catch {
    return false;
  }
}

/**
 * Requests access from Freighter wallet and returns public key and network.
 */
export async function connectFreighterWallet(): Promise<{ address: string; network?: string }> {
  if (typeof window === "undefined") {
    throw new Error("Window is undefined.");
  }

  const access = await freighter.requestAccess();
  if (access.error) {
    throw new Error(access.error);
  }
  if (!access.address) {
    throw new Error("No public key returned from Freighter wallet.");
  }

  let network = "TESTNET";
  try {
    const netDetails = await freighter.getNetworkDetails();
    if (netDetails && netDetails.network) {
      network = netDetails.network;
    }
  } catch {
    // ignore
  }

  return {
    address: access.address,
    network,
  };
}

/**
 * Signs transaction XDR via Freighter wallet.
 */
export async function signTransactionWithFreighter(
  xdr: string,
  networkPassphrase = DEFAULT_NETWORK_PASSPHRASE
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Cannot sign transaction outside browser.");
  }

  const res = await freighter.signTransaction(xdr, {
    networkPassphrase,
  });

  if (res.error) {
    throw new Error(res.error);
  }
  if (!res.signedTxXdr) {
    throw new Error("Freighter failed to return signed transaction XDR.");
  }

  return res.signedTxXdr;
}

const LOCAL_STORAGE_KEY = "streampay_my_streams";

/**
 * Returns list of stream IDs stored in browser localStorage.
 */
export function getStoredStreamIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Adds a stream ID to localStorage.
 */
export function addStoredStreamId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredStreamIds();
    if (!existing.includes(id)) {
      const updated = [id, ...existing];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

/**
 * Removes a stream ID from localStorage.
 */
export function removeStoredStreamId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredStreamIds();
    const updated = existing.filter((item) => item !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export { formatUnits, parseUnits, USDC_DECIMALS };
