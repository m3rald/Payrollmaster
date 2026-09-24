import { useState } from 'react'
import { Eye, Lock, ExternalLink, AlertTriangle } from 'lucide-react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { formatUsdc, runStatusLabel, runStatusColor, formatDate, shortenAddress } from '../lib/utils'
import { buildTxExplorerUrl } from '../onchain-facts'
import { loadEmployees, getOrgSecret } from '../lib/store'
import { decryptAmount } from '../lib/crypto'
import type { Org, PayrollRun } from '../types/payroll'

const ARC_TESTNET_ID = 5042002

interface DecryptedLine {
  employeeId: string
  displayName: string
  amountUsdc: string
  destCommitment: string
}

interface AuditorDeskProps {
  org: Org | undefined
  runs: PayrollRun[]
}

export function AuditorDesk({ org, runs }: AuditorDeskProps) {
  const { isConnected } = useAccount()
  const [viewKey, setViewKey] = useState('')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(runs[0]?.id ?? null)
  const [decryptedLines, setDecryptedLines] = useState<DecryptedLine[] | null>(null)
  const [decrypting, setDecrypting] = useState(false)
  const [error, setError] = useState('')

  const run = runs.find(r => r.id === selectedRunId) ?? runs[0] ?? null

  async function handleDecrypt() {
    if (!org || !run || !viewKey.trim()) return
    setDecrypting(true)
    setError('')
    try {
      const secret = viewKey.trim()
      const employees = loadEmployees(org.id)
      const lines: DecryptedLine[] = await Promise.all(
        run.lines.map(async (line) => {
          const emp = employees.find(e => e.id === line.employeeId)
          let amountUsdc = '—'
          try { amountUsdc = await decryptAmount(secret, run.id, line.employeeId, line.amountCipher) }
          catch { /* wrong key — stays as — */ }
          return {
            employeeId: line.employeeId,
            displayName: emp?.displayName ?? shortenAddress(line.employeeId),
            amountUsdc,
            destCommitment: line.destCommitment,
          }
        })
      )
      const anyDecrypted = lines.some(l => l.amountUsdc !== '—')
      if (!anyDecrypted) {
        setError('Could not decrypt any lines. Check the view key.')
        setDecryptedLines(null)
      } else {
        setDecryptedLines(lines)
      }
    } finally { setDecrypting(false) }
  }

  // If org owner is viewing, pre-fill from localStorage secret
  function useOrgSecret() {
    const secret = getOrgSecret(org?.id ?? '')
    if (secret) setViewKey(secret)
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="size-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-muted)' }}>
          <Eye className="size-8" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="display text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>Auditor Desk</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
            Connect your wallet to access auditor view.
          </p>
        </div>
        <ConnectKitButton />
      </div>
    )
  }

  if (!org) {
    return (
      <InnerCard className="text-center py-10">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Select an organisation first.</p>
      </InnerCard>
    )
  }

  if (runs.length === 0) {
    return (
      <InnerCard className="text-center py-10">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>No runs to audit yet.</p>
      </InnerCard>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Auditor Desk</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Decrypt and review a run · {org.name}</p>
      </div>

      {/* Privacy notice */}
      <InnerCard>
        <div className="flex items-start gap-2">
          <Lock className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Salary amounts are AES-GCM encrypted. To read them, provide the org view key.
            The org owner can find the key in their browser (or share it securely via out-of-band channel for a time-boxed audit).
            Nothing is sent to any server — decryption happens locally.
          </p>
        </div>
      </InnerCard>

      {/* Run selector */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Select Run</h2>
        <div className="flex gap-2 flex-wrap">
          {runs.slice(0, 10).map(r => (
            <button key={r.id} onClick={() => { setSelectedRunId(r.id); setDecryptedLines(null) }}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={selectedRunId === r.id
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }
              }>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {run && (
        <>
          {/* Run summary */}
          <Card>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{run.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {run.lines.length} lines · {formatUsdc(run.totalUsdc)} USDC
                  {run.executedAt && ` · paid ${formatDate(run.executedAt)}`}
                </div>
              </div>
              <Badge label={runStatusLabel(run.status)} color={runStatusColor(run.status)} />
            </div>
            {run.txHash && (
              <a href={buildTxExplorerUrl(ARC_TESTNET_ID, run.txHash)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--accent-hover)' }}>
                View on explorer <ExternalLink className="size-3" />
              </a>
            )}
          </Card>

          {/* View key input */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="size-4" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>View Key</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Org view key (hex)"
                placeholder="Paste the 64-character view key"
                value={viewKey}
                onChange={e => setViewKey(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { void handleDecrypt() }} loading={decrypting} disabled={!viewKey.trim()}>
                  Decrypt Run
                </Button>
                <Button size="sm" variant="ghost" onClick={useOrgSecret}>
                  Use my org key
                </Button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                  <AlertTriangle className="size-3.5" />
                  {error}
                </div>
              )}
            </div>
          </Card>

          {/* Decrypted table */}
          {decryptedLines && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Eye className="size-4" style={{ color: 'var(--success)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Decrypted Lines — {run.label}
                </h2>
              </div>
              <div className="space-y-2">
                {decryptedLines.map((line, i) => (
                  <div key={line.employeeId}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{line.displayName}</div>
                      <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
                        Line {i + 1} · {line.destCommitment.slice(0, 14)}…
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums display" style={{ color: line.amountUsdc === '—' ? 'var(--muted)' : 'var(--ink)' }}>
                        {line.amountUsdc === '—' ? '—' : formatUsdc(line.amountUsdc)}
                      </div>
                      {line.amountUsdc !== '—' && (
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>USDC</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Total</span>
                <div className="flex items-baseline gap-1">
                  <span className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {formatUsdc(run.totalUsdc)}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--subtle)' }}>USDC</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
