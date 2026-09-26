# PayrollMaster — Full Security Audit Report (Round 3)
**Date:** 2026-09-26 | **Severity level:** Max | **Chain:** Arc Testnet (5042002)

---

## Executive Summary

This is the third and final audit round. All Critical and High findings from rounds 1–2 are confirmed resolved. Six new findings remain: 1 Critical, 3 High, 2 Low/Info. None are fund-loss bugs; they are hardening items and UX failures on money paths.

---

## ✅ RESOLVED (confirmed fixed this round)

| # | Finding | Where |
|---|---|---|
| R1 | PaystubStore write access control — registry-only, no overwrites | PaystubStore.sol |
| R2 | createOrg gated on registrySet (RegistryNotSet error) | OrgFactory.sol |
| R3 | Zero-address constructor guards on all 4 contracts | All contracts |
| R4 | setOrgFactory uses custom ZeroFactory error | RunRegistry.sol |
| R5 | reclaimResidual — 90-day recovery window for unclaimed funds | RunRegistry.sol |
| R6 | Receipt status checked on ALL writeContract calls | arc.ts |
| R7 | publishRosterRoot rethrows after toast | usePayroll.ts |
| R8 | useOrgRole returns 'none' when deps missing | useOrgRole.ts |
| R9 | NewRun has try/catch + error banner | NewRun.tsx |
| R10 | Claim links use URL-safe base64 | merkle.ts |
| R11 | Worker gas warning shown before Claim button | EmployeePortal.tsx |

---

## 🔴 CRITICAL

### C1 — `createOrg` is permissionless (namespace squatting)
**Contract:** OrgFactory.sol:47 `createOrg`
**Impact:** Any wallet can call `createOrg("target-org-id", maliciousAddress)` and permanently seize that org ID before the real owner does. Because `OrgAlreadyExists` blocks replacement, the victim must use a different org ID or lose the namespace permanently.
**Fix:** Require `msg.sender == owner` in `createOrg`, or use a signed-authorization pattern so only the intended owner can create their own org.

---

## 🟠 HIGH

### H1 — Wrong-wallet publish reported as success
**File:** usePayroll.ts `publishRosterRoot`, Approve.tsx `handlePublishRoster`
**Impact:** When the wrong wallet is connected, `publishRosterRoot` shows a toast and returns without throwing. The Approve screen advances the checklist step to "done" even though nothing landed on-chain. Makers believe the roster root is published when it isn't — executeRun will fail.
**Fix:** Return explicit `{ success: boolean }` from `publishRosterRoot`, or throw on wrong-wallet guard. Approve.tsx must check the return value before marking the step done.

### H2 — Employee portal silently shows "No payroll" on read failure
**File:** EmployeePortal.tsx `loadEntries`
**Impact:** If the RPC call fails, localStorage is corrupt, or chain reads error out, the catch block is silent and the UI shows "No payroll found for your wallet." Workers with real unclaimed funds are told they have nothing to claim — they may walk away from their money.
**Fix:** Distinguish between "empty" (no claims found) and "error" (load failed). Show a visible error banner with a retry button when loading fails.

### H3 — executeRun completion state derived from localStorage, not chain
**File:** arc.ts `executeRun`, usePayroll.ts `executeRun`
**Impact:** `paid` and `held` counts are taken from `run.lines.length` in localStorage, not from on-chain events or contract reads. On a different device or browser, the run will show wrong completion state. If a partial execution occurs, the UI will still show "all paid."
**Fix:** After `executeRun` confirms, read `RunExecuted` event logs or query `run.heldAmount` on-chain to derive actual paid/held counts.

### H4 — setRegistry has no event emission
**Contract:** OrgFactory.sol:39 `setRegistry`
**Impact:** The most critical admin action (wiring the registry) emits no event. No way to monitor or audit when this was called, by whom, or what values were set.
**Fix:** Add `event RegistrySet(address indexed oldRegistry, address indexed newRegistry)` and emit it in `setRegistry`.

---

## 🟡 MEDIUM / LOW

### M1 — Vault trust anchors are mutable storage (should be immutable)
**Contract:** Vault.sol — `usdc`, `owner`, `registry` stored in regular storage
**Impact:** These are set once in the constructor and never changed, but mutable storage means they could theoretically be altered by a future upgrade or storage collision. No immediate exploit path.
**Fix:** Declare as `immutable`.

### M2 — StealthDistributor addresses should be immutable
**Contract:** StealthDistributor.sol — `registry`, `paystubStore`
**Impact:** Same as M1 — set once, never changed, but stored as mutable.
**Fix:** Declare as `immutable`.

---

## Risk Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 1 | Open (C1 — namespace squatting) |
| High | 4 | 3 open (H1–H3) + 1 open (H4) |
| Medium/Low | 2 | Open (M1–M2, low risk) |
| Resolved | 11 | All confirmed fixed |

---

## Priority Fix Order Before Mainnet

1. **C1** — Add `require(msg.sender == owner)` to `createOrg`
2. **H1** — Throw on wrong-wallet in `publishRosterRoot`; check return in Approve.tsx
3. **H2** — Distinguish error vs empty in EmployeePortal claim loading
4. **H3** — Read `RunExecuted` event after executeRun to derive real paid/held counts
5. **H4** — Emit `RegistrySet` event in `setRegistry`
6. **M1/M2** — Mark Vault + StealthDistributor fields as `immutable`
