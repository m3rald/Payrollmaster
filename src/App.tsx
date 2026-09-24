import { useState } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
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

export type Screen = 'home' | 'roster' | 'new-run' | 'approve' | 'employee-portal' | 'settings' | 'auditor'

const ARC_TESTNET_CHAIN_ID = 5042002

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const {
    orgs, activeOrg, employees, runs, loading,
    selectOrg, createOrg, addEmployee, deleteEmployee,
    createRun, publishRosterRoot, attestSanctions, approveRun, executeRun,
    fundVault, setMaker, setChecker,
  } = usePayroll()

  return (
    <Shell screen={screen} onNav={setScreen} orgName={activeOrg?.name}>
      <ChainGuard
        chainId={chainId}
        targetChainId={ARC_TESTNET_CHAIN_ID}
        onSwitch={() => { void switchChain({ chainId: ARC_TESTNET_CHAIN_ID }) }}
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
    </Shell>
  )
}
