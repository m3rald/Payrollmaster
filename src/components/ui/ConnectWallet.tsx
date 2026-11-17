import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, type Connector } from 'wagmi'
import { LogOut, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'

const INSTALL_URL: Record<string, string> = {
  metaMask: 'https://metamask.io/download/',
  okxWallet: 'https://www.okx.com/web3',
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Direct wallet connection. Browser wallets (MetaMask, OKX) connect through
 * their injected provider with no QR code. WalletConnect (QR) only appears
 * when VITE_WC_PROJECT_ID is set, and is labelled as a mobile option.
 */
export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const [installed, setInstalled] = useState<Record<string, boolean>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  // De-duplicate by display name (EIP-6963 discovery can repeat our targets)
  const seen = new Set<string>()
  const list = connectors.filter((c) => {
    const key = c.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        list.map(async (c) => {
          if (c.type === 'walletConnect') return [c.uid, true] as const
          try {
            return [c.uid, Boolean(await c.getProvider())] as const
          } catch {
            return [c.uid, false] as const
          }
        }),
      )
      if (!cancelled) setInstalled(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connectors])

  async function handleConnect(c: Connector) {
    if (c.type !== 'walletConnect' && installed[c.uid] === false) {
      const url = INSTALL_URL[c.id]
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else toast.error(`${c.name} was not detected in this browser.`)
      return
    }
    setBusyId(c.uid)
    try {
      await connectAsync({ connector: c })
      setOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/rejected|denied|closed/i.test(msg)) {
        toast.error(`Could not connect ${c.name}. Unlock the wallet and try again.`)
      }
    } finally {
      setBusyId(null)
    }
  }

  if (isConnected && address) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-mono"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-strong)', color: 'var(--ink)' }}
      >
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: 'var(--success, #16a34a)' }} />
          {short(address)}
        </span>
        <button
          onClick={() => disconnect()}
          aria-label="Disconnect wallet"
          className="p-1 rounded-md hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ background: 'var(--accent)' }}
      >
        <Wallet className="size-4" />
        Connect Wallet
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Connect a wallet"
            className="w-full max-w-sm rounded-2xl border p-5 flex flex-col gap-3"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
                Connect a wallet
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: 'var(--muted)' }}>
                <X className="size-4" />
              </button>
            </div>

            {list.map((c) => {
              const isWc = c.type === 'walletConnect'
              const missing = !isWc && installed[c.uid] === false
              return (
                <button
                  key={c.uid}
                  disabled={isPending}
                  onClick={() => void handleConnect(c)}
                  className="flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--ink)', background: 'var(--surface-muted)' }}
                >
                  <span>{isWc ? 'WalletConnect (mobile, QR)' : c.name}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {busyId === c.uid ? 'Connecting…' : missing ? 'Install' : isWc ? 'QR code' : 'Detected'}
                  </span>
                </button>
              )
            })}

            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Your wallet will ask to switch to Arc Testnet. Approve it to continue.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
