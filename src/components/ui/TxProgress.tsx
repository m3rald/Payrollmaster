import { CheckCircle2, Loader2, Circle } from 'lucide-react'

export type TxStep = 'idle' | 'signing' | 'broadcasting' | 'confirming' | 'done' | 'error'

export interface TxProgressProps {
  step: TxStep
  steps?: string[]
  error?: string
  className?: string
}

const DEFAULT_STEPS = ['Signing', 'Broadcasting', 'Confirming', 'Done']

const STEP_INDEX: Record<TxStep, number> = {
  idle: -1,
  signing: 0,
  broadcasting: 1,
  confirming: 2,
  done: 3,
  error: -1,
}

export function TxProgress({ step, steps = DEFAULT_STEPS, error, className = '' }: TxProgressProps) {
  if (step === 'idle') return null

  const current = STEP_INDEX[step]

  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      {step === 'error' ? (
        <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
          {error ?? 'Transaction failed'}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          {steps.map((label, i) => {
            const isDone = step === 'done' ? true : i < current
            const isActive = step !== 'done' && i === current
            return (
              <div key={label} className="flex items-center gap-1.5">
                {isDone ? (
                  <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
                ) : isActive ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />
                ) : (
                  <Circle className="size-4 shrink-0" style={{ color: 'var(--border-strong)' }} />
                )}
                <span
                  className="text-xs font-medium"
                  style={{ color: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--subtle)' }}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <div className="w-4 h-px ml-1" style={{ background: 'var(--border-strong)' }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
