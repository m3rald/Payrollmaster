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

## Deployed Contracts (Arc Testnet) — 2026-09-26 (latest)

| Contract | Address | Explorer |
|---|---|---|
| OrgFactory | 0x2fb1aa6bd50138989171f3de85c0539fdc035bd2 | https://explorer.testnet.arc.io/address/0x2fb1aa6bd50138989171f3de85c0539fdc035bd2 |
| RunRegistry | 0x39035c0050de4c13e019218473dcdb5516c9b506 | https://explorer.testnet.arc.io/address/0x39035c0050de4c13e019218473dcdb5516c9b506 |
| PaystubStore | 0x9d66ba788763175ce279bdb42a663d05a1a2d2fb | https://explorer.testnet.arc.io/address/0x9d66ba788763175ce279bdb42a663d05a1a2d2fb |
| StealthDistributor | 0x5f89105d439900b406ebcfd4c74cf596b874a0ce | https://explorer.testnet.arc.io/address/0x5f89105d439900b406ebcfd4c74cf596b874a0ce |

WIRING STATUS (2026-09-26 after 10 deploys):
- OrgFactory.registry() = 0x39035c00 (RunRegistry) ✓ — Vault bakes correct registry
- RunRegistry.orgFactory() = 0x494b3966 (prev OrgFactory) ✗ — createRun still broken
- PaystubStore.registry() = 0x9d66ba78 ✓
- StealthDistributor ✓
TOMORROW: Deploy OrgFactory(usdc_only) → get address → Deploy RunRegistry(OrgFactory) → call OrgFactory.setRegistry(RunRegistry)
OrgFactory now has setRegistry(address) one-time setter — circular dep permanently broken.

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
