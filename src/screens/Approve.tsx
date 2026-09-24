import { useState } from 'react'
import { ShieldCheck, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ChecklistRow } from '../components/ui/ChecklistRow'
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

export function Approve({ org, runs, loading, onPublishRoster, onAttestSanctions, onApprove, onExecute }: ApproveProps) {
  const [selectedId, setSelectedId] = useState<string | null>(runs[0]?.id ?? null)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ paid: number; held: number; txHash: string } | null>(null)

  const run = runs.find(r => r.id === selectedId) ?? runs[0] ?? null

  const checks = run ? {
    rosterPublished: run.status !== 'draft',
    sanctionsAttested: run.sanctionsAttested,
    checkerSigned: !!run.checkerSig,
  } : null

  const allGreen = checks && checks.rosterPublished && checks.sanctionsAttested && checks.checkerSigned
  const canExecute = allGreen && run?.status === 'approved' && !executing

  async function handleExecute() {
    if (!run) return
    setExecuting(true)
    try {
      const r = await onExecute(run.id)
      setResult(r)
    } finally { setExecuting(false) }
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
              <ChecklistRow label="Checker signature bound to run" done={!!run.checkerSig} />
            </div>
          </Card>

          {/* Maker actions */}
          {run.status === 'draft' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Maker Step</h3>
              <Button size="lg" loading={loading} onClick={() => { void onPublishRoster(run.id) }}>
                Publish Roster Root On-Chain
              </Button>
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
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  Sign to approve this run. Your signature is bound to the roster root and run ID.
                </p>
                <Button size="sm" loading={loading} onClick={() => { void onApprove(run.id) }}>
                  Sign Approval
                </Button>
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
                <span className="text-base font-semibold">Run executed</span>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--ink)' }}>
                {result.paid > 0 && result.held === 0
                  ? `${run.label} paid ${result.paid} of ${result.paid}. All lines settled.`
                  : `${run.label} paid ${result.paid} of ${result.paid + result.held}. ${result.held} lines held for review.`
                }
              </p>
              <a
                href={buildTxExplorerUrl(ARC_TESTNET_ID, result.txHash)}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--accent-hover)' }}
              >
                View on explorer <ExternalLink className="size-3" />
              </a>
            </Card>
          ) : (
            <Button size="lg" onClick={() => { void handleExecute() }} loading={executing} disabled={!canExecute}>
              {allGreen ? 'Execute Run' : 'Complete checklist to execute'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
