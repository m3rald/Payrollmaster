import './tracing'
import './console-capture'

// Suppress unhandled promise rejections from wallet connectors trying to
// restore a previous session when the wallet is locked or the domain isn't
// authorised yet. These are expected on every cold load and should not crash
// the app or pollute error monitoring.
window.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason
  const msg = typeof reason === 'string'
    ? reason
    : typeof reason === 'object' && reason !== null && 'message' in reason
      ? String((reason as Record<string, unknown>).message)
      : ''
  const WALLET_NOISE = [
    'Failed to connect to MetaMask',
    'Message channel disconnected',
    '"code":4900',
    'User rejected',
    'Already processing',
    'has not been authorized yet',  // OKX domain auth on cold load
    'signal is aborted',            // RPC timeout on receipt polling
  ]
  if (WALLET_NOISE.some(s => msg.includes(s))) {
    event.preventDefault()
  }
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { Toaster } from 'sonner'
import { config } from './config'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <App />
          <Toaster position="top-center" />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

