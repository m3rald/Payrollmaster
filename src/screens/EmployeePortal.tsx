import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { UserCircle, Lock, ExternalLink, CheckCircle2, Clock, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { TxProgress } from '../components/ui/TxProgress'
import type { TxStep } from '../components/ui/TxProgress'
import { formatUsdc, runStatusColor, shortenAddress } from '../lib/utils'
import { buildTxExplorerUrl } from '../onchain-facts'
import { loadRuns, loadOrgs, getOrgSecret } from '../lib/store'
import { decryptAmount } from '../lib/crypto'
import { decodeClaimProof, buildMerkleRootWithProofs } from '../lib/merkle'
import { arcSettlement } from '../settlement/arc'
import type { Org } from '../types/payroll'

const ARC_TESTNET_ID = 5042002

interface ClaimEntry {
  runId: string
  runLabel: string
  lineIndex: number
  amount: string        // raw USDC units
  amountDisplay: string // decrypted display amount
  dest: string          // worker wallet address
  proof: string[]
  claimed: boolean
  txHash?: string
  orgId: string
}

export function EmployeePortal() {
  const { isConnected, address } = useAccount()

  // Parse ?claim= from URL — maker's deep link with proof embedded
  const urlClaim = (() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('claim')
    return raw ? decodeClaimProof(raw) : null
  })()

  const [entries, setEntries] = useState<ClaimEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [txSteps, setTxSteps] = useState<Record<string, TxStep>>({})
  const [txErrors, setTxErrors] = useState<Record<string, string>>({})

  // Derive a unique key per line
  const lineKey = (e: ClaimEntry) => `${e.runId}:${e.lineIndex}`

  const loadEntries = useCallback(async () => {
    if (!address) return
    try {
      const orgs: Org[] = loadOrgs()
      const results: ClaimEntry[] = []

      // Path A: URL-embedded claim proof (from maker's link)
      if (urlClaim) {
        // Verify the dest matches the connected wallet
        if (urlClaim.dest.toLowerCase() === address.toLowerCase()) {
          const claimed = await arcSettlement.isLineClaimed(urlClaim.runId, urlClaim.lineIndex)
          results.push({
            runId: urlClaim.runId,
            runLabel: urlClaim.runId.slice(0, 8) + '…',
            lineIndex: urlClaim.lineIndex,
            amount: urlClaim.amount,
            amountDisplay: formatUsdc(urlClaim.amount),
            dest: urlClaim.dest,
            proof: urlClaim.proof,
            claimed,
            orgId: '',
          })
        }
      }

      // Path B: Scan localStorage runs for lines where dest == connected wallet
      for (const org of orgs) {
        const secret = getOrgSecret(org.id)
        const runs = loadRuns(org.id)
        for (const run of runs) {
          if (run.status !== 'completed' && run.status !== 'partial') continue
          // Regenerate proofs from stored roster
          const { proofs } = buildMerkleRootWithProofs(run.id, run.lines)
          for (let i = 0; i < run.lines.length; i++) {
            const line = run.lines[i]
            const dest = line.dest ?? line.destCommitment
            if (dest.toLowerCase() !== address.toLowerCase()) continue
            // Already added via URL path?
            if (results.find(r => r.runId === run.id && r.lineIndex === i)) continue
            let amountDisplay = '—'
            if (secret) {
              try { amountDisplay = formatUsdc(await decryptAmount(secret, run.id, line.employeeId, line.amountCipher)) }
              catch { /* leave as — */ }
            }
            const claimed = await arcSettlement.isLineClaimed(run.id, i)
            results.push({
              runId: run.id,
              runLabel: run.label,
              lineIndex: i,
              amount: line.amountUsdc,
              amountDisplay,
              dest,
              proof: proofs[i]?.proof ?? [],
              claimed,
              txHash: run.txHash,
              orgId: org.id,
            })
          }
        }
      }

      setEntries(results)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load payroll data — check your connection and try again.')
    }
  }, [address, urlClaim?.runId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isConnected || !address) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    loadEntries().then(() => { if (!cancelled) setLoading(false) }).catch((err: unknown) => {
      if (!cancelled) {
        setLoading(false)
        setLoadError(err instanceof Error ? err.message : 'Failed to load payroll data.')
      }
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  async function handleClaim(entry: ClaimEntry) {
    const key = lineKey(entry)
    setTxSteps(s => ({ ...s, [key]: 'signing' }))
    setTxErrors(e => ({ ...e, [key]: '' }))
    try {
      setTxSteps(s => ({ ...s, [key]: 'broadcasting' }))
      const { txHash } = await arcSettlement.claimLine(
        entry.runId, entry.lineIndex, entry.amount, entry.dest, entry.proof
      )
      setTxSteps(s => ({ ...s, [key]: 'confirming' }))
      toast.success(`${formatUsdc(entry.amount)} USDC claimed!`)
      // Mark as claimed locally
      setEntries(prev => prev.map(e =>
        e.runId === entry.runId && e.lineIndex === entry.lineIndex
          ? { ...e, claimed: true, txHash }
          : e
      ))
      setTxSteps(s => ({ ...s, [key]: 'done' }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed'
      setTxErrors(e => ({ ...e, [key]: msg }))
      setTxSteps(s => ({ ...s, [key]: 'error' }))
      setTimeout(() => setTxSteps(s => ({ ...s, [key]: 'idle' })), 4000)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="size-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--surface-muted)' }}>
          <UserCircle className="size-8" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="display text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>Employee Portal</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
            Connect the wallet your employer added to the payroll roster to see and claim your USDC.
          </p>
        </div>
        <ConnectKitButton />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Employee Portal</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Showing payroll for <span className="font-mono">{shortenAddress(address!)}</span>
        </p>
      </div>

      {/* If a claim link was passed but dest doesn't match */}
      {urlClaim && urlClaim.dest.toLowerCase() !== address?.toLowerCase() && (
        <InnerCard>
          <div className="flex items-start gap-2">
            <UserCircle className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Wrong wallet</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                This claim link is for wallet <span className="font-mono">{shortenAddress(urlClaim.dest)}</span>.
                Switch to that wallet to claim.
              </p>
            </div>
          </div>
        </InnerCard>
      )}

      {loading && (
        <InnerCard className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Scanning payroll runs…</p>
        </InnerCard>
      )}

      {!loading && loadError && (
        <InnerCard>
          <div className="flex items-start gap-2">
            <Coins className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--error, #e53e3e)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Failed to load payroll data</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{loadError}</p>
              <button onClick={() => { void loadEntries() }}
                className="text-xs font-medium mt-2" style={{ color: 'var(--accent)' }}>
                Try again
              </button>
            </div>
          </div>
        </InnerCard>
      )}

      {!loading && !loadError && entries.length === 0 && (
        <InnerCard className="text-center py-8">
          <Coins className="size-8 mx-auto mb-3" style={{ color: 'var(--border-strong)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No payroll found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Make sure you're connected with the wallet address your employer added to the roster.
            If you received a claim link, open it directly.
          </p>
        </InnerCard>
      )}

      {entries.map(entry => {
        const key = lineKey(entry)
        const step = txSteps[key] ?? 'idle'
        const err = txErrors[key] ?? ''
        return (
          <Card key={key}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{entry.runLabel}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{shortenAddress(entry.dest)}</div>
              </div>
              <Badge
                label={entry.claimed ? 'Claimed' : 'Ready to claim'}
                color={entry.claimed ? runStatusColor('completed') : runStatusColor('approved')}
              />
            </div>

            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {entry.amountDisplay}
              </span>
              <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>

            {!entry.claimed && (
              <div className="flex items-start gap-2 mb-2 px-2 py-1.5 rounded-lg text-xs"
                style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
                <Coins className="size-3.5 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                <span>You need a small USDC balance on Arc Testnet to pay gas for this claim.</span>
              </div>
            )}
            {entry.claimed ? (
              <div className="flex items-center gap-2" style={{ color: 'var(--success)' }}>
                <CheckCircle2 className="size-4" />
                <span className="text-sm font-medium">Paid to your wallet</span>
                {entry.txHash && (
                  <a href={buildTxExplorerUrl(ARC_TESTNET_ID, entry.txHash)}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs ml-auto"
                    style={{ color: 'var(--accent-hover)' }}>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {step === 'idle' || step === 'error' ? (
                  <Button size="sm" onClick={() => { void handleClaim(entry) }}
                    disabled={step !== 'idle' && step !== 'error'}>
                    <Coins className="size-3.5 mr-1" />
                    Claim {formatUsdc(entry.amount)} USDC
                  </Button>
                ) : null}
                <TxProgress step={step} error={err} />
              </div>
            )}

            {entry.txHash && !entry.claimed && (
              <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                <Clock className="size-3" />
                <span>Run executed</span>
                <a href={buildTxExplorerUrl(ARC_TESTNET_ID, entry.txHash)}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 ml-auto"
                  style={{ color: 'var(--accent-hover)' }}>
                  Explorer <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </Card>
        )
      })}

      <InnerCard>
        <div className="flex items-start gap-2">
          <Lock className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Your wallet address is your identity. Only the wallet address added to the payroll roster can claim those funds — no one else can see or take your payment.
          </p>
        </div>
      </InnerCard>
    </div>
  )
}
