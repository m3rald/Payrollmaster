import { createPublicClient, http, erc20Abi, parseAbi, type Address, type WalletClient } from 'viem'
import { arcTestnet } from 'viem/chains'
import type { Settlement, FundResult, ExecuteRunResult } from './types'
import { loadRun } from '../lib/store'
import { getUsdc } from '../onchain-facts'

const CHAIN_ID = 5042002
const usdcFact = getUsdc(CHAIN_ID)!

const ORG_FACTORY = (import.meta.env.VITE_ORG_FACTORY_ADDRESS ?? '') as Address
const RUN_REGISTRY = (import.meta.env.VITE_RUN_REGISTRY_ADDRESS ?? '') as Address

const orgFactoryAbi = parseAbi([
  'function createOrg(string orgId, string name, address owner) external returns (address vault)',
  'function vaultOf(string orgId) external view returns (address)',
  'function setMaker(string orgId, address maker) external',
  'function setChecker(string orgId, address checker) external',
])
const runRegistryAdminAbi = parseAbi([
  'function setOrgFactory(address _orgFactory) external',
  'function orgFactory() external view returns (address)',
  'function deployer() external view returns (address)',
])
const vaultAbi = parseAbi([
  'function fund(uint256 amount) external',
  'function withdraw(uint256 amount) external',
  'function balance() external view returns (uint256)',
  'function owner() external view returns (address)',
])
const orgFactoryEventsAbi = parseAbi([
  'event OrgCreated(string indexed orgId, address owner, address vault)',
])
const registryAbi = parseAbi([
  'function createRun(string orgId, string runId, bytes32 rosterRoot, uint256 totalAmount) external',
  'function approveRun(string runId, bytes checkerSig) external',
  'function executeRun(string runId) external returns (uint256 paid, uint256 held)',
  'function claimLine(string runId, uint256 lineIndex, uint256 amount, address dest, bytes32[] proof) external',
  'function claimed(string runId, uint256 lineIndex) external view returns (bool)',
])

// General-purpose read client (balance queries, vaultOf, etc.)
const pub = createPublicClient({ chain: arcTestnet, transport: http() })

// Dedicated receipt-polling client with a long timeout.
// Keeping it separate means a gas-price timeout never cancels an in-flight receipt wait.
const receiptClient = createPublicClient({
  chain: arcTestnet,
  transport: http(undefined, { timeout: 120_000 }),
})

// Fetch gas price with a short timeout + one retry so a slow RPC
// never blocks tx submission. Falls back to a safe static value.
async function arcGasPrice(): Promise<bigint> {
  for (let i = 0; i < 2; i++) {
    try {
      const c = createPublicClient({ chain: arcTestnet, transport: http(undefined, { timeout: 5_000 }) })
      const gp = await c.getGasPrice()
      return (gp * 120n) / 100n   // +20% headroom
    } catch { /* retry once */ }
  }
  return 30_000_000_000n   // 30 gwei static fallback
}

// Estimate gas for a contract call and add 30% headroom.
// Falls back to the provided default if estimation fails (e.g. wallet doesn't support eth_estimateGas).
async function estimateGas(
  params: Parameters<typeof pub.estimateContractGas>[0],
  fallback: bigint
): Promise<bigint> {
  try {
    const est = await pub.estimateContractGas(params)
    return (est * 130n) / 100n
  } catch {
    return fallback
  }
}

// Wait for receipt using the long-timeout client so block confirmation
// never races against an unrelated RPC abort.
async function waitReceipt(hash: `0x${string}`) {
  return receiptClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
}

export class ArcSettlement implements Settlement {
  private wc: WalletClient | null = null
  setWalletClient(c: WalletClient) { this.wc = c }
  private w() { if (!this.wc) throw new Error('Wallet not connected'); return this.wc }
  private check() {
    if (!ORG_FACTORY || !RUN_REGISTRY)
      throw new Error('Contracts not deployed yet — set VITE_ORG_FACTORY_ADDRESS + VITE_RUN_REGISTRY_ADDRESS in .env')
  }

  async registerOrg(orgId: string, name: string) {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const gasPrice = await arcGasPrice()
    // createOrg deploys a new Vault inline — needs a generous gas limit
    const hash = await wc.writeContract({
      address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'createOrg',
      args: [orgId, name, account], chain: arcTestnet, account,
      gas: 3_000_000n, gasPrice,
    })
    await waitReceipt(hash)
    const vaultAddress = await pub.readContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'vaultOf', args: [orgId] })
    return { vaultAddress, txHash: hash }
  }

  async getVaultBalance(orgId: string): Promise<string> {
    if (!ORG_FACTORY) return '0'
    try {
      const vault = await this.resolveVault(orgId).catch(() => null)
      if (!vault) return '0'
      const bal = await pub.readContract({ address: vault, abi: vaultAbi, functionName: 'balance' })
      return bal.toString()
    } catch { return '0' }
  }

  // Resolve vault address: prefer localStorage (always correct) over vaultOf() which
  // returns zero for orgs created through a previous OrgFactory deployment.
  private async resolveVault(orgId: string): Promise<Address> {
    const { loadOrg } = await import('../lib/store')
    const stored = loadOrg(orgId)?.vaultAddress as Address | undefined
    if (stored && stored !== '0x0000000000000000000000000000000000000000') return stored
    // Fallback to on-chain lookup
    const vault = await pub.readContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'vaultOf', args: [orgId] })
    if (!vault || vault === '0x0000000000000000000000000000000000000000')
      throw new Error('Vault not found — org may not be registered yet. Try the "Register now" button.')
    return vault
  }

  async fund(orgId: string, amountUsdc: string): Promise<FundResult> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const vault = await this.resolveVault(orgId)
    const amount = BigInt(amountUsdc)
    const [gasPrice, approveGas, fundGas] = await Promise.all([
      arcGasPrice(),
      estimateGas({ address: usdcFact.address as Address, abi: erc20Abi, functionName: 'approve', args: [vault, amount], account }, 80_000n),
      estimateGas({ address: vault, abi: vaultAbi, functionName: 'fund', args: [amount], account }, 100_000n),
    ])
    const approveTx = await wc.writeContract({
      address: usdcFact.address as Address, abi: erc20Abi, functionName: 'approve',
      args: [vault, amount], chain: arcTestnet, account, gasPrice, gas: approveGas,
    })
    await waitReceipt(approveTx)
    const fundTx = await wc.writeContract({
      address: vault, abi: vaultAbi, functionName: 'fund',
      args: [amount], chain: arcTestnet, account, gasPrice, gas: fundGas,
    })
    const receipt = await waitReceipt(fundTx)
    if (receipt.status !== 'success') throw new Error('Fund tx reverted')
    const bal = await pub.readContract({ address: vault, abi: vaultAbi, functionName: 'balance' })
    return { txHash: fundTx, vaultBalance: bal.toString() }
  }

  async publishRosterRoot(runId: string, orgId: string, root: string, total: string) {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const [gasPrice, gas] = await Promise.all([
      arcGasPrice(),
      estimateGas({
        address: RUN_REGISTRY, abi: registryAbi, functionName: 'createRun',
        args: [orgId, runId, root as `0x${string}`, BigInt(total)], account,
      }, 300_000n),
    ])
    const hash = await wc.writeContract({
      address: RUN_REGISTRY, abi: registryAbi, functionName: 'createRun',
      args: [orgId, runId, root as `0x${string}`, BigInt(total)],
      chain: arcTestnet, account, gasPrice, gas,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  async approveRun(runId: string, sig: string) {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const [gasPrice, gas] = await Promise.all([
      arcGasPrice(),
      estimateGas({
        address: RUN_REGISTRY, abi: registryAbi, functionName: 'approveRun',
        args: [runId, sig as `0x${string}`], account,
      }, 100_000n),
    ])
    const hash = await wc.writeContract({
      address: RUN_REGISTRY, abi: registryAbi, functionName: 'approveRun',
      args: [runId, sig as `0x${string}`],
      chain: arcTestnet, account, gasPrice, gas,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  async executeRun(runId: string, orgId: string): Promise<ExecuteRunResult> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const [gasPrice, gas] = await Promise.all([
      arcGasPrice(),
      estimateGas({
        address: RUN_REGISTRY, abi: registryAbi, functionName: 'executeRun',
        args: [runId], account,
      }, 200_000n),
    ])
    const hash = await wc.writeContract({
      address: RUN_REGISTRY, abi: registryAbi, functionName: 'executeRun',
      args: [runId], chain: arcTestnet, account, gasPrice, gas,
    })
    const receipt = await waitReceipt(hash)
    if (receipt.status !== 'success') throw new Error('Execute run reverted')
    const run = loadRun(orgId, runId)
    return { paid: run?.lines.length ?? 0, held: 0, txHash: hash }
  }

  async withdrawVault(orgId: string, amountUsdc: string): Promise<{ txHash: string }> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const gasPrice = await arcGasPrice()
    const vault = await this.resolveVault(orgId)

    // Simulate first — old vault deployments don't have withdraw().
    // If the simulation reverts with no revert data, the function doesn't exist in that bytecode.
    try {
      await pub.simulateContract({
        address: vault, abi: vaultAbi, functionName: 'withdraw',
        args: [BigInt(amountUsdc)], account,
      })
    } catch (simErr: unknown) {
      const msg = simErr instanceof Error ? simErr.message : String(simErr)
      // No revert data = function selector not found (old vault bytecode without withdraw)
      if (msg.includes('execution reverted') && !msg.includes('NotOwner') && !msg.includes('ZeroAmount') && !msg.includes('InsufficientBalance')) {
        throw new Error(
          'This vault was deployed before withdraw was added. ' +
          'Create a new org through the current app — new vaults support withdraw. ' +
          'To recover funds from this vault, use the Contracts panel and call pull() via RunRegistry.'
        )
      }
      throw simErr
    }

    const hash = await wc.writeContract({
      address: vault, abi: vaultAbi, functionName: 'withdraw',
      args: [BigInt(amountUsdc)], chain: arcTestnet, account, gasPrice,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  // Scan OrgCreated events to find all orgs owned by a given address.
  // Used to restore org state when a user connects a different wallet or a new browser.
  async getOrgsForAddress(ownerAddress: string): Promise<Array<{ orgId: string; vaultAddress: string }>> {
    if (!ORG_FACTORY) return []
    try {
      const logs = await pub.getLogs({
        address: ORG_FACTORY,
        event: orgFactoryEventsAbi[0],
        fromBlock: 0n,
        toBlock: 'latest',
      })
      const results: Array<{ orgId: string; vaultAddress: string }> = []
      for (const log of logs) {
        const args = log.args as { orgId?: string; owner?: string; vault?: string }
        if (args.owner?.toLowerCase() === ownerAddress.toLowerCase() && args.orgId && args.vault) {
          results.push({ orgId: args.orgId, vaultAddress: args.vault })
        }
      }
      return results
    } catch { return [] }
  }

  async setMaker(orgId: string, makerAddress: string): Promise<{ txHash: string }> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const [gasPrice, gas] = await Promise.all([
      arcGasPrice(),
      estimateGas({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'setMaker', args: [orgId, makerAddress as Address], account }, 80_000n),
    ])
    const hash = await wc.writeContract({
      address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'setMaker',
      args: [orgId, makerAddress as Address], chain: arcTestnet, account, gasPrice, gas,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  async setChecker(orgId: string, checkerAddress: string): Promise<{ txHash: string }> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const [gasPrice, gas] = await Promise.all([
      arcGasPrice(),
      estimateGas({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'setChecker', args: [orgId, checkerAddress as Address], account }, 80_000n),
    ])
    const hash = await wc.writeContract({
      address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'setChecker',
      args: [orgId, checkerAddress as Address], chain: arcTestnet, account, gasPrice, gas,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  // One-time admin: call setOrgFactory on RunRegistry to point it at the current OrgFactory.
  // Only the original deployer wallet can call this. Safe to expose — the contract itself enforces it.
  async fixRegistryWiring(): Promise<{ txHash: string }> {
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const gasPrice = await arcGasPrice()
    const hash = await wc.writeContract({
      address: RUN_REGISTRY, abi: runRegistryAdminAbi, functionName: 'setOrgFactory',
      args: [ORG_FACTORY], chain: arcTestnet, account, gasPrice,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  async claimLine(runId: string, lineIndex: number, amount: string, dest: string, proof: string[]): Promise<{ txHash: string }> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    // Simulate first to catch InvalidProof / AlreadyClaimed / InvalidDestination before sending
    await pub.simulateContract({
      address: RUN_REGISTRY, abi: registryAbi, functionName: 'claimLine',
      args: [runId, BigInt(lineIndex), BigInt(amount), dest as Address, proof as `0x${string}`[]],
      account,
    })
    const [gasPrice, gas] = await Promise.all([
      arcGasPrice(),
      estimateGas({
        address: RUN_REGISTRY, abi: registryAbi, functionName: 'claimLine',
        args: [runId, BigInt(lineIndex), BigInt(amount), dest as Address, proof as `0x${string}`[]],
        account,
      }, 150_000n),
    ])
    const hash = await wc.writeContract({
      address: RUN_REGISTRY, abi: registryAbi, functionName: 'claimLine',
      args: [runId, BigInt(lineIndex), BigInt(amount), dest as Address, proof as `0x${string}`[]],
      chain: arcTestnet, account, gasPrice, gas,
    })
    await waitReceipt(hash)
    return { txHash: hash }
  }

  async isLineClaimed(runId: string, lineIndex: number): Promise<boolean> {
    if (!RUN_REGISTRY) return false
    try {
      return await pub.readContract({
        address: RUN_REGISTRY, abi: registryAbi, functionName: 'claimed',
        args: [runId, BigInt(lineIndex)],
      })
    } catch { return false }
  }

  // Check whether RunRegistry already points at the correct OrgFactory
  async isWiringCorrect(): Promise<boolean> {
    if (!RUN_REGISTRY || !ORG_FACTORY) return false
    try {
      const current = await pub.readContract({
        address: RUN_REGISTRY, abi: runRegistryAdminAbi, functionName: 'orgFactory',
      })
      return current.toLowerCase() === ORG_FACTORY.toLowerCase()
    } catch { return false }
  }
}

export const arcSettlement = new ArcSettlement()
