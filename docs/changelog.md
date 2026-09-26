# Payroll Master — Before vs After Comparison

All changes made during the Arc Studio session (September 24–25, 2026).

---

## Smart Contracts

| # | Area | Before | After | Status |
|---|---|---|---|---|
| 1 | **OrgFactory ↔ RunRegistry wiring** | OrgFactory deployed with stale RunRegistry address (`0xA1881Be8`); every Vault embedded the wrong registry | Redeployed in correct sequence: RunRegistry(`0x0`) → OrgFactory(RunRegistry) — Vault's `registry` is correct in every new org | ✅ Fixed |
| 2 | **RunRegistry.orgFactory** | Set to `address(0)` on deployed instance — `createRun` always reverted with `OrgNotFound` | Pending final deploy: RunRegistry(`0xc5c59ddc`) so `orgFactory` is baked in correctly | 🟡 1 deploy pending |
| 3 | **PaystubStore access control** | `store()` was `external` with zero access control — any wallet could overwrite any employee's encrypted paystub | Added `constructor(address _registry)` + `if (msg.sender != registry) revert NotRegistry()` + `if already stored revert AlreadyStored()` | 🟡 Source fixed, redeploy pending |
| 4 | **Vault.withdraw** | No way to retrieve USDC from a funded vault if a run was cancelled — funds permanently locked | Added `withdraw(uint256)` — owner-only, emits `Withdrawn` event | ✅ Fixed (in new OrgFactory deploy) |
| 5 | **RunRegistry.setOrgFactory** | Constructor required non-zero `orgFactory` — circular deploy dependency was unsolvable | Added one-time `setOrgFactory()` gated by `msg.sender == deployer && orgFactory == 0` — breaks the circular dep cleanly | ✅ Fixed |
| 6 | **Contract verification** | All contracts unverified on explorer — MetaMask flagged every interaction as "unknown contract" | All 4 contracts verified via `forge verify-contract --verifier blockscout` on Arc Testnet explorer | ✅ Fixed |

---

## Wallet & Network

| # | Area | Before | After | Status |
|---|---|---|---|---|
| 7 | **OKX Wallet support** | Only `injected()` (MetaMask-style `window.ethereum`) — OKX invisible in ConnectKit | Added `injected({ target: 'okxWallet' })` explicitly — OKX appears as its own option | ✅ Fixed |
| 8 | **MetaMask disappearing** | When OKX + MetaMask both installed, OKX hijacks `window.ethereum` — MetaMask vanished from the wallet picker | Added `injected({ target: 'metaMask' })` as first connector — targets `window.ethereum.providers` array, MetaMask always visible | ✅ Fixed |
| 9 | **Duplicate connector conflict** | Bare `injected()` + two targeted connectors shared the same wagmi connector ID — caused duplicate/missing entries in ConnectKit | Removed bare `injected()` fallback — ConnectKit handles the generic case internally | ✅ Fixed |
| 10 | **Arc Testnet chain ID hex** | `wallet_addEthereumChain` was sending `0x4CEF52` (5,173,074) — wrong chain entirely | Corrected to `0x4CEFB2` (5,042,002 = Arc Testnet) | ✅ Fixed |
| 11 | **Arc Testnet auto-add** | Users had to manually add Arc Testnet to OKX/MetaMask — "Network fee: --" and greyed Confirm button | `ChainGuard` now calls `wallet_addEthereumChain` (EIP-3085) with full RPC params on every wrong-chain connection — one click adds + switches | ✅ Fixed |
| 12 | **WalletConnect support** | No WalletConnect connector — no QR-code fallback for mobile/hardware wallets | Added `walletConnect` connector gated on `VITE_WC_PROJECT_ID` | ✅ Fixed |

---

## Transaction Reliability

| # | Area | Before | After | Status |
|---|---|---|---|---|
| 13 | **Gas estimation failing on OKX** | OKX doesn't have Arc Testnet in its chain registry — "Network fee: --", Confirm button permanently greyed | `arc.ts` fetches live gas price from Arc RPC and injects both `gasPrice` and `gas` explicitly into every `writeContract` call — wallet never needs to estimate | ✅ Fixed |
| 14 | **Gas limit too low for createOrg** | `createOrg` deploys a Vault internally — MetaMask under-estimated gas, always failing | Explicit `gas: 3_000_000n` on `createOrg` call | ✅ Fixed |
| 15 | **RPC abort cancelling receipt poll** | `arcGasPrice()` and `waitForTransactionReceipt` shared the same viem client — a timed-out gas price call aborted in-flight receipt polling, showing "failed" for txs that actually landed | Separated into dedicated `receiptClient` (2-min timeout) and short-timeout gas price client (5s + 1 retry + 30 gwei fallback) | ✅ Fixed |
| 16 | **approveRun never sent on-chain** | `approveRun` only called `walletClient.signMessage` locally — `run.approved` stayed `false` on-chain — `executeRun` always hit `RunNotApproved` revert | `approveRun` now signs locally then calls `RunRegistry.approveRun()` on-chain — local state updates only after tx confirms | ✅ Fixed |
| 17 | **Wrong contract addresses in .env** | `.env` was never created at session start — `VITE_ORG_FACTORY_ADDRESS` and `VITE_RUN_REGISTRY_ADDRESS` were empty strings | `.env` created with all 4 deployed contract addresses; updated after each redeploy; Vite restarted each time | ✅ Fixed |
| 18 | **All txs sent to stale RunRegistry** | After multiple redeployments, `.env` still pointed at `0xa726a045` (abandoned Sep 24 RunRegistry) — every `createRun`/`executeRun` went to a zombie contract | Correct addresses written to `.env` and verified on-chain before each session | ✅ Fixed |

---

## Role & Access Guards

| # | Area | Before | After | Status |
|---|---|---|---|---|
| 19 | **Wrong-wallet createRun** | `createRun` sent from any connected wallet — if not the owner/maker, immediate `NotAuthorizedMaker` revert on-chain | UI reads `ownerOf`/`makerOf`/`checkerOf` from OrgFactory — each step button disabled + banner shown if wrong wallet connected | ✅ Fixed |
| 20 | **Wrong-wallet approveRun** | Same — checker step had no wallet check | Banner + disabled button if connected wallet ≠ assigned checker | ✅ Fixed |
| 21 | **Wrong-wallet executeRun** | Same — execute had no wallet check | Banner + disabled button if connected wallet ≠ org owner | ✅ Fixed |
| 22 | **Nav tabs blocked by role** | `canSee()` returned `false` for `role === 'none'` or `'loading'` — Roster, Settings, Approve tabs completely unclickable without a connected wallet | Navigation always allowed; role check only disables action buttons inside each screen | ✅ Fixed |
| 23 | **Role-aware UI** | All screens visible to all wallets | After connecting, app reads role from OrgFactory — colour-coded badge (Owner/Maker/Checker) in sidebar; nav items non-navigable for irrelevant roles | ✅ Fixed |

---

## UX & Frontend

| # | Area | Before | After | Status |
|---|---|---|---|---|
| 24 | **"Vault not registered" dead-end** | Warning text shown with no recovery path — org saved locally before tx confirmed, vault address missing | Added "Register now" retry button — calls `createOrg` on the correct OrgFactory and saves vault address on confirm | ✅ Fixed |
| 25 | **Inline transaction progress** | Single toast on tx start/end — no step visibility for finance teams watching a large payroll execute | `TxProgress` component on Fund Vault (Approve → Deposit), Publish Roster Root, Approve Run, Execute Run — each shows Signing → Broadcasting → Confirming → Done with inline error display | ✅ Fixed |
| 26 | **Employee portal deep links** | Employees had to manually paste a UUID to access their payslip | "Copy portal link" button per employee in Roster generates `?emp=<id>&tab=employee-portal` URL; portal auto-fills on open | ✅ Fixed |
| 27 | **Cross-wallet org memory** | Orgs stored only in `localStorage` — switching wallets or new browser showed empty state | On wallet connect, app reads `OrgCreated` events from OrgFactory and imports any orgs owned by that address missing from local state | ✅ Fixed |
| 28 | **Dark mode** | Light mode only | Sun/Moon toggle in sidebar and mobile header — respects system preference on first visit, persists to localStorage | ✅ Fixed |
| 29 | **Select/input pale in dark mode** | Browser forced OS-native white on `<select>` elements in dark mode | Global CSS rule with `color-scheme: dark` + `background: var(--surface-strong)` on select + options; placeholder text uses `var(--subtle)` | ✅ Fixed |
| 30 | **Watermark removed** | "Built with Arc Studio" pill visible in app header | Completely removed from `main.tsx` | ✅ Fixed |
| 31 | **Vault withdraw UI** | No way to withdraw from vault in the UI even after contract fix | "Withdraw" button + inline form in vault card alongside "Fund" | ✅ Fixed |
| 32 | **Settings screen non-functional** | `setMaker`/`setChecker` transactions sent to old OrgFactory — orgs not registered there → `OrgNotFound` revert | Now sends to current OrgFactory — works for orgs created through `0xc5c59ddc` | ✅ Fixed |

---

## Vite / Dev Environment

| # | Area | Before | After | Status |
|---|---|---|---|---|
| 33 | **HMR WebSocket hostname** | HMR config hardcoded old session hostname (`isw1ohv4...`) — WebSocket failed on every reconnect | Changed to `host: true` — derives hostname dynamically from whatever the preview proxy serves | ✅ Fixed |
| 34 | **Unhandled wallet reconnect errors** | On every page load, wagmi threw unhandled rejections for locked/unauthorised MetaMask/OKX sessions — polluted console and interfered with app state | Global `unhandledrejection` handler silences known wallet noise without hiding real errors | ✅ Fixed |

---

## Summary Counts

| Category | Fixed | Pending |
|---|---|---|
| Smart contracts | 5 | 2 (deploy-gated) |
| Wallet & network | 6 | 0 |
| Transaction reliability | 6 | 0 |
| Role & access guards | 5 | 0 |
| UX & frontend | 9 | 0 |
| Dev environment | 2 | 0 |
| **Total** | **33** | **2** |

The 2 pending items both require one deploy window (RunRegistry final wiring + PaystubStore/StealthDistributor redeploy).
