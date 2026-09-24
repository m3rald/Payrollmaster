async function deriveKey(orgSecret: string, runId: string, employeeId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const km = await crypto.subtle.importKey('raw', enc.encode(orgSecret), { name: 'PBKDF2' }, false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(`${runId}:${employeeId}`), iterations: 50_000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptAmount(orgSecret: string, runId: string, employeeId: string, amountUsdc: string): Promise<string> {
  const key = await deriveKey(orgSecret, runId, employeeId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(amountUsdc))
  const buf = new Uint8Array(12 + cipher.byteLength)
  buf.set(iv)
  buf.set(new Uint8Array(cipher), 12)
  return '0x' + Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function decryptAmount(orgSecret: string, runId: string, employeeId: string, cipher: string): Promise<string> {
  const key = await deriveKey(orgSecret, runId, employeeId)
  const bytes = Uint8Array.from(cipher.replace('0x', '').match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  return new TextDecoder().decode(plain)
}

export function viewTag(cipher: string): string { return cipher.slice(0, 6) }

export async function destCommitment(stealthDest: string, employeeId: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${stealthDest}:${employeeId}`))
  return '0x' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateOrgSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
}
