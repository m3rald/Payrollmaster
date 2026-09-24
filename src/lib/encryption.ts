/**
 * App-layer privacy: ECIES-style amount encryption using Web Crypto.
 * v1: AES-GCM with a shared key derived from a master secret.
 * v2: Replace with proper ECIES (secp256k1 + HKDF + AES-GCM).
 * v3 Rialo: delete this module; REX handles confidential compute.
 */

/** Derive a per-run per-employee key from the master org secret and contextual data. */
async function deriveKey(
  orgSecret: string,
  runId: string,
  employeeId: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(orgSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`${runId}:${employeeId}`),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Encrypt a USDC amount string (e.g. "1500000") for a given employee in a run. */
export async function encryptAmount(
  orgSecret: string,
  runId: string,
  employeeId: string,
  amountUsdc: string
): Promise<string> {
  const key = await deriveKey(orgSecret, runId, employeeId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(amountUsdc)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  // Pack iv + ciphertext as hex
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipher), iv.byteLength)
  return '0x' + Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Decrypt amount cipher for an employee. Returns the USDC amount string. */
export async function decryptAmount(
  orgSecret: string,
  runId: string,
  employeeId: string,
  cipher: string
): Promise<string> {
  const key = await deriveKey(orgSecret, runId, employeeId)
  const bytes = Uint8Array.from(cipher.replace('0x', '').match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
  const iv = bytes.slice(0, 12)
  const cipherBytes = bytes.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes)
  return new TextDecoder().decode(plain)
}

/** Generate a view tag from the cipher (first 2 bytes) for O(1) scanning. */
export function viewTagFromCipher(cipher: string): string {
  return cipher.slice(0, 6) // 0x + 2 bytes
}

/** Derive a dest commitment (hash of stealthDest + employeeId) for on-chain use. */
export async function deriveDestCommitment(
  stealthDest: string,
  employeeId: string
): Promise<`0x${string}`> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${stealthDest}:${employeeId}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return '0x' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('') as `0x${string}`
}
