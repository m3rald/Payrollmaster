export interface FundResult { txHash: string; vaultBalance: string }
export interface ExecuteRunResult { paid: number; held: number; txHash: string }

export interface Settlement {
  fund(orgId: string, amountUsdc: string): Promise<FundResult>
  executeRun(runId: string, orgId: string): Promise<ExecuteRunResult>
  getVaultBalance(orgId: string): Promise<string>
  publishRosterRoot(runId: string, orgId: string, root: string, total: string): Promise<{ txHash: string }>
  approveRun(runId: string, sig: string): Promise<{ txHash: string }>
  registerOrg(orgId: string, name: string): Promise<{ vaultAddress: string; txHash: string }>
  setMaker(orgId: string, makerAddress: string): Promise<{ txHash: string }>
  setChecker(orgId: string, checkerAddress: string): Promise<{ txHash: string }>
}
