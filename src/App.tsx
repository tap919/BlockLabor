import { useState } from 'react';
import { Navigation, ViewState } from './components/Navigation';
import { HomeView } from './components/Home';
import { BookLaborView } from './components/BookLabor';
import { ClientPortalView } from './components/ClientPortal';
import { ContractorPortalView } from './components/ContractorPortal';
import { StaffDashboardView } from './components/StaffDashboard';
import { ServicesView } from './components/Services';
import { PricingView } from './components/Pricing';
import { AboutView } from './components/About';
import { QaStagingHub } from './components/QaStagingHub';

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
} from './data';
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
} from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  
  // Real active shared database nodes
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [candidates, setCandidates] = useState<WorkerCandidate[]>(mockCandidates);
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>(mockIntegrations);
  const [logs, setLogs] = useState<SystemLog[]>(initialLogs);
  const [partnerVendors, setPartnerVendors] = useState<PartnerVendor[]>(mockPartnerVendors);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>(mockIncidentReports);

  // Premium corporate states
  const [isEnterprise, setIsEnterprise] = useState<boolean>(false);
  const [branches, setBranches] = useState<BranchDivision[]>(mockBranches);
  const [rateCards, setRateCards] = useState<RateCard[]>(mockRateCards);
  const [ssoConfig, setSsoConfig] = useState<SsoConfig>(defaultSsoConfig);
  const [permissions, setPermissions] = useState<AdminPermissions[]>(defaultPermissions);


  // Central log trigger
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

  // Central state book modifier
  const handleBookJob = (newJob: Job) => {
    setJobs(prev => [newJob, ...prev]);
    handleAddLog(
      'scheduler', 
      `[Block Booked]: ${newJob.businessName} booked an urgent ${newJob.blockType} vertical block for ${newJob.category}. Syncing to QuickBooks Online...`, 
      'info'
    );
  };

  // Transition individual job statuses cleanly
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

  // Modify worker onboarding credentials, background check consent checks as recruiters adjust them
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

  // Toggle integration state live in simulated environment
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

  // Incident & dispute handling
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

  // Vendor supplier registration
  const handleAddPartnerVendor = (vendor: PartnerVendor) => {
    setPartnerVendors(prev => [...prev, vendor]);
    handleAddLog('scheduler', `[Vendor Registered] Subcontract supplier state created: ${vendor.name}`, 'success');
  };

  const handleUpdatePartnerVendorStatus = (id: string, status: PartnerVendor['status']) => {
    setPartnerVendors(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    handleAddLog('scheduler', `[Vendor Status updated] ${id} to state: ${status}`, 'info');
  };

  return (
    <div className="min-h-screen bg-[#0F1115] font-sans text-white antialiased selection:bg-[#10B981] selection:text-[#0F1115]">
      <Navigation currentView={currentView} setView={setCurrentView} />
      
      {/* Interactive Premium Sandbox Toggle Bar */}
      <div className={`transition-all duration-300 max-w-7xl mx-auto rounded-b-xl px-4 py-2 text-center text-xs flex flex-wrap justify-between items-center gap-2 shadow-lg sticky top-16 z-40 ${
        isEnterprise 
          ? 'bg-gradient-to-r from-emerald-950 via-zinc-900 to-emerald-950 border-x border-b border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.08)]' 
          : 'bg-[#1b1f28] border-x border-b border-[#2C303B]'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isEnterprise ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-mono text-[11px] text-zinc-300">
            Simulated Sandbox Plan: <strong className={isEnterprise ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{isEnterprise ? '🏆 PREMIUM ENTERPRISE SUITE' : '⚡ STANDARD PAY-AS-YOU-GO'}</strong>
          </span>
          {isEnterprise && (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono text-[9px] px-1.5 py-0.5 ml-2 font-bold uppercase hidden sm:inline-block">
              Okta SSO Verified • Multi-Branch Active
            </span>
          )}
        </div>
        <button 
          onClick={() => {
            const newState = !isEnterprise;
            setIsEnterprise(newState);
            handleAddLog(
              'system', 
              newState 
                ? '🏆 Activated Corporate Enterprise Suite. Unlocked SAML SSO, Multi-Branch management, AutoML staff matching alignment scorecards, customized SLA matrices, and live rate-card automated pre-fill validators.'
                : '⚡ Reverted sandbox profile to Standard pay-as-you-go block booking tier.', 
              newState ? 'success' : 'info'
            );
          }}
          className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
            isEnterprise 
              ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-white' 
              : 'bg-gradient-to-r from-amber-500 to-emerald-500 text-black hover:opacity-90 font-extrabold border-transparent shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse'
          }`}
        >
          {isEnterprise ? '← Downscale to Standard ( pay-go )' : '⚡ Simulate Enterprise Upgrades'}
        </button>
      </div>

      <main className="pb-16">
        {currentView === 'home' && <HomeView setView={setCurrentView} />}
        {currentView === 'services' && <ServicesView />}
        {currentView === 'pricing' && <PricingView isEnterprise={isEnterprise} />}
        
        {currentView === 'book' && (
          <BookLaborView 
            onBookJob={handleBookJob} 
            setView={setCurrentView} 
            isEnterprise={isEnterprise}
            branches={branches}
            rateCards={rateCards}
          />
        )}
        
        {currentView === 'client' && (
          <ClientPortalView 
            jobs={jobs} 
            candidates={candidates} 
            incidentReports={incidentReports}
            onAddIncident={handleAddIncident}
            onChangeJobStatus={handleChangeJobStatus}
            onAddLog={handleAddLog}
            isEnterprise={isEnterprise}
            branches={branches}
            rateCards={rateCards}
          />
        )}
        
        {currentView === 'contractor' && (
          <ContractorPortalView 
            jobs={jobs} 
            candidates={candidates} 
            incidentReports={incidentReports}
            onAddIncident={handleAddIncident}
            onChangeJobStatus={handleChangeJobStatus}
            onUpdateCandidate={handleUpdateCandidate}
            onAddLog={handleAddLog}
          />
        )}

        {currentView === 'staff' && (
          <StaffDashboardView 
            jobs={jobs}
            candidates={candidates}
            integrations={integrations}
            logs={logs}
            partnerVendors={partnerVendors}
            incidentReports={incidentReports}
            onBookJob={handleBookJob}
            onChangeJobStatus={handleChangeJobStatus}
            onUpdateCandidate={handleUpdateCandidate}
            onToggleIntegration={handleToggleIntegration}
            onAddLog={handleAddLog}
            onAddIncident={handleAddIncident}
            onUpdateIncidentStatus={handleUpdateIncidentStatus}
            onAddPartnerVendor={handleAddPartnerVendor}
            onUpdatePartnerVendorStatus={handleUpdatePartnerVendorStatus}
            isEnterprise={isEnterprise}
            setIsEnterprise={setIsEnterprise}
            branches={branches}
            setBranches={setBranches}
            rateCards={rateCards}
            setRateCards={setRateCards}
            ssoConfig={ssoConfig}
            setSsoConfig={setSsoConfig}
            permissions={permissions}
            setPermissions={setPermissions}
          />
        )}
        
        {currentView === 'about' && <AboutView />}

        {currentView === 'qa' && (
          <QaStagingHub
            jobs={jobs}
            setJobs={setJobs}
            candidates={candidates}
            setCandidates={setCandidates}
            logs={logs}
            onAddLog={handleAddLog}
            isEnterprise={isEnterprise}
            setIsEnterprise={setIsEnterprise}
            permissions={permissions}
            setPermissions={setPermissions}
          />
        )}
      </main>
    </div>
  );
}
