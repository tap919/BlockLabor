import { useState } from 'react';
import { ViewState } from './components/Navigation';
import { AppShell } from './app/AppShell';

import { 
  mockBranches,
  mockRateCards,
  defaultSsoConfig,
  defaultPermissions
} from './shared/mocks/data';
import { 
  BranchDivision,
  RateCard,
  SsoConfig,
  AdminPermissions
} from './shared/types/domain';

import { useJobsStore } from './features/jobs/jobsStore';
import { useCandidatesStore } from './features/candidates/candidatesStore';
import { useIncidentsStore } from './features/incidents/incidentsStore';
import { useIntegrationsStore } from './features/integrations/integrationsStore';
import { useVendorsStore } from './features/vendors/vendorsStore';
import { useLogsStore } from './features/logs/logsStore';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [isEnterprise, setIsEnterprise] = useState<boolean>(false);
  const [branches, setBranches] = useState<BranchDivision[]>(mockBranches);
  const [rateCards, setRateCards] = useState<RateCard[]>(mockRateCards);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig>(defaultSsoConfig);
  const [permissions, setPermissions] = useState<AdminPermissions[]>(defaultPermissions);

  const { jobs, setJobs, addJob, updateJobStatus } = useJobsStore();
  const { candidates, setCandidates, updateCandidate } = useCandidatesStore();
  const { incidents: incidentReports, addIncident, updateIncidentStatus } = useIncidentsStore();
  const { integrations, toggleIntegration } = useIntegrationsStore();
  const { vendors: partnerVendors, addVendor, updateVendorStatus } = useVendorsStore();
  const { logs, addLog } = useLogsStore();

  const handleBookJob = (newJob: any) => {
    addJob(newJob);
    addLog(
      'scheduler', 
      `[Block Booked]: ${newJob.businessName} booked an urgent ${newJob.blockType} vertical block for ${newJob.category}. Syncing to QuickBooks Online...`, 
      'info'
    );
  };

  const handleAddIncident = (newIncident: any) => {
    addIncident(newIncident);
    addLog('system', `[Incident Logged] ${newIncident.reportedBy.toUpperCase()} reported a ${newIncident.category} detail for ${newIncident.businessName} (Severity: ${newIncident.severity.toUpperCase()})`, 'warning');
  };

  const handleUpdateIncidentStatus = (id: string, status: any, resolutionNotes?: string) => {
    updateIncidentStatus(id, status, resolutionNotes);
    addLog('system', `[Incident Resolution] Incident ${id} transitioned to resolved.`, 'success');
  };

  const handleAddPartnerVendor = (vendor: any) => {
    addVendor(vendor);
    addLog('scheduler', `[Vendor Registered] Subcontract supplier state created: ${vendor.name}`, 'success');
  };

  const handleUpdatePartnerVendorStatus = (id: string, status: any) => {
    updateVendorStatus(id, status);
    addLog('scheduler', `[Vendor Status updated] ${id} to state: ${status}`, 'info');
  };

  return (
    <AppShell 
      currentView={currentView}
      setCurrentView={setCurrentView}
      isEnterprise={isEnterprise}
      setIsEnterprise={setIsEnterprise}
      jobs={jobs}
      candidates={candidates}
      integrations={integrations}
      logs={logs}
      partnerVendors={partnerVendors}
      incidentReports={incidentReports}
      branches={branches}
      rateCards={rateCards}
      ssoConfig={ssoConfig}
      permissions={permissions}
      handleAddLog={addLog}
      handleBookJob={handleBookJob}
      handleChangeJobStatus={updateJobStatus}
      handleUpdateCandidate={updateCandidate}
      handleToggleIntegration={toggleIntegration}
      handleAddIncident={handleAddIncident}
      handleUpdateIncidentStatus={handleUpdateIncidentStatus}
      handleAddPartnerVendor={handleAddPartnerVendor}
      handleUpdatePartnerVendorStatus={handleUpdatePartnerVendorStatus}
      setJobs={setJobs}
      setCandidates={setCandidates}
      setBranches={setBranches}
      setRateCards={setRateCards}
      setSsoConfig={setSsoConfig}
      setPermissions={setPermissions}
    />
  );
}
