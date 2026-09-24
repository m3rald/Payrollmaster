# Payroll Master — Feasibility Analysis

**Date:** September 23, 2026  
**Scope:** Arc Testnet (v1) with Rialo adapter stub (v2+)

---

## Verdict: Buildable Now, with Five Bounded Risks

The core product promise is fully achievable on Arc Testnet today. The privacy model, the dual-approval flow, the Settlement adapter abstraction, and the encrypted-roster pattern are all standard engineering — none require experimental infrastructure. The five risks below each have a clear mitigation.

---

## What Works Right Now (Arc Testnet)

### 1. One-Click Settle with USDC on Arc

Arc Testnet (chain ID 5042002) runs USDC as the native gas token. The same asset funds both gas and payroll lines. No ETH, no wrapped token, no cross-asset swap before payout. This is the best possible chain for a USDC payroll product. A vault contract can hold USDC, verify a Merkle proof per line, and push transfers in a single `executeRun` transaction.

### 2. Maker / Checker On-Chain (EIP-712 + Solidity)

The pattern is standard: the maker submits a `runId + rosterRoot + totalAmount` hash, the checker signs an EIP-712 typed-data approval off-chain, and the `RunRegistry.execute` function verifies the checker's signature on-chain before disbursing. No oracle, no multisig wallet needed. OpenZeppelin's `EIP712` base is available at the pinned 5.1.0 version (Paris EVM, no Cancun opcodes). This gives you a legally distinct maker/checker separation with an auditable on-chain trail.

### 3. App-Layer Privacy (v1 — No Arc Privacy Sector Required)

You correctly identify that Arc's privacy features are not required in v1. The plan is sound:

- **Roster privacy**: Employee names, salaries, and destinations are stored only in the app's encrypted backend. Only a `rosterRoot` (Merkle root) goes on-chain.
- **Amount privacy on-chain**: The contract emits `Paid(runId, destCommitment, amountCipher, viewTag)` rather than a plain `(address, amount)` event. Anyone on the explorer sees that a run happened; they cannot decode `amountCipher` without the view key.
- **Stealth addresses**: One-time destination per employee per run (`StealthDistributor` contract pattern). Stealth addressing is a proven technique (EIP-5564 describes the meta-address format). An employee's EOA never appears in public contract storage or events.
- **Selective disclosure**: The employer's backend holds the per-employee view key. Employees query their own paystub via a signed request. An auditor receives a time-boxed view key from the employer, never from the contract itself.

This v1 model is defensible and ships on standard Solidity. It is NOT zero-knowledge — a compromised backend leaks everything — but the spec explicitly accepts that for v1 and defers ZK to v2/v3.

### 4. Merkle Roster Root On-Chain

`rosterRoot = merkle(employeeId, payHash, destCommitment)` is a well-understood pattern used in airdrops (Uniswap, ENS) and payroll-adjacent products. On-chain storage cost is one `bytes32` per run. Proof verification is O(log n) gas per line. At 100 employees, a batch proof run costs roughly 200k–400k gas; on Arc that is a small, stable USDC fee. No novel primitives needed.

### 5. Settlement Adapter TypeScript Interface

The `Settlement` interface (`fund`, `executeRun`, `proofForEmployee`) is a clean abstraction boundary. `ArcSettlement` implements it using wagmi/viem + the deployed Solidity contracts. `RialoSettlement` is a stub today and fills in when Rialo's CDK ships. The UI never touches a chain directly. This is excellent architecture and has no technical blockers.

### 6. Frontend UX (Finance App Aesthetic)

React + Vite + wagmi v2 + ConnectKit is the exact stack already in the sandbox. The dashboard archetype (two-panel desktop: vault summary + run list) maps directly to the `frontend-design` skill's market/dashboard layout. The employee portal (single-column mobile-first) maps to the earn/wallet layout. Both are achievable with the existing Tailwind setup. Hiding gas and hex addresses from employees is straightforward — the employer portal shows them; the employee portal does not.

---

## Five Bounded Risks

### Risk 1: Stealth Address UX for Employees

**The problem.** Stealth addressing means each employee gets a fresh one-time address per run. The employee must scan the chain (or query the keeper) to discover their deposit. On Arc this means the keeper process watches for `Paid` events and uses the employee's registered scan key to detect which events belong to them. If the keeper is down during a run, the employee cannot see their payment until it resumes.

**Mitigation.** The keeper is a simple event watcher. Run it as a persistent Node/Bun worker. Store the matched `(runId, employee, amount, dest)` tuples in the encrypted backend. The employee portal queries the backend (authenticated by email/phone), not the chain directly. Keeper downtime causes a delay in the portal — the payment has already landed on-chain.

**v3 note.** On Rialo the keeper is deleted entirely — Rialo's IPC layer handles pay-to-email natively. The architecture already plans for this.

### Risk 2: Encryption Key Management (App-Layer Privacy)

**The problem.** The spec puts roster encryption in the app backend, not in a TEE or ZK circuit. The per-employee `amountCipher` is encrypted with a key the employer controls. If the employer's key material is compromised, all salary data is exposed. This is an accepted v1 tradeoff, but it must be stated in the product's terms and communicated to pilot orgs.

**Mitigation.** Use a well-established scheme: ECIES (Elliptic Curve Integrated Encryption Scheme) with a per-run ephemeral key pair. The employer holds the master viewing key. Each employee's per-run cipher is `ECIES-encrypt(employeePubKey, amount)`. The employer re-encrypts under the auditor's key for the auditing window. Key material lives in the encrypted backend (or a secrets manager like Circle's entity-secret model). Document the trust assumption clearly.

### Risk 3: Sanctions / KYC / Regulatory Position

**The problem.** Payroll is regulated in most jurisdictions. The spec correctly says "position v1 as testnet + invited-org tooling" — that is the right call. However, the `sanctions_hit` predicate needs to check a real list (OFAC, UN) before v1 can be used even by invited orgs.

**Mitigation.** The sanctions adapter is an off-chain service (the spec already puts it in `adapters/sanctions`). For v1, integrate a simple OFAC name-match API (e.g., Chainalysis, Elliptic, or even a public OFAC SDN feed) as an attested off-chain step. The run engine checks an `ofac_attested` flag before calling `executeRun`. The contract does NOT need to do sanctions screening — it only checks that the attester signed off. This is the correct pattern.

### Risk 4: Rialo Compatibility (Architecture Discipline)

**The problem.** Rialo (RISC-V + SVM, reactive txs, REX confidential compute) is a fundamentally different execution model from EVM/Solidity. The spec already forbids assuming Solidity redeploys onto Rialo — that is correct. The risk is that v1 decisions accidentally couple the UI or the run engine to EVM-only concepts (e.g., `chainId`, `gasPrice`, Solidity ABI encoding, EIP-712 signatures) in a way that makes `RialoSettlement` hard to implement.

**Mitigation.** The `Settlement` interface is the firewall. Enforce one rule: no wagmi/viem import in `packages/settlement` or `apps/console` routing logic. Chain-specific types stay inside `packages/settlement-arc`. `PREDICATES.md` documents the predicates in plain English (not Solidity) so the Rialo engineer translates to reactive tx syntax without rewriting product logic. This is already implied in the spec but worth making an explicit code review checklist item.

### Risk 5: Stealth Address Proof Size and Gas

**The problem.** The `StealthDistributor` pattern requires a Merkle proof per employee per run. At 200 employees per run, proof size is ~7 leaves * 32 bytes = ~224 bytes per employee, times 200 = ~45 KB calldata. On Arc this is gas-cost predictable (USDC gas, stable fees), but if a single `executeRun` processes all 200 lines in one transaction, the calldata alone costs significant gas, and the 30M gas block limit may bind for very large rosters.

**Mitigation.** Split large runs into batches of 50 lines per transaction. The `RunRegistry` tracks `(runId, batchIndex, paid, held)` and marks the run complete when all batches are done. The "one click" UX triggers N sequential transactions, handled transparently by the `ArcSettlement.executeRun` method. The employee portal and the run summary aggregate across batches.

---

## Build Order Assessment

The proposed build order is correct and risk-sequenced properly. A few refinements:

| Step | Assessment |
|------|-----------|
| 1. Arc vault + public batch pay | Start here. Proves the loop works before adding privacy. |
| 2. Encrypt roster, publish root only | Add ECIES encryption in the backend; root on-chain stays the same. |
| 3. Stealth dest per employee | The hardest UX step. Add keeper worker here. |
| 4. Maker/checker + recurring keeper | EIP-712 checker sig is straightforward once STEP 1 is solid. |
| 5. Employee portal | Auth by email/phone → show own paystub from backend. |
| 6. Wrap chain calls in Settlement | Refactor, not a new feature. Do this before any Rialo work. |
| 7. RialoSettlement | Depends on Rialo CDK. Stub with typed errors in the meantime. |
| 8. Demo dual-run | Smoke test that the same run JSON executes on both adapters. |

---

## Contracts Required (Arc Testnet, Solidity 0.8.x, Paris EVM)

| Contract | Purpose |
|----------|---------|
| `OrgFactory` | Create and register orgs; emit `OrgCreated(orgId, owner)` |
| `Vault` | Hold USDC, allow `fund()`, enforce `balance >= runTotal` before release |
| `RunRegistry` | Store `rosterRoot`, accept checker EIP-712 approval, expose `execute(runId, proofs[])` |
| `PaystubStore` | Store per-run `amountCipher` mapped to `destCommitment`; no plaintext |
| `StealthDistributor` | Pull from Vault, push to one-time stealth addresses, emit `Paid(runId, destCommitment, amountCipher, viewTag)` |

All five fit in the standard OpenZeppelin 5.1.0 + Foundry Paris-EVM build. Total estimated line count: ~600–800 lines of Solidity across the five contracts.

---

## What is NOT Feasible in v1

| Feature | Why Not v1 | Path |
|---------|-----------|------|
| Zero-knowledge amount proofs | No ZK toolchain on Arc Testnet yet | v2 / Arc Privacy Sector |
| Pay to phone/email without keeper | Requires Rialo IPC layer | v3 |
| Bank off-ramp settlement confirmation | Real banking API + compliance; out of scope for testnet | Adapter stub |
| Regulatory compliance for live payroll | Licensed product territory; testnet + invited orgs only | Business decision |
| Mainnet deploy | v1 is testnet + invited-org; mainnet needs a paid third-party audit | After audit |

---

## Summary

Payroll Master is technically sound. The Arc Testnet target is ideal (USDC as gas, EVM-compatible, stable fees). The privacy model is honest about its v1 limitations and has a clear upgrade path. The Settlement abstraction is the right way to keep Rialo in the picture without blocking v1. The build order is sensible. The five risks each have a concrete mitigation that does not require a fundamental redesign.

**Recommended next step:** build the `OrgFactory`, `Vault`, and `RunRegistry` contracts first (Steps 1–2 of your build order), deploy them to Arc Testnet, and wire a minimal console UI to prove the one-click execute loop. That validates the settlement adapter interface before any privacy complexity is added.
