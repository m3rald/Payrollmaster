import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { UserCircle, Lock, ExternalLink } from 'lucide-react'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { formatUsdc, runStatusColor, formatDate } from '../lib/utils'
import { buildTxExplorerUrl } from '../onchain-facts'
import { loadRuns, loadOrgs, getOrgSecret } from '../lib/store'
import { decryptAmount } from '../lib/crypto'
import type { Org } from '../types/payroll'

const ARC_TESTNET_ID = 5042002

interface Paystub {
  runId: string
  label: string
  amountUsdc: string
  status: 'paid' | 'held' | 'pending'
  txHash?: string
  executedAt?: number
}

export function EmployeePortal() {
  const { isConnected } = useAccount()
  const [employeeId, setEmployeeId] = useState('')
  const [paystubs, setPaystubs] = useState<Paystub[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  async function fetchPaystubs() {
    if (!employeeId.trim()) return
    setLoading(true); setError('')
    try {
      const orgs: Org[] = loadOrgs()
      const results: Paystub[] = []
      for (const org of orgs) {
        const secret = getOrgSecret(org.id)
        if (!secret) continue
        const runs = loadRuns(org.id)
        for (const run of runs) {
          const line = run.lines.find(l => l.employeeId === employeeId.trim())
          if (!line) continue
          let amountUsdc = '0'
          try { amountUsdc = await decryptAmount(secret, run.id, employeeId.trim(), line.amountCipher) }
          catch { amountUsdc = '—' }
          const status = run.status === 'completed' ? 'paid' : run.status === 'partial' ? 'held' : 'pending'
          results.push({ runId: run.id, label: run.label, amountUsdc, status, txHash: run.txHash, executedAt: run.executedAt })
        }
      }
      setPaystubs(results)
      setSearched(true)
    } finally { setLoading(false) }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="size-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-muted)' }}>
          <UserCircle className="size-8" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="display text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>Employee Portal</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>Connect your wallet to view your paystubs.</p>
        </div>
        <ConnectKitButton />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Employee Portal</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>View your paystubs — amounts visible only to you</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="size-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Your Employee ID</span>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border-strong)', color: 'var(--ink)' }}
            placeholder="Paste your employee ID"
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
          />
          <Button size="sm" onClick={() => { void fetchPaystubs() }} loading={loading} disabled={!employeeId.trim()}>
            View
          </Button>
        </div>
        {error && <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      </Card>

      {searched && paystubs.length === 0 && (
        <InnerCard className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No paystubs found for this ID.</p>
        </InnerCard>
      )}

      {paystubs.map(p => (
        <Card key={p.runId}>
          <div className="flex items-start justify-between mb-3">
            <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{p.label}</div>
            <Badge label={p.status} color={runStatusColor(p.status)} />
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {p.amountUsdc === '—' ? '—' : formatUsdc(p.amountUsdc)}
            </span>
            <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
          {p.executedAt && (
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Paid on {formatDate(p.executedAt)}</p>
          )}
          {p.txHash && (
            <a
              href={buildTxExplorerUrl(ARC_TESTNET_ID, p.txHash)}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--accent-hover)' }}
            >
              View transaction <ExternalLink className="size-3" />
            </a>
          )}
        </Card>
      ))}

      <InnerCard>
        <div className="flex items-start gap-2">
          <Lock className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Your salary is encrypted. Only you can see your amount — not other employees, not the public explorer.
          </p>
        </div>
      </InnerCard>
    </div>
  )
}
