import type { Org, Employee, PayrollRun } from '../types/payroll'

const P = 'pm_v1'
const k = (orgId: string, kind: string) => `${P}:${orgId}:${kind}`

export function saveOrg(org: Org) {
  const all = loadOrgs()
  const i = all.findIndex(o => o.id === org.id)
  if (i >= 0) all[i] = org; else all.push(org)
  localStorage.setItem(`${P}:orgs`, JSON.stringify(all))
}
export function loadOrgs(): Org[] {
  try { return JSON.parse(localStorage.getItem(`${P}:orgs`) ?? '[]') as Org[] } catch { return [] }
}
export function loadOrg(id: string) { return loadOrgs().find(o => o.id === id) }

export function saveEmployee(emp: Employee) {
  const all = loadEmployees(emp.orgId)
  const i = all.findIndex(e => e.id === emp.id)
  if (i >= 0) all[i] = emp; else all.push(emp)
  localStorage.setItem(k(emp.orgId, 'employees'), JSON.stringify(all))
}
export function loadEmployees(orgId: string): Employee[] {
  try { return JSON.parse(localStorage.getItem(k(orgId, 'employees')) ?? '[]') as Employee[] } catch { return [] }
}
export function removeEmployee(orgId: string, eid: string) {
  const all = loadEmployees(orgId).filter(e => e.id !== eid)
  localStorage.setItem(k(orgId, 'employees'), JSON.stringify(all))
}

export function saveRun(run: PayrollRun) {
  const all = loadRuns(run.orgId)
  const i = all.findIndex(r => r.id === run.id)
  if (i >= 0) all[i] = run; else all.push(run)
  localStorage.setItem(k(run.orgId, 'runs'), JSON.stringify(all))
}
export function loadRuns(orgId: string): PayrollRun[] {
  try { return JSON.parse(localStorage.getItem(k(orgId, 'runs')) ?? '[]') as PayrollRun[] } catch { return [] }
}
export function loadRun(orgId: string, runId: string) { return loadRuns(orgId).find(r => r.id === runId) }

export function setActiveOrg(id: string) { localStorage.setItem(`${P}:activeOrg`, id) }
export function getActiveOrg() { return localStorage.getItem(`${P}:activeOrg`) }

export function setOrgSecret(orgId: string, secret: string) { localStorage.setItem(`${P}:${orgId}:secret`, secret) }
export function getOrgSecret(orgId: string) { return localStorage.getItem(`${P}:${orgId}:secret`) }
