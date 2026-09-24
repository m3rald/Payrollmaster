import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', loading, size = 'md', className, children, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'w-full py-3.5 text-sm' }
  const variants = {
    primary: 'text-white hover:opacity-90',
    ghost: 'border hover:opacity-80',
    danger: 'text-white hover:opacity-90',
  }
  const styles = {
    primary: { background: 'var(--accent)' },
    ghost: { color: 'var(--ink-2)', borderColor: 'var(--border-strong)', background: 'var(--surface-strong)' },
    danger: { background: 'var(--danger)' },
  }

  return (
    <button
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], className)}
      style={styles[variant]}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}
