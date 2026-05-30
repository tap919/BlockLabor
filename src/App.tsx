import { useState } from 'react';
import { ViewState } from './components/Navigation';
import { AppShell } from './app/AppShell';

import { 
  mockJobs, 
  mockCandidates, 
  mockIntegrations, 
  initialLogs, 
  mockPartnerVendors, 
  mockIncidentReports,
  mockBranches,
  mockRateCards,
  defaultSsoConfig,
  defaultPermissions
} from './shared/mocks/data';
import { 
  Job, 
  WorkerCandidate, 
  IntegrationSetting, 
  SystemLog, 
  PartnerVendor, 
  IncidentReport,
  BranchDivision,
  RateCard,
  SsoConfig,
  AdminPermissions
} from './shared/types/domain';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [candidates, setCandidates] = useState<WorkerCandidate[]>(mockCandidates);
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>(mockIntegrations);
  const [logs, setLogs] = useState<SystemLog[]>(initialLogs);
  const [partnerVendors, setPartnerVendors] = useState<PartnerVendor[]>(mockPartnerVendors);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>(mockIncidentReports);
  const [isEnterprise, setIsEnterprise] = useState<boolean>(false);
  const [branches, setBranches] = useState<BranchDivision[]>(mockBranches);
  const [rateCards, setRateCards] = useState<RateCard[]>(mockRateCards);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig>(defaultSsoConfig);
  const [permissions, setPermissions] = useState<AdminPermissions[]>(defaultPermissions);

  const handleAddLog = (
    category: SystemLog['category'], 
    message: string, 
    type: SystemLog['type'] = 'info'
  ) => {
    const newLog: SystemLog = {
      id: 'log-' + Math.floor(Math.random() * 100000 + 400),
      timestamp: new Date().toISOString(),
      category,
      message,
      type
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleBookJob = (newJob: Job) => {
    setJobs(prev => [newJob, ...prev]);
    handleAddLog(
      'scheduler', 
      `[Block Booked]: ${newJob.businessName} booked an urgent ${newJob.blockType} vertical block for ${newJob.category}. Syncing to QuickBooks Online...`, 
      'info'
    );
  };

  const handleChangeJobStatus = (
    jobId: string, 
    status: Job['status'], 
    contractorId?: string, 
    extraUpdates?: Partial<Job>
  ) => {
    setJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        return {
          ...job,
          status,
          ...(contractorId !== undefined ? { contractorId } : {}),
          ...extraUpdates
        };
      }
      return job;
    }));
  };

  const handleUpdateCandidate = (
    candidateId: string, 
    updates: Partial<WorkerCandidate>
  ) => {
    setCandidates(prev => prev.map(cand => {
      if (cand.id === candidateId) {
        return { ...cand, ...updates };
      }
      return cand;
    }));
  };

  const handleToggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(node => {
      if (node.id === id) {
        return {
          ...node,
          status: node.status === 'connected' ? 'disconnected' : 'connected',
          lastSync: new Date().toISOString()
        };
      }
      return node;
    }));
  };

  const handleAddIncident = (newIncident: IncidentReport) => {
    setIncidentReports(prev => [newIncident, ...prev]);
    handleAddLog('system', `[Incident Logged] ${newIncident.reportedBy.toUpperCase()} reported a ${newIncident.category} detail for ${newIncident.businessName} (Severity: ${newIncident.severity.toUpperCase()})`, 'warning');
  };

  const handleUpdateIncidentStatus = (id: string, status: IncidentReport['status'], resolutionNotes?: string) => {
    setIncidentReports(prev => prev.map(inc => {
      if (inc.id === id) {
        return { ...inc, status, ...(resolutionNotes ? { resolutionNotes } : {}) };
      }
      return inc;
    }));
    handleAddLog('system', `[Incident Resolution] Incident ${id} transitioned to resolved.`, 'success');
  };

  const handleAddPartnerVendor = (vendor: PartnerVendor) => {
    setPartnerVendors(prev => [...prev, vendor]);
    handleAddLog('scheduler', `[Vendor Registered] Subcontract supplier state created: ${vendor.name}`, 'success');
  };

  const handleUpdatePartnerVendorStatus = (id: string, status: PartnerVendor['status']) => {
    setPartnerVendors(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    handleAddLog('scheduler', `[Vendor Status updated] ${id} to state: ${status}`, 'info');
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
      handleAddLog={handleAddLog}
      handleBookJob={handleBookJob}
      handleChangeJobStatus={handleChangeJobStatus}
      handleUpdateCandidate={handleUpdateCandidate}
      handleToggleIntegration={handleToggleIntegration}
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
