import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ShieldCheck, AlertCircle, CheckCircle2, ExternalLink, Wallet, Link2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { buildMerkleRootWithProofs, encodeClaimProof } from '../lib/merkle'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ChecklistRow } from '../components/ui/ChecklistRow'
import { TxProgress } from '../components/ui/TxProgress'
import type { TxStep } from '../components/ui/TxProgress'
import { formatUsdc, runStatusLabel, runStatusColor, formatRelTime, shortenAddress } from '../lib/utils'
import { buildTxExplorerUrl } from '../onchain-facts'
import type { PayrollRun, Org } from '../types/payroll'

interface ApproveProps {
  org: Org | undefined
  runs: PayrollRun[]
  loading: boolean
  onPublishRoster: (runId: string) => Promise<void>
  onAttestSanctions: (runId: string) => void
  onApprove: (runId: string) => Promise<void>
  onExecute: (runId: string) => Promise<{ paid: number; held: number; txHash: string }>
}

const ARC_TESTNET_ID = 5042002

// Inline wallet-role warning banner
function WalletWarning({ needed, current }: { needed: string; current: string | undefined }) {
  const match = current?.toLowerCase() === needed.toLowerCase()
  if (match) return null
  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs mb-2"
      style={{ background: 'rgba(220,100,40,0.08)', border: '1px solid rgba(220,100,40,0.25)', color: 'var(--warning)' }}>
      <Wallet className="size-3.5 mt-0.5 shrink-0" />
      <span>
        This step requires wallet <span className="font-mono font-semibold">{shortenAddress(needed)}</span>.
        {current ? <> You have <span className="font-mono font-semibold">{shortenAddress(current)}</span> connected.</> : ' No wallet connected.'}
        {' '}Switch wallets before proceeding.
      </span>
    </div>
  )
}

export function Approve({ org, runs, loading, onPublishRoster, onAttestSanctions, onApprove, onExecute }: ApproveProps) {
  const { address } = useAccount()
  const [selectedId, setSelectedId] = useState<string | null>(runs[0]?.id ?? null)
  const [executeStep, setExecuteStep] = useState<TxStep>('idle')
  const [publishStep, setPublishStep] = useState<TxStep>('idle')
  const [approveStep, setApproveStep] = useState<TxStep>('idle')
  const [txError, setTxError] = useState('')
  const [result, setResult] = useState<{ paid: number; held: number; txHash: string } | null>(null)

  const run = runs.find(r => r.id === selectedId) ?? runs[0] ?? null

  const checks = run ? {
    rosterPublished: run.status !== 'draft',
    sanctionsAttested: run.sanctionsAttested,
    checkerSigned: !!run.checkerSig,
  } : null

  const allGreen = checks && checks.rosterPublished && checks.sanctionsAttested && checks.checkerSigned
  const canExecute = allGreen && run?.status === 'approved' && executeStep === 'idle'

  // Who should be connected for each step
  // Maker step: org.maker if set, else org.owner
  const makerWallet = org ? (org.maker ?? org.owner) : undefined
  // Checker step: org.checker (must be set)
  const checkerWallet = org?.checker
  // Execute step: org.owner
  const ownerWallet = org?.owner

  async function handlePublishRoster(runId: string) {
    setTxError('')
    setPublishStep('signing')
    try {
      setPublishStep('broadcasting')
      await onPublishRoster(runId)
      setPublishStep('done')
      setTimeout(() => setPublishStep('idle'), 2000)
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Transaction failed')
      setPublishStep('error')
      setTimeout(() => setPublishStep('idle'), 4000)
    }
  }

  async function handleExecute() {
    if (!run) return
    setTxError('')
    setExecuteStep('signing')
    try {
      setExecuteStep('broadcasting')
      const r = await onExecute(run.id)
      setExecuteStep('confirming')
      setResult(r)
      setExecuteStep('done')
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Transaction failed')
      setExecuteStep('error')
      setTimeout(() => setExecuteStep('idle'), 4000)
    }
  }

  if (!org) {
    return <InnerCard className="text-center py-10"><p className="text-sm" style={{ color: 'var(--muted)' }}>Select an organisation first.</p></InnerCard>
  }

  if (runs.length === 0) {
    return <InnerCard className="text-center py-10"><p className="text-sm" style={{ color: 'var(--muted)' }}>No runs yet — create one first.</p></InnerCard>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Approve & Execute</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Maker/checker flow · {org.name}</p>
      </div>

      {/* Run selector */}
      <div className="flex gap-2 flex-wrap">
        {runs.slice(0, 8).map(r => (
          <button key={r.id} onClick={() => { setSelectedId(r.id); setResult(null) }}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={selectedId === r.id
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }
            }>
            {r.label}
          </button>
        ))}
      </div>

      {run && (
        <>
          {/* Run summary */}
          <Card>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{run.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{run.lines.length} lines · {formatRelTime(run.createdAt)}</div>
              </div>
              <Badge label={runStatusLabel(run.status)} color={runStatusColor(run.status)} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatUsdc(run.totalUsdc)}</span>
              <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
          </Card>

          {/* One-click checklist */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>One-Click Checklist</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              <ChecklistRow label="Roster root published on-chain" done={run.status !== 'draft'} />
              <ChecklistRow label="Sanctions screen attested" done={run.sanctionsAttested} />
              <ChecklistRow label="Checker approved on-chain" done={!!run.checkerSig} />
            </div>
          </Card>

          {/* Maker actions */}
          {run.status === 'draft' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Maker Step</h3>
              {makerWallet && <WalletWarning needed={makerWallet} current={address} />}
              {publishStep === 'idle' || publishStep === 'error' ? (
                <Button size="lg" loading={loading}
                  disabled={!!makerWallet && address?.toLowerCase() !== makerWallet.toLowerCase()}
                  onClick={() => { void handlePublishRoster(run.id) }}>
                  Publish Roster Root On-Chain
                </Button>
              ) : null}
              <TxProgress step={publishStep} error={txError} />
            </div>
          )}

          {run.status !== 'draft' && !run.sanctionsAttested && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Sanctions</h3>
              <InnerCard>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="size-4" style={{ color: 'var(--warning)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Attest sanctions screen</span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  Confirm you have screened all payees against OFAC and other applicable lists.
                </p>
                <Button size="sm" onClick={() => onAttestSanctions(run.id)}>Attest Sanctions Clear</Button>
              </InnerCard>
            </div>
          )}

          {/* Checker approval */}
          {run.status === 'roster_published' && run.sanctionsAttested && !run.checkerSig && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Checker Step</h3>
              <InnerCard>
                {checkerWallet
                  ? <WalletWarning needed={checkerWallet} current={address} />
                  : <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs mb-2"
                      style={{ background: 'rgba(220,100,40,0.08)', border: '1px solid rgba(220,100,40,0.25)', color: 'var(--warning)' }}>
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>No checker assigned — set one in Org Settings first.</span>
                    </div>
                }
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  Sign to approve this run. Your signature is bound on-chain — this transaction is required before Execute Run will succeed.
                </p>
                {approveStep === 'idle' || approveStep === 'error' ? (
                  <Button size="sm" loading={loading}
                    disabled={!checkerWallet || address?.toLowerCase() !== checkerWallet.toLowerCase()}
                    onClick={() => {
                    setApproveStep('signing')
                    setTxError('')
                    onApprove(run.id)
                      .then(() => { setApproveStep('done'); setTimeout(() => setApproveStep('idle'), 2000) })
                      .catch((e: unknown) => {
                        setTxError(e instanceof Error ? e.message : 'Approval failed')
                        setApproveStep('error')
                        setTimeout(() => setApproveStep('idle'), 4000)
                      })
                    setApproveStep('broadcasting')
                  }}>
                    Sign & Approve On-Chain
                  </Button>
                ) : null}
                <TxProgress step={approveStep} error={txError} />
              </InnerCard>
            </div>
          )}

          {run.checkerSig && (
            <InnerCard>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--success)' }}>
                <CheckCircle2 className="size-4" />
                <span>Approved by {run.checkerAddress ? shortenAddress(run.checkerAddress) : 'checker'}</span>
              </div>
            </InnerCard>
          )}

          {/* Execute */}
          {result ? (
            <Card>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success)' }}>
                <CheckCircle2 className="size-5" />
                <span className="text-base font-semibold">Run executed — share claim links</span>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                USDC is now held in the contract. Each employee must claim their line using the link below — it pre-fills their proof so they just connect their wallet and click Claim.
              </p>
              <a
                href={buildTxExplorerUrl(ARC_TESTNET_ID, result.txHash)}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium mb-4"
                style={{ color: 'var(--accent-hover)' }}
              >
                View on explorer <ExternalLink className="size-3" />
              </a>
              {/* Generate claim links for every line */}
              {(() => {
                const { proofs } = buildMerkleRootWithProofs(run.id, run.lines)
                return (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
                      Claim links — send each to the worker
                    </div>
                    {proofs.map((cp, i) => {
                      const encoded = encodeClaimProof(cp)
                      const base = window.location.origin + window.location.pathname
                      const url = `${base}?claim=${encoded}&tab=employee-portal`
                      const emp = run.lines[i]
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: 'var(--ink)' }}>
                              {emp.employeeId}
                            </div>
                            <div className="text-xs font-mono truncate" style={{ color: 'var(--subtle)' }}>
                              {shortenAddress(cp.dest)}
                            </div>
                          </div>
                          <button
                            onClick={() => { void navigator.clipboard.writeText(url).then(() => toast.success('Claim link copied')) }}
                            className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                            style={{ background: 'var(--surface-strong)', color: 'var(--accent)' }}
                          >
                            <Copy className="size-3" /> Copy
                          </button>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => {
                        const { proofs: ps } = buildMerkleRootWithProofs(run.id, run.lines)
                        const base = window.location.origin + window.location.pathname
                        const all = ps.map((cp, i) => `${run.lines[i].employeeId}: ${base}?claim=${encodeClaimProof(cp)}&tab=employee-portal`).join('\n')
                        void navigator.clipboard.writeText(all).then(() => toast.success('All claim links copied'))
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium mt-1"
                      style={{ color: 'var(--accent-hover)' }}
                    >
                      <Link2 className="size-3" /> Copy all links
                    </button>
                  </div>
                )
              })()}
            </Card>
          ) : (
            <div className="space-y-3">
              {ownerWallet && <WalletWarning needed={ownerWallet} current={address} />}
              {executeStep === 'idle' || executeStep === 'error' ? (
                <Button size="lg" onClick={() => { void handleExecute() }}
                  disabled={!canExecute || (!!ownerWallet && address?.toLowerCase() !== ownerWallet.toLowerCase())}>
                  {allGreen ? 'Execute Run' : 'Complete checklist to execute'}
                </Button>
              ) : null}
              <TxProgress step={executeStep} error={txError} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
