# StreamPay Smart Contract

> Non-custodial per-second streaming payments on Stellar Soroban.

StreamPay enables continuous value transfers of SEP-41 assets (e.g., USDC) with deterministic, ledger-based accrual. Either party can pause, resume, update the payment rate, or cancel. Settlement is permissionless: anyone (frontend, keeper bots, payer, or payee) can trigger transfers trustlessly.

---

## Architecture & Features

- **Standard Interface**: Built with Soroban SDK (`v29.0.1`, Protocol 29 Testnet compatible) targeting `wasm32v1-none`.
- **Single Responsibility**: No external contract dependencies except the SEP-41 Token interface (`soroban_sdk::token::TokenClient`).
- **Deterministic Ledger Math**: Accrual is calculated per ledger tick:
  $$\text{amount\_owed} = \text{rate\_per\_second} \times (\text{current\_ledger} - \text{last\_paid\_ledger})$$
- **State Controls**:
  - `initialize`: One-time setup with admin address and SEP-41 token address.
  - `create_stream`: Opens a stream (`payer.require_auth()`).
  - `pause`: Payer pauses stream, settling accrued funds up to the pause ledger.
  - `resume`: Payer resumes stream, setting `last_paid_ledger` to current to prevent back-accrual.
  - `update_rate`: Payer updates rate, settling funds accrued at the old rate.
  - `cancel` / `cancel_by`: Either payer or payee can cancel the stream. Settles remaining owed funds and marks stream cancelled.
  - `execute_payment`: Permissionless call transferring accrued tokens from payer to payee.
  - `amount_owed`: Pure view returning amount owed (returns 0 if paused or cancelled).
  - `get_stream`: View returning complete stream metadata.
- **Checked Arithmetic**: Strict `i128` operations with `ContractError::Overflow` protection. No floating point.
- **TTL Extension**: Persistent storage entries and instance storage are automatically extended with `extend_ttl` (`PERSISTENT_BUMP_THRESHOLD` = 120,960 ledgers, `PERSISTENT_EXTEND_TO` = 518,400 ledgers).
- **Strict Events**: Every state change emits a typed contract event (`StreamCreated`, `StreamPaused`, `StreamResumed`, `RateUpdated`, `StreamCancelled`, `PaymentExecuted`).

---

## Contract Errors

| Code | Error | Description |
|---|---|---|
| 1 | `AlreadyInitialized` | Contract has already been initialized |
| 2 | `NotInitialized` | Contract has not been initialized yet |
| 3 | `Unauthorized` | Caller lacks authorization for the action |
| 4 | `StreamNotFound` | Specified stream ID does not exist |
| 5 | `StreamAlreadyPaused` | Attempted to pause an already paused stream |
| 6 | `StreamNotPaused` | Attempted to resume an active (unpaused) stream |
| 7 | `StreamCancelled` | Mutating action attempted on a cancelled stream |
| 8 | `InvalidRate` | Rate per second must be greater than 0 |
| 9 | `Overflow` | Mathematical overflow in rate calculation or balances |
| 10 | `InsufficientBalance` | Token transfer failed (payer balance or allowance) |
| 11 | `InvalidToken` | Token contract address is invalid |

---

## Building & Testing

### Prerequisites

- Rust 1.84+ (Rust 1.97.1 recommended) with target `wasm32v1-none` installed:
  ```bash
  rustup target add wasm32v1-none
  ```
- Stellar CLI (`stellar`)

### Build Commands

```bash
# Run unit and integration test suite
make test
# Or: cargo test

# Build optimized WebAssembly contract
make build
# Output: target/wasm32v1-none/release/streampay_contract.wasm

# Check contract syntax and types
make check
```

---

## Deployed Testnet Contract

| Property | Value |
|---|---|
| **Network** | Stellar Testnet (Protocol 29) |
| **RPC Endpoint** | `https://soroban-testnet.stellar.org` |
| **StreamPay Contract ID** | `CC2WFGXP3CFFFVCRODZB2BXHRXZIMUA3PTVAK3SMQC7LPKTDAFQU4GFA` |
| **SEP-41 USDC Contract ID** | `CCQGOTGN6HTQE74XYERYSYVU57T5NPYWV5DLCROMB56OXTV6RSO6KIGK` |
| **Admin Address** | `GAHYU5YGHEOI3MKA2MLW2O46YY74SHBLC4JTVGWN36LH7LL7FFF4O6SS` |
| **Stellar Expert Explorer** | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CC2WFGXP3CFFFVCRODZB2BXHRXZIMUA3PTVAK3SMQC7LPKTDAFQU4GFA) |

---

## Deployment & Initialization Instructions (Testnet)

### 1. Configure Identity & Network

```bash
# Add Testnet network config
stellar network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Generate or import deployer identity
stellar keys generate --global admin --network testnet
stellar keys fund admin --network testnet
```

### 2. Deploy Contract Wasm

```bash
# Deploy WASM bytecode to Testnet
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/streampay_contract.wasm \
  --source admin \
  --network testnet)

echo "Deployed StreamPay Contract ID: $CONTRACT_ID"
```

### 3. Initialize Contract

```bash
# Initialize with Admin address and SEP-41 USDC (or Testnet token)
ADMIN_ADDRESS=$(stellar keys address admin)
USDC_ADDRESS="CBIELTK6YBZJU5UP2WWQEUCYJLPU6QXN54EX62HRS2T77AZ54K3K64TG" # Example Testnet asset

stellar contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $ADMIN_ADDRESS \
  --token $USDC_ADDRESS
```
