// Canonical onchain facts for Arc Testnet and USDC.
// All chain-specific values live here — never hardcode elsewhere.

export const ARC_TESTNET_CHAIN_ID = 5042002

// USDC on Arc Testnet: same address as the native gas token pool (ERC-20 view)
const USDC_FACTS: Record<number, { address: string; decimals: number; symbol: string }> = {
  [ARC_TESTNET_CHAIN_ID]: {
    address: '0x3600000000000000000000000000000000000000',
    decimals: 6,
    symbol: 'USDC',
  },
}

export function getUsdc(chainId: number) {
  return USDC_FACTS[chainId] ?? null
}

// Arc Testnet block explorer base URL
const EXPLORER_BASE: Record<number, string> = {
  [ARC_TESTNET_CHAIN_ID]: 'https://explorer.testnet.arc.io',
}

export function buildTxExplorerUrl(chainId: number, txHash: string): string {
  const base = EXPLORER_BASE[chainId] ?? 'https://explorer.testnet.arc.io'
  return `${base}/tx/${txHash}`
}

export function buildAddressExplorerUrl(chainId: number, address: string): string {
  const base = EXPLORER_BASE[chainId] ?? 'https://explorer.testnet.arc.io'
  return `${base}/address/${address}`
}
