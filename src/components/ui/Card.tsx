import { cn } from '../../lib/utils'

interface CardProps { children: React.ReactNode; className?: string; style?: React.CSSProperties }

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border p-5', className)}
      style={{
        background: 'var(--surface-strong)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(20px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function InnerCard({ children, className }: CardProps) {
  return (
    <div
      className={cn('rounded-xl p-4', className)}
      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}
