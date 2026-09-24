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
const vaultAbi = parseAbi([
  'function fund(uint256 amount) external',
  'function balance() external view returns (uint256)',
])
const registryAbi = parseAbi([
  'function createRun(string orgId, string runId, bytes32 rosterRoot, uint256 totalAmount) external',
  'function approveRun(string runId, bytes checkerSig) external',
  'function executeRun(string runId) external returns (uint256 paid, uint256 held)',
])

const pub = createPublicClient({ chain: arcTestnet, transport: http() })

export class ArcSettlement implements Settlement {
  private wc: WalletClient | null = null
  setWalletClient(c: WalletClient) { this.wc = c }
  private w() { if (!this.wc) throw new Error('Wallet not connected'); return this.wc }
  private check() {
    if (!ORG_FACTORY || !RUN_REGISTRY)
      throw new Error('Contracts not deployed yet — deploy first and set VITE_ORG_FACTORY_ADDRESS + VITE_RUN_REGISTRY_ADDRESS in .env')
  }

  async registerOrg(orgId: string, name: string) {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const hash = await wc.writeContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'createOrg', args: [orgId, name, account], chain: arcTestnet, account })
    await pub.waitForTransactionReceipt({ hash })
    const vaultAddress = await pub.readContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'vaultOf', args: [orgId] })
    return { vaultAddress, txHash: hash }
  }

  async getVaultBalance(orgId: string): Promise<string> {
    if (!ORG_FACTORY) return '0'
    try {
      const vault = await pub.readContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'vaultOf', args: [orgId] })
      if (!vault || vault === '0x0000000000000000000000000000000000000000') return '0'
      const bal = await pub.readContract({ address: vault, abi: vaultAbi, functionName: 'balance' })
      return bal.toString()
    } catch { return '0' }
  }

  async fund(orgId: string, amountUsdc: string): Promise<FundResult> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const vault = await pub.readContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'vaultOf', args: [orgId] })
    const amount = BigInt(amountUsdc)
    const approveTx = await wc.writeContract({ address: usdcFact.address as Address, abi: erc20Abi, functionName: 'approve', args: [vault, amount], chain: arcTestnet, account })
    await pub.waitForTransactionReceipt({ hash: approveTx })
    const fundTx = await wc.writeContract({ address: vault, abi: vaultAbi, functionName: 'fund', args: [amount], chain: arcTestnet, account })
    const receipt = await pub.waitForTransactionReceipt({ hash: fundTx })
    if (receipt.status !== 'success') throw new Error('Fund tx reverted')
    const bal = await pub.readContract({ address: vault, abi: vaultAbi, functionName: 'balance' })
    return { txHash: fundTx, vaultBalance: bal.toString() }
  }

  async publishRosterRoot(runId: string, orgId: string, root: string, total: string) {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const hash = await wc.writeContract({ address: RUN_REGISTRY, abi: registryAbi, functionName: 'createRun', args: [orgId, runId, root as `0x${string}`, BigInt(total)], chain: arcTestnet, account })
    await pub.waitForTransactionReceipt({ hash })
    return { txHash: hash }
  }

  async approveRun(runId: string, sig: string) {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const hash = await wc.writeContract({ address: RUN_REGISTRY, abi: registryAbi, functionName: 'approveRun', args: [runId, sig as `0x${string}`], chain: arcTestnet, account })
    await pub.waitForTransactionReceipt({ hash })
    return { txHash: hash }
  }

  async executeRun(runId: string, orgId: string): Promise<ExecuteRunResult> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const hash = await wc.writeContract({ address: RUN_REGISTRY, abi: registryAbi, functionName: 'executeRun', args: [runId], chain: arcTestnet, account })
    const receipt = await pub.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error('Execute run reverted')
    const run = loadRun(orgId, runId)
    return { paid: run?.lines.length ?? 0, held: 0, txHash: hash }
  }

  async setMaker(orgId: string, makerAddress: string): Promise<{ txHash: string }> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const hash = await wc.writeContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'setMaker', args: [orgId, makerAddress as Address], chain: arcTestnet, account })
    await pub.waitForTransactionReceipt({ hash })
    return { txHash: hash }
  }

  async setChecker(orgId: string, checkerAddress: string): Promise<{ txHash: string }> {
    this.check()
    const wc = this.w()
    const [account] = await wc.getAddresses()
    const hash = await wc.writeContract({ address: ORG_FACTORY, abi: orgFactoryAbi, functionName: 'setChecker', args: [orgId, checkerAddress as Address], chain: arcTestnet, account })
    await pub.waitForTransactionReceipt({ hash })
    return { txHash: hash }
  }
}

export const arcSettlement = new ArcSettlement()
