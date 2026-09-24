import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { RunStatus } from '../types/payroll'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatUsdc(rawUsdc: string | bigint): string {
  const num = Number(rawUsdc) / 1_000_000
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

export function parseUsdcInput(input: string): string {
  const dollars = parseFloat(input.replace(/[^0-9.]/g, ''))
  if (isNaN(dollars) || dollars <= 0) return '0'
  return Math.round(dollars * 1_000_000).toString()
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function runStatusLabel(status: RunStatus): string {
  const map: Record<RunStatus, string> = {
    draft: 'Draft',
    roster_published: 'Roster Ready',
    approved: 'Approved',
    executing: 'Executing',
    completed: 'Completed',
    partial: 'Partial',
    failed: 'Failed',
  }
  return map[status] ?? status
}

export function runStatusColor(status: RunStatus | 'paid' | 'held' | 'pending'): string {
  if (status === 'completed') return 'var(--success)'
  if (status === 'partial') return 'var(--warning)'
  if (status === 'failed') return 'var(--danger)'
  if (status === 'approved') return 'var(--accent-hover)'
  return 'var(--muted)'
}

export function formatRelTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (hours < 1) return `${mins}m ago`
  if (days < 1) return `${hours}h ago`
  return `${days}d ago`
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
