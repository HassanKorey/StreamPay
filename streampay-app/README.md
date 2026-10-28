# StreamPay Monorepo (App & SDK)

> Next.js 15 + Stellar SDK Frontend & TypeScript SDK for StreamPay streaming payments on Stellar Soroban.

StreamPay enables non-custodial per-second streaming transfers of SEP-41 USDC on Stellar. Either party can pause, resume, update the rate, or cancel. Settlement is permissionless: anyone can trigger transfers trustlessly.

---

## Monorepo Architecture

```
streampay-app/
├── packages/
│   └── sdk/          # @streampay/sdk - Pure TypeScript SDK for StreamPay
└── apps/
    └── web/          # Next.js 15 App Router dApp with Freighter integration
```

---

## Environment Variables

Configure these in `apps/web/.env.local` or in deployment settings (e.g. Vercel):

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase | `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed StreamPay contract ID | `C...` |
| `NEXT_PUBLIC_USDC_ADDRESS` | SEP-41 USDC token address | `C...` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon endpoint | `https://horizon-testnet.stellar.org` |

---

## How to Run Locally

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build the SDK

```bash
pnpm --filter @streampay/sdk build
```

### 3. Start the Development Server

```bash
pnpm --filter streampay-web dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser with the Freighter wallet extension installed and connected to Stellar Testnet.

### 4. Build for Production

```bash
pnpm --filter streampay-web build
```

---

## How to Point to a Different Contract ID

To point the frontend to a freshly deployed StreamPay contract:
1. Update `NEXT_PUBLIC_CONTRACT_ID` in `apps/web/.env.local` or environment variables:
   ```bash
   NEXT_PUBLIC_CONTRACT_ID=C<YOUR_NEW_CONTRACT_ID>
   ```
2. Re-run `pnpm --filter streampay-web build` (or restart `dev`).

---

## Demo Script (Grant Review Walkthrough)

1. **Connect Wallet**: Open the app, click **Connect Freighter** (switch network to Testnet).
2. **Create Stream**:
   - Navigate to **Create Stream** (`/create`).
   - Enter recipient test address (`G...`).
   - Set rate to `0.1` USDC/s (`1,000,000` base units/ledger).
   - Click **Launch Stream** and sign with Freighter.
3. **Wait & Accrue**:
   - Redirects to `/stream/[id]`.
   - Observe the live ticker increasing in real time every ledger (~5 seconds).
4. **Execute Payment**:
   - Click **Execute Payment**.
   - Tokens transfer trustlessly from payer to payee.
5. **Pause Stream**:
   - Click **Pause Stream** from the payer account.
   - Accrual freezes immediately.
6. **Resume Stream**:
   - Click **Resume Stream**; accrual restarts with zero back-accrual.
7. **Cancel Stream**:
   - Click **Cancel Stream** (can be triggered by payer or payee).
   - Accrued balance is settled and stream status becomes **Cancelled**.

---

## Links

- **Smart Contract**: See [`streampay-contract`](../streampay-contract/README.md) for Soroban Rust contract code, tests, and build instructions.
