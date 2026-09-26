import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Building2, Plus, ChevronRight, Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { TxProgress } from '../components/ui/TxProgress'
import type { TxStep } from '../components/ui/TxProgress'
import { formatUsdc, runStatusLabel, runStatusColor, formatRelTime } from '../lib/utils'
import { arcSettlement } from '../settlement/arc'
import type { Org, PayrollRun } from '../types/payroll'
import type { Screen } from '../App'

interface HomeProps {
  orgs: Org[]
  activeOrg: Org | undefined
  runs: PayrollRun[]
  loading: boolean
  onCreateOrg: (name: string) => Promise<Org>
  onSelectOrg: (id: string) => void
  onNav: (s: Screen) => void
  onFundVault: (amountDollars: string) => Promise<void>
  onWithdrawVault: (amountDollars: string) => Promise<void>
  onRetryRegistration: (orgId: string) => Promise<void>
}

export function Home({ orgs, activeOrg, runs, loading, onCreateOrg, onSelectOrg, onNav, onFundVault, onWithdrawVault, onRetryRegistration }: HomeProps) {
  const { isConnected } = useAccount()
  const [showCreate, setShowCreate] = useState(false)
  const [showFund, setShowFund] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [fundAmount, setFundAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [creating, setCreating] = useState(false)
  const [fundStep, setFundStep] = useState<TxStep>('idle')
  const [withdrawStep, setWithdrawStep] = useState<TxStep>('idle')
  const [fundError, setFundError] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [vaultBalance, setVaultBalance] = useState('0')

  const refreshBalance = useCallback(() => {
    if (!activeOrg) return
    arcSettlement.getVaultBalance(activeOrg.id).then(setVaultBalance).catch(() => {})
  }, [activeOrg])

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  async function handleCreate() {
    if (!orgName.trim()) return
    setCreating(true)
    try { await onCreateOrg(orgName.trim()); setShowCreate(false); setOrgName('') }
    finally { setCreating(false) }
  }

  async function handleRetryRegistration() {
    if (!activeOrg) return
    setRetrying(true)
    try { await onRetryRegistration(activeOrg.id) }
    finally { setRetrying(false) }
  }

  async function handleWithdraw() {
    if (!withdrawAmount.trim()) return
    setWithdrawError('')
    setWithdrawStep('signing')
    try {
      setWithdrawStep('broadcasting')
      await onWithdrawVault(withdrawAmount.trim())
      setWithdrawStep('done')
      setWithdrawAmount('')
      refreshBalance()
      setTimeout(() => { setWithdrawStep('idle'); setShowWithdraw(false) }, 2000)
    } catch (e) {
      setWithdrawError(e instanceof Error ? e.message : 'Withdrawal failed')
      setWithdrawStep('error')
      setTimeout(() => setWithdrawStep('idle'), 4000)
    }
  }

  async function handleFund() {
    if (!fundAmount.trim()) return
    setFundError('')
    setFundStep('signing')
    try {
      // The settlement does approve then fund sequentially;
      // we advance the step indicator at each checkpoint
      setFundStep('broadcasting')
      await onFundVault(fundAmount.trim())
      setFundStep('done')
      setFundAmount('')
      refreshBalance()
      setTimeout(() => { setFundStep('idle'); setShowFund(false) }, 2000)
    } catch (e) {
      setFundError(e instanceof Error ? e.message : 'Transaction failed')
      setFundStep('error')
      setTimeout(() => setFundStep('idle'), 4000)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="size-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-muted)' }}>
          <Wallet className="size-8" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="display text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>Connect your wallet</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
            Connect to Arc Testnet to create an org and run payroll with USDC.
          </p>
        </div>
        <ConnectKitButton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            {activeOrg ? activeOrg.name : 'Payroll Master'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            {activeOrg ? 'Arc Testnet — USDC payroll' : 'Create an org to get started'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" /> New Org
        </Button>
      </div>

      {/* Create org form */}
      {showCreate && (
        <Card>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>New Organisation</h3>
          <div className="space-y-3">
            <Input label="Organisation name" placeholder="Acme Corp" value={orgName} onChange={e => setOrgName(e.target.value)} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Creating an org deploys a USDC vault on Arc Testnet and registers your org on-chain. Your wallet will be prompted to sign a transaction.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { void handleCreate() }} loading={creating || loading} disabled={!orgName.trim()}>
                Create &amp; Deploy Vault
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Org selector */}
      {orgs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {orgs.map(org => (
            <button key={org.id} onClick={() => onSelectOrg(org.id)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={activeOrg?.id === org.id
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }
              }
            >
              {org.name}
            </button>
          ))}
        </div>
      )}

      {activeOrg && (
        <>
          {/* Vault balance card */}
          <Card>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(26,128,71,0.12)' }}>
                  <Wallet className="size-3" style={{ color: 'var(--success)' }} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Vault Balance</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setShowFund(v => !v); setShowWithdraw(false) }}>
                  <ArrowDownToLine className="size-3.5" /> Fund
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowWithdraw(v => !v); setShowFund(false) }}>
                  <ArrowUpFromLine className="size-3.5" /> Withdraw
                </Button>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {formatUsdc(vaultBalance)}
              </span>
              <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Arc Testnet ·{' '}
              {activeOrg.vaultAddress
                ? <span className="font-mono">{activeOrg.vaultAddress.slice(0, 10)}…</span>
                : (
                  <span className="inline-flex items-center gap-2">
                    <span style={{ color: 'var(--warning)' }}>Vault not registered on-chain yet</span>
                    <button
                      onClick={() => { void handleRetryRegistration() }}
                      disabled={retrying || loading}
                      className="text-xs font-semibold px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      {retrying ? 'Registering…' : 'Register now'}
                    </button>
                  </span>
                )
              }
            </p>

            {/* Fund form — inline */}
            {showFund && (
              <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Fund Vault</h4>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Enter the USDC amount to deposit. Two transactions will be sent: first an ERC-20 approval, then the vault deposit.
                </p>
                <Input
                  label="Amount (USDC)"
                  placeholder="e.g. 5000.00"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  type="number"
                  min="0"
                />
                {fundStep === 'idle' || fundStep === 'error' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { void handleFund() }} disabled={!fundAmount.trim() || !activeOrg.vaultAddress}>
                      Approve &amp; Fund
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowFund(false)}>Cancel</Button>
                  </div>
                ) : null}
                <TxProgress
                  step={fundStep}
                  steps={['Approving USDC', 'Depositing', 'Confirming', 'Done']}
                  error={fundError}
                />
                {!activeOrg.vaultAddress && (
                  <p className="text-xs" style={{ color: 'var(--warning)' }}>
                    Register the org on-chain first using the "Register now" button above.
                  </p>
                )}
              </div>
            )}

            {/* Withdraw form — inline */}
            {showWithdraw && (
              <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Withdraw from Vault</h4>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Withdraw idle USDC back to your wallet. Only the org owner can withdraw.
                </p>
                <Input
                  label="Amount (USDC)"
                  placeholder="e.g. 1000.00"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  type="number"
                  min="0"
                />
                {withdrawStep === 'idle' || withdrawStep === 'error' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { void handleWithdraw() }} disabled={!withdrawAmount.trim() || !activeOrg.vaultAddress}>
                      Withdraw
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowWithdraw(false)}>Cancel</Button>
                  </div>
                ) : null}
                <TxProgress step={withdrawStep} error={withdrawError} />
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNav('new-run')}
              className="rounded-2xl p-4 text-left transition-all hover:opacity-80"
              style={{ background: 'var(--accent)', color: 'white' }}>
              <Plus className="size-5 mb-2" />
              <div className="text-sm font-semibold">New Run</div>
              <div className="text-xs opacity-70 mt-0.5">Prepare payroll</div>
            </button>
            <button onClick={() => onNav('roster')}
              className="rounded-2xl p-4 text-left border transition-all hover:opacity-80"
              style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}>
              <Building2 className="size-5 mb-2" style={{ color: 'var(--accent)' }} />
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Manage Roster</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Employees</div>
            </button>
          </div>

          {/* Recent runs — activity feed */}
          {runs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Recent Activity</h2>
              <div className="space-y-2">
                {runs.slice(0, 5).map(run => {
                  const summary = run.status === 'completed'
                    ? `${run.label} paid ${run.paidCount} of ${run.lines.length}. All lines settled.`
                    : run.status === 'partial'
                    ? `${run.label} paid ${run.paidCount} of ${run.lines.length}. ${run.heldCount} line${run.heldCount !== 1 ? 's' : ''} held for review.`
                    : null
                  return (
                    <button key={run.id} onClick={() => onNav('approve')}
                      className="w-full rounded-xl p-4 text-left flex items-center justify-between transition-all hover:opacity-80"
                      style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{run.label}</div>
                        {summary ? (
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{summary}</div>
                        ) : (
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {run.lines.length} lines · {formatUsdc(run.totalUsdc)} USDC · {formatRelTime(run.createdAt)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge label={runStatusLabel(run.status)} color={runStatusColor(run.status)} />
                        <ChevronRight className="size-4" style={{ color: 'var(--subtle)' }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {runs.length === 0 && (
            <InnerCard className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No runs yet — create one to get started.</p>
              <Button size="sm" className="mt-3" onClick={() => onNav('new-run')}>
                <Plus className="size-4" /> New Run
              </Button>
            </InnerCard>
          )}
        </>
      )}

      {!activeOrg && orgs.length === 0 && (
        <InnerCard className="text-center py-10">
          <Building2 className="size-10 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>No organisations yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Create your first org to start running payroll on Arc Testnet.</p>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="size-4" /> Create Org</Button>
        </InnerCard>
      )}
    </div>
  )
}
