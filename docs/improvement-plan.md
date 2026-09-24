# Payroll Master — Improvement Plan & Rialo Migration Guide

> Analysis date: September 24, 2026  
> Reviewer: Arc Studio

---

## 1. Executive Summary

The v1 build is architecturally sound: the Settlement interface is correctly isolated, the privacy model is real (AES-GCM, PBKDF2, Merkle root), and the contracts compile clean on Paris EVM. What it lacks is production finish — role enforcement, on-chain org registration, vault funding from the UI, a real Auditor Desk, and the polish that turns a demo into a product finance teams trust. The improvements below are ranked by impact and grouped into four tiers.

---

## 2. Critical Gaps (must fix before any real org uses this)

### 2.1 On-chain org registration is never called
**Problem:** `createOrg` in `usePayroll.ts` only saves to localStorage. It never calls `arcSettlement.registerOrg()`, so `OrgFactory` on-chain has no record, `vaultOf[orgId]` is always zero, and every subsequent on-chain call reverts.  
**Fix:** Call `arcSettlement.registerOrg(id, name)` inside `createOrg`, store the returned `vaultAddress` on the `Org` object, and only resolve the Promise once the tx confirms. Gate the Roster/New Run screens behind `org.vaultAddress !== undefined`.

### 2.2 RunRegistry.setOrgFactory() was never called
**Problem:** RunRegistry was deployed with `orgFactory = address(0)`. Until `setOrgFactory(0x588...)` is called by the deployer wallet, every `createRun`, `approveRun`, and `executeRun` call reverts.  
**Fix:** Call `setOrgFactory` once from the deployer wallet via the Arc explorer or a one-off script. Then remove the setter from the contract (it is a backdoor once used).

### 2.3 Vault funding has no UI path
**Problem:** `fundVault` exists in `usePayroll` but is not wired to any screen. The one-click checklist will never turn green because `vault.balance()` is always 0.  
**Fix:** Add a "Fund Vault" card to the Home screen with an amount input. Show the current balance, the required amount for the selected run, and a clear "Approve + Fund" two-step button flow.

### 2.4 Role enforcement is only on-chain; the UI does not reflect roles
**Problem:** `isAdmin` is hardcoded `true` in `App.tsx`. Any visitor sees all admin screens. Checker and Employee are indistinguishable in the UI.  
**Fix:** After wallet connects, read `ownerOf`, `makerOf`, `checkerOf` from OrgFactory for the connected address and derive the role. Show only the screens that role may see. The Approve screen should show only the Checker step if the connected wallet is the checker, not the Maker step.

### 2.5 The org secret is stored in `localStorage` in plaintext
**Problem:** `setOrgSecret` stores the 32-byte AES master key as a hex string in `localStorage`. Any browser extension or XSS attack reads it directly.  
**Fix (v1):** Wrap it with the browser's native `localStorage` encryption by keeping the secret in `sessionStorage` (cleared on tab close) and requiring the user to re-enter a passphrase to derive the key on each session — never persist the raw secret. A stronger v2 path is to store the secret encrypted under a wallet-signed key, which also proves org ownership.

---

## 3. High-Impact Product Improvements

### 3.1 Add the Auditor Desk screen
The spec requires it. Implement it as a time-boxed view: the org owner generates a `viewKey` (the orgSecret encrypted under the auditor's wallet public key) and shares it. The Auditor screen takes the encrypted view key, decrypts it with the auditor's connected wallet, then decrypts all run lines client-side. Show a read-only table with all lines, amounts, and run status. No on-chain footprint beyond what already exists.

### 3.2 Add a Fund Vault screen with a proper two-step UX
UX: show the vault balance, the shortfall for the selected run, and a single "Approve + Fund USDC" button that does the `erc20.approve` then `vault.fund` in sequence with clear progress toasts. Add a "Withdraw" button for the org owner to reclaim unspent funds (add `withdraw(uint256)` to Vault, owner-only).

### 3.3 Real maker/checker role assignment UI
Add a "Team" tab to the org settings where the owner pastes wallet addresses to assign as maker and checker. This calls `OrgFactory.setMaker()` and `OrgFactory.setChecker()` on-chain. Show current assignees read from the contract.

### 3.4 Replace the "Attest Sanctions" mock button with a real attestion flow
Currently `attestSanctions` is a local flag flip with no on-chain record and no actual screening. For a production-grade v1, this should at minimum:
- Provide a clear checklist the maker works through manually.
- Record the maker's wallet signature over `keccak256(abi.encodePacked("sanctions-clear", runId, block.timestamp))` in `RunRegistry` rather than accepting a caller flag. This makes the attest auditable on-chain.
- Clearly label it "Self-attestation (testnet only)" until a real sanctions API adapter (Chainalysis, Elliptic) is wired in.

### 3.5 Add a recurring payroll scheduler (Keeper)
Add a `PaySchedule` struct to RunRegistry: `{ uint256 interval; uint256 lastRun; bool active }`. The keeper worker polls it every N seconds and calls `executeRun` when `block.timestamp >= lastRun + interval`. This is the direct analog of Rialo's reactive transaction trigger `WHEN payday`. Ship it as a background bun process in `workers/keeper/`.

### 3.6 Show per-line claim status on the Approve screen
After `executeRun`, the USDC is held in RunRegistry awaiting `claimLine` per employee. The UI should show each line as "Awaiting claim" / "Claimed" / "Held". The employee should be able to trigger `claimLine` from the Employee Portal after pasting their ID and a one-time claim link.

### 3.7 Retry failed lines
`RunRegistry.executeRun` sets `executed = true` but does not call `claimLine` for any line. Any line that fails a Merkle proof stays held. Add `retryFailed(runId, lineIndex, ...)` to the UI — it calls `claimLine` again for that specific line with a corrected destination.

---

## 4. UX / Design Improvements

### 4.1 Replace the Employee ID paste flow with a QR or deep link
The current Employee Portal requires the employee to paste a UUID. Replace this with a "Copy your portal link" button on the Roster screen that generates a URL like `?emp=<id>` and pre-fills the field. This removes the friction and makes it usable without any blockchain knowledge.

### 4.2 Show transaction progress inline, not just toasts
Right now a tx fires and a toast appears. For a finance product, show a step-by-step progress indicator inline in the card that triggered the action: "1. Signing... 2. Broadcasting... 3. Confirming... 4. Done." with a spinner per step.

### 4.3 Add a "September run paid 42 of 44" activity feed
The spec explicitly calls this out. Add a run history feed on Home that renders natural-language summaries: `"September run paid 42 of 44. Two lines held for review."` instead of just a status badge.

### 4.4 Chain-switch guard
If the connected wallet is on the wrong network, show a "Switch to Arc Testnet" banner before any write action. Use wagmi's `useSwitchChain` + `useChainId` for this — never let a tx land on the wrong chain silently.

### 4.5 Mobile bottom-nav overlap
The bottom nav is `fixed` and overlaps content by 64px. The `pb-24` on main only partially compensates. Switch to `pb-[env(safe-area-inset-bottom)+5rem]` to handle iPhone notch correctly.

### 4.6 Empty-state illustrations
Every empty state currently shows a grey icon and one line of text. Add a minimal SVG illustration for: no org, no employees, no runs. This is the difference between a demo and a product people share with their finance team.

---

## 5. Contract Improvements

### 5.1 Remove the `setOrgFactory` backdoor after calling it
The one-time setter is a necessary bootstrapping workaround, but it is a privileged backdoor. After calling it once, emit a `FactorySet` event and delete the `deployer` state variable by setting it to `address(0)`. The setter then becomes permanently locked.

### 5.2 Add `Vault.withdraw(uint256, address)` for org owner
Right now funds can enter the vault but never leave except through `pull`. The org owner needs a way to reclaim funds if a run is cancelled. Add an owner-only `withdraw` function.

### 5.3 EIP-712 typed signatures for checker approval
`approveRun` takes `bytes calldata checkerSig` but silently ignores it (`checkerSig;`). Replace this with actual EIP-712 signature verification: define a `RunApproval` type, verify `ecrecover(hash, v, r, s) == expectedChecker`. This makes the approval cryptographically binding rather than just "caller is checker."

### 5.4 Add a `cancelRun` function
A run that is created but never approved (e.g. the checker rejects it) should be cancellable by the owner/maker to free up the mental model. Add `cancelRun(runId)` that sets a `cancelled` bool and refunds any escrowed USDC back to the vault.

### 5.5 Emit `StealthDistributor.emitPaid` from `RunRegistry.executeRun`
Right now `StealthDistributor` is deployed but never called. Wire the call from `executeRun`: after pulling from the vault, call `stealthDistributor.emitPaid(...)` for each line. This produces the privacy event log the keeper reads for employee discovery.

---

## 6. Rialo Migration — How Easy Is It?

Short answer: **very easy, by design.** The Settlement interface is the entire migration surface.

### 6.1 What the interface looks like today

```typescript
// src/settlement/types.ts  — unchanged between Arc and Rialo
export interface Settlement {
  fund(orgId: string, amountUsdc: string): Promise<FundResult>
  executeRun(runId: string, orgId: string): Promise<ExecuteRunResult>
  getVaultBalance(orgId: string): Promise<string>
  publishRosterRoot(runId: string, orgId: string, root: string, total: string): Promise<{ txHash: string }>
  approveRun(runId: string, sig: string): Promise<{ txHash: string }>
  registerOrg(orgId: string, name: string): Promise<{ vaultAddress: string; txHash: string }>
}
```

The UI never imports `viem`, `wagmi`, chain IDs, or contract addresses directly. Every chain call goes through this interface. This is 100% correct and is the key engineering decision that makes the migration mechanical.

### 6.2 What changes on Rialo

| Concern | Arc (now) | Rialo (later) |
|---|---|---|
| Settlement module | `src/settlement/arc.ts` | `src/settlement/rialo.ts` |
| Run trigger | Keeper worker polls a scheduler | Reactive transaction `WHEN payday` — keeper process deleted |
| Employee discovery | Keeper scans `Paid` events for matching view tag | REX confidential compute — no keeper, no event scan |
| Privacy | App-layer AES-GCM + stealth dest | REX decrypt/policy inside confidential enclave |
| Pay to email/phone | Not supported in v1 | IPC identity resolution — `dest` is an email/phone hash |
| Contracts | Solidity on EVM | Rialo CDK (RISC-V + SVM) — NOT a Solidity redeploy |

### 6.3 The migration is three files

1. **`src/settlement/rialo.ts`** — new file that implements `Settlement` using the Rialo CDK client instead of viem/wagmi. The contract addresses, ABI, and transaction patterns change; the interface signature does not.

2. **`src/App.tsx` (one line)** — change the import:
   ```typescript
   // Before
   import { arcSettlement } from './settlement/arc'
   // After
   import { rialoSettlement } from './settlement/rialo'
   ```
   Then pass `rialoSettlement` to `usePayroll` as a prop instead of importing the singleton directly. This makes both adapters testable simultaneously.

3. **`workers/keeper/index.ts`** — deleted. On Rialo the reactive transaction engine replaces the polling loop entirely.

### 6.4 What does NOT change at all

- Every screen component (`Home`, `Roster`, `NewRun`, `Approve`, `EmployeePortal`) — zero changes.
- `usePayroll.ts` — zero changes (it only calls `settlement.*`, never a chain directly).
- `src/lib/crypto.ts` — the AES-GCM layer stays until REX is live; then it is replaced module-by-module without touching the hook.
- `src/lib/merkle.ts` — the Merkle root is a content hash; chain-agnostic.
- `src/types/payroll.ts` — no chain-specific types in here.
- `src/lib/store.ts` — localStorage is the persistence layer; unchanged.
- All UI components — completely chain-agnostic.

### 6.5 Recommended migration steps (when Rialo CDK is available)

1. Add `RialoSettlement` as a second implementation of `Settlement` in `packages/settlement-rialo/`.
2. Make `usePayroll` accept a `settlement: Settlement` dependency injection prop.
3. Write an integration test suite against `ArcSettlement` on a fork; the same suite runs against `RialoSettlement` on the Rialo devnet.
4. Feature-flag the active adapter at build time with `VITE_SETTLEMENT_ADAPTER=arc|rialo`.
5. Delete `workers/keeper/` once reactive triggers are verified on Rialo devnet.
6. Replace `src/lib/crypto.ts` encrypt/decrypt with REX policy calls for the confidential compute path.

### 6.6 The one architectural risk to manage now

`usePayroll.ts` line 31:
```typescript
useEffect(() => { if (walletClient) arcSettlement.setWalletClient(walletClient) }, [walletClient])
```
This couples the hook to the Arc singleton. Before migration, convert `arcSettlement` to a React context provider so the active adapter is injected, not imported. Then the feature flag swaps the provider at the root level and nothing else changes.

---

## 7. Summary Table

| # | Item | Impact | Effort |
|---|---|---|---|
| 2.1 | Wire registerOrg on-chain | Critical | 1 hr |
| 2.2 | Call setOrgFactory on deployer | Critical | 5 min |
| 2.3 | Fund vault UI | Critical | 2 hr |
| 2.4 | Role-aware UI | High | 3 hr |
| 2.5 | Protect org secret | High | 2 hr |
| 3.1 | Auditor Desk screen | High | 4 hr |
| 3.2 | Fund Vault screen polish | High | 1 hr |
| 3.3 | Maker/checker assignment UI | High | 2 hr |
| 3.4 | Real sanctions attestation | High | 3 hr |
| 3.5 | Keeper worker | Medium | 4 hr |
| 3.6 | Per-line claim status | Medium | 2 hr |
| 4.1 | QR/deep link for employees | Medium | 1 hr |
| 4.2 | Inline tx progress | Medium | 2 hr |
| 4.3 | Activity feed copy | Medium | 1 hr |
| 4.4 | Chain-switch guard | High | 1 hr |
| 5.3 | EIP-712 checker sig | High | 2 hr |
| 5.2 | Vault.withdraw | Medium | 30 min |
| 5.5 | Wire StealthDistributor | High | 1 hr |

**Rialo migration effort once CDK ships: ~1 day for a developer who did not write this codebase, ~2 hours for one who did.**
