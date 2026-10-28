## Description

<!-- Provide a brief description of the changes introduced by this pull request. Link any related issues using fixes #issue_number. -->

Fixes #

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🧪 Test addition or improvement
- [ ] 🧹 Refactoring / Code hygiene

## Component Affected

- [ ] `streampay-contract` (Soroban Rust smart contract)
- [ ] `@streampay/sdk` (TypeScript SDK)
- [ ] `apps/web` (Next.js frontend application)
- [ ] CI / Deployment / Documentation

## Checklist

- [ ] My code adheres to the style guidelines and architectural rules of this project.
- [ ] I have performed a self-review of my own code.
- [ ] I have commented my code, particularly in hard-to-understand areas.
- [ ] No `any` types were used; strict TypeScript passes without errors.
- [ ] For smart contract changes:
  - [ ] No `unwrap()` or `expect()` in non-test contract code.
  - [ ] Checked `i128` arithmetic used (no floating point).
  - [ ] `cargo test` passes 100% of integration & unit tests.
- [ ] For SDK / Frontend changes:
  - [ ] `pnpm --filter @streampay/sdk build` and `pnpm --filter @streampay/sdk test` pass.
  - [ ] `pnpm --filter streampay-web build` passes with zero errors.
- [ ] Conventional commit message standard followed (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- [ ] I have updated relevant documentation / README where applicable.
