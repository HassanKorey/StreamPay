import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
} = await import(sdkPath);

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const server = new rpc.Server(RPC_URL);

// Admin secret loaded strictly from environment variable
const ADMIN_SECRET = process.env.STELLAR_ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.error("Error: STELLAR_ADMIN_SECRET environment variable is required to deploy.");
  process.exit(1);
}
const admin = Keypair.fromSecret(ADMIN_SECRET);

console.log("Admin Public Key:", admin.publicKey());

async function sendTx(tx) {
  tx.sign(admin);
  const sendRes = await server.sendTransaction(tx);
  if (sendRes.status === "ERROR") {
    throw new Error(`sendTransaction failed: ${JSON.stringify(sendRes.errorResult)}`);
  }
  console.log(`Transaction submitted with hash: ${sendRes.hash}`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const txRes = await server.getTransaction(sendRes.hash);
    if (txRes.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log(`Transaction confirmed in ledger: ${txRes.ledger}`);
      return txRes;
    }
    if (txRes.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${txRes.resultXdr?.toXDR("base64")}`);
    }
  }
  throw new Error("Transaction timed out.");
}

async function main() {
  console.log("\n--- STEP 1: Deploying SEP-41 USDC Asset Contract ---");
  const usdcAsset = new Asset("USDC", admin.publicKey());
  let assetContractId;

  try {
    let account = await server.getAccount(admin.publicKey());
    let op = Operation.createStellarAssetContract({ asset: usdcAsset });
    let tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(op)
      .setTimeout(TimeoutInfinite)
      .build();

    tx = await server.prepareTransaction(tx);
    const res = await sendTx(tx);
    assetContractId = scValToNative(res.returnValue);
    console.log(`✅ Deployed USDC Asset Contract ID: ${assetContractId}`);
  } catch (err) {
    console.log("Asset contract deploy note:", err.message);
    // If already exists or error, calculate contract id
    assetContractId = usdcAsset.contractId(NETWORK_PASSPHRASE);
    console.log(`Using calculated USDC Contract ID: ${assetContractId}`);
  }

  console.log("\n--- STEP 2: Uploading StreamPay Contract WASM ---");
  const wasmPath = path.resolve(
    __dirname,
    "../streampay-contract/target/wasm32v1-none/release/streampay_contract.wasm"
  );
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`WASM size: ${wasmBytes.length} bytes`);

  const wasmHash = crypto.createHash("sha256").update(wasmBytes).digest();
  console.log(`WASM Hash: ${wasmHash.toString("hex")}`);

  let uploadedWasmHash;
  try {
    let account = await server.getAccount(admin.publicKey());
    let op = Operation.uploadContractWasm({ wasm: wasmBytes });
    let tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(op)
      .setTimeout(TimeoutInfinite)
      .build();

    tx = await server.prepareTransaction(tx);
    const res = await sendTx(tx);
    uploadedWasmHash = Buffer.from(scValToNative(res.returnValue));
    console.log(`✅ WASM uploaded with hash: ${uploadedWasmHash.toString("hex")}`);
  } catch (err) {
    console.log("Upload notice:", err.message);
    uploadedWasmHash = wasmHash;
    console.log(`Using existing WASM hash: ${uploadedWasmHash.toString("hex")}`);
  }

  console.log("\n--- STEP 3: Deploying StreamPay Contract Instance ---");
  const salt = crypto.randomBytes(32);
  let account = await server.getAccount(admin.publicKey());
  let createOp = Operation.createCustomContract({
    address: new Address(admin.publicKey()),
    wasmHash: uploadedWasmHash,
    salt: salt,
  });

  let createTx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(createOp)
    .setTimeout(TimeoutInfinite)
    .build();

  createTx = await server.prepareTransaction(createTx);
  const createRes = await sendTx(createTx);
  const contractId = scValToNative(createRes.returnValue);
  console.log(`🎉 StreamPay Contract deployed at ID: ${contractId}`);

  console.log("\n--- STEP 4: Initializing StreamPay Contract ---");
  account = await server.getAccount(admin.publicKey());
  const contract = new Contract(contractId);
  const initOp = contract.call(
    "initialize",
    new Address(admin.publicKey()).toScVal(),
    new Address(assetContractId).toScVal()
  );

  let initTx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(initOp)
    .setTimeout(TimeoutInfinite)
    .build();

  initTx = await server.prepareTransaction(initTx);
  await sendTx(initTx);
  console.log(`✅ StreamPay Contract initialized with Admin and Token!`);

  console.log("\n--- STEP 5: Updating Environment Variables & Configs ---");
  const envContent = `NEXT_PUBLIC_RPC_URL=${RPC_URL}
NEXT_PUBLIC_NETWORK_PASSPHRASE=${NETWORK_PASSPHRASE}
NEXT_PUBLIC_CONTRACT_ID=${contractId}
NEXT_PUBLIC_USDC_ADDRESS=${assetContractId}
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
`;

  fs.writeFileSync(
    path.resolve(__dirname, "../streampay-app/apps/web/.env.local"),
    envContent
  );
  console.log("✅ Written .env.local with deployed contract addresses.");

  console.log("\n==========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("StreamPay Contract ID:", contractId);
  console.log("USDC Token Address:", assetContractId);
  console.log("Admin Address:", admin.publicKey());
  console.log("==========================================\n");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
