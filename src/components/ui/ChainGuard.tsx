import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { useAccount, useConnectorClient } from 'wagmi'
import { toast } from 'sonner'

// Arc Testnet params — passed verbatim to wallet_addEthereumChain (EIP-3085).
// This registers the network in the wallet on first use and switches to it.
const ARC_TESTNET_PARAMS = {
  chainId: '0x4CEFB2',             // 5042002 in hex
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.io'],
  blockExplorerUrls: ['https://explorer.testnet.arc.io'],
}

interface ChainGuardProps {
  chainId: number
  targetChainId: number
  onSwitch: () => void
}

export function ChainGuard({ chainId, targetChainId }: ChainGuardProps) {
  const { isConnected } = useAccount()
  const { data: client } = useConnectorClient()
  const [switching, setSwitching] = useState(false)

  if (!isConnected || chainId === targetChainId) return null

  async function handleAddAndSwitch() {
    if (!client) { toast.error('Wallet not ready'); return }
    setSwitching(true)
    try {
      // wallet_addEthereumChain adds the chain if unknown, then switches to it.
      // Works on MetaMask, OKX, Rabby, Coinbase Wallet, and all EIP-3085 wallets.
      await client.request({
        method: 'wallet_addEthereumChain',
        params: [ARC_TESTNET_PARAMS],
      })
    } catch (e: unknown) {
      // Some wallets (e.g. MetaMask) throw code 4902 if addEthereumChain is
      // unsupported and require wallet_switchEthereumChain as a fallback.
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0
      if (code === 4902 || code === -32601) {
        try {
          await client.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ARC_TESTNET_PARAMS.chainId }],
          })
        } catch {
          toast.error('Could not switch network — please switch to Arc Testnet manually.')
        }
      } else if (code !== 4001) {
        // 4001 = user rejected — don't toast for that
        toast.error('Network switch failed — please switch to Arc Testnet manually.')
      }
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
      style={{ background: 'rgba(220,100,40,0.1)', border: '1px solid rgba(220,100,40,0.3)', color: 'var(--ink)' }}
    >
      <AlertTriangle className="size-4 shrink-0" style={{ color: 'var(--warning)' }} />
      <span className="flex-1">
        Wrong network — switch to <strong>Arc Testnet</strong> to use Payroll Master.
        {' '}This will add the network to your wallet if it isn't there yet.
      </span>
      <Button size="sm" onClick={() => { void handleAddAndSwitch() }} disabled={switching}>
        {switching ? <Loader2 className="size-3.5 animate-spin" /> : 'Add & Switch'}
      </Button>
    </div>
  )
}
