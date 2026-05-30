import { Navigation, ViewState } from '../components/Navigation';
import { HomeView } from '../components/Home';
import { BookingPage as BookLaborView } from '../features/booking/BookingPage';
import { ClientPortalView } from '../components/ClientPortal';
import { ContractorPortalView } from '../components/ContractorPortal';
import { StaffDashboardView } from '../components/StaffDashboard';
import { ServicesView } from '../components/Services';
import { PricingView } from '../components/Pricing';
import { AboutView } from '../components/About';
import { QaStagingHub } from '../components/QaStagingHub';

interface AppShellProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isEnterprise: boolean;
  setIsEnterprise: (value: boolean) => void;
  jobs: any[]; 
  candidates: any[];
  integrations: any[];
  logs: any[];
  partnerVendors: any[];
  incidentReports: any[];
  branches: any[];
  rateCards: any[];
  ssoConfig: any;
  permissions: any[];
  handleAddLog: any;
  handleBookJob: any;
  handleChangeJobStatus: any;
  handleUpdateCandidate: any;
  handleToggleIntegration: any;
  handleAddIncident: any;
  handleUpdateIncidentStatus: any;
  handleAddPartnerVendor: any;
  handleUpdatePartnerVendorStatus: any;
  setJobs: any;
  setCandidates: any;
  setBranches: any;
  setRateCards: any;
  setSsoConfig: any;
  setPermissions: any;
}

export function AppShell({ 
  currentView, 
  setCurrentView, 
  isEnterprise,
  setIsEnterprise,
  jobs,
  candidates,
  integrations,
  logs,
  partnerVendors,
  incidentReports,
  branches,
  rateCards,
  ssoConfig,
  permissions,
  handleAddLog,
  handleBookJob,
  handleChangeJobStatus,
  handleUpdateCandidate,
  handleToggleIntegration,
  handleAddIncident,
  handleUpdateIncidentStatus,
  handleAddPartnerVendor,
  handleUpdatePartnerVendorStatus,
  setJobs,
  setCandidates,
  setBranches,
  setRateCards,
  setSsoConfig,
  setPermissions
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0F1115] font-sans text-white antialiased selection:bg-[#10B981] selection:text-[#0F1115]">
      <Navigation currentView={currentView} setView={setCurrentView} />
      
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
