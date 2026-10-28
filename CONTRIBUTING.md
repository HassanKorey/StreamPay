# Contributing to StreamPay

Thank you for your interest in contributing to **StreamPay**! We welcome contributions from developers of all skill levels, from fixing typos in documentation to implementing complex Soroban contract features.

---

## Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all members of the community with respect and courtesy.

---

## Architecture Overview

StreamPay is organized as a monorepo consisting of:

1. **`streampay-contract/`**: Soroban smart contract written in Rust (`soroban-sdk = "29.0.1"`). Handles stream creation, pause/resume, rate adjustments, mutual cancellation, and permissionless payment execution.
2. **`streampay-app/packages/sdk/`**: `@streampay/sdk` pure TypeScript client library wrapping Soroban RPC transaction builders, contract invocations, and read-only views.
3. **`streampay-app/apps/web/`**: Next.js 15 App Router dApp with Freighter wallet integration, live accrual ticker, and interactive stream controls.

---

## Development Prerequisites

- **Rust**: 1.84+ (Rust 1.97.1 recommended)
  ```bash
  rustup target add wasm32v1-none
  ```
- **Node.js**: v22.0.0 or higher
- **pnpm**: v9 or v10
  ```bash
  corepack enable && corepack prepare pnpm@latest --activate
  ```
- **Stellar CLI**: (Optional, for manual deployment and identity management)
  ```bash
  cargo install --locked stellar-cli
  ```

---

## Getting Started

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/StreamPay.git
   cd StreamPay
   ```

2. **Set up workspace dependencies**:
   ```bash
   cd streampay-app
   pnpm install
   ```

3. **Verify Contract Tests**:
   ```bash
   cd ../streampay-contract
   make test
   # Or: cargo test
   ```

4. **Verify SDK Build & Tests**:
   ```bash
   cd ../streampay-app/packages/sdk
   pnpm build
   pnpm test
   ```

5. **Start Web dApp**:
   ```bash
   cd ../apps/web
   pnpm dev
   ```
   Open `http://localhost:3000` in your browser with Freighter wallet installed and set to Stellar Testnet.

---

## Issue Labels Guide

We use standardized labels to triage and categorize issues:

| Label | Color | Description |
|---|---|---|
| `good first issue` | `#7057ff` | Beginner-friendly tasks with self-contained scope; perfect for newcomers. |
| `help wanted` | `#008672` | Tasks where maintainers actively seek community contributions. |
| `enhancement` | `#a2eeef` | New features, enhancements, or proposals. |
| `bug` | `#d73a4a` | Something isn't working as expected. |
| `contract` | `#e99695` | Related to the Soroban Rust smart contract (`streampay-contract`). |
| `sdk` | `#bfd4f2` | Related to the `@streampay/sdk` TypeScript package. |
| `frontend` | `#1d76db` | Related to the Next.js web application and UI components. |
| `testing` | `#d4c5f9` | Unit, integration, fuzzing, or end-to-end testing. |
| `documentation` | `#0075ca` | Improvements to guides, READMEs, or code comments. |

---

## Development Standards & Hard Constraints

To maintain top code quality and security, all contributions must adhere to the following:

- **Strict TypeScript**: Never use `any`. Always supply full typing for parameters and returns.
- **Checked Arithmetic**: In smart contracts, all rate and balance math must use checked `i128` operations returning `ContractError::Overflow` on error. Floating-point arithmetic is forbidden.
- **No Unwraps**: In non-test smart contract code, never call `.unwrap()` or `.expect()`. Return explicit `Result<T, ContractError>`.
- **Atomic Commits**: Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
  - `feat: add token selector dropdown`
  - `fix: prevent divide by zero on zero duration`
  - `test: add integration test for payee cancel`
  - `docs: update testnet contract IDs in README`
  - `chore: bump dependencies`
- **Clean Git Staging**: Never use `git add .`. Stage specific changed files intentionally.

---

## Submitting a Pull Request

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Commit your changes following conventional commit syntax.
3. Verify that all tests and builds pass cleanly:
   ```bash
   # Contract
   cd streampay-contract && cargo test
   
   # SDK & Web App
   cd ../streampay-app
   pnpm --filter @streampay/sdk test
   pnpm --filter streampay-web build
   ```
4. Push your branch and open a Pull Request using our [PR Template](.github/PULL_REQUEST_TEMPLATE.md).
5. Address any feedback from reviewers promptly.
