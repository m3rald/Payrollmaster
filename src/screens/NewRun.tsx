import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { formatUsdc, parseUsdcInput } from '../lib/utils'
import type { Employee, Org, PayrollRun } from '../types/payroll'
import type { Screen } from '../App'

interface NewRunProps {
  org: Org | undefined
  employees: Employee[]
  loading: boolean
  onCreateRun: (label: string, lines: Array<{ employeeId: string; amountDollars: string }>) => Promise<PayrollRun>
  onNav: (s: Screen) => void
}

interface LineEntry { employeeId: string; amountDollars: string }

export function NewRun({ org, employees, loading, onCreateRun, onNav }: NewRunProps) {
  const [label, setLabel] = useState('')
  const [lines, setLines] = useState<LineEntry[]>([{ employeeId: '', amountDollars: '' }])
  const [created, setCreated] = useState<PayrollRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addLine() { setLines(prev => [...prev, { employeeId: '', amountDollars: '' }]) }
  function removeLine(i: number) { setLines(prev => prev.filter((_, j) => j !== i)) }
  function updateLine(i: number, field: keyof LineEntry, value: string) {
    setLines(prev => prev.map((l, j) => j === i ? { ...l, [field]: value } : l))
  }

  const totalDollars = lines.reduce((s, l) => s + parseFloat(l.amountDollars || '0'), 0)
  const validLines = lines.filter(l => l.employeeId && parseFloat(l.amountDollars) > 0)
  const canCreate = label.trim() && validLines.length > 0

  async function handleCreate() {
    if (!canCreate) return
    setError(null)
    try {
      const run = await onCreateRun(label.trim(), validLines)
      setCreated(run)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create run — check roster wallet addresses and try again.')
    }
  }

  if (!org) {
    return <InnerCard className="text-center py-10"><p className="text-sm" style={{ color: 'var(--muted)' }}>Select an organisation first.</p></InnerCard>
  }

  if (created) {
    return (
      <div className="space-y-5">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Run Created</h1>
        <Card>
          <div className="space-y-3">
            <div className="text-sm font-semibold" style={{ color: 'var(--success)' }}>Draft run ready</div>
            <div className="text-sm" style={{ color: 'var(--ink)' }}><span className="font-semibold">{created.label}</span></div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{created.lines.length} employees · {formatUsdc(created.totalUsdc)} USDC total</div>
            <p className="text-xs p-3 rounded-lg" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
              Amounts are encrypted. The on-chain roster root hides individual salaries.
            </p>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => onNav('approve')}>Go to Approve</Button>
              <Button variant="ghost" onClick={() => { setCreated(null); setLabel(''); setLines([{ employeeId: '', amountDollars: '' }]) }}>New Run</Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>New Run</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Prepare a payroll run for {org.name}</p>
      </div>

      <Card>
        <Input label="Run label" placeholder="September 2026" value={label} onChange={e => setLabel(e.target.value)} />
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Pay Lines</h2>
          <Button size="sm" variant="ghost" onClick={addLine}><Plus className="size-4" /> Add Line</Button>
        </div>

        {employees.length === 0 && (
          <InnerCard className="text-center py-6">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Add employees to your roster first.</p>
            <Button size="sm" className="mt-3" onClick={() => onNav('roster')}>Go to Roster</Button>
          </InnerCard>
        )}

        {employees.length > 0 && (
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--muted)' }}>Employee</label>
                  <select
                    value={line.employeeId}
                    onChange={e => updateLine(i, 'employeeId', e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--surface-strong)', borderColor: 'var(--border-strong)', color: 'var(--ink)' }}
                  >
                    <option value="">Select employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.displayName}</option>)}
                  </select>
                </div>
                <div className="w-36">
                  <Input
                    label="Amount (USD)"
                    placeholder="0.00"
                    inputMode="decimal"
                    value={line.amountDollars}
                    onChange={e => updateLine(i, 'amountDollars', e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                </div>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="mb-0.5 p-2.5 rounded-lg transition-all hover:opacity-80" style={{ color: 'var(--danger)' }}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {validLines.length > 0 && (
        <InnerCard>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--muted)' }}>Total</span>
            <span className="display font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatUsdc(parseUsdcInput(totalDollars.toFixed(2)))} USDC</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span style={{ color: 'var(--subtle)' }}>Lines</span>
            <span className="tabular-nums" style={{ color: 'var(--subtle)' }}>{validLines.length}</span>
          </div>
        </InnerCard>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--danger)22', color: 'var(--danger)', border: '1px solid var(--danger)44' }}>
          {error}
        </div>
      )}

      <Button size="lg" onClick={() => { void handleCreate() }} loading={loading} disabled={!canCreate}>
        Create Run
      </Button>
    </div>
  )
}
