import { useState } from 'react'
import { Users, Plus, Trash2, Mail } from 'lucide-react'
import { Card, InnerCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Employee, Org } from '../types/payroll'

interface RosterProps {
  org: Org | undefined
  employees: Employee[]
  onAdd: (name: string, email?: string) => Employee
  onDelete: (id: string) => void
}

export function Roster({ org, employees, onAdd, onDelete }: RosterProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    onAdd(name.trim(), email.trim() || undefined)
    setName(''); setEmail(''); setShowForm(false)
  }

  if (!org) {
    return (
      <InnerCard className="text-center py-10">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Create or select an organisation first.</p>
      </InnerCard>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Roster</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{org.name} — {employees.length} employees</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="size-4" /> Add Employee
        </Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>New Employee</h3>
          <div className="space-y-3">
            <Input label="Full name" placeholder="Alice Smith" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Email (optional)" type="email" placeholder="alice@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!name.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {employees.length === 0 && (
        <InnerCard className="text-center py-10">
          <Users className="size-10 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No employees yet. Add your first team member.</p>
        </InnerCard>
      )}

      {employees.length > 0 && (
        <div className="space-y-2">
          {employees.map(emp => (
            <div key={emp.id}
              className="flex items-center justify-between rounded-xl p-4"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'var(--accent)' }}>
                  {emp.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{emp.displayName}</div>
                  {emp.email && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                      <Mail className="size-3" /> {emp.email}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => onDelete(emp.id)} className="rounded-lg p-1.5 transition-all hover:opacity-80"
                style={{ color: 'var(--danger)' }}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
