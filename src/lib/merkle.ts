import { keccak256, encodePacked } from 'viem'
import type { PayrollLine } from '../types/payroll'

// runId is included so the same (lineIndex, amount, dest) tuple cannot be
// replayed against a different run. Must match the leaf encoding in RunRegistry.claimLine.
function hashLeaf(runId: string, lineIndex: number, amount: string, dest: string): `0x${string}` {
  return keccak256(encodePacked(
    ['string', 'uint256', 'uint256', 'address'],
    [runId, BigInt(lineIndex), BigInt(amount), dest as `0x${string}`]
  ))
}

function pair(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
  return keccak256(encodePacked(['bytes32', 'bytes32'], [x, y]))
}

export interface ClaimProof {
  runId: string
  lineIndex: number
  amount: string   // raw USDC units (6 decimals)
  dest: string     // worker wallet address
  proof: string[]  // merkle proof path
}

/** Build a merkle root AND return the proof for every line in one pass. */
export function buildMerkleRootWithProofs(runId: string, lines: PayrollLine[]): {
  root: `0x${string}`
  proofs: ClaimProof[]
} {
  if (!lines.length) return {
    root: '0x0000000000000000000000000000000000000000000000000000000000000000',
    proofs: [],
  }

  const leaves = lines.map((l, i) =>
    hashLeaf(runId, i, l.amountUsdc, l.dest ?? l.destCommitment)
  )

  // Build the full tree layer by layer, storing every layer for proof extraction
  const tree: (`0x${string}`)[][] = [leaves]
  while (tree[tree.length - 1].length > 1) {
    const prev = tree[tree.length - 1]
    const next: `0x${string}`[] = []
    for (let i = 0; i < prev.length; i += 2)
      next.push(i + 1 < prev.length ? pair(prev[i], prev[i + 1]) : prev[i])
    tree.push(next)
  }

  const root = tree[tree.length - 1][0]

  // Extract proof for each leaf
  const proofs: ClaimProof[] = lines.map((l, i) => {
    const proof: string[] = []
    let idx = i
    for (let d = 0; d < tree.length - 1; d++) {
      const layer = tree[d]
      const sibIdx = idx % 2 === 0 ? idx + 1 : idx - 1
      if (sibIdx < layer.length) proof.push(layer[sibIdx])
      idx = Math.floor(idx / 2)
    }
    return {
      runId,
      lineIndex: i,
      amount: l.amountUsdc,
      dest: l.dest ?? l.destCommitment,
      proof,
    }
  })

  return { root, proofs }
}

/** Encode a ClaimProof as a URL-safe base64 string for deep links.
 *  Uses base64url (RFC 4648 §5): replaces +→- /→_ and strips trailing =
 *  so the value is safe to embed in a query string without encodeURIComponent. */
export function encodeClaimProof(cp: ClaimProof): string {
  return btoa(JSON.stringify(cp))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Decode a ClaimProof from a URL-safe base64 string. */
export function decodeClaimProof(encoded: string): ClaimProof | null {
  try {
    // Accept both standard base64 and base64url
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4)
    return JSON.parse(atob(padded)) as ClaimProof
  } catch { return null }
}

export function buildMerkleRoot(runId: string, lines: PayrollLine[]): `0x${string}` {
  if (!lines.length) return '0x0000000000000000000000000000000000000000000000000000000000000000'
  let layer = lines.map((l, i) => hashLeaf(runId, i, l.amountUsdc, l.dest ?? l.destCommitment))
  while (layer.length > 1) {
    const next: `0x${string}`[] = []
    for (let i = 0; i < layer.length; i += 2)
      next.push(i + 1 < layer.length ? pair(layer[i], layer[i + 1]) : layer[i])
    layer = next
  }
  return layer[0]
}
