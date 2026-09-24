import { useState } from 'react'
import { Settings, UserCheck, ShieldCheck, ExternalLink } from 'lucide-react'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { shortenAddress } from '../lib/utils'
import { buildAddressExplorerUrl } from '../onchain-facts'
import type { Org } from '../types/payroll'

const ARC_TESTNET_ID = 5042002

interface OrgSettingsProps {
  org: Org | undefined
  loading: boolean
  onSetMaker: (addr: string) => Promise<void>
  onSetChecker: (addr: string) => Promise<void>
}

export function OrgSettings({ org, loading, onSetMaker, onSetChecker }: OrgSettingsProps) {
  const [makerInput, setMakerInput] = useState('')
  const [checkerInput, setCheckerInput] = useState('')
  const [savingMaker, setSavingMaker] = useState(false)
  const [savingChecker, setSavingChecker] = useState(false)

  if (!org) {
    return (
      <InnerCard className="text-center py-10">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Select an organisation first.</p>
      </InnerCard>
    )
  }

  async function handleSetMaker() {
    if (!makerInput.trim()) return
    setSavingMaker(true)
    try { await onSetMaker(makerInput.trim()); setMakerInput('') }
    finally { setSavingMaker(false) }
  }

  async function handleSetChecker() {
    if (!checkerInput.trim()) return
    setSavingChecker(true)
    try { await onSetChecker(checkerInput.trim()); setCheckerInput('') }
    finally { setSavingChecker(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{org.name} · role management</p>
      </div>

      {/* Org info */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Organisation</h2>
        </div>
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--muted)' }}>Name</dt>
            <dd className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{org.name}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--muted)' }}>Owner</dt>
            <dd className="flex items-center gap-1">
              <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{shortenAddress(org.owner)}</span>
              <a href={buildAddressExplorerUrl(ARC_TESTNET_ID, org.owner)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" style={{ color: 'var(--muted)' }} />
              </a>
            </dd>
          </div>
          {org.vaultAddress && (
            <div className="flex items-center justify-between">
              <dt className="text-xs" style={{ color: 'var(--muted)' }}>Vault</dt>
              <dd className="flex items-center gap-1">
                <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{shortenAddress(org.vaultAddress)}</span>
                <a href={buildAddressExplorerUrl(ARC_TESTNET_ID, org.vaultAddress)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" style={{ color: 'var(--muted)' }} />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Maker */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <UserCheck className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Maker</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          The Maker prepares payroll runs. Only the owner can assign this role. Defaults to the owner if unset.
        </p>
        {org.maker ? (
          <InnerCard className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Current Maker</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{shortenAddress(org.maker)}</span>
                <a href={buildAddressExplorerUrl(ARC_TESTNET_ID, org.maker)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" style={{ color: 'var(--muted)' }} />
                </a>
              </div>
            </div>
          </InnerCard>
        ) : (
          <InnerCard className="mb-4">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No maker set — owner acts as maker.</p>
          </InnerCard>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="0x… wallet address"
            value={makerInput}
            onChange={e => setMakerInput(e.target.value)}
          />
          <Button
            size="sm"
            loading={savingMaker || loading}
            disabled={!makerInput.trim() || !makerInput.startsWith('0x')}
            onClick={() => { void handleSetMaker() }}
          >
            Assign
          </Button>
        </div>
      </Card>

      {/* Checker */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Checker</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          The Checker approves runs. Must be a different wallet from the Maker for proper separation of duties.
        </p>
        {org.checker ? (
          <InnerCard className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Current Checker</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{shortenAddress(org.checker)}</span>
                <a href={buildAddressExplorerUrl(ARC_TESTNET_ID, org.checker)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" style={{ color: 'var(--muted)' }} />
                </a>
              </div>
            </div>
          </InnerCard>
        ) : (
          <InnerCard className="mb-4">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No checker set — any wallet can approve (testnet only).</p>
          </InnerCard>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="0x… wallet address"
            value={checkerInput}
            onChange={e => setCheckerInput(e.target.value)}
          />
          <Button
            size="sm"
            loading={savingChecker || loading}
            disabled={!checkerInput.trim() || !checkerInput.startsWith('0x')}
            onClick={() => { void handleSetChecker() }}
          >
            Assign
          </Button>
        </div>
      </Card>
    </div>
  )
}
