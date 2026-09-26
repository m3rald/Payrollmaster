/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

// WalletConnect project ID — required for WalletConnect v2.
// Get a free one at https://cloud.walletconnect.com and set VITE_WC_PROJECT_ID in .env.
// Without it, only injected wallets (MetaMask, OKX, etc.) are available.
const wcProjectId = (import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ?? ''

const connectors = [
  // MetaMask targeted explicitly — OKX hijacks window.ethereum so we must name it
  injected({ target: 'metaMask' }),
  // OKX injects at window.okxwallet — separate target required
  injected({ target: 'okxWallet' }),
  // WalletConnect v2: QR-code / mobile fallback (only when a project ID is set)
  ...(wcProjectId
    ? [walletConnect({ projectId: wcProjectId, showQrModal: true })]
    : []),
  // NOTE: bare injected() removed — it conflicts with the targeted connectors above
  // and causes duplicate/missing wallet entries in ConnectKit.
  // ConnectKit surfaces any remaining injected wallet automatically via its own detection.
]

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors,
  transports: {
    [arcTestnet.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
