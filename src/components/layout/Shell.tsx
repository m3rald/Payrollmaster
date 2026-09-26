import { ConnectKitButton } from 'connectkit'
import { Building2, Users, PlayCircle, ShieldCheck, LayoutDashboard, UserCircle, Settings, Eye, Sun, Moon, BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Screen } from '../../App'
import type { OrgRole } from '../../hooks/useOrgRole'
import { useState, useEffect } from 'react'

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, () => setDark(d => !d)] as const
}

interface ShellProps {
  screen: Screen
  onNav: (s: Screen) => void
  orgName?: string
  role?: OrgRole
  children: React.ReactNode
}

const ROLE_LABEL: Record<OrgRole, string | null> = {
  owner: 'Owner',
  maker: 'Maker',
  checker: 'Checker',
  none: null,
  loading: null,
}

const ROLE_COLOR: Record<OrgRole, string> = {
  owner: 'var(--accent)',
  maker: 'var(--success)',
  checker: 'var(--warning)',
  none: 'var(--muted)',
  loading: 'var(--muted)',
}

const adminNav: { id: Screen; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: LayoutDashboard },
  { id: 'roster', label: 'Roster', Icon: Users },
  { id: 'new-run', label: 'New Run', Icon: PlayCircle },
  { id: 'approve', label: 'Approve', Icon: ShieldCheck },
  { id: 'auditor', label: 'Auditor Desk', Icon: Eye },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

const mobileNav: { id: Screen; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: LayoutDashboard },
  { id: 'roster', label: 'Roster', Icon: Users },
  { id: 'approve', label: 'Approve', Icon: ShieldCheck },
  { id: 'employee-portal', label: 'Portal', Icon: UserCircle },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

export function Shell({ screen, onNav, orgName, role, children }: ShellProps) {
  const roleLabel = role ? ROLE_LABEL[role] : null
  const roleColor = role ? ROLE_COLOR[role] : 'var(--muted)'
  const [dark, toggleDark] = useDarkMode()
  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside
        className="hidden lg:flex w-56 shrink-0 flex-col border-r pt-6 pb-4 px-3"
        style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="px-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Building2 className="size-4 text-white" />
            </div>
            <span className="display text-sm tracking-tight" style={{ color: 'var(--ink)', fontWeight: 700 }}>
              Payroll Master
            </span>
          </div>
          {orgName && (
            <div className="mt-1 flex items-center gap-1.5">
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{orgName}</p>
              {roleLabel && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: roleColor + '22', color: roleColor }}>
                  {roleLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {adminNav.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left',
                screen === id ? 'text-white' : 'hover:opacity-80'
              )}
              style={screen === id
                ? { background: 'var(--accent)', color: 'white' }
                : { color: 'var(--ink-2)' }
              }
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}

          <div className="my-2 border-t" style={{ borderColor: 'var(--border)' }} />

          <button
            onClick={() => onNav('employee-portal')}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left',
              screen === 'employee-portal' ? 'text-white' : 'hover:opacity-80'
            )}
            style={screen === 'employee-portal'
              ? { background: 'var(--accent)', color: 'white' }
              : { color: 'var(--ink-2)' }
            }
          >
            <UserCircle className="size-4" />
            Employee Portal
          </button>

          <button
            onClick={() => onNav('guide')}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left',
              screen === 'guide' ? 'text-white' : 'hover:opacity-80'
            )}
            style={screen === 'guide'
              ? { background: 'var(--accent)', color: 'white' }
              : { color: 'var(--ink-2)' }
            }
          >
            <BookOpen className="size-4" />
            User Guide
          </button>
        </nav>

        {/* Wallet + dark mode */}
        <div className="mt-4 px-1 flex flex-col gap-2">
          <ConnectKitButton />
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80 w-full"
            style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
          >
            {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="flex lg:hidden items-center justify-between px-4 py-3 border-b sticky top-0 z-20"
          style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Building2 className="size-3.5 text-white" />
            </div>
            <span className="display text-sm font-bold" style={{ color: 'var(--ink)' }}>Payroll Master</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <ConnectKitButton />
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="flex lg:hidden fixed bottom-0 inset-x-0 border-t z-20 px-2 py-2"
          style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}>
          {mobileNav.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => onNav(id)}
              className="flex flex-1 flex-col items-center gap-0.5 py-1 rounded-lg transition-all"
              style={{ color: screen === id ? 'var(--accent)' : 'var(--muted)' }}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </nav>

        <main className="flex-1 min-h-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
