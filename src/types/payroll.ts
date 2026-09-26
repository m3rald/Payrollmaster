export type Role = 'owner' | 'maker' | 'checker' | 'employee' | 'auditor'

export interface Org {
  id: string
  name: string
  owner: string
  maker?: string
  checker?: string
  vaultAddress?: string
  createdAt: number
}

export interface Employee {
  id: string
  orgId: string
  displayName: string
  email?: string
  walletAddress: string   // EVM address — used as dest in claimLine merkle leaf
  active: boolean
}

export interface PayrollLine {
  employeeId: string
  amountUsdc: string
  dest: string          // stealth destination address for this line
  destCommitment: string
  amountCipher: string
  viewTag: string
}

export type RunStatus =
  | 'draft'
  | 'roster_published'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'partial'
  | 'failed'

export interface PayrollRun {
  id: string
  orgId: string
  label: string
  lines: PayrollLine[]
  totalUsdc: string
  rosterRoot: string
  checkerSig?: string
  checkerAddress?: string
  sanctionsAttested: boolean
  status: RunStatus
  txHash?: string
  paidCount: number
  heldCount: number
  createdAt: number
  executedAt?: number
}
