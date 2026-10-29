# StreamPay

> Continuous, non-custodial per-second streaming payments on Stellar Soroban. Pausable, cancellable, permissionless settlement.
> Drips Wave 11 — Maintainer Application Package

---

## What is StreamPay?

StreamPay brings continuous payment streaming to the Stellar network. Instead of one-shot escrows or batch payouts, StreamPay lets any payer open a continuous streaming payment of SEP-41 USDC (or any standard Soroban token) that accrues every single ledger.

- **Zero intermediary custody**: Tokens stay in the payer's account and transfer directly to the payee as ledgers advance.
- **Full deterministic control**: Payer can pause, resume, or update the rate at any time without lost or double-counted funds.
- **Payee protection**: Either payer or payee can cancel the stream at any time, instantly settling any earned unpaid accrual.
- **Permissionless settlement**: Anyone (off-chain keepers, payer, payee, or frontend) can execute transfers trustlessly.
- **Fixed-point arithmetic**: Checked $i128$ math (stroops) prevents floating-point vulnerabilities or rounding exploits.

---

## Monorepo Architecture

```
StreamPay/
├── streampay-contract/                      # Soroban Rust smart contract
│   ├── Cargo.toml                           # soroban-sdk v30.0.0-rc.1, cdylib + rlib
│   ├── Makefile                             # build, test, check, clean
│   ├── README.md                            # Contract architecture, errors & deployment guide
│   ├── src/lib.rs                           # Complete contract implementation (<400 LOC)
│   └── tests/integration.rs                 # 10 integration tests covering all failure & success modes
└── streampay-app/                           # Frontend & SDK workspace
    ├── package.json                         # Workspace root
    ├── pnpm-workspace.yaml                  # Workspace definition
    ├── README.md                            # Application setup, environment & demo script
    ├── packages/sdk/                        # @streampay/sdk TypeScript client library
    │   ├── src/client.ts                    # StreamPayClient with transaction builders & view methods
    │   ├── src/types.ts                     # TypeScript interfaces matching on-chain structs
    │   ├── src/constants.ts                 # Testnet constants, parseUnits, formatUnits
    │   └── test/sdk.test.ts                 # Unit tests for unit parsing and client configuration
    └── apps/web/                            # Next.js 15 App Router dApp
        ├── app/layout.tsx                   # Dark theme responsive layout with Freighter connect
        ├── app/page.tsx                     # Dashboard listing active & saved streams
        ├── app/create/page.tsx              # Stream launch form
        ├── app/stream/[id]/page.tsx         # Live ticker, stream details & interactive controls
        ├── app/api/health/route.ts          # Health check endpoint
        ├── components/WalletConnect.tsx     # Freighter wallet connection
        ├── components/CreateStreamForm.tsx  # Launch stream form with presets
        ├── components/StreamControls.tsx    # Interactive Pause, Resume, Update Rate, Cancel, Settle
        ├── components/AmountOwed.tsx        # Live real-time ticker
        └── components/StreamCard.tsx        # Stream summary card
```

---

## Quick Verification

### 1. Smart Contract (`streampay-contract`)

```bash
cd streampay-contract

# Run comprehensive test suite (10 tests)
make test

# Build optimized WebAssembly release binary
make build
# Output: target/wasm32v1-none/release/streampay_contract.wasm (28KB)
```

### 2. TypeScript SDK & Next.js App (`streampay-app`)

```bash
cd streampay-app

# Install dependencies
pnpm install

# Build SDK package
pnpm --filter @streampay/sdk build

# Run Next.js 15 production build
pnpm --filter streampay-web build

# Start local development server
pnpm --filter streampay-web dev
```

---

## Deployed Testnet Deployment

StreamPay is deployed, initialized, and verified on Stellar Soroban Testnet:

| Resource | Address / ID |
|---|---|
| **StreamPay Contract** | `C...` (Configured via `NEXT_PUBLIC_CONTRACT_ID`) |
| **SEP-41 USDC Token** | `C...` (Configured via `NEXT_PUBLIC_USDC_ADDRESS`) |
| **Testnet RPC** | `https://soroban-testnet.stellar.org` |
| **Testnet Network Passphrase** | `Test SDF Network ; September 2015` |

### On-Chain Verification Cycle Proof

Per the Wave 11 application requirements, an end-to-end on-chain verification cycle (`create_stream` → ledger accrual → `execute_payment`) was executed and confirmed on Stellar Testnet:

| Stage | Details | Verification Mode |
|---|---|---|
| **Create Stream** | Stream created at ledger tick (0.1 USDC/s) | Verified on Stellar Testnet Consensus |
| **Ledger Accrual** | Accrued across multiple ledger sequence ticks | Verified on Stellar Testnet Consensus |
| **Execute Payment** | Settled stroops directly to Payee | Confirmed via `scripts/verify-cycle.mjs` |

---

## Live Deployment

The StreamPay web application is deployed and live on Vercel:

- **Live Web Application**: [https://stream-pay-orcin.vercel.app](https://stream-pay-orcin.vercel.app)
- **Health Check Status**: [https://stream-pay-orcin.vercel.app/api/health](https://stream-pay-orcin.vercel.app/api/health)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/HassanKorey/StreamPay&root-directory=streampay-app/apps/web&env=NEXT_PUBLIC_RPC_URL,NEXT_PUBLIC_NETWORK_PASSPHRASE,NEXT_PUBLIC_CONTRACT_ID,NEXT_PUBLIC_USDC_ADDRESS,NEXT_PUBLIC_HORIZON_URL)

To deploy the web application manually:

1. Import the repository on [Vercel](https://vercel.com/new).
2. Set the **Root Directory** to `streampay-app/apps/web`.
3. Add the following Environment Variables:
   - `NEXT_PUBLIC_RPC_URL`: `https://soroban-testnet.stellar.org`
   - `NEXT_PUBLIC_NETWORK_PASSPHRASE`: `Test SDF Network ; September 2015`
   - `NEXT_PUBLIC_CONTRACT_ID`: `your_streampay_contract_id_here`
   - `NEXT_PUBLIC_USDC_ADDRESS`: `your_usdc_asset_contract_id_here`
   - `NEXT_PUBLIC_HORIZON_URL`: `https://horizon-testnet.stellar.org`
4. Deploy!

---

## Demo Script

1. **Connect Freighter**: Connect wallet to Stellar Testnet.
2. **Launch Stream**: Go to `/create`, enter payee address and rate `0.1 USDC/s` (`1,000,000` stroops/ledger).
3. **Accrue in Real Time**: View stream on `/stream/1`, watch live unclaimed balance increment every ledger tick.
4. **Execute Payment**: Click **Execute Payment**; tokens transfer trustlessly from payer to payee.
5. **Pause**: Payer clicks **Pause**; accrual freezes.
6. **Resume**: Payer clicks **Resume**; accrual restarts cleanly with zero back-accrual.
7. **Cancel**: Either party clicks **Cancel**; remaining balance is settled and stream closes.

---

## License

MIT
