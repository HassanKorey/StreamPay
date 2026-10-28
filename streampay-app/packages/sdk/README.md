# @streampay/sdk

TypeScript SDK for StreamPay — continuous non-custodial streaming payments on Stellar Soroban.

## Installation

```bash
npm install @streampay/sdk @stellar/stellar-sdk
# or
pnpm add @streampay/sdk @stellar/stellar-sdk
```

## Quick Start

```typescript
import { StreamPayClient, parseUnits, formatUnits } from "@streampay/sdk";

const client = new StreamPayClient({
  contractId: "C...",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

// Query amount owed
const streamId = 1n;
const owed = await client.amountOwed(streamId);
console.log(`Amount owed: ${formatUnits(owed)} USDC`);

// Fetch stream status
const stream = await client.getStream(streamId);
console.log(`Payer: ${stream.payer}, Rate: ${formatUnits(stream.ratePerSecond)} USDC/sec`);

// Build transaction XDR for wallet signing
const createXdr = await client.createStream({
  payer: "G...",
  payee: "G...",
  ratePerSecond: parseUnits("0.1"), // 0.1 USDC/ledger
});
```
