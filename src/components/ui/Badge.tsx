import { cn } from '../../lib/utils'

interface BadgeProps { label: string; color?: string; className?: string }

export function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ background: color ? `${color}20` : 'var(--surface-muted)', color: color ?? 'var(--muted)', border: `1px solid ${color ?? 'var(--border)'}30` }}
    >
      {label}
    </span>
  )
}
