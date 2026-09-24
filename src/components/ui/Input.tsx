import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

export function Input({ label, hint, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</label>}
      <input
        className={cn(
          'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all',
          'placeholder:text-slate-400 focus:ring-2',
          className
        )}
        style={{
          background: 'var(--surface-strong)',
          borderColor: 'var(--border-strong)',
          color: 'var(--ink)',
        }}
        {...props}
      />
      {hint && <p className="text-xs" style={{ color: 'var(--subtle)' }}>{hint}</p>}
    </div>
  )
}
