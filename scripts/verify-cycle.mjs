import fs from "fs";
import path from "path";
import dns from "dns";
import { fileURLToPath } from "url";

dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const sdkPath = path.resolve(
  __dirname,
  "../streampay-app/apps/web/node_modules/@stellar/stellar-sdk/lib/index.js"
);
const {
  Keypair,
  rpc,
  TransactionBuilder,
  Operation,
  Address,
  Asset,
  nativeToScVal,
  scValToNative,
  Contract,
  TimeoutInfinite,
  authorizeInvocation,
  xdr,
  SorobanDataBuilder,
} = await import(sdkPath);

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS;
const ADMIN_SECRET = process.env.STELLAR_ADMIN_SECRET;

if (!ADMIN_SECRET || !CONTRACT_ID || !USDC_ADDRESS) {
  console.error("Error: Missing STELLAR_ADMIN_SECRET, NEXT_PUBLIC_CONTRACT_ID, or NEXT_PUBLIC_USDC_ADDRESS in .env.local");
  process.exit(1);
}

const server = new rpc.Server(RPC_URL);
const admin = Keypair.fromSecret(ADMIN_SECRET);
const streamContract = new Contract(CONTRACT_ID);

console.log("=================================================================");
console.log("       STREAMPAY ON-CHAIN VERIFICATION CYCLE (STELLAR TESTNET)    ");
console.log("=================================================================");
console.log(`Contract ID : ${CONTRACT_ID}`);
console.log(`USDC Token  : ${USDC_ADDRESS}`);
console.log(`Admin/Issuer: ${admin.publicKey()}\n`);

async function sendTx(tx, signer) {
  tx.sign(signer);
  const sendRes = await server.sendTransaction(tx);
  if (sendRes.status === "ERROR") {
    throw new Error(`sendTransaction failed: ${JSON.stringify(sendRes.errorResult)}`);
  }
  console.log(`  Tx submitted: ${sendRes.hash}`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const txRes = await server.getTransaction(sendRes.hash);
    if (txRes.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log(`  Tx confirmed in ledger ${txRes.ledger}`);
      return { txRes, hash: sendRes.hash };
    }
    if (txRes.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Tx failed on-chain: ${txRes.resultXdr?.toXDR("base64")}`);
    }
  }
  throw new Error("Transaction confirmation timed out.");
}

async function fundWithFriendbot(pubKey) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${pubKey}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${pubKey}: ${res.statusText}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}

async function main() {
  // Step 1: Create Payer & Payee keypairs
  console.log("--- Step 1: Setting up Payer & Payee Testnet Accounts ---");
  const payer = Keypair.random();
  const payee = Keypair.random();
  console.log(`  Payer Public Key: ${payer.publicKey()}`);
  console.log(`  Payee Public Key: ${payee.publicKey()}`);

  console.log("  Funding Payer & Payee via Friendbot...");
  await fundWithFriendbot(payer.publicKey());
  await fundWithFriendbot(payee.publicKey());
  console.log("  ✅ Both accounts initialized on Stellar Testnet.");

  // Step 2: Establish USDC Trustline & Mint USDC to Payer
  console.log("\n--- Step 2: Minting 500 SEP-41 USDC to Payer ---");
  const usdcAsset = new Asset("USDC", admin.publicKey());

  // Payer and Payee add trustline for USDC
  let payerAccount = await server.getAccount(payer.publicKey());
  let trustTx = new TransactionBuilder(payerAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: usdcAsset, limit: "1000000" }))
    .setTimeout(TimeoutInfinite)
    .build();
  await sendTx(trustTx, payer);
  console.log("  ✅ Payer established trustline to USDC asset.");

  let payeeAccount = await server.getAccount(payee.publicKey());
  let payeeTrustTx = new TransactionBuilder(payeeAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: usdcAsset, limit: "1000000" }))
    .setTimeout(TimeoutInfinite)
    .build();
  await sendTx(payeeTrustTx, payee);
  console.log("  ✅ Payee established trustline to USDC asset.");

  // Admin transfers 500 USDC to Payer
  let adminAccount = await server.getAccount(admin.publicKey());
  let payTx = new TransactionBuilder(adminAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      Operation.payment({
        destination: payer.publicKey(),
        asset: usdcAsset,
        amount: "500",
      })
    )
    .setTimeout(TimeoutInfinite)
    .build();
  await sendTx(payTx, admin);
  console.log("  ✅ Minted & transferred 500 USDC to Payer.");

  // Payer approves StreamPay contract to stream USDC
  const tokenContract = new Contract(USDC_ADDRESS);
  payerAccount = await server.getAccount(payer.publicKey());
  const latestLedger = (await server.getLatestLedger()).sequence;
  let approveTx = new TransactionBuilder(payerAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      tokenContract.call(
        "approve",
        new Address(payer.publicKey()).toScVal(),
        new Address(CONTRACT_ID).toScVal(),
        nativeToScVal(100_000_000_000n, { type: "i128" }),
        nativeToScVal(latestLedger + 100_000, { type: "u32" })
      )
    )
    .setTimeout(TimeoutInfinite)
    .build();
  approveTx = await server.prepareTransaction(approveTx);
  await sendTx(approveTx, payer);
  console.log("  ✅ Payer approved StreamPay contract allowance for streaming.");

  // Step 3: Payer Invokes create_stream on StreamPay Contract
  console.log("\n--- Step 3: Invoking create_stream on StreamPay Contract ---");
  const ratePerLedger = 1_000_000n; // 0.1 USDC per ledger tick (1,000,000 stroops)
  payerAccount = await server.getAccount(payer.publicKey());

  let createTx = new TransactionBuilder(payerAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      streamContract.call(
        "create_stream",
        new Address(payer.publicKey()).toScVal(),
        new Address(payee.publicKey()).toScVal(),
        nativeToScVal(ratePerLedger, { type: "i128" })
      )
    )
    .setTimeout(TimeoutInfinite)
    .build();

  createTx = await server.prepareTransaction(createTx);
  const { txRes: createRes, hash: createHash } = await sendTx(createTx, payer);
  const streamId = scValToNative(createRes.returnValue);
  console.log(`  🎉 Stream #${streamId} successfully created on-chain!`);
  console.log(`  Explorer: https://stellar.expert/explorer/testnet/tx/${createHash}`);

  // Step 4: Wait for Ledgers to Accrue
  console.log("\n--- Step 4: Waiting 20 Seconds for Stellar Ledgers to Advance ---");
  for (let s = 20; s > 0; s -= 5) {
    process.stdout.write(`  Accruing... ${s}s remaining\r`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("  ✅ Ledgers advanced. Querying amount owed...");

  // Step 5: Query amount_owed view function
  payerAccount = await server.getAccount(payer.publicKey());
  let viewTx = new TransactionBuilder(payerAccount, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      streamContract.call("amount_owed", nativeToScVal(streamId, { type: "u64" }))
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const simRes = await server.simulateTransaction(viewTx);
  const accruedAmount = scValToNative(simRes.result.retval);
  const humanAccrued = (Number(accruedAmount) / 10_000_000).toFixed(4);
  console.log(`  Accrued Amount Owed: ${accruedAmount} stroops (~${humanAccrued} USDC)`);

  // Step 6: Settlement via execute_payment (signed by payer)
  console.log("\n--- Step 6: Triggering execute_payment ---");
  payerAccount = await server.getAccount(payer.publicKey());

  let execTx = new TransactionBuilder(payerAccount, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      streamContract.call("execute_payment", nativeToScVal(streamId, { type: "u64" }))
    )
    .setTimeout(TimeoutInfinite)
    .build();

  execTx = await server.prepareTransaction(execTx);
  const { txRes: execRes, hash: execHash } = await sendTx(execTx, payer);
  const settledAmount = scValToNative(execRes.returnValue);
  const humanSettled = (Number(settledAmount) / 10_000_000).toFixed(4);
  console.log(`  ✅ Payment executed! Settled: ${settledAmount} stroops (${humanSettled} USDC)`);
  console.log(`  Explorer: https://stellar.expert/explorer/testnet/tx/${execHash}`);

  // Step 7: Final Contract Verification
  console.log("\n--- Step 7: Verifying Final Stream State ---");
  let getStreamTx = new TransactionBuilder(adminAccount, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      streamContract.call("get_stream", nativeToScVal(streamId, { type: "u64" }))
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const getSim = await server.simulateTransaction(getStreamTx);
  const finalStream = scValToNative(getSim.result.retval);
  console.log("  Stream Record from Contract Storage:");
  console.log(`    - ID               : ${finalStream.id}`);
  console.log(`    - Payer            : ${finalStream.payer}`);
  console.log(`    - Payee            : ${finalStream.payee}`);
  console.log(`    - Rate/Ledger      : ${finalStream.rate_per_second} stroops`);
  console.log(`    - Total Paid       : ${finalStream.total_paid} stroops`);
  console.log(`    - Start Ledger     : ${finalStream.start_ledger}`);
  console.log(`    - Last Paid Ledger : ${finalStream.last_paid_ledger}`);
  console.log(`    - Is Paused        : ${finalStream.paused}`);
  console.log(`    - Is Cancelled     : ${finalStream.cancelled}`);

  console.log("\n=================================================================");
  console.log("  🎉 ON-CHAIN VERIFICATION CYCLE COMPLETED SUCCESSFULLY!         ");
  console.log("=================================================================");
  console.log(`Contract Address  : https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`);
  console.log(`Create Stream Tx  : https://stellar.expert/explorer/testnet/tx/${createHash}`);
  console.log(`Execute Payment Tx: https://stellar.expert/explorer/testnet/tx/${execHash}`);
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ Verification Cycle Failed:", err);
  process.exit(1);
});
