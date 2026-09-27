# Payroll Master

> Built with Arc Studio — money-powered onchain apps

Multi-tenant payroll console with app-layer privacy. Workers get paid in USDC; salaries are hidden from the public explorer.

---

## What This App Does

Any org funds a vault, a maker prepares a run, a checker approves it, and the owner clicks Execute. Workers get paid in USDC on Arc Testnet. Amounts are AES-GCM encrypted client-side; only the employer and the individual employee can read a given salary.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, ConnectKit + wagmi v2
- Contracts: Solidity 0.8.28 + Foundry (Arc Testnet, Paris EVM)
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC at 0x3600000000000000000000000000000000000000 (6 decimals)
- Privacy: app-layer AES-GCM per-line encryption; only merkle root stored on-chain

## Deployed Contracts (Arc Testnet) — 2026-09-27 (FINAL — fully wired)

| Contract | Address | Explorer |
|---|---|---|
| OrgFactory | 0x3b47fd28ebfd8f7158b79248144081bc3a075e89 | https://explorer.testnet.arc.io/address/0x3b47fd28ebfd8f7158b79248144081bc3a075e89 |
| RunRegistry | 0x31882d1c006b191dd246f250f3d1ff193d0274fb | https://explorer.testnet.arc.io/address/0x31882d1c006b191dd246f250f3d1ff193d0274fb |
| PaystubStore | 0xe1fcdf0d54bb1f081511a94d55ad8ec5479035d8 | https://explorer.testnet.arc.io/address/0xe1fcdf0d54bb1f081511a94d55ad8ec5479035d8 |
| StealthDistributor | 0xbb35d65b55fd1a2b3a5650a074e724a5071c5fb6 | https://explorer.testnet.arc.io/address/0xbb35d65b55fd1a2b3a5650a074e724a5071c5fb6 |

WIRING STATUS (2026-09-27 — fully matched):
- OrgFactory.registry() = 0x31882d1c (RunRegistry) ✓
- RunRegistry.orgFactory() = 0x3b47fd28 (OrgFactory) ✓
- PaystubStore.registry() = 0x31882d1c (RunRegistry) ✓
- StealthDistributor.registry() = 0x31882d1c (RunRegistry) ✓
- createRun: fully operational — no more OrgNotFound revert

## Key Files

- `src/App.tsx` — routing shell
- `src/screens/` — Home, Roster, NewRun, Approve, EmployeePortal
- `src/hooks/usePayroll.ts` — all business logic
- `src/settlement/arc.ts` — ArcSettlement adapter (wraps all chain calls)
- `src/settlement/types.ts` — Settlement interface (chain-agnostic)
- `src/lib/crypto.ts` — AES-GCM amount encryption/decryption
- `src/lib/merkle.ts` — roster merkle root builder
- `src/lib/store.ts` — localStorage persistence
- `contracts/OrgFactory.sol` — org registry + vault deployer
- `contracts/Vault.sol` — per-org USDC vault
- `contracts/RunRegistry.sol` — run lifecycle (create/approve/execute/claim)
- `contracts/PaystubStore.sol` — ciphered paystub storage
- `contracts/StealthDistributor.sol` — privacy event emitter

## Rialo Migration Path

`packages/settlement-rialo` (stub) replaces `src/settlement/arc.ts`. The UI never imports chain types directly — only `Settlement` from `src/settlement/types.ts`. The keeper worker (`workers/keeper`) is deleted on Rialo.
