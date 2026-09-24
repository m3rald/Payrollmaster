import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { useAccount } from 'wagmi'

interface ChainGuardProps {
  chainId: number
  targetChainId: number
  onSwitch: () => void
}

export function ChainGuard({ chainId, targetChainId, onSwitch }: ChainGuardProps) {
  const { isConnected } = useAccount()
  if (!isConnected || chainId === targetChainId) return null

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
      style={{ background: 'rgba(220,100,40,0.1)', border: '1px solid rgba(220,100,40,0.3)', color: 'var(--ink)' }}
    >
      <AlertTriangle className="size-4 shrink-0" style={{ color: 'var(--warning)' }} />
      <span className="flex-1">Wrong network — switch to Arc Testnet to use Payroll Master.</span>
      <Button size="sm" onClick={onSwitch}>Switch</Button>
    </div>
  )
}
