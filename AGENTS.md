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

## Deployed Contracts (Arc Testnet)

| Contract | Address | Explorer |
|---|---|---|
| OrgFactory | 0x588aff9e646c88f4ad26f4fd961b8f15157a2bc7 | https://explorer.testnet.arc.io/address/0x588aff9e646c88f4ad26f4fd961b8f15157a2bc7 |
| RunRegistry | 0x9ba157c1221ea791f3a4afd7653e9d221a50e331 | https://explorer.testnet.arc.io/address/0x9ba157c1221ea791f3a4afd7653e9d221a50e331 |
| PaystubStore | 0x03292b1ba7e146dec1d055bde23efe8a442a3db8 | https://explorer.testnet.arc.io/address/0x03292b1ba7e146dec1d055bde23efe8a442a3db8 |
| StealthDistributor | 0xaca90c502ff9284d6ef1d320176bc7985089fe83 | https://explorer.testnet.arc.io/address/0xaca90c502ff9284d6ef1d320176bc7985089fe83 |

NOTE: RunRegistry was deployed with orgFactory=0x0. Call `setOrgFactory(0x588aff9e646c88f4ad26f4fd961b8f15157a2bc7)` from the deployer wallet once to link it.

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
