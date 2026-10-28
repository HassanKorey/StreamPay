import { NextResponse } from "next/server";
import { DEFAULT_CONTRACT_ID, DEFAULT_RPC_URL, DEFAULT_NETWORK_PASSPHRASE } from "../../../lib/stellar";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    contractId: DEFAULT_CONTRACT_ID,
    rpcUrl: DEFAULT_RPC_URL,
    networkPassphrase: DEFAULT_NETWORK_PASSPHRASE,
  });
}
