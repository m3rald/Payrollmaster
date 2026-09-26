import { useEffect, useState } from 'react'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { useAccount } from 'wagmi'

export type OrgRole = 'owner' | 'maker' | 'checker' | 'none' | 'loading'

const ORG_FACTORY = (import.meta.env.VITE_ORG_FACTORY_ADDRESS ?? '') as Address

const roleAbi = parseAbi([
  'function ownerOf(string orgId) external view returns (address)',
  'function makerOf(string orgId) external view returns (address)',
  'function checkerOf(string orgId) external view returns (address)',
])

const pub = createPublicClient({ chain: arcTestnet, transport: http() })

export function useOrgRole(orgId: string | null | undefined): OrgRole {
  const { address } = useAccount()
  const [role, setRole] = useState<OrgRole>('none')

  const ready = Boolean(orgId && address && ORG_FACTORY)

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function fetchRole() {
      setRole('loading')
      try {
        const [owner, maker, checker] = await Promise.all([
          pub.readContract({ address: ORG_FACTORY, abi: roleAbi, functionName: 'ownerOf', args: [orgId!] }),
          pub.readContract({ address: ORG_FACTORY, abi: roleAbi, functionName: 'makerOf', args: [orgId!] }),
          pub.readContract({ address: ORG_FACTORY, abi: roleAbi, functionName: 'checkerOf', args: [orgId!] }),
        ])
        if (cancelled) return
        const addr = (address as string).toLowerCase()
        if ((owner as string).toLowerCase() === addr) setRole('owner')
        else if ((maker as string).toLowerCase() === addr) setRole('maker')
        else if ((checker as string).toLowerCase() === addr) setRole('checker')
        else setRole('none')
      } catch {
        if (!cancelled) setRole('none')
      }
    }

    void fetchRole()
    return () => { cancelled = true }
  }, [ready, orgId, address])

  return role
}
