import { keccak256, encodePacked } from 'viem'
import type { PayrollLine } from '../types/payroll'

function hashLeaf(l: PayrollLine): `0x${string}` {
  return keccak256(encodePacked(
    ['string', 'bytes32', 'bytes32'],
    [l.employeeId, l.destCommitment as `0x${string}`, (l.amountCipher.slice(0, 66)) as `0x${string}`]
  ))
}

function pair(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
  return keccak256(encodePacked(['bytes32', 'bytes32'], [x, y]))
}

export function buildMerkleRoot(lines: PayrollLine[]): `0x${string}` {
  if (!lines.length) return '0x0000000000000000000000000000000000000000000000000000000000000000'
  let layer = lines.map(hashLeaf)
  while (layer.length > 1) {
    const next: `0x${string}`[] = []
    for (let i = 0; i < layer.length; i += 2)
      next.push(i + 1 < layer.length ? pair(layer[i], layer[i + 1]) : layer[i])
    layer = next
  }
  return layer[0]
}
