import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'

interface ChecklistRowProps {
  label: string
  done: boolean
  warn?: boolean
}

export function ChecklistRow({ label, done, warn }: ChecklistRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {done
        ? <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
        : warn
          ? <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--warning)' }} />
          : <Circle className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
      }
      <span className="text-sm" style={{ color: done ? 'var(--ink)' : 'var(--muted)' }}>{label}</span>
    </div>
  )
}
