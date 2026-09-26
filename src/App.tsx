import { useState } from 'react'
import { useChainId } from 'wagmi'
import { Shell } from './components/layout/Shell'
import { ChainGuard } from './components/ui/ChainGuard'
import { Home } from './screens/Home'
import { Roster } from './screens/Roster'
import { NewRun } from './screens/NewRun'
import { Approve } from './screens/Approve'
import { EmployeePortal } from './screens/EmployeePortal'
import { OrgSettings } from './screens/OrgSettings'
import { AuditorDesk } from './screens/AuditorDesk'
import { usePayroll } from './hooks/usePayroll'
import { useOrgRole } from './hooks/useOrgRole'

export type Screen = 'home' | 'roster' | 'new-run' | 'approve' | 'employee-portal' | 'settings' | 'auditor' | 'guide'

const ARC_TESTNET_CHAIN_ID = 5042002

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'employee-portal') return 'employee-portal'
    return 'home'
  })
  const chainId = useChainId()
  const {
    orgs, activeOrg, employees, runs, loading,
    selectOrg, createOrg, retryOrgRegistration, addEmployee, deleteEmployee,
    createRun, publishRosterRoot, attestSanctions, approveRun, executeRun,
    fundVault, withdrawVault, setMaker, setChecker,
  } = usePayroll()

  const role = useOrgRole(activeOrg?.id)

  // Navigation is always allowed — role-gating only disables action buttons inside screens.
  // Previously this blocked nav clicks for 'none'/'loading' roles which made tabs unclickable.
  function canSee(_s: Screen): boolean {
    return true
  }

  const isGuide = screen === 'guide'
  return (
    <Shell screen={screen} onNav={(s) => setScreen(s)} orgName={activeOrg?.name} role={role}>
      {!isGuide && <div className="px-4 py-6 pb-24 lg:pb-6 lg:px-8 max-w-4xl w-full mx-auto flex-1">
      <ChainGuard
        chainId={chainId}
        targetChainId={ARC_TESTNET_CHAIN_ID}
        onSwitch={() => {}}
      />
      {screen === 'home' && (
        <Home
          orgs={orgs}
          activeOrg={activeOrg}
          runs={runs}
          loading={loading}
          onCreateOrg={createOrg}
          onSelectOrg={selectOrg}
          onNav={setScreen}
          onFundVault={fundVault}
          onWithdrawVault={withdrawVault}
          onRetryRegistration={retryOrgRegistration}
        />
      )}
      {screen === 'roster' && (
        <Roster
          org={activeOrg}
          employees={employees}
          onAdd={addEmployee}
          onDelete={deleteEmployee}
        />
      )}
      {screen === 'new-run' && (
        <NewRun
          org={activeOrg}
          employees={employees}
          loading={loading}
          onCreateRun={createRun}
          onNav={setScreen}
        />
      )}
      {screen === 'approve' && (
        <Approve
          org={activeOrg}
          runs={runs}
          loading={loading}
          onPublishRoster={publishRosterRoot}
          onAttestSanctions={attestSanctions}
          onApprove={approveRun}
          onExecute={executeRun}
        />
      )}
      {screen === 'settings' && (
        <OrgSettings
          org={activeOrg}
          loading={loading}
          onSetMaker={setMaker}
          onSetChecker={setChecker}
        />
      )}
      {screen === 'auditor' && (
        <AuditorDesk org={activeOrg} runs={runs} />
      )}
      {screen === 'employee-portal' && <EmployeePortal />}
      </div>}
      {screen === 'guide' && (
        <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/user-guide.html"
            title="User Guide"
            style={{ flex: 1, border: 'none', width: '100%' }}
          />
        </div>
      )}
    </Shell>
  )
}
