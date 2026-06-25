import { useState } from 'react';
import { AppShell } from './app/AppShell';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { HomeView } from './features/landing/components/Home';
import { BookingPage as BookLaborView } from './features/booking/BookingPage';
import { ClientPortalView } from './features/jobs/components/ClientPortal';
import { ContractorPortalView } from './features/candidates/components/ContractorPortal';
import { StaffDashboardView } from './features/dashboard/components/StaffDashboard';
import { ServicesView } from './features/landing/components/Services';
import { PricingView } from './features/landing/components/Pricing';
import { AboutView } from './features/landing/components/About';
import { QaStagingHub } from './features/admin/components/QaStagingHub';
import { SignInForm } from './features/auth/SignInForm';
import { RequireAuth } from './features/auth/RequireAuth';
import { useAuth } from './features/auth/AuthContext';
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
  AdminPermissions,
  SimulatorRole
} from './shared/types/domain';
import { useJobsStore } from './features/jobs/jobsStore';
import { useCandidatesStore } from './features/candidates/candidatesStore';
import { useIncidentsStore } from './features/incidents/incidentsStore';
import { useIntegrationsStore } from './features/integrations/integrationsStore';
import { useVendorsStore } from './features/vendors/vendorsStore';
import { useLogsStore } from './features/logs/logsStore';
import type { ViewState } from './components/common/Navigation';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'services' | 'pricing' | 'book' | 'client' | 'contractor' | 'about' | 'staff' | 'qa' | 'signin' >('home');
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
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleAddLog = (category: string, message: string, type?: string) => {
    addLog(category as any, message, type as any);
  };

  const handleSetView = (view: ViewState | ((prev: ViewState) => ViewState)) => {
    const newView = typeof view === 'function' ? view(currentView) : view;
    setCurrentView(newView);
    if (newView === 'signin') {
      navigate('/signin');
    } else {
      navigate('/'); // Navigate to home or root path for other views
    }
  };

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
      setCurrentView={handleSetView}
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
    >
      <Routes>
        <Route path="/signin" element={<SignInForm onSuccess={() => navigate('/')} />} />
        <Route path="/unauthorized" element={<div>Unauthorized Access</div>} />
        <Route path="/" element={<HomeView setView={handleSetView} />} />
        <Route path="/services" element={<ServicesView />} />
        <Route path="/pricing" element={<PricingView isEnterprise={isEnterprise} />} />
        <Route 
          path="/book"
          element={
            <BookLaborView 
              onBookJob={handleBookJob} 
              setView={(v) => handleSetView(v as typeof currentView)} 
              isEnterprise={isEnterprise}
              branches={branches}
              rateCards={rateCards}
            />
          }
        />
        <Route 
          path="/client"
          element={
            <ClientPortalView 
              jobs={jobs} 
              candidates={candidates} 
              incidentReports={incidentReports}
              onAddIncident={handleAddIncident}
              onChangeJobStatus={updateJobStatus}
              onAddLog={handleAddLog}
              isEnterprise={isEnterprise}
              branches={branches}
              rateCards={rateCards}
            />
          }
        />
        <Route 
          path="/contractor"
          element={
            <ContractorPortalView 
              jobs={jobs} 
              candidates={candidates} 
              incidentReports={incidentReports}
              onAddIncident={handleAddIncident}
              onChangeJobStatus={updateJobStatus}
              onUpdateCandidate={updateCandidate}
              onAddLog={handleAddLog}
            />
          }
        />
        <Route 
          path="/staff"
          element={
            <RequireAuth allowedRoles={['owner', 'recruiter', 'scheduler', 'payroll']}>
              <StaffDashboardView 
                jobs={jobs}
                candidates={candidates}
                integrations={integrations}
                logs={logs}
                partnerVendors={partnerVendors}
                incidentReports={incidentReports}
                onBookJob={handleBookJob}
                onChangeJobStatus={updateJobStatus}
                onUpdateCandidate={updateCandidate}
                onToggleIntegration={toggleIntegration}
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
            </RequireAuth>
          }
        />
        <Route path="/about" element={<AboutView />} />
        <Route 
          path="/qa"
          element={
            <RequireAuth allowedRoles={['owner', 'recruiter', 'scheduler', 'payroll']}>
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
            </RequireAuth>
          }
        />
      </Routes>
    </AppShell>
  );
}
