import { useState, useEffect, useCallback } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { toast } from 'sonner'
import type { Org, Employee, PayrollRun } from '../types/payroll'
import {
  saveOrg, loadOrgs, saveEmployee, loadEmployees, removeEmployee,
  saveRun, loadRuns, loadRun, setActiveOrg, getActiveOrg, setOrgSecret, getOrgSecret,
} from '../lib/store'
import { buildMerkleRoot } from '../lib/merkle'
import { encryptAmount, viewTag, destCommitment, generateOrgSecret } from '../lib/crypto'
import { generateId, parseUsdcInput } from '../lib/utils'
import { arcSettlement } from '../settlement/arc'
import type { ExecuteRunResult } from '../settlement/types'

export function usePayroll() {
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const [orgs, setOrgs] = useState<Org[]>(() => loadOrgs())
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => getActiveOrg())
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const active = getActiveOrg()
    return active ? loadEmployees(active) : []
  })
  const [runs, setRuns] = useState<PayrollRun[]>(() => {
    const active = getActiveOrg()
    return active ? loadRuns(active) : []
  })
  const [loading, setLoading] = useState(false)

  // Wire wallet client into the settlement adapter whenever it changes
  useEffect(() => { if (walletClient) arcSettlement.setWalletClient(walletClient) }, [walletClient])

  const selectOrg = useCallback((id: string) => {
    setActiveOrg(id)
    setActiveOrgIdState(id)
    setEmployees(loadEmployees(id))
    setRuns(loadRuns(id))
  }, [])

  const createOrg = useCallback(async (name: string): Promise<Org> => {
    if (!address) throw new Error('Connect wallet first')
    const id = generateId()
    setOrgSecret(id, generateOrgSecret())
    // Optimistically save locally so the UI responds immediately
    const org: Org = { id, name, owner: address, createdAt: Date.now() }
    saveOrg(org)
    setActiveOrg(id)
    setActiveOrgIdState(id)
    setOrgs(loadOrgs())
    setEmployees([])
    setRuns([])
    // Register on-chain — creates the Vault and links orgId → vaultAddress
    setLoading(true)
    try {
      const { vaultAddress, txHash } = await arcSettlement.registerOrg(id, name)
      const updated: Org = { ...org, vaultAddress }
      saveOrg(updated)
      setOrgs(loadOrgs())
      toast.success('Organisation registered on-chain')
      void txHash
      return updated
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'On-chain registration failed')
      // Return the local org even if chain call failed so user can retry
      return org
    } finally {
      setLoading(false)
    }
  }, [address])

  const addEmployee = useCallback((displayName: string, email?: string): Employee => {
    if (!activeOrgId) throw new Error('No active org')
    const emp: Employee = { id: generateId(), orgId: activeOrgId, displayName, email, active: true }
    saveEmployee(emp)
    setEmployees(prev => [...prev, emp])
    return emp
  }, [activeOrgId])

  const deleteEmployee = useCallback((eid: string) => {
    if (!activeOrgId) return
    removeEmployee(activeOrgId, eid)
    setEmployees(prev => prev.filter(e => e.id !== eid))
  }, [activeOrgId])

  const createRun = useCallback(async (
    label: string,
    lines: Array<{ employeeId: string; amountDollars: string }>
  ): Promise<PayrollRun> => {
    if (!activeOrgId) throw new Error('No active org')
    const secret = getOrgSecret(activeOrgId)
    if (!secret) throw new Error('Org secret missing')
    setLoading(true)
    try {
      const runId = generateId()
      const payrollLines = await Promise.all(lines.map(async ({ employeeId, amountDollars }) => {
        const amountUsdc = parseUsdcInput(amountDollars)
        const stealthDest = '0x' + Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256',
            new TextEncoder().encode(`${secret}:${runId}:${employeeId}:stealth`)))
        ).map(b => b.toString(16).padStart(2, '0')).join('')
        const dc = await destCommitment(stealthDest, employeeId)
        const cipher = await encryptAmount(secret, runId, employeeId, amountUsdc)
        return { employeeId, amountUsdc, destCommitment: dc, amountCipher: cipher, viewTag: viewTag(cipher) }
      }))
      const totalUsdc = payrollLines.reduce((s, l) => s + BigInt(l.amountUsdc), 0n).toString()
      const rosterRoot = buildMerkleRoot(payrollLines)
      const run: PayrollRun = {
        id: runId, orgId: activeOrgId, label, lines: payrollLines,
        totalUsdc, rosterRoot, sanctionsAttested: false, status: 'draft',
        paidCount: 0, heldCount: 0, createdAt: Date.now(),
      }
      saveRun(run)
      setRuns(prev => [run, ...prev])
      return run
    } finally { setLoading(false) }
  }, [activeOrgId])

  const publishRosterRoot = useCallback(async (runId: string): Promise<void> => {
    if (!activeOrgId) return
    const run = loadRun(activeOrgId, runId)
    if (!run) return
    setLoading(true)
    try {
      const { txHash } = await arcSettlement.publishRosterRoot(runId, activeOrgId, run.rosterRoot, run.totalUsdc)
      const updated = { ...run, status: 'roster_published' as const, txHash }
      saveRun(updated); setRuns(prev => prev.map(r => r.id === runId ? updated : r))
      toast.success('Roster root published on-chain')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed')
    } finally { setLoading(false) }
  }, [activeOrgId])

  const attestSanctions = useCallback((runId: string) => {
    if (!activeOrgId) return
    const run = loadRun(activeOrgId, runId)
    if (!run) return
    const updated = { ...run, sanctionsAttested: true }
    saveRun(updated); setRuns(prev => prev.map(r => r.id === runId ? updated : r))
  }, [activeOrgId])

  const approveRun = useCallback(async (runId: string): Promise<void> => {
    if (!activeOrgId || !walletClient || !address) throw new Error('Wallet not connected')
    const run = loadRun(activeOrgId, runId)
    if (!run) throw new Error('Run not found')
    setLoading(true)
    try {
      const sig = await walletClient.signMessage({
        account: address,
        message: `payroll-master:approve:${runId}:${run.rosterRoot}`,
      })
      const updated = { ...run, status: 'approved' as const, checkerSig: sig, checkerAddress: address }
      saveRun(updated); setRuns(prev => prev.map(r => r.id === runId ? updated : r))
      toast.success('Run approved')
    } finally { setLoading(false) }
  }, [activeOrgId, walletClient, address])

  const executeRun = useCallback(async (runId: string): Promise<ExecuteRunResult> => {
    if (!activeOrgId) throw new Error('No active org')
    const run = loadRun(activeOrgId, runId)
    if (!run) throw new Error('Run not found')
    setLoading(true)
    try {
      const result = await arcSettlement.executeRun(runId, activeOrgId)
      const status = result.held > 0 ? 'partial' as const : 'completed' as const
      const updated = { ...run, status, txHash: result.txHash, paidCount: result.paid, heldCount: result.held, executedAt: Date.now() }
      saveRun(updated); setRuns(prev => prev.map(r => r.id === runId ? updated : r))
      return result
    } finally { setLoading(false) }
  }, [activeOrgId])

  const fundVault = useCallback(async (amountDollars: string): Promise<void> => {
    if (!activeOrgId) throw new Error('No active org')
    setLoading(true)
    try {
      const amountUsdc = parseUsdcInput(amountDollars)
      await arcSettlement.fund(activeOrgId, amountUsdc)
      toast.success('Vault funded')
    } finally { setLoading(false) }
  }, [activeOrgId])

  const setMaker = useCallback(async (makerAddress: string): Promise<void> => {
    if (!activeOrgId) throw new Error('No active org')
    setLoading(true)
    try {
      await arcSettlement.setMaker(activeOrgId, makerAddress)
      const orgsNow = loadOrgs()
      const idx = orgsNow.findIndex(o => o.id === activeOrgId)
      if (idx >= 0) { orgsNow[idx] = { ...orgsNow[idx], maker: makerAddress }; saveOrg(orgsNow[idx]) }
      setOrgs(loadOrgs())
      toast.success('Maker assigned on-chain')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Set maker failed')
    } finally { setLoading(false) }
  }, [activeOrgId])

  const setChecker = useCallback(async (checkerAddress: string): Promise<void> => {
    if (!activeOrgId) throw new Error('No active org')
    setLoading(true)
    try {
      await arcSettlement.setChecker(activeOrgId, checkerAddress)
      const orgsNow = loadOrgs()
      const idx = orgsNow.findIndex(o => o.id === activeOrgId)
      if (idx >= 0) { orgsNow[idx] = { ...orgsNow[idx], checker: checkerAddress }; saveOrg(orgsNow[idx]) }
      setOrgs(loadOrgs())
      toast.success('Checker assigned on-chain')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Set checker failed')
    } finally { setLoading(false) }
  }, [activeOrgId])

  return {
    orgs,
    activeOrgId,
    activeOrg: orgs.find(o => o.id === activeOrgId),
    employees, runs, loading,
    selectOrg, createOrg, addEmployee, deleteEmployee,
    createRun, publishRosterRoot, attestSanctions, approveRun, executeRun, fundVault,
    setMaker, setChecker,
  }
}
