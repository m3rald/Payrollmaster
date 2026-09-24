# Payroll Master — Usage & Testing Guide

---

## Before You Start: One Required Setup Step

RunRegistry was deployed with `orgFactory = address(0)` due to a circular deployment dependency.
You must call `setOrgFactory` once before any payroll flow works.

**Who must do it:** the wallet at `0xa3039A54856ed74B5AEc999EeF3fc954Ab010Cf6` (the deployer).

**How:**
1. Go to the Arc Testnet explorer:  
   https://explorer.testnet.arc.io/address/0xa1881be8a3a6a38762b197db7be05a17b39bd8eb
2. Open the **Write** tab.
3. Connect the deployer wallet.
4. Call `setOrgFactory` with the argument:  
   `0x588aff9e646c88f4ad26f4fd961b8f15157a2bc7`
5. Confirm the transaction.

After this, `orgFactory()` on RunRegistry will return `0x588aff9e646c88f4ad26f4fd961b8f15157a2bc7` and all flows are unblocked.

---

## Step-by-Step: Full Payroll Run as the Admin

### Step 1 — Get test USDC

Click **"Get test USDC"** in the Arc Studio sidebar. This drips Arc Testnet USDC to your connected wallet for free. You need at least enough to cover your total payroll (e.g. 500 USDC for a 5-person run at 100 USDC each).

Alternatively use the faucet at https://faucet.circle.com — select Arc Testnet, paste your wallet address.

### Step 2 — Connect your wallet

Open the app preview. You will land on the Home screen with a "Connect your wallet" prompt.

- Click **Connect** (ConnectKit dialog opens)
- Choose MetaMask or any injected wallet
- If prompted to switch network, switch to **Arc Testnet** (Chain ID: 5042002, RPC: https://rpc.testnet.arc.io)

Your wallet address appears in the bottom-left of the sidebar once connected.

### Step 3 — Create an Organisation

1. Click **New Org** (top-right of Home screen).
2. Enter a name, e.g. `Acme Corp`.
3. Click **Create**.

> **What happens under the hood:** A unique org ID is generated, an org secret (32-byte AES master key) is saved to localStorage, and the org is stored locally. An on-chain `OrgFactory.createOrg()` call is needed here but is not yet wired — this is critical gap 2.1 from the improvement plan. Until it is fixed, the on-chain vault does not exist and fund/execute will fail. For a demo of the UI flow only, local state still works.

### Step 4 — Add Employees (Roster screen)

1. Click **Roster** in the sidebar.
2. Click **Add Employee**.
3. Enter a display name and optional email, e.g. `Alice Chen`.
4. Repeat for each employee.

Each employee gets a UUID. Copy and share this ID with the employee privately — they need it to view their paystub in the Employee Portal.

### Step 5 — Create a New Run

1. Click **New Run** in the sidebar.
2. Enter a label, e.g. `September 2026`.
3. For each employee, enter their salary amount in USDC (e.g. `1500.00`).
4. Click **Create Run**.

> **What happens:** amounts are encrypted client-side with AES-GCM using a PBKDF2-derived key (orgSecret + runId + employeeId). A Merkle root over all encrypted commitments is computed. Only the root, not any salary, is stored on-chain later.

### Step 6 — Approve & Execute (Approve screen)

Click **Approve** in the sidebar. You will see the One-Click Checklist:

**Step A: Publish Roster Root**
- Click **Publish Roster Root On-Chain**.
- MetaMask will prompt for a transaction — confirm it.
- This calls `RunRegistry.createRun(orgId, runId, rosterRoot, totalAmount)`.
- Wait for confirmation (a few seconds on Arc Testnet).
- Checklist row 1 turns green.

**Step B: Attest Sanctions**
- Click **Attest Sanctions Clear**.
- This is currently a local flag (testnet only) — confirm that you have screened payees.
- Checklist row 2 turns green.

**Step C: Checker Signs**
- Click **Sign Approval**.
- MetaMask prompts for a message signature (no gas, no transaction).
- The signature is bound to `runId` and `rosterRoot`.
- Checklist row 3 turns green.

**Step D: Execute**
- All three rows are green. The **Execute Run** button activates.
- Click **Execute Run**.
- MetaMask prompts for a transaction — confirm.
- This calls `RunRegistry.executeRun(runId)`, which:
  - Verifies the run is approved and the vault has enough USDC
  - Pulls the total from the vault into the registry
  - Emits `RunExecuted(runId, paid, held, txData)`
- A confirmation card appears: `"September 2026 paid N of N. All lines settled."`
- An explorer link lets you see the transaction.

---

## Viewing Paystubs as an Employee

1. Click **Employee Portal** in the sidebar (or bottom nav on mobile).
2. Connect your wallet (can be any wallet — employees do not need the admin wallet).
3. Paste your Employee ID (the UUID the admin shared with you).
4. Click **View**.

Your salary decrypts locally in your browser using the org's secret key. Nothing is sent to any server. Other employees' amounts are not visible — the explorer only shows ciphered data.

---

## Testing the Privacy Model

Open the Arc Testnet explorer after a run executes:

- Transaction: https://explorer.testnet.arc.io  
  Search the tx hash shown after Execute.

**What the explorer shows:**
- `RunExecuted` event with `runId`, `paid` count, `held` count — no amounts, no names, no addresses.
- The vault `Pulled` event shows a total USDC amount moved to RunRegistry — no per-employee breakdown.

**What the explorer does NOT show:**
- Individual salary amounts (AES-GCM ciphered in `PaystubStore`)
- Employee wallet addresses (dest commitments are SHA-256 hashes, not addresses)
- Any name or email

---

## Testing Roles

The app currently hardcodes `isAdmin = true` (improvement item 2.4). To manually test role separation:

- **Maker test:** use one wallet to publish the roster root.
- **Checker test:** use a different wallet to sign approval. The contract enforces that only `checkerOf[orgId]` can call `approveRun` — if you try with the maker wallet and no checker is set, it uses the owner as checker by default.
- To set a real checker on-chain: call `OrgFactory.setChecker(orgId, checkerAddress)` from the owner wallet via the explorer Write tab.

---

## Quick Smoke Test Checklist

| # | Action | Expected result |
|---|---|---|
| 1 | Open app, not connected | Home shows "Connect your wallet" |
| 2 | Connect MetaMask on Arc Testnet | Wallet address shown in sidebar |
| 3 | Create org "Test Corp" | Org appears, org selector shows it |
| 4 | Add 2 employees | Both appear in Roster |
| 5 | Create run "Test Run" with amounts | Run appears with status "Draft" |
| 6 | Approve screen: Publish Roster Root | Tx confirmed, row 1 green |
| 7 | Attest Sanctions | Row 2 green |
| 8 | Sign Approval | Row 3 green |
| 9 | Execute Run | Success card, explorer link |
| 10 | Employee Portal: paste employee ID | Salary shown, others not |
| 11 | Open explorer with the tx hash | No salary amounts visible |

---

## Contract Addresses (Arc Testnet)

| Contract | Address |
|---|---|
| OrgFactory | `0x588aff9e646c88f4ad26f4fd961b8f15157a2bc7` |
| RunRegistry | `0xa1881be8a3a6a38762b197db7be05a17b39bd8eb` |
| PaystubStore | `0x03292b1ba7e146dec1d055bde23efe8a442a3db8` |
| StealthDistributor | `0xaca90c502ff9284d6ef1d320176bc7985089fe83` |
| USDC | `0x3600000000000000000000000000000000000000` |

Explorer: https://explorer.testnet.arc.io  
RPC: https://rpc.testnet.arc.io  
Chain ID: 5042002

---

## Known Limitations in This Build

- **On-chain org registration not yet called from UI** (critical gap 2.1): createOrg saves locally only. Fund and Execute will revert until registerOrg is wired. Workaround: call `OrgFactory.createOrg` directly from the explorer Write tab with your wallet address.
- **`setOrgFactory` must be called once** (see top of this guide).
- **No vault funding UI**: `fundVault` exists in code but has no button yet. Workaround: approve USDC spend and call `Vault.fund()` from the explorer.
- **Roles are not enforced in the UI** yet: all screens are visible to any connected wallet.
