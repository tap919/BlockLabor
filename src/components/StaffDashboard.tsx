import { useState, useMemo, FormEvent, Dispatch, SetStateAction } from 'react';
import { 
  Job, WorkerCandidate, IntegrationSetting, SystemLog, VerticalType, RequiredCredential, PartnerVendor, IncidentReport 
} from '../shared/types/domain';
import { 
  VERTICAL_WORKFLOWS, PRICING_BLOCKS, CATEGORIES_BY_VERTICAL, VERTICALS
} from '../constants';
import { 
  LineChart, Sparkles, AlertTriangle, CloudSun, Calendar, Users, 
  DollarSign, CheckSquare, Shield, Clock, Send, Link, CheckCircle, 
  XCircle, Filter, FileText, Smartphone, RefreshCw, Key, ArrowRight,
  TrendingUp, MapPin, CheckCircle2, ChevronRight, Briefcase, FileSignature, Info,
  Layers, Settings, Award, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReportingAnalytics } from './ReportingAnalytics';
import { MarginTracker } from './MarginTracker';
import { BillingInvoicing } from './BillingInvoicing';

interface StaffDashboardProps {
  jobs: Job[];
  candidates: WorkerCandidate[];
  integrations: IntegrationSetting[];
  logs: SystemLog[];
  partnerVendors?: PartnerVendor[];
  incidentReports?: IncidentReport[];
  onBookJob?: (job: Job) => void;
  onChangeJobStatus: (jobId: string, status: Job['status'], contractorId?: string, extraUpdates?: Partial<Job>) => void;
  onUpdateCandidate: (candidateId: string, updates: Partial<WorkerCandidate>) => void;
  onToggleIntegration: (integrationId: string) => void;
  onAddLog: (category: SystemLog['category'], message: string, type?: SystemLog['type']) => void;
  onAddIncident?: (newIncident: IncidentReport) => void;
  onUpdateIncidentStatus?: (id: string, status: IncidentReport['status'], resolutionNotes?: string) => void;
  onAddPartnerVendor?: (vendor: PartnerVendor) => void;
  onUpdatePartnerVendorStatus?: (id: string, status: PartnerVendor['status']) => void;
  isEnterprise?: boolean;
  setIsEnterprise?: Dispatch<SetStateAction<boolean>>;
  branches?: any[];
  setBranches?: Dispatch<SetStateAction<any[]>>;
  rateCards?: any[];
  setRateCards?: Dispatch<SetStateAction<any[]>>;
  ssoConfig?: any;
  setSsoConfig?: Dispatch<SetStateAction<any>>;
  permissions?: any[];
  setPermissions?: Dispatch<SetStateAction<any[]>>;
}

type StaffRole = 'owner' | 'recruiter' | 'scheduler' | 'payroll' | 'billing' | 'ai_copilot' | 'vendors_incidents' | 'sso_permissions';

// Location Coordinates Match
const LOCATIONS_COORDINATES = [
  { name: 'Downtown Warehouse D-12', address: '120 Dockside Rd, Suite 4', supervisor: 'George K.' },
  { name: 'West Wing Ward B, Room 4', address: '900 Medical Valley Blvd', supervisor: 'Charge Nurse Laura' },
  { name: 'Convention Center Pavilion A', address: '400 Exposition Dr', supervisor: 'Sonia Perez (Events Partner)' },
  { name: 'Financial District Tower, Suite 400', address: '60 Wall St, Floor 4', supervisor: 'Eleanor Vance' },
  { name: 'Metropolitan Ball Room', address: '100 Plaza Ave, Ballroom B', supervisor: 'Thomas Granger' }
];

export function StaffDashboardView({
  jobs,
  candidates,
  integrations,
  logs,
  partnerVendors = [],
  incidentReports = [],
  onBookJob,
  onChangeJobStatus,
  onUpdateCandidate,
  onToggleIntegration,
  onAddLog,
  onAddIncident,
  onUpdateIncidentStatus,
  onAddPartnerVendor,
  onUpdatePartnerVendorStatus,
  isEnterprise = false,
  setIsEnterprise = () => {},
  branches = [],
  setBranches = () => {},
  rateCards = [],
  setRateCards = () => {},
  ssoConfig = {},
  setSsoConfig = () => {},
  permissions = [],
  setPermissions = () => {}
}: StaffDashboardProps) {
  const [activeStaffRole, setActiveStaffRole] = useState<StaffRole>('owner');
  const [selectedVerticalFilter, setSelectedVerticalFilter] = useState<string>('All');
  
  // Custom Owner sub-tabs
  const [ownerSubTab, setOwnerSubTab] = useState<'summary' | 'analytics' | 'margins'>('summary');

  // Payroll advanced state
  const [expandedPayrollJobId, setExpandedPayrollJobId] = useState<string | null>(null);
  const [payrollExpenseInput, setPayrollExpenseInput] = useState<number>(0);
  const [payrollDeductionInput, setPayrollDeductionInput] = useState<number>(0);
  
  // Custom Recruiters states
  const [phoneSimulatorCandidateId, setPhoneSimulatorCandidateId] = useState<string | null>(null);
  const [typedSMS, setTypedSMS] = useState('');

  // AI Copilot states
  const [copilotJobId, setCopilotJobId] = useState<string>('');
  const [copilotCandidateId, setCopilotCandidateId] = useState<string>('');
  const [copilotMode, setCopilotMode] = useState<'job_desc' | 'screening' | 'outreach'>('job_desc');
  const [copilotInstruction, setCopilotInstruction] = useState<string>('');
  const [copilotResponse, setCopilotResponse] = useState<string>('');
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // Vendor Registration states
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorMarkup, setVendorMarkup] = useState<number>(15);
  const [vendorTaxId, setVendorTaxId] = useState('');
  const [vendorVertical, setVendorVertical] = useState<VerticalType>('Light Industrial');

  // Incident submission states
  const [incJobId, setIncJobId] = useState('');
  const [incWorkerId, setIncWorkerId] = useState('');
  const [incCategory, setIncCategory] = useState<'safety' | 'misconduct' | 'dispute' | 'other'>('safety');
  const [incSeverity, setIncSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [incReporter, setIncReporter] = useState<'worker' | 'client' | 'agency'>('client');
  const [incDescription, setIncDescription] = useState('');

  // Custom Scheduler Form States
  const [newJobBusiness, setNewJobBusiness] = useState('');
  const [newJobVertical, setNewJobVertical] = useState<VerticalType>('Light Industrial');
  const [newJobCategory, setNewJobCategory] = useState('Warehouse Packing');
  const [newJobLocation, setNewJobLocation] = useState('Downtown Warehouse D-12');
  const [newJobPayRate, setNewJobPayRate] = useState<number>(25);
  const [newJobBillRate, setNewJobBillRate] = useState<number>(35);
  const [newJobHeadcount, setNewJobHeadcount] = useState<number>(1);
  const [newJobStartTime, setNewJobStartTime] = useState('08:00');
  const [newJobEndTime, setNewJobEndTime] = useState('16:00');
  const [newJobDurationShifts, setNewJobDurationShifts] = useState<number>(1);
  const [newJobStartWindow, setNewJobStartWindow] = useState('Tomorrow, Day Shift');
  const [newJobSkills, setNewJobSkills] = useState('');

  // Interactive Matchmaking States
  const [matchmakingJobId, setMatchmakingJobId] = useState<string | null>(null);

  // Custom Shift Presets / Templates
  const SHIFT_TEMPLATES = [
    { title: '🛠️ Industrial Packer Pro', vertical: 'Light Industrial' as const, category: 'Warehouse Packing', pay: 25, bill: 35, start: '14:00', end: '18:00', duration: 1, text: 'Must have forklift cert, safety vest' },
    { title: '🏥 CNA Ward Caregiver', vertical: 'Healthcare' as const, category: 'Nursing Assistant (CNA) Support', pay: 28, bill: 38, start: '07:00', end: '15:00', duration: 1, text: 'State CNA, CPR BLS certified' },
    { title: '🎟️ Event Marshall Extra', vertical: 'Events' as const, category: 'Event Ticket Scanner', pay: 22, bill: 30, start: '17:00', end: '21:00', duration: 1, text: 'Uniform black, ticket scanners' },
    { title: '📂 Office Data Overload', vertical: 'Clerical' as const, category: 'Data Entry backlog', pay: 21, bill: 28, start: '09:00', end: '17:00', duration: 5, text: 'Sensitive records, NDA signed' }
  ];

  // Computations for Analytics (Owner View)
  const totalVolume = jobs.reduce((acc, curr) => acc + curr.charge, 0);
  const totalPayout = jobs.reduce((acc, curr) => acc + (curr.status === 'paid' || curr.status === 'completed' ? curr.payout : 0), 0);
  const estimatedProfit = jobs.reduce((acc, curr) => acc + (curr.charge - curr.payout), 0);
  const activeFulfillmentRate = jobs.length > 0 
    ? Math.round((jobs.filter(j => j.status !== 'open').length / jobs.length) * 100) 
    : 100;

  // Reusable credential mapper
  const getAllCredentials = () => {
    const credMap: Record<string, string> = {};
    VERTICAL_WORKFLOWS.forEach(w => {
      w.mandatoryCredentials.forEach(c => {
        credMap[c.id] = c.name;
      });
    });
    return credMap;
  };
  const credentialNames = getAllCredentials();

  // Helper: Send recruit text SMS alert
  const handleSendSMSToCandidate = (cand: WorkerCandidate) => {
    if (!typedSMS.trim()) return;
    onAddLog('sms', `[Outbound Text to ${cand.name}]: "${typedSMS}"`, 'sms');
    
    // Inject sent message directly into candidate's messages log
    const systemMsg = {
      id: 'msg-' + Date.now(),
      sender: 'Staff Sourcing',
      text: typedSMS,
      timestamp: new Date().toISOString()
    };
    onUpdateCandidate(cand.id, {
      messages: [...(cand.messages || []), systemMsg]
    });

    setTypedSMS('');
    alert(`SMS text dispatched to mobile gateway and logged under ${cand.name}'s thread.`);
  };

  // Helper: Calculate markup on the fly
  const currentMarkupPercent = useMemo(() => {
    if (newJobPayRate <= 0) return 0;
    const markup = ((newJobBillRate - newJobPayRate) / newJobPayRate) * 100;
    return Math.round(markup * 10) / 10;
  }, [newJobPayRate, newJobBillRate]);

  // Handle Loading Template
  const handleLoadTemplate = (tpl: typeof SHIFT_TEMPLATES[0]) => {
    setNewJobVertical(tpl.vertical);
    const cats = CATEGORIES_BY_VERTICAL[tpl.vertical] || [];
    setNewJobCategory(tpl.category);
    setNewJobPayRate(tpl.pay);
    setNewJobBillRate(tpl.bill);
    setNewJobStartTime(tpl.start);
    setNewJobEndTime(tpl.end);
    setNewJobDurationShifts(tpl.duration);
    setNewJobSkills(tpl.text);
    
    if (tpl.vertical === 'Light Industrial') {
      setNewJobLocation('Downtown Warehouse D-12');
      setNewJobStartWindow('Tomorrow, Afternoon (2 PM - 6 PM)');
    } else if (tpl.vertical === 'Healthcare') {
      setNewJobLocation('West Wing Ward B, Room 4');
      setNewJobStartWindow('This Saturday, Day (7 AM - 3 PM)');
    } else if (tpl.vertical === 'Events') {
      setNewJobLocation('Convention Center Pavilion A');
      setNewJobStartWindow('Today, Evening (5 PM - 9 PM)');
    } else {
      setNewJobLocation('Financial District Tower, Suite 400');
      setNewJobStartWindow('Starting Next Monday, Morning');
    }
    
    alert(`Template loaded! Prefilled SOW rate settings.`);
  };

  // Handle manual Job order placement inside Scheduler backoffice
  const handleCreateJobOrder = (e: FormEvent) => {
    e.preventDefault();
    if (!onBookJob) return;

    const jobId = 'job-' + Math.floor(Math.random() * 1000 + 400);
    const splitSkills = newJobSkills ? newJobSkills.split(',').map(s => s.trim()) : ['General Support'];

    // Construct compliance checklist
    const activeWorkflow = VERTICAL_WORKFLOWS.find(v => v.vertical === newJobVertical) || VERTICAL_WORKFLOWS[0];
    const checklist = activeWorkflow.complianceChecklist.map((term, idx) => ({
      id: `${jobId}-check-${idx}`,
      text: term,
      completed: false
    }));
    checklist.unshift({ id: `${jobId}-check-i`, text: 'Check card credentials on GPS lock-in', completed: false });

    // Calculate payouts based on hourly rates and block duration (or simple fallback)
    // Fallback: 4 hours if not explicitly computed
    const multiplierHours = newJobPayRate * 4;

    const newJob: Job = {
      id: jobId,
      businessName: newJobBusiness || 'Backoffice Requested LLC',
      vertical: newJobVertical,
      category: newJobCategory || CATEGORIES_BY_VERTICAL[newJobVertical]?.[0],
      blockType: newJobDurationShifts > 1 ? '1-week' : '8-hour',
      startWindow: newJobStartWindow || 'Tomorrow morning SOW window',
      location: newJobLocation,
      requiredSkills: splitSkills,
      status: 'open',
      payout: multiplierHours,
      charge: newJobBillRate * 4,
      createdAt: new Date().toISOString(),
      checklist,
      headcount: newJobHeadcount,
      billRate: newJobBillRate,
      payRate: newJobPayRate,
      markup: currentMarkupPercent,
      hoursPerShift: 4,
      durationShifts: newJobDurationShifts,
      locationName: newJobLocation,
      shiftStartTime: newJobStartTime,
      shiftEndTime: newJobEndTime
    };

    onBookJob(newJob);
    setNewJobBusiness('');
    setNewJobSkills('');
    alert(`New SOW Job Order ${jobId} deployed to Dispatch board! Headcount requested: ${newJobHeadcount}.`);
  };

  // Automated swap/drop approval
  const handleApproveSwap = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.contractorId) return;

    const contractorObj = candidates.find(c => c.id === job.contractorId);
    
    // Clear contractor assignment and set back to open board, clear swap flags
    onChangeJobStatus(jobId, 'open', undefined, {
      swapRequested: false,
      dropRequested: false
    });

    onAddLog('scheduler', `[Teammate Swap Approved] Shift swap for ${job.businessName} has been approved. The block is back on open board. SMS notification sent to ${contractorObj?.name}.`, 'success');
    alert("Teammate swap approved! The SOW block is immediately released as 'open' for dispatch.");
  };

  // Candidate document verification
  const handleApproveDoc = (candidateId: string, docId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || !candidate.documents) return;

    const updatedDocs = candidate.documents.map(doc => {
      if (doc.id === docId) {
        return { ...doc, status: 'verified' as const };
      }
      return doc;
    });

    // Auto-verify credential lists based on type
    let verifiedExtra = [...candidate.verifiedCredentials];
    const targetDoc = candidate.documents.find(d => d.id === docId);
    if (targetDoc) {
      if (targetDoc.type.toLowerCase().includes('food')) {
        verifiedExtra.push('food_handler');
      } else if (targetDoc.type.toLowerCase().includes('license') || targetDoc.type.toLowerCase().includes('forklift')) {
        verifiedExtra.push('forklift_cert');
      } else if (targetDoc.type.toLowerCase().includes('medical') || targetDoc.type.toLowerCase().includes('cna')) {
        verifiedExtra.push('cna_license');
      }
    }

    onUpdateCandidate(candidateId, {
      documents: updatedDocs,
      verifiedCredentials: Array.from(new Set(verifiedExtra)),
      status: 'active' // Promote to active if they signed
    });

    onAddLog('recruiter', `[Manual Certification Approved] Recruiter approved file '${targetDoc?.name}' for ${candidate.name}. Credential flagged active.`, 'success');
    alert("Worker document verified and credentials ledger flagged successfully!");
  };

  // OVERTIME ESTIMATOR & FORECAST TRACKER
  // Calculate total scheduled hours for each worker to see if they exceed 40 hours!
  const contractorScheduledHours = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    // Seed MAP
    candidates.forEach(c => {
      hoursMap[c.id] = 0;
    });

    // Map through accepted/completed jobs
    jobs.forEach(j => {
      if (j.contractorId) {
        const hours = j.blockType === '1-week' ? 40 : j.blockType === '8-hour' ? 8 : 4;
        hoursMap[j.contractorId] = (hoursMap[j.contractorId] || 0) + hours;
      }
    });

    return hoursMap;
  }, [jobs, candidates]);

  return (
    <div className="min-h-screen bg-[#0F1115] py-6 sm:py-10 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header details */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[#2A2D35] pb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Shield className="h-6 w-6 text-[#10B981]" /> Staff Operations Center
            </h1>
            <p className="text-xs text-[#8E9299] mt-1">
              Automated 1099 dispatch audit, recruiting document OCR verification, and Gusto/QuickBooks sync controllers.
            </p>
          </div>
          
          {/* Quick Switch Clearance tabs */}
          <div className="flex flex-wrap p-1 bg-[#161920] rounded-lg border border-[#2A2D35] gap-1 self-start">
            {[
              { id: 'owner', label: 'Owner Insights' },
              { id: 'recruiter', label: 'Recruitment (ATS)' },
              { id: 'scheduler', label: 'SOW Scheduling' },
              { id: 'payroll', label: 'Gusto Payroll' },
              { id: 'billing', label: 'Client Invoicing' },
              { id: 'ai_copilot', label: '✨ AI Co-Pilot' },
              { id: 'vendors_incidents', label: '💼 Partners & Incidents' },
              { id: 'sso_permissions', label: '🛡️ SAML & Branches' }
            ].map(role => (
              <button
                key={role.id}
                onClick={() => setActiveStaffRole(role.id as StaffRole)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                  activeStaffRole === role.id 
                    ? 'bg-[#10B981] text-[#0F1115]' 
                    : 'text-[#8E9299] hover:text-white'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {/* -------------------------------------------------------------
            TAB: OWNER INSIGHTS
            ------------------------------------------------------------- */}
        {activeStaffRole === 'owner' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Owner Insights subnavigation header */}
            <div className="flex bg-[#161920] p-1 rounded-lg border border-[#2A2D35] gap-1 self-start flex-wrap max-w-xl">
              {[
                { id: 'summary', label: 'Dashboard Summary' },
                { id: 'analytics', label: 'Fulfillment Metrics' },
                { id: 'margins', label: 'Margins Audit Desk' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setOwnerSubTab(sub.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                    ownerSubTab === sub.id 
                      ? 'bg-[#10B981] text-[#0F1115]' 
                      : 'text-[#8E9299] hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {ownerSubTab === 'summary' && (
              <>
                {/* Owner Stats Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#8E9299] tracking-wider block">Billed Charge Value</span>
                    <span className="text-2xl font-mono text-white font-bold block">${totalVolume.toLocaleString()}</span>
                    <p className="text-[9px] text-[#10B981]">Total invoices issued in QuickBooks Online</p>
                  </div>
                  <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#8E9299] tracking-wider block">Contractor Disbursements</span>
                    <span className="text-2xl font-mono text-white font-bold block">${totalPayout.toLocaleString()}</span>
                    <p className="text-[9px] text-zinc-500">Authorized contractor 1099 direct transfers</p>
                  </div>
                  <div className="bg-[#161920] border border-[#10B98133] bg-[#10B981]/[0.02] rounded-xl p-5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#10B981] tracking-wider block">Est. Facilitation Margin</span>
                    <span className="text-2xl font-mono text-[#10B981] font-bold block">${estimatedProfit.toLocaleString()}</span>
                    <p className="text-[9px] text-zinc-400">Calculated gross profit retention: ~26.4%</p>
                  </div>
                  <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#8E9299] tracking-wider block">Fulfillment Ratio</span>
                    <span className="text-2xl font-mono text-white font-bold block">{activeFulfillmentRate}%</span>
                    <p className="text-[9px] text-[#F59E0B]">Pre-vetted bookings containing matched operators</p>
                  </div>
                </div>

                {/* Overtime & Over-work warnings block */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#EF4444] flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Overtime Risk & Labor Forecast Tracker
                  </h3>
                  <p className="text-xs text-[#8E9299]">
                    To maintain high operating margins, schedulers must ensure no individual 1099 contractor exceeds 40 work hours weekly unless premium pricing blocks are authorized with customers. Check live workload hours:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {candidates.map(c => {
                      const hrs = contractorScheduledHours[c.id] || 0;
                      const isOvertime = hrs > 40;
                      return (
                        <div key={c.id} className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                          isOvertime ? 'bg-red-500/10 border-red-500/25' : 'bg-[#1F232B] border-[#373A43]'
                        }`}>
                          <div>
                            <span className="font-bold text-white block">{c.name}</span>
                            <span className="text-[10px] text-slate-500">{c.verticals.join(', ')}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm block text-white">{hrs} hrs</span>
                            {isOvertime ? (
                              <span className="text-[8px] bg-red-500/20 text-red-400 font-bold px-1 rounded uppercase">OT WARNING</span>
                            ) : (
                              <span className="text-[8px] text-zinc-500 uppercase">SAFE RANGE</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Multi-location coordination */}
                  <div className="lg:col-span-2 bg-[#161920] border border-[#2A2D35] rounded-xl p-6 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-1.5 pb-2 border-b border-zinc-800">
                      <MapPin className="h-4 w-4 text-[#10B981]" /> Client Dispatch Multi-Site Roster
                    </h3>
                    
                    <div className="space-y-3">
                      {LOCATIONS_COORDINATES.map((loc, idx) => {
                        const matchedJobs = jobs.filter(j => j.location === loc.name);
                        return (
                          <div key={idx} className="bg-[#1F232B] p-3.5 rounded-lg border border-[#373A43] flex justify-between items-center gap-4 text-xs">
                            <div>
                              <span className="font-bold text-white block text-sm">{loc.name}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{loc.address}</span>
                              <span className="text-[9px] text-[#10B981] font-mono mt-1 block">Supervisor: {loc.supervisor}</span>
                            </div>
                            <div className="text-right">
                              <span className="bg-[#10B98111] border border-[#10B98122] text-[#10B981] font-mono px-2.5 py-0.5 rounded font-bold">
                                {matchedJobs.length} BLOCKS ACTIVE
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* API and log feeds side */}
                  <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-6 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#3B82F6] border-b border-zinc-800 pb-2">
                      Compliance Automation Rules
                    </h3>
                    <div className="space-y-3.5 text-xs text-slate-300">
                      <div className="p-3 bg-black/45 rounded border border-zinc-800 space-y-1">
                        <strong className="text-white">Section 530 Compliance:</strong>
                        <p className="text-[11px] text-[#8E9299]">Workers maintain 100% schedule flexibility. The platform does not penalize dropped SOW blocks, conforming with IRS Independent classification safe harbors.</p>
                      </div>
                      <div className="p-3 bg-black/45 rounded border border-zinc-800 space-y-1">
                        <strong className="text-white">Double-Tier Escrow Hold:</strong>
                        <p className="text-[11px] text-[#8E9299]">To minimize financial slippage, QuickBooks invoices are created in escrow upon shift acceptance. Contractor 1099 payout triggers automatically in Gusto on check-out stamp approvals.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {ownerSubTab === 'analytics' && (
              <ReportingAnalytics jobs={jobs} candidates={candidates} />
            )}

            {ownerSubTab === 'margins' && (
              <MarginTracker jobs={jobs} candidates={candidates} />
            )}

          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: RECRUITMENT (ATS)
            ------------------------------------------------------------- */}
        {activeStaffRole === 'recruiter' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Direct Document Verification Desk */}
            <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] border-b border-zinc-800 pb-2 flex items-center gap-2">
                <FileSignature className="h-4 w-4" /> OCR Credentials Review Desk
              </h3>
              <p className="text-xs text-[#8E9299]">
                Review credentials and identification uploaded by contractors from their self-service portal. OCR validation extracts key parameters automatically for quick back-office check-offs:
              </p>

              <div className="space-y-3">
                {candidates.map(candidate => {
                  const pendingDocs = (candidate.documents || []).filter(doc => doc.status === 'pending');
                  if (pendingDocs.length === 0) return null;
                  return (
                    <div key={candidate.id} className="bg-[#1F232B] p-4 rounded-xl border border-yellow-500/10 space-y-3 text-xs">
                      <div className="flex justify-between items-center bg-black/40 px-3 py-1.5 rounded border border-zinc-800">
                        <div>
                          <span className="font-bold text-white uppercase tracking-wider">{candidate.name}</span>
                          <span className="text-[10px] text-slate-500 block">Verticals: {candidate.verticals.join(', ')}</span>
                        </div>
                        <span className="text-yellow-500 font-mono font-bold uppercase tracking-wide text-[9px]">PENDING ACTION</span>
                      </div>

                      <div className="space-y-2">
                        {pendingDocs.map(doc => (
                          <div key={doc.id} className="bg-black/50 p-3 rounded border border-zinc-800 flex justify-between items-center">
                            <div>
                              <strong className="text-white block text-xs">{doc.name}</strong>
                              <span className="text-zinc-500 font-mono text-[9px] uppercase">{doc.type}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveDoc(candidate.id, doc.id)}
                                className="bg-[#10B981] hover:bg-emerald-400 text-black font-bold uppercase px-3 py-1 rounded text-[10px]"
                              >
                                Approve Extraction
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {candidates.every(c => !(c.documents || []).some(d => d.status === 'pending')) && (
                  <div className="text-center py-6 text-zinc-500 text-xs bg-[#1F232B]/30 rounded-lg border border-dashed border-zinc-800">
                    No outstanding contractor documents pending approval reviews. Verified files synced with Workday.
                  </div>
                )}
              </div>
            </div>

            {/* ATS Pipeline List */}
            <div className="bg-[#161920] border border-[#2A2D35] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2A2D35] bg-[#0F1115] flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Applicant Recruiting Pipelines</h4>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="min-w-full divide-y divide-[#2A2D35] text-left">
                  <thead className="bg-[#0F1115] text-[#8E9299]">
                    <tr>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Candidate Details</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Integrations Tracking</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Onboarding Clearance</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Verified Credentials</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D35]">
                    {candidates.map(cand => (
                      <tr key={cand.id} className="hover:bg-[#1F232B] transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-white text-sm block">{cand.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{cand.phone} • {cand.email}</span>
                          <div className="mt-1 flex gap-1">
                            {cand.verticals.map(v => (
                              <span key={v} className="bg-[#1F232B] px-1 text-[9px] font-bold text-[#10B981] rounded border border-zinc-800">
                                {v}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-[10px]">Checkr Status: <span className={`font-bold font-mono px-1 rounded ${
                              cand.backgroundCheckStatus === 'passed' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>{cand.backgroundCheckStatus.toUpperCase()}</span></p>
                            <p className="text-[10px]">DocuSign Status: <span className={`font-bold font-mono px-1 rounded ${
                              cand.eSignStatus === 'signed' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-red-500/10 text-red-500'
                            }`}>{cand.eSignStatus.toUpperCase()}</span></p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            cand.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {cand.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {cand.verifiedCredentials.map(cid => (
                              <span key={cid} className="bg-black/35 px-1 rounded border border-zinc-800 text-[8px] font-mono text-zinc-400">
                                {cid.replace('_', ' ').toUpperCase()}
                              </span>
                            ))}
                            {cand.verifiedCredentials.length === 0 && (
                              <span className="text-zinc-500 text-[10px]">No credentials linked</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setPhoneSimulatorCandidateId(cand.id)}
                            className="bg-[#1F232B] border border-zinc-700 hover:bg-zinc-800 text-white rounded px-2.5 py-1 text-[10px] font-bold uppercase inline-flex items-center gap-1"
                          >
                            <Smartphone className="h-3 w-3" /> SMS Alert
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inbound / Outbound SMS Controller Panel */}
            {phoneSimulatorCandidateId && (
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 max-w-lg space-y-3">
                {(() => {
                  const currentSMSCand = candidates.find(c => c.id === phoneSimulatorCandidateId);
                  if (!currentSMSCand) return null;
                  return (
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-[#10B981]">SMS Alert Dispatcher</span>
                      <p className="text-xs text-[#8E9299]">Recipient Mobile: <strong className="text-white">{currentSMSCand.name} ({currentSMSCand.phone})</strong></p>
                      
                      <textarea
                        rows={2}
                        value={typedSMS}
                        onChange={e => setTypedSMS(e.target.value)}
                        placeholder="Type a compliance check-up notification or shift suggestion to trigger an instant SMS alert..."
                        className="bg-black border border-zinc-800 rounded p-2 text-xs text-white w-full focus:border-[#10B981] outline-none"
                      />

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setPhoneSimulatorCandidateId(null)}
                          className="bg-zinc-800 px-3 py-1.5 rounded text-xs text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSendSMSToCandidate(currentSMSCand)}
                          className="bg-[#10B981] hover:bg-emerald-400 text-black font-bold uppercase tracking-wider px-4 py-1.5 rounded text-xs"
                        >
                          Send SMS Alert
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: SOW SCHEDULING (DIRECT DISPATCH PANEL)
            ------------------------------------------------------------- */}
        {activeStaffRole === 'scheduler' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left side: templates & create block order */}
            <div className="lg:col-span-1 bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-6">
              
              {/* Preset Shift Templates */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#10B981] tracking-wider block">Load Role-Based Shift Template</span>
                <p className="text-xs text-[#8E9299] mb-3">Load pre-sized operational blocks instantly matching pre-defined billing markups:</p>
                <div className="grid grid-cols-1 gap-2">
                  {SHIFT_TEMPLATES.map((tpl, key) => (
                    <button
                      key={key}
                      onClick={() => handleLoadTemplate(tpl)}
                      className="bg-[#1F232B] border border-zinc-800 hover:border-[#10B981] transition p-2.5 rounded text-left flex justify-between items-center"
                    >
                      <div>
                        <span className="text-white font-bold block text-xs">{tpl.title}</span>
                        <span className="text-zinc-500 text-[10px] uppercase">{tpl.category}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#10B981]" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Job Order Form */}
              <form onSubmit={handleCreateJobOrder} className="space-y-4 border-t border-zinc-800 pt-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block pb-1 border-b border-zinc-800">Manual Job Order Placement</span>
                
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Customer Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Logistics"
                    value={newJobBusiness}
                    onChange={e => setNewJobBusiness(e.target.value)}
                    className="bg-[#1F232B] border border-zinc-800 rounded p-2 text-xs text-white w-full focus:border-[#10B981] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Vertical Task System</label>
                    <select
                      value={newJobVertical}
                      onChange={e => {
                        const val = e.target.value as VerticalType;
                        setNewJobVertical(val);
                        setNewJobCategory(CATEGORIES_BY_VERTICAL[val][0]);
                      }}
                      className="bg-[#1F232B] border border-zinc-800 rounded p-2 text-white w-full outline-none"
                    >
                      {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Role Category</label>
                    <select
                      value={newJobCategory}
                      onChange={e => setNewJobCategory(e.target.value)}
                      className="bg-[#1F232B] border border-zinc-800 rounded p-2 text-white w-full outline-none"
                    >
                      {(CATEGORIES_BY_VERTICAL[newJobVertical] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Contractor Pay ($/hr)</label>
                    <input
                      type="number"
                      required
                      value={newJobPayRate}
                      onChange={e => setNewJobPayRate(Number(e.target.value))}
                      className="bg-[#1F232B] border border-zinc-800 font-mono text-xs text-[#10B981] p-2 rounded w-full outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Client Bill ($/hr)</label>
                    <input
                      type="number"
                      required
                      value={newJobBillRate}
                      onChange={e => setNewJobBillRate(Number(e.target.value))}
                      className="bg-[#1F232B] border border-zinc-800 font-mono text-xs text-white p-2 rounded w-full outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold text-center block mb-1">Calculated Markup</label>
                    <div className="bg-[#1F232B]/60 py-2 rounded text-center text-xs font-mono font-bold text-emerald-400">
                      {currentMarkupPercent}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Headcount Target</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={8}
                      value={newJobHeadcount}
                      onChange={e => setNewJobHeadcount(Number(e.target.value))}
                      className="bg-[#1F232B] border border-zinc-800 p-2 text-xs text-white rounded w-full outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">Duration Shifts</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newJobDurationShifts}
                      onChange={e => setNewJobDurationShifts(Number(e.target.value))}
                      className="bg-[#1F232B] border border-zinc-800 p-2 text-xs text-white rounded w-full outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#10B981] hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider py-2 rounded"
                >
                  Create & Dispatch SOW
                </button>
              </form>
            </div>

            {/* Right side: Open shift dispatch list */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Swap and drop requests approvals desk */}
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-500 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                  <RefreshCw className="h-4 w-4" /> Shift Swap Approvals Desk ({jobs.filter(j => j.swapRequested).length})
                </h3>
                
                <div className="space-y-3">
                  {jobs.filter(j => j.swapRequested).map(job => {
                    const originalContractor = candidates.find(c => c.id === job.contractorId);
                    return (
                      <div key={job.id} className="bg-yellow-500/[0.01] border border-yellow-500/10 p-3.5 rounded-lg flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-white block text-xs">{job.businessName} — {job.category}</strong>
                          <span className="text-zinc-500 text-[10px] block">Released by: {originalContractor?.name || 'Assigned Contractor'}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveSwap(job.id)}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black px-3.5 py-1 rounded font-bold uppercase text-[10px]"
                          >
                            Approve Release SOW
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {jobs.filter(j => j.swapRequested).length === 0 && (
                    <p className="text-zinc-500 text-center py-4 text-xs font-mono">No outstanding shift swap requests reported.</p>
                  )}
                </div>
              </div>

              {/* Active list board */}
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Direct Dispatch Roster List</h3>
                
                <div className="divide-y divide-zinc-800/60">
                  {jobs.map(job => {
                    const assignedWorker = candidates.find(c => c.id === job.contractorId);
                    
                    return (
                      <div key={job.id} className="py-5 border-b border-zinc-800/80 last:border-0 last:pb-0 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="font-bold text-white uppercase text-xs block">{job.businessName}</span>
                            <span className="text-zinc-400 text-[10px] block">{job.category} ({job.blockType})</span>
                            <div className="text-[10px] text-zinc-500 space-y-0.5 mt-1">
                              <p>Timing: {job.shiftStartTime || '08:00'} to {job.shiftEndTime || '16:00'}</p>
                              <p>Location: {job.location}</p>
                              {job.isOutsourced && (
                                <p className="text-purple-400 font-bold flex items-center gap-1">
                                  <Layers className="h-3 w-3" /> Subcontracted to: {partnerVendors.find(pv => pv.id === job.vendorId)?.name || 'Outsourced Partner'}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 space-y-1.5">
                            <span className="font-mono text-[#10B981] font-bold block text-xs">${job.payout} payout</span>
                            
                            {job.status === 'open' ? (
                              <div className="flex flex-col gap-1 text-xs">
                                <select
                                  defaultValue=""
                                  onChange={e => {
                                    const candId = e.target.value;
                                    if (candId) {
                                      onChangeJobStatus(job.id, 'accepted', candId);
                                      const candObj = candidates.find(c => c.id === candId);
                                      onAddLog('scheduler', `[Manual Dispatch Match] Assigned ${candObj?.name} to block contract for ${job.businessName}`, 'success');
                                      alert("Smart candidate dispatch lock-in executed!");
                                    }
                                  }}
                                  className="bg-[#1F232B] border border-zinc-700 text-[10px] text-white rounded p-1 outline-none"
                                >
                                  <option value="" disabled>Smart Dispatch Match...</option>
                                  {candidates
                                    .filter(c => c.status === 'active' && c.verticals.includes(job.vertical))
                                    .map(cand => (
                                      <option key={cand.id} value={cand.id}>
                                        Match: {cand.name} (Rel: {cand.reliabilityScore || 95}% • rating: {cand.clientRatingClass})
                                      </option>
                                    ))}
                                </select>
                                
                                {isEnterprise && (
                                  <div className="mt-2 bg-emerald-500/[0.03] border border-emerald-500/10 p-2.5 rounded text-left text-[10px] max-w-[220px] space-y-1">
                                    <div className="flex items-center gap-1 font-bold text-emerald-400 uppercase tracking-widest font-sans">
                                      <Sparkles className="h-2.5 w-2.5 animate-pulse" /> AI Match Recommendation
                                    </div>
                                    {(() => {
                                      const activeVertCandidates = candidates.filter(c => c.status === 'active' && c.verticals.includes(job.vertical));
                                      if (activeVertCandidates.length > 0) {
                                        const topCand = [...activeVertCandidates].sort((a, b) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0))[0];
                                        const isPastWorker = (topCand.reliabilityScore || 0) > 90 || topCand.clientRatingClass === 'premium';
                                        const alignmentScore = Math.min(99, Math.round((topCand.reliabilityScore || 95) + (isPastWorker ? 4 : 0)));
                                        return (
                                          <div>
                                            <p className="text-[#ECECF1] font-bold">🎯 {topCand.name} — {alignmentScore}% Match</p>
                                            <p className="text-zinc-500 leading-tight mt-0.5 overflow-hidden font-sans">
                                              Punctuality index of {topCand.reliabilityScore}%. High compliance rating for similar past {job.vertical} shifts with Vanguard.
                                            </p>
                                          </div>
                                        );
                                      }
                                      return <p className="text-zinc-500">Scanning pool...</p>;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-zinc-400 font-mono">
                                MATCHED: <strong className="text-[#10B981]">{assignedWorker?.name}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {job.status === 'open' && (
                          <div className="space-y-2 mt-2">
                            {/* Redeployment Engine suggestions */}
                            <div className="bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/80 space-y-2">
                              <div className="flex justify-between items-center bg-zinc-900/40 px-2 py-1 rounded">
                                <span className="text-[10px] text-[#10B981] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 animate-pulse" /> Redeployment Recommendation Engine
                                </span>
                                <span className="text-[9px] text-[#10B981] font-mono font-black">
                                  HISTORY LOOKUP
                                </span>
                              </div>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                {candidates
                                  .filter(c => c.status === 'active' && c.verticals.includes(job.vertical))
                                  .map(cand => {
                                    const workedHerePrior = jobs.some(j => j.businessName === job.businessName && j.contractorId === cand.id);
                                    const rawScore = cand.reliabilityScore || 92;
                                    const matchedScore = workedHerePrior ? Math.min(rawScore + 8, 100) : rawScore;
                                    return (
                                      <div key={cand.id} className="flex justify-between items-center bg-[#1B1E26] p-2 rounded text-[11px] border border-zinc-800 hover:border-[#10B981]/25 transition">
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-white">{cand.name}</span>
                                            <span className="text-[10px] text-zinc-400 font-mono">Rel: {cand.reliabilityScore}%</span>
                                            <span className={`text-[9px] font-bold ${
                                              cand.clientRatingClass === 'A+' ? 'text-[#10B981]' : 'text-yellow-400'
                                            }`}>Rating: {cand.clientRatingClass}</span>
                                          </div>
                                          <div className="flex gap-2 text-[10px] text-zinc-500 font-mono">
                                            <span>Attendance: {cand.attendanceRate}%</span>
                                            <span>Completion: {cand.completionRate}%</span>
                                            {workedHerePrior && (
                                              <span className="text-[#10B981] font-bold bg-[#10B981]/10 px-1 rounded text-[8px] uppercase">
                                                ★ Worked Here Prior
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-mono font-bold text-[#10B981] bg-[#10B981]/5 px-1.5 py-0.5 rounded border border-[#10B981]/10 mr-1">
                                            {matchedScore}% SOW Align
                                          </span>
                                          <button
                                            onClick={() => {
                                              onChangeJobStatus(job.id, 'accepted', cand.id);
                                              onAddLog('scheduler', `[Redeployment Assigned] Automatically matched and assigned ${cand.name} to SOW Order with ${job.businessName} (Historical Alignment score ${matchedScore}%)`, 'success');
                                              alert(`Assigned ${cand.name} successfully based on history! SMS schedule sent.`);
                                            }}
                                            className="bg-[#10B981] hover:bg-emerald-400 text-black px-2 py-0.5 rounded text-[9px] font-bold uppercase transition"
                                          >
                                            Redeploy
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                {candidates.filter(c => c.status === 'active' && c.verticals.includes(job.vertical)).length === 0 && (
                                  <p className="text-[10px] text-zinc-600 font-mono text-center py-2">No qualified active partners sourced. Try changing job vertical.</p>
                                )}
                              </div>
                            </div>

                            {/* Subcontracting outsource selection */}
                            <div className="flex items-center justify-between bg-[#1B1E26] p-2 rounded border border-zinc-800">
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Layers className="h-3 w-3" /> Outsourcing Delegation
                              </span>
                              <div className="flex gap-2">
                                <select
                                  defaultValue=""
                                  onChange={e => {
                                    const vId = e.target.value;
                                    if (vId) {
                                      onChangeJobStatus(job.id, 'open', undefined, { isOutsourced: true, vendorId: vId });
                                      const vObj = partnerVendors.find(v => v.id === vId);
                                      onAddLog('scheduler', `[Outsourced Shift] Delegated SOW shift block for ${job.businessName} to Subcontract Partner Vendor ${vObj?.name || 'Partner'}`, 'info');
                                      alert(`Assigned shift order to partner: ${vObj?.name}. Markup share tracked!`);
                                    }
                                  }}
                                  className="bg-zinc-900 border border-[#3A3F4C] text-[10px] text-white rounded px-2 py-1 outline-none"
                                >
                                  <option value="" disabled>Outsource to Supplier...</option>
                                  {partnerVendors
                                    .filter(v => v.status === 'active')
                                    .map(v => (
                                      <option key={v.id} value={v.id}>
                                        {v.name} ({Math.round(v.markupShare * 100)}% Fee)
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: GUSTO & QUICKBOOKS PAYROLL
            ------------------------------------------------------------- */}
        {activeStaffRole === 'payroll' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-[#161920] border border-[#2A2D35] rounded-xl overflow-hidden shadow-xl">
              <div className="px-6 py-5 border-b border-[#2A2D35] bg-[#0F1115] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5">
                    Gusto Multi-State Timesheet Approvals & Multi-Tier Escrow
                  </h3>
                  <p className="text-[10px] text-[#8E9299] mt-0.5">Review approved hours, adjust expense captures/deductions, calculate multi-state tax withholdings, and disburse 1099 wages.</p>
                </div>
                <span className="text-[9px] text-zinc-500 font-mono font-bold bg-[#1F232B] px-2.5 py-1 rounded border border-zinc-800">Gusto API Partner ID: GST-8012</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#2A2D35] text-left text-xs">
                  <thead className="bg-[#0F1115] text-[#8E9299]">
                    <tr>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Client Order Site</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Contractor State</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Hours Breakdown</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px]">Withholding Status</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px] text-right font-mono">Net 1099 Pay</th>
                      <th className="px-6 py-3 font-semibold uppercase text-[10px] text-right">Payroll Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D35] bg-[#161920]">
                    {jobs.map(job => {
                      const assocWorker = candidates.find(c => c.id === job.contractorId);
                      const isExpanded = expandedPayrollJobId === job.id;

                      // Clock hours details
                      const hrs = job.shiftHours || (job.blockType === '1-week' ? 40 : job.blockType === '8-hour' ? 8 : 4);
                      const regHrs = Math.min(hrs, 40);
                      const otHrs = job.overtimeHours || Math.max(0, hrs - 40);
                      
                      const payRate = job.payRate || 20;
                      const basePay = regHrs * payRate;
                      const otPay = otHrs * payRate * 1.5;
                      
                      const expVal = job.payrollExpenses || 0;
                      const dedVal = job.payrollDeductions || 0;
                      
                      const grossPay = basePay + otPay;
                      const netPay = grossPay + expVal - dedVal;

                      // State Tax calculations
                      const taxState = assocWorker?.stateCode || job.stateCode || 'CA';
                      const stateWithholdingPct = taxState === 'CA' ? 0.06 : taxState === 'NY' ? 0.055 : 0;
                      const stateTaxEst = grossPay * stateWithholdingPct;
                      const ficaEst = grossPay * 0.062;
                      const medEst = grossPay * 0.0145;
                      const totalWithholdingEst = ficaEst + medEst + stateTaxEst;

                      // Onboarding timesheet events notes check
                      const notesPath = job.timesheet?.notes || 'Cleared timesheet punch sequence';

                      return (
                        <>
                          <tr key={job.id} className="hover:bg-[#1F232B] transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-white text-sm block">{job.businessName}</span>
                              <span className="text-[10px] text-zinc-500 block mt-0.5">{job.category} ({job.blockType})</span>
                            </td>
                            <td className="px-6 py-4">
                              {assocWorker ? (
                                <div>
                                  <span className="font-bold text-white block">{assocWorker.name}</span>
                                  <span className="text-[10px] text-[#10B981] font-mono block">State: {taxState} • {assocWorker.recruiterName || 'Support Recr.'}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-600 block font-mono">UNASSIGNED</span>
                              )}
                            </td>
                            <td className="px-6 py-4 space-y-1 font-mono">
                              <div className="text-[11px] text-zinc-200">
                                <span>Reg: <strong className="text-white">{regHrs}h</strong></span>
                                {otHrs > 0 && <span className="ml-2">OT: <strong className="text-yellow-500">{otHrs}h</strong></span>}
                              </div>
                              <span className="text-[10px] text-zinc-500 block">{notesPath}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[11px] text-zinc-300 font-mono capitalize">
                                {taxState === 'TX' ? 'TX Safe Harbor' : `Multi-State (${taxState})`}
                              </span>
                              <span className="block text-[9px] text-[#10B981] font-mono">Est WH: ${Math.round(totalWithholdingEst)}</span>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-right py-3">
                              <span className="text-[#10B981] block text-sm">${netPay.toLocaleString()}</span>
                              <span className="text-[9px] text-zinc-500 block">Gross: ${grossPay}</span>
                            </td>
                            <td className="px-6 py-4 text-right space-y-1">
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => {
                                    setExpandedPayrollJobId(isExpanded ? null : job.id);
                                    setPayrollExpenseInput(0);
                                    setPayrollDeductionInput(0);
                                  }}
                                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded text-[10px] font-bold uppercase transition"
                                >
                                  {isExpanded ? 'Hide Adjust' : 'Prep Pay'}
                                </button>

                                {job.status === 'completed' && (
                                  <button
                                    onClick={() => {
                                      onChangeJobStatus(job.id, 'paid');
                                      if (assocWorker) {
                                        onUpdateCandidate(assocWorker.id, { totalEarned: assocWorker.totalEarned + netPay });
                                      }
                                      onAddLog('payroll', `[Gusto] Released Net 1099 Pay of $${netPay} ($${grossPay} Gross) to ${assocWorker?.name} in bank account ${assocWorker?.directDepositDetail?.account || '*****'}. Sync status set.`, 'success');
                                      onAddLog('payroll', `[Ledger] QuickBooks auto-reconciled associated INV-${job.id} corresponding billing charge of $${job.charge}.`, 'success');
                                      alert("1099 wage release and audit trail logged to Gusto ID GST-8012!");
                                    }}
                                    className="bg-[#10B981] hover:bg-emerald-400 text-black px-3 py-1 rounded font-bold uppercase tracking-wider text-[10px]"
                                  >
                                    Release
                                  </button>
                                )}

                                {job.status === 'paid' && (
                                  <span className="text-[#10B981] font-bold uppercase text-[9px] font-mono px-2 py-1 bg-[#10B98111] border border-[#10B98122] rounded flex items-center gap-1">
                                    ✓ DISBURSED
                                  </span>
                                )}

                                {job.status === 'open' && (
                                  <span className="text-zinc-600 font-bold uppercase text-[9px] font-mono px-2 py-1 bg-black/25 rounded">
                                    PENDING SHIFT
                                  </span>
                                )}

                                {job.status === 'accepted' && (
                                  <span className="text-yellow-500 font-bold uppercase text-[9px] font-mono px-2 py-1 bg-yellow-500/10 rounded">
                                    IN PROGRESS
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Detail Adjustments Row Section */}
                          {isExpanded && (
                            <tr key={`${job.id}-exp`} className="bg-[#1F232B]/55 border-l-2 border-[#10B981]">
                              <td colSpan={6} className="px-6 py-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  
                                  {/* Section A: Capture expenses form and deductions */}
                                  <div className="space-y-3 bg-black/25 p-4 rounded-lg border border-zinc-800">
                                    <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Payroll Capture & Deductions</h4>
                                    
                                    <div className="space-y-4 text-xs">
                                      <div>
                                        <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Capturable Expense Allowance ($)</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="number"
                                            value={payrollExpenseInput || ''}
                                            onChange={e => setPayrollExpenseInput(Number(e.target.value))}
                                            placeholder="e.g. 25.00 for fuel"
                                            className="bg-zinc-850 border border-zinc-750 p-1.5 rounded text-xs text-white uppercase font-mono w-full outline-none focus:border-[#10B981]"
                                          />
                                          <button
                                            onClick={() => {
                                              if (payrollExpenseInput < 0) return;
                                              const finalVal = (job.payrollExpenses || 0) + payrollExpenseInput;
                                              onChangeJobStatus(job.id, job.status, job.contractorId, { payrollExpenses: finalVal });
                                              onAddLog('payroll', `[Expense Captured] Added $${payrollExpenseInput} mileage/reimbursement write-in for ${assocWorker?.name}`, 'info');
                                              setPayrollExpenseInput(0);
                                              alert(`Expense allowance of $${payrollExpenseInput} logged inside digital timesheet!`);
                                            }}
                                            className="bg-zinc-800 hover:bg-zinc-700 text-[#10B981] px-3 font-bold text-[10px] uppercase rounded border border-zinc-700 border-dashed"
                                          >
                                            Add
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Standard Wage Deductions ($)</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="number"
                                            value={payrollDeductionInput || ''}
                                            onChange={e => setPayrollDeductionInput(Number(e.target.value))}
                                            placeholder="e.g. 10.00 uniform"
                                            className="bg-zinc-850 border border-zinc-750 p-1.5 rounded text-xs text-white uppercase font-mono w-full outline-none focus:border-[#10B981]"
                                          />
                                          <button
                                            onClick={() => {
                                              if (payrollDeductionInput < 0) return;
                                              const finalVal = (job.payrollDeductions || 0) + payrollDeductionInput;
                                              onChangeJobStatus(job.id, job.status, job.contractorId, { payrollDeductions: finalVal });
                                              onAddLog('payroll', `[Deduction Applied] Deducted $${payrollDeductionInput} item cost from ${assocWorker?.name}`, 'warning');
                                              setPayrollDeductionInput(0);
                                              alert(`Payroll deduction of $${payrollDeductionInput} applied to timesheet!`);
                                            }}
                                            className="bg-zinc-800 hover:bg-zinc-700 text-rose-400 px-3 font-bold text-[10px] uppercase rounded border border-zinc-700 border-dashed"
                                          >
                                            Apply
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Section B: Multi-state Withholding Ledger details */}
                                  <div className="space-y-2 bg-black/25 p-4 rounded-lg border border-zinc-800">
                                    <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Multi-State Statutory Withholdings</h4>
                                    
                                    <div className="space-y-1.5 text-xs text-zinc-400 font-mono">
                                      <div className="flex justify-between border-b border-zinc-850/45 pb-1">
                                        <span>FICA Social Security (6.2%)</span>
                                        <span className="text-white">${ficaEst.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-zinc-850/45 pb-1">
                                        <span>FICA Medicare (1.45%)</span>
                                        <span className="text-white">${medEst.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-zinc-850/45 pb-1">
                                        <span>State Tax ({taxState === 'CA' ? 'CA 6.0%' : taxState === 'NY' ? 'NY 5.5%' : 'TX 0.0%'})</span>
                                        <span className="text-yellow-400 font-bold">${stateTaxEst.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between pt-1 border-t border-zinc-800 text-white font-bold">
                                        <span>Estimated Wh. Reserves</span>
                                        <span className="text-[#10B981]">${totalWithholdingEst.toFixed(2)}</span>
                                      </div>
                                    </div>
                                    <p className="text-[9px] text-zinc-500 leading-relaxed mt-1 block">Taxes are modeled according to worker tax state code attribution. TX workers map safe state exceptions.</p>
                                  </div>

                                  {/* Section C: Complete Wage Ledger Balance sheet & Timelines */}
                                  <div className="space-y-3 bg-black/25 p-4 rounded-lg border border-zinc-800">
                                    <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Payroll Statement Audit Ledger</h4>
                                    
                                    <div className="text-xs space-y-1 bg-black/40 p-2.5 rounded border border-zinc-800 max-h-32 overflow-y-auto">
                                      <div className="flex gap-1.5 text-[10px] text-zinc-400">
                                        <span className="font-bold text-indigo-400">10:45 AM:</span>
                                        <span>SOW accepted. In escrow.</span>
                                      </div>
                                      <div className="flex gap-1.5 text-[10px] text-zinc-400">
                                        <span className="font-bold text-indigo-400">11:32 AM:</span>
                                        <span>Check-in GPS fence auto verified.</span>
                                      </div>
                                      <div className="flex gap-1.5 text-[10px] text-zinc-400">
                                        <span className="font-bold text-indigo-400">05:12 PM:</span>
                                        <span>Punch checks compiled by scheduler.</span>
                                      </div>
                                      {job.status === 'paid' && (
                                        <div className="flex gap-1.5 text-[10px] text-[#10B981] font-bold">
                                          <span>DONE:</span>
                                          <span>Gusto disbursed & ledger matched.</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex justify-between font-mono text-zinc-300 border-t border-zinc-800 pt-2 text-xs">
                                      <span>Captured Reimbursement:</span>
                                      <span className="text-[#10B981] font-bold">+${expVal}</span>
                                    </div>
                                    <div className="flex justify-between font-mono text-zinc-300 text-xs">
                                      <span>Applied Deductions:</span>
                                      <span className="text-rose-400 font-bold">-${dedVal}</span>
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: CLIENT INVOICING
            ------------------------------------------------------------- */}
        {activeStaffRole === 'billing' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <BillingInvoicing 
              jobs={jobs} 
              candidates={candidates} 
              onAddLog={onAddLog} 
              onChangeJobStatus={onChangeJobStatus} 
            />
          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: AI ASSISTANT / CO-PILOT
            ------------------------------------------------------------- */}
        {activeStaffRole === 'ai_copilot' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Configuration Form */}
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 mb-1 animate-pulse">
                    <Sparkles className="h-4 w-4" /> ATS Recruitment AI Assist
                  </h3>
                  <p className="text-[10px] text-zinc-400">Select SOW job positions or candidates. Generate high-quality JDs, run screening checks, or request a sourcing outreach template.</p>
                </div>

                <div className="space-y-3">
                  {/* Job Vacancy SELECT */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Target SOW Shift / Job</label>
                    <select
                      value={copilotJobId}
                      onChange={e => {
                        setCopilotJobId(e.target.value);
                        setCopilotResponse('');
                      }}
                      className="bg-zinc-900 border border-[#3A3F4C] text-xs text-white p-2 rounded outline-none w-full"
                    >
                      <option value="">-- Choose Job / Order --</option>
                      {jobs.map(j => (
                        <option key={j.id} value={j.id}>
                          {j.businessName} — {j.category} (${j.payout}/hr)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Candidate SELECT */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Worker Candidate (Screening/Outreach only)</label>
                    <select
                      value={copilotCandidateId}
                      onChange={e => {
                        setCopilotCandidateId(e.target.value);
                        setCopilotResponse('');
                      }}
                      className="bg-zinc-900 border border-[#3A3F4C] text-xs text-white p-2 rounded outline-none w-full"
                    >
                      <option value="">-- Choose Candidate --</option>
                      {candidates.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Rel: {c.reliabilityScore || 90}% • {c.clientRatingClass})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AI capability mode */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">AI Sourcing Capability</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'job_desc', label: 'Draft SOW JD' },
                        { id: 'screening', label: 'AI Screen' },
                        { id: 'outreach', label: 'SMS Pitch' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setCopilotMode(m.id as any);
                            setCopilotResponse('');
                          }}
                          className={`p-2 rounded text-[10px] uppercase font-bold tracking-wider text-center border transition-all ${
                            copilotMode === m.id 
                              ? 'bg-[#10B981] hover:bg-emerald-400 text-black border-[#10B981]' 
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Guideline instructions */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Custom Guidelines (Optional)</label>
                    <textarea
                      rows={3}
                      value={copilotInstruction}
                      onChange={e => setCopilotInstruction(e.target.value)}
                      placeholder="e.g. Include background checks reminder, mention safety boots requirement, or emphasize overtime multipliers..."
                      className="bg-zinc-900 border border-[#3A3F4C] text-xs text-white p-2 rounded outline-none w-full font-sans resize-none"
                    />
                  </div>

                  {/* Trigger AI Button */}
                  <button
                    onClick={() => {
                      if (!copilotJobId) {
                        alert("Please select a target job position first.");
                        return;
                      }
                      setCopilotLoading(true);
                      onAddLog('system', `[AI Assistant] Invoking Gemini-2.5-Flash parameters for ${copilotMode.toUpperCase()} template generation...`, 'info');
                      
                      setTimeout(() => {
                        const targetJob = jobs.find(j => j.id === copilotJobId);
                        const targetCand = candidates.find(c => c.id === copilotCandidateId);
                        
                        let responseText = "";
                        if (copilotMode === 'job_desc') {
                          responseText = `# STATEMENT OF WORK: ${targetJob?.category.toUpperCase()}

**HIRING AUTHORITY:** ${targetJob?.businessName}
**CONTRACT VENUE:** ${targetJob?.location || 'Assigned client site'}
**HOURLY BILL RATE:** $${(targetJob?.charge || 40) / (targetJob?.shiftHours || 4)}/hr  •  **1099 HOURLY PAY:** $${targetJob?.payRate || 25}/hr
**SHIFTS DURATION:** ${targetJob?.blockType || 'Scheduled blocks'} SOW assignments

### I. OBJECTIVE & GENERAL ASSIGNMENT
The client is looking to retain certified 1099 contractors as a ${targetJob?.category || 'Shift Specialist'} to handle immediate operational workloads. The operator is expected to adhere closely to the client’s compliance rules, including standard arrival policies under BlockLabor guidance.

### II. REQUIRED SPECIALIST QUALIFICATION & CREDENTIAL CHECK
1. Valid background verification cleared.
2. Compliance clearance check.
3. ${targetJob?.requiredSkills.join(', ') || 'General hand skills'} as specified.
${copilotInstruction ? `\n### III. INCORPORATED RECRUITER DIRECTIVES\n- ${copilotInstruction}` : ''}

### IV. STATEMENT OF LIABILITY
Contractors operate as independent agents under mutual 1099 terms. Please complete daily geofenced clocks to authorize matching payout disbursals.`;
                        } else if (copilotMode === 'screening') {
                          if (!targetCand) {
                            responseText = `*Error: Candidate select is required to perform an AI Screening check. Please select a candidate above.*`;
                          } else {
                            const isMatchedVertical = targetCand.verticals.includes(targetJob?.vertical || 'Light Industrial');
                            const matchPercent = isMatchedVertical ? targetCand.reliabilityScore : Math.max(50, (targetCand.reliabilityScore || 90) - 25);
                            const missingDocs = targetCand.documents.filter(d => d.status !== 'verified').map(d => d.type);
                            
                            responseText = `# AI CANDIDATE SCREENING REPORT
**CANDIDATE:** ${targetCand.name} (Reliability Score: ${targetCand.reliabilityScore || 95}%)
**TARGET SOW SHIFT:** ${targetJob?.category} at ${targetJob?.businessName}

### 📊 CRITICAL MATCH DIAGNOSTIC: ${matchPercent}% ALIGNMENT RANK
- **Vertical Alignment:** ${isMatchedVertical ? '✓ CONFIRMED MATCH' : '⚠ VERTICAL MISMATCH'} (Job vertical: \`${targetJob?.vertical}\`, Specialist operates in: ${targetCand.verticals.join(', ')}).
- **Core Skills Matched:** ${targetCand.skills.filter(s => targetJob?.requiredSkills.some(js => js.toLowerCase().includes(s.toLowerCase()))).join(', ') || 'No specific match overlapped. General suitability inferred.'}
- **Worker Reliability Metrics:**
  * **Attendance Rate:** ${targetCand.attendanceRate}% (Excellent)
  * **Punctuality Score:** ${targetCand.punctualityRate}%
  * **Shift Completion Index:** ${targetCand.completionRate}%
  * **Client Grade:** **${targetCand.clientRatingClass}**

### 🛡️ VERIFIED BACKOFFICE STATE & COMPLIANCE RISK
- **Background Screening Status:** \`${targetCand.backgroundCheckStatus.toUpperCase()}\`
- **DocuSign 1099 Handbook State:** \`${targetCand.eSignStatus.toUpperCase()}\`
- **Expired Credentials Detected:** 
  * ${targetCand.documents.find(d => d.status === 'expired')?.name || 'None detected. Normal compliant status.'} (${targetCand.documents.find(d => d.status === 'expired')?.type || ''})
${missingDocs.length > 0 ? `- **Backoffice Gaps to Settle prior to dispatch:** ${missingDocs.join(', ')}` : ''}
${copilotInstruction ? `\n- **Additional instruction guidelines checked:** ${copilotInstruction}` : ''}

### 💡 DISPATCH RECOMMENDATION
${matchPercent >= 85 ? `**RECOMMENDED FOR DISPATCH.** Contractor demonstrates exemplary attendance parameters. Verify any pending documents before locking in schedule.` : `**CONDITIONAL HOLDOVER.** Candidate's vertical expertise does not align perfectly. Schedulers must request manual credential verification before proceeding.`}`;
                          }
                        } else if (copilotMode === 'outreach') {
                          if (!targetCand) {
                            responseText = `*Error: Candidate select is required to construct a tail outreach text message block.*`;
                          } else {
                            responseText = `[Twilio Dispatch Message Preview]
"Hi ${targetCand.name}! This is BlockLabor Dispatch. We have an urgent shift available with ${targetJob?.businessName} in your local area!

📍 ROLE: ${targetJob?.category}
⏰ SCHEDULE: ${targetJob?.shiftStartTime || '08:00'} - ${targetJob?.shiftEndTime || '16:00'}
💰 PAYOUT: $${targetJob?.payRate || 25}/hr SOW Block Rate

Let us know if you can take this shift: accept directly in your Contractor Portal here!
${copilotInstruction ? `Note: ${copilotInstruction}\n` : ''}Reply YES to lock in."`;
                          }
                        }

                        setCopilotResponse(responseText);
                        setCopilotLoading(false);
                        onAddLog('system', `[AI Assistant] Gemini-2.5 template compiled successfully. Exposing output.`, 'success');
                      }, 1200);
                    }}
                    className="w-full bg-[#10B981] text-[#0F1115] font-bold uppercase p-2 rounded text-xs hover:bg-[#10B981]/80 flex items-center justify-center gap-1.5 transition-all mt-4"
                  >
                    {copilotLoading ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Fetching Gemini Co-Pilot...
                      </span>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Initialize AI Sourcing
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column (2 spans wide): Render Output */}
              <div className="lg:col-span-2 bg-[#161920] border border-[#2A2D35] rounded-xl p-5 flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> AI Generated Result SOW
                  </h3>
                  {copilotResponse && (
                    <button
                      onClick={() => {
                        if (copilotMode === 'outreach') {
                          const targetCand = candidates.find(c => c.id === copilotCandidateId);
                          if (targetCand) {
                            onAddLog('sms', `[AI Outreach Dispatch to ${targetCand.name}]: SMS outbound text sent.`, 'sms');
                            alert(`Tailored SMS outreach successfully pushed to Twilio SMS gateway for candidate ${targetCand.name}!`);
                          }
                        } else {
                          navigator.clipboard?.writeText(copilotResponse);
                          alert("AI Output copied to clipboard!");
                        }
                      }}
                      className="bg-zinc-850 hover:bg-zinc-800 text-xs px-3 py-1 text-[#10B981] rounded border border-zinc-700 font-bold uppercase"
                    >
                      {copilotMode === 'outreach' ? 'Dispatch Live SMS Outreach' : 'Copy Output'}
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-zinc-950 p-4 rounded-lg font-mono text-xs text-zinc-300 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-zinc-900 min-h-[300px]">
                  {copilotResponse ? (
                    copilotResponse
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-center text-zinc-600 space-y-2 py-10">
                      <Sparkles className="h-8 w-8 text-zinc-800" />
                      <p className="text-xs">No compiled model output exists.</p>
                      <p className="text-[10px] max-w-sm">Configure target parameters, select SOW Sourcing modes on the left, and click 'Initialize AI Sourcing' to execute the mock LLM pipeline.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: PARTNERS & INCIDENTS DESK
            ------------------------------------------------------------- */}
        {activeStaffRole === 'vendors_incidents' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Top Row: Partner Suppliers Directory */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Form: Register Partner supply vendor */}
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4 h-fit">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 font-bold">
                    <Layers className="h-4 w-4" /> Register Subcontract Supplier
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Define subcontractor agencies, agreed contract markup rates, and tax identifiers for joint payroll coverage.</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Labor Supplier Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Paramount Labor Group"
                      value={vendorName}
                      onChange={e => setVendorName(e.target.value)}
                      className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Contact Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Robert DeNiro"
                        value={vendorContact}
                        onChange={e => setVendorContact(e.target.value)}
                        className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Markup Percentage (%)</label>
                      <input
                        type="number"
                        placeholder="e.g. 15"
                        value={vendorMarkup || ''}
                        onChange={e => setVendorMarkup(Number(e.target.value))}
                        className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Supplier Phone</label>
                      <input
                        type="text"
                        placeholder="(555) 012-4411"
                        value={vendorPhone}
                        onChange={e => setVendorPhone(e.target.value)}
                        className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Business Tax ID</label>
                      <input
                        type="text"
                        placeholder="XX-XXXX881"
                        value={vendorTaxId}
                        onChange={e => setVendorTaxId(e.target.value)}
                        className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Agreed Labor Verticals</label>
                    <select
                      value={vendorVertical}
                      onChange={e => setVendorVertical(e.target.value as VerticalType)}
                      className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                    >
                      {VERTICALS.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Supplier Email</label>
                    <input
                      type="email"
                      placeholder="payouts@paramountlabor.test"
                      value={vendorEmail}
                      onChange={e => setVendorEmail(e.target.value)}
                      className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!vendorName || !vendorEmail || !vendorTaxId) {
                        alert("Please complete required supplier fields (Name, Email, Tax ID).");
                        return;
                      }
                      if (onAddPartnerVendor) {
                        const newVendor: PartnerVendor = {
                          id: 'v-' + Math.floor(Math.random() * 1000 + 400),
                          name: vendorName,
                          contactName: vendorContact || "Administrative Desk",
                          email: vendorEmail,
                          phone: vendorPhone || "(555) 123-4567",
                          verticals: [vendorVertical],
                          markupShare: vendorMarkup / 100,
                          status: 'active',
                          assignedJobsCount: 0,
                          insuranceExpiry: new Date(Date.now() + 31536000000).toISOString().split('T')[0],
                          taxId: vendorTaxId
                        };
                        onAddPartnerVendor(newVendor);
                        alert(`Subcontract Supplier Partner successfully registered: ${vendorName}! Markups and compliance live.`);
                        
                        setVendorName('');
                        setVendorContact('');
                        setVendorEmail('');
                        setVendorPhone('');
                        setVendorTaxId('');
                      }
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-500 font-bold uppercase p-2 rounded text-xs transition-all mt-2"
                  >
                    Add Supply Partner
                  </button>
                </div>
              </div>

              {/* Right List: Supplier roster */}
              <div className="lg:col-span-2 bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 font-bold">
                      <Users className="h-4 w-4" /> Active Subcontract Suppliers ({partnerVendors.length})
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Oversight of subcontractor markup commissions, contract statuses, and general insurance compliance logs.</p>
                  </div>
                </div>

                <div className="divide-y divide-zinc-800/80">
                  {partnerVendors.map(vendor => (
                    <div key={vendor.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{vendor.name}</strong>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            vendor.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {vendor.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-[#8E9299]">Contact: <strong className="text-white">{vendor.contactName}</strong>  •  {vendor.email}  •  {vendor.phone}</p>
                        <div className="flex gap-4 text-[10px] text-zinc-500 font-mono">
                          <span>Markup Fee: <strong className="text-white text-xs">{Math.round(vendor.markupShare * 100)}%</strong></span>
                          <span>Tax ID: {vendor.taxId}</span>
                          <span>Insurance Expiry: {vendor.insuranceExpiry}</span>
                          <span>Vertical Scope: <strong className="text-purple-400 font-sans">{vendor.verticals.join(', ')}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {vendor.status === 'active' ? (
                          <button
                            onClick={() => {
                              if (onUpdatePartnerVendorStatus) {
                                onUpdatePartnerVendorStatus(vendor.id, 'suspended');
                                alert(`Labor Supplier partner ${vendor.name} suspended from manual dispatch list.`);
                              }
                            }}
                            className="bg-zinc-850 hover:bg-zinc-800 border border-rose-500/20 hover:border-rose-500/60 text-rose-455 px-3 py-1 font-bold text-[10px] uppercase rounded"
                          >
                            Suspend Partner
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (onUpdatePartnerVendorStatus) {
                                onUpdatePartnerVendorStatus(vendor.id, 'active');
                                alert(`Authorized partner: ${vendor.name}`);
                              }
                            }}
                            className="bg-[#10B98115] hover:bg-[#10B98133] border border-emerald-500/30 text-emerald-450 px-3 py-1 font-bold text-[10px] uppercase rounded"
                          >
                            Authorize Partner
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {partnerVendors.length === 0 && (
                    <p className="text-xs text-zinc-500 font-mono text-center py-6">No subcontract supply agencies currently registered.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Row: On-Site Incident Desktop and Misconduct Logger */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Report Incident Form */}
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4 h-fit">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" /> Log On-Site Safety Incident
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Report safety disputes, job site misconduct, or clocking disputes directly onto the joint-employer ledger.</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Target Active Job Venue</label>
                    <select
                      value={incJobId}
                      onChange={e => {
                        setIncJobId(e.target.value);
                        const selectedJob = jobs.find(j => j.id === e.target.value);
                        if (selectedJob && selectedJob.contractorId) {
                          setIncWorkerId(selectedJob.contractorId);
                        }
                      }}
                      className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                    >
                      <option value="">-- Choose Venue Order --</option>
                      {jobs.map(j => (
                        <option key={j.id} value={j.id}>
                          {j.businessName} — {j.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Contractor / Worker Involved</label>
                    <select
                      value={incWorkerId}
                      onChange={e => setIncWorkerId(e.target.value)}
                      className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                    >
                      <option value="">-- Choose Specialist --</option>
                      {candidates.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Issue Category</label>
                      <select
                        value={incCategory}
                        onChange={e => setIncCategory(e.target.value as any)}
                        className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                      >
                        <option value="safety">Safety Violation</option>
                        <option value="misconduct">Misconduct</option>
                        <option value="dispute">Time / Pay Dispute</option>
                        <option value="other">Other Event</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Incident Severity</label>
                      <select
                        value={incSeverity}
                        onChange={e => setIncSeverity(e.target.value as any)}
                        className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-white w-full outline-none focus:border-[#10B981]"
                      >
                        <option value="low">Low Info</option>
                        <option value="medium">Medium Issue</option>
                        <option value="high">High Warning</option>
                        <option value="critical">Critical Incident</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Claim Reporter</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'client', label: 'Client Site' },
                        { id: 'worker', label: 'Specialist' },
                        { id: 'agency', label: 'Staff Desk' }
                      ].map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setIncReporter(r.id as any)}
                          className={`p-1.5 rounded text-[10px] uppercase font-bold tracking-wider text-center border transition-all ${
                            incReporter === r.id 
                              ? 'bg-[#10B981] hover:bg-emerald-400 text-black border-[#10B981]' 
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Incident Description Details</label>
                    <textarea
                      rows={3}
                      value={incDescription}
                      onChange={e => setIncDescription(e.target.value)}
                      placeholder="Specify dates, physical hazards, or hours disputation details..."
                      className="bg-zinc-900 border border-[#3A3F4C] p-2 rounded text-xs text-white w-full outline-none resize-none font-sans focus:border-[#10B981]"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!incJobId || !incWorkerId || !incDescription) {
                        alert("Please select target active job, contractor, and fill description details.");
                        return;
                      }
                      const assocJob = jobs.find(j => j.id === incJobId);
                      const assocWorker = candidates.find(c => c.id === incWorkerId);
                      
                      if (onAddIncident && assocJob && assocWorker) {
                        const newReport: IncidentReport = {
                          id: 'inc-' + Math.floor(Math.random() * 1000 + 100),
                          jobId: incJobId,
                          businessName: assocJob.businessName,
                          contractorId: incWorkerId,
                          contractorName: assocWorker.name,
                          reportedBy: incReporter,
                          category: incCategory,
                          severity: incSeverity,
                          timestamp: new Date().toISOString(),
                          description: incDescription,
                          status: 'pending'
                        };
                        onAddIncident(newReport);
                        alert(`Incident safely logged on joint-employer audit ledger! Assigned Incident ID: ${newReport.id}`);
                        setIncDescription('');
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-500 font-bold uppercase p-2 rounded text-xs transition-all mt-1"
                  >
                    File Incident Report
                  </button>
                </div>
              </div>

              {/* Right Column (2 spans wide): Lists of incidents */}
              <div className="lg:col-span-2 bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                <div className="border-b border-zinc-850 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4" /> Active Incident Reports & Disputes ({incidentReports.length})
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Audit trail of site grievances, safety occurrences, and hours dispute tracking for joint-liability insurance logs.</p>
                </div>

                <div className="divide-y divide-zinc-800/80">
                  {incidentReports.map(inc => (
                    <div key={inc.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-white text-xs">{inc.businessName} — SOW {inc.category.toUpperCase()} Case</strong>
                            <span className={`text-[8px] font-mono tracking-widest uppercase font-bold px-1.5 py-0.5 rounded ${
                              inc.severity === 'critical' ? 'bg-red-500 text-white animate-bounce' :
                              inc.severity === 'high' ? 'bg-orange-500 text-white' :
                              inc.severity === 'medium' ? 'bg-yellow-500 text-[#0F1115]' :
                              'bg-zinc-800 text-zinc-300'
                            }`}>
                              Severity: {inc.severity.toUpperCase()}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                              inc.status === 'resolved' 
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                : 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30 animate-pulse'
                            }`}>
                              {inc.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                            Case Specialist: <strong className="text-white font-sans">{inc.contractorName}</strong>  •  Reported by: <span className="text-zinc-300 font-sans">{inc.reportedBy.toUpperCase()}</span>  •  Logged: {new Date(inc.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="bg-zinc-950 p-2.5 rounded border border-zinc-900 text-xs text-zinc-300 italic font-mono leading-relaxed leading-5">
                        "{inc.description}"
                      </div>

                      {inc.status === 'resolved' && (
                        <p className="text-[10px] text-emerald-400 font-bold font-mono">✓ Resolved Dispute Status Ledger</p>
                      )}

                      {inc.resolutionNotes && (
                        <div className="bg-[#10B9810D] p-2 rounded border border-emerald-500/10 text-[11px] text-[#10B981] font-sans">
                          <strong>Resolution Settlement:</strong> "{inc.resolutionNotes}"
                        </div>
                      )}

                      {inc.status === 'pending' && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type resolution settlement action here..."
                            id={`res-input-${inc.id}`}
                            className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs text-white rounded outline-none flex-1 focus:border-[#10B981]"
                          />
                          <button
                            onClick={() => {
                              const inputEl = document.getElementById(`res-input-${inc.id}`) as HTMLInputElement;
                              const notes = inputEl?.value || "Settled amicably after backoffice compliance check.";
                              if (onUpdateIncidentStatus) {
                                onUpdateIncidentStatus(inc.id, 'resolved', notes);
                                alert(`Case ${inc.id} set to resolved. Log matches updated!`);
                              }
                            }}
                            className="bg-[#10B981] hover:bg-emerald-400 text-black text-[10px] px-3.5 py-1 rounded font-bold uppercase"
                          >
                            Mark Settled
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {incidentReports.length === 0 && (
                    <p className="text-xs text-zinc-500 font-mono text-center py-6">No incident records filed.</p>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------------------
            TAB: ENTERPRISE SSO & MULTI-BRANCH DIVISION CONTROL HUB
            ------------------------------------------------------------- */}
        {activeStaffRole === 'sso_permissions' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Enterprise License Warning block if not isEnterprise */}
            {!isEnterprise && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-4 font-sans">
                  <AlertTriangle className="h-10 w-10 text-amber-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">🔒 Premium Enterprise Modules Inactive</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                      Multi-branch division logs, rate card automation constraints, Okta SAML claims, and advanced granular permissions are restricted to corporate profiles. Activate the enterprise simulation to inspect full backoffice credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEnterprise(true);
                    onAddLog('system', '🏆 Activated Corporate Enterprise Suite via inner credentials dashboard.', 'success');
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded shrink-0 duration-200 animate-pulse"
                >
                  ⚡ Unlock Enterprise Suite Sim
                </button>
              </div>
            )}

            {/* Standard Dashboard view of branches, rate cards, and SSO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Branches manager */}
              <div className="lg:col-span-2 bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 font-bold">
                    <Building2 className="h-4 w-4 text-emerald-400" /> Multi-Branch Operational Divisions ({branches.length})
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Edit active branch locations, adjust regional margin allocations, and track regional dispatches.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[9px] font-mono tracking-wider">
                        <th className="py-2.5">Branch Name</th>
                        <th className="py-2.5">City</th>
                        <th className="py-2.5">Regional Manager</th>
                        <th className="py-2.5">Margin Target</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/50">
                      {branches.map((b: any) => (
                        <tr key={b.id} className="hover:bg-zinc-950/25">
                          <td className="py-3 font-bold text-white">{b.name}</td>
                          <td className="py-3 text-zinc-300">{b.city}</td>
                          <td className="py-3 font-mono text-zinc-400">{b.manager}</td>
                          <td className="py-3 text-[#10B981] font-mono font-bold">{b.marginTarget}% Margin</td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setBranches(prev => prev.filter(item => item.id !== b.id));
                                onAddLog('system', `Archived operational branch division: ${b.name}`, 'warning');
                                alert("Branch division archived from central registry!");
                              }}
                              className="text-red-400 hover:text-red-300 text-[10px] uppercase font-bold"
                            >
                              Archive
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Create Branch form */}
                <form 
                  onSubmit={e => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const name = (form.elements.namedItem('bName') as HTMLInputElement).value;
                    const city = (form.elements.namedItem('bCity') as HTMLInputElement).value;
                    const manager = (form.elements.namedItem('bManager') as HTMLInputElement).value;
                    const target = Number((form.elements.namedItem('bTarget') as HTMLInputElement).value);
                    
                    const newB = {
                      id: 'br-' + Math.floor(Math.random() * 1000 + 100),
                      name,
                      city,
                      manager,
                      marginTarget: target,
                      activeJobsCount: 0,
                      activeWorkersCount: 0
                    };
                    
                    setBranches(prev => [...prev, newB]);
                    onAddLog('system', `Opened new corporate office branch division: ${name} (Manager: ${manager})`, 'success');
                    form.reset();
                    alert("Branch division registered successfully!");
                  }}
                  className="bg-zinc-950 p-4 rounded-lg space-y-3"
                >
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Provision New Division Location</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">Name</label>
                      <input name="bName" required placeholder="e.g. Seattle Port" className="bg-zinc-950 border border-zinc-850 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">City</label>
                      <input name="bCity" required placeholder="Seattle" className="bg-zinc-950 border border-zinc-850 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">Manager Representative</label>
                      <input name="bManager" required placeholder="Thomas G." className="bg-zinc-950 border border-zinc-850 text-[#fff] rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">Margin Target (%)</label>
                      <input name="bTarget" type="number" required defaultValue="30" className="bg-zinc-950 border border-zinc-850 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                    </div>
                  </div>
                  <button type="submit" className="bg-[#10B981] hover:bg-emerald-400 text-black font-extrabold text-[10px] uppercase tracking-wide px-3.5 py-1.5 rounded transition">
                    + Register Division Branch
                  </button>
                </form>
              </div>

              {/* Right Column: SAML SSO Settings & Advanced Granular permission checkboxes */}
              <div className="space-y-6">
                
                {/* SAML Card */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 border-b border-zinc-800 pb-2 font-sans">
                      <Key className="h-4 w-4 text-emerald-400" /> SAML SSO Directory Sync
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">Configured claims domain verifying user identification before executing payroll and block orders.</p>
                  </div>

                  <div className="space-y-3 text-xs font-sans">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Active Identity Provider</label>
                      <select 
                        value={ssoConfig.provider || 'Okta'} 
                        onChange={e => {
                          setSsoConfig((prev: any) => ({ ...prev, provider: e.target.value }));
                          onAddLog('system', `SSO Identity provider changed to: ${e.target.value}`, 'info');
                        }}
                        className="bg-zinc-900 border border-zinc-800 rounded p-1.5 text-xs text-white w-full outline-none focus:border-[#10B981]"
                      >
                        <option value="Okta">Okta Enterprise Access</option>
                        <option value="Azure AD">Microsoft Azure Active Directory</option>
                        <option value="Ping Identity">Ping Identity SAML 2.0</option>
                        <option value="None">None (Insecure / Email Verification Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1 font-sans">Single Sign-On SSO Domain</label>
                      <input 
                        type="text" 
                        value={ssoConfig.domain || 'enterprise.blocklabor.okta.com/sso'} 
                        onChange={e => setSsoConfig((prev: any) => ({ ...prev, domain: e.target.value }))}
                        className="bg-zinc-900 border border-[#2A2D35] rounded p-1.5 font-mono text-[11px] text-[#fff] w-full outline-none focus:border-[#10B981]"
                        placeholder="enterprise.blocklabor.okta.com/sso" 
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-black/20 rounded font-sans">
                      <div>
                        <p className="text-[10px] font-bold text-white uppercase tracking-wider">Enforce Domain Lockout</p>
                        <p className="text-[9px] text-zinc-500">Only authorize users authenticating inside AD domain.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!ssoConfig.enabled}
                        onChange={e => {
                          setSsoConfig((prev: any) => ({ ...prev, enabled: e.target.checked }));
                          onAddLog('system', `Domain Lockout policy toggled ${e.target.checked ? 'ON' : 'OFF'}`, 'success');
                        }}
                        className="rounded border-[#373A43] bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]"
                      />
                    </div>
                  </div>
                </div>

                {/* Granular Permission Simulation claims */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1.5 border-b border-zinc-800 pb-2 font-sans">
                      <Shield className="h-4 w-4 text-emerald-400" /> Granular Access Clearance Claims
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">Simulate toggling privilege claims. Locked actions will trigger real-time SAML security validation locks when executing backoffice operations.</p>
                  </div>

                  <div className="space-y-4 text-xs font-sans">
                    {permissions.map((p: any) => (
                      <div key={p.id} className="p-3 bg-zinc-950/40 rounded-lg border border-zinc-800/80 space-y-2">
                        <strong className="text-[#10B981] block font-mono text-[11px]">{p.roleName} Mode Clearance Claims</strong>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <label className="flex items-center gap-1.5 text-zinc-400">
                            <input 
                              type="checkbox" 
                              checked={!!p.canEditRateCards} 
                              onChange={e => {
                                setPermissions((prev: any[]) => prev.map(item => item.id === p.id ? { ...item, canEditRateCards: e.target.checked } : item));
                                onAddLog('system', `Modified edit claims for role ${p.roleName}`, 'info');
                              }}
                              className="rounded border-zinc-800 bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]" 
                            />
                            Rate Card Writes
                          </label>

                          <label className="flex items-center gap-1.5 text-zinc-400">
                            <input 
                              type="checkbox" 
                              checked={!!p.canApprovePayroll} 
                              onChange={e => {
                                setPermissions((prev: any[]) => prev.map(item => item.id === p.id ? { ...item, canApprovePayroll: e.target.checked } : item));
                                onAddLog('system', `Modified payroll claims for role ${p.roleName}`, 'info');
                              }}
                              className="rounded border-zinc-800 bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]" 
                            />
                            Approve Payroll
                          </label>

                          <label className="flex items-center gap-1.5 text-zinc-400">
                            <input 
                              type="checkbox" 
                              checked={!!p.canVerifyDocs} 
                              onChange={e => {
                                setPermissions((prev: any[]) => prev.map(item => item.id === p.id ? { ...item, canVerifyDocs: e.target.checked } : item));
                                onAddLog('system', `Modified documentation claims for role ${p.roleName}`, 'info');
                              }}
                              className="rounded border-zinc-800 bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]" 
                            />
                            Audit Doc OCR
                          </label>

                          <label className="flex items-center gap-1.5 text-zinc-400">
                            <input 
                              type="checkbox" 
                              checked={!!p.canDeployDispatches} 
                              onChange={e => {
                                setPermissions((prev: any[]) => prev.map(item => item.id === p.id ? { ...item, canDeployDispatches: e.target.checked } : item));
                                onAddLog('system', `Modified dispatcher claims for role ${p.roleName}`, 'info');
                              }}
                              className="rounded border-zinc-800 bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]" 
                            />
                            SOW Direct Send
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
              
              {/* Automated Standardized Rate Cards */}
              {isEnterprise && (
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4 lg:col-span-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" /> Standardized Rate Cards Automated Ledger
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Establish automatic pay metrics and billing premiums per category. Any labor requested via the booking templates will automatically align with these card specifications, eliminating direct manual rate configuration risks.
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto font-sans">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[9px] font-mono tracking-wider">
                          <th className="py-2.5">Vertical</th>
                          <th className="py-2.5">Role Category</th>
                          <th className="py-2.5">Std Payout ($/hr)</th>
                          <th className="py-2.5">Std Billing ($/hr)</th>
                          <th className="py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850/50">
                        {rateCards.map((rc: any) => (
                          <tr key={rc.id} className="hover:bg-zinc-950/20">
                            <td className="py-2 text-zinc-400 font-mono text-[11px]">{rc.vertical}</td>
                            <td className="py-2 font-bold text-white">{rc.category}</td>
                            <td className="py-2 font-mono text-emerald-400">
                              <input
                                type="number"
                                value={rc.standardPayRate}
                                onChange={e => {
                                  const systemAdminClaim = permissions?.[0]?.canEditRateCards;
                                  if (systemAdminClaim === false) {
                                    alert("⛔ Permission Denied: Your SAML token lacks the administrative write claim 'canEditRateCards' needed to modify corporate rate contracts.");
                                    return;
                                  }
                                  const newVal = Number(e.target.value);
                                  setRateCards((prev: any[]) => prev.map(item => item.id === rc.id ? { ...item, standardPayRate: newVal } : item));
                                }}
                                className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-0.5 rounded w-16 text-center text-white font-mono"
                              />
                            </td>
                            <td className="py-2 font-mono text-white">
                              <input
                                type="number"
                                value={rc.standardBillRate}
                                onChange={e => {
                                  const systemAdminClaim = permissions?.[0]?.canEditRateCards;
                                  if (systemAdminClaim === false) {
                                    alert("⛔ Permission Denied: Your SAML token lacks the administrative write claim 'canEditRateCards' needed to modify corporate rate contracts.");
                                    return;
                                  }
                                  const newVal = Number(e.target.value);
                                  setRateCards((prev: any[]) => prev.map(item => item.id === rc.id ? { ...item, standardBillRate: newVal } : item));
                                }}
                                className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-0.5 rounded w-16 text-center text-white font-mono"
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const systemAdminClaim = permissions?.[0]?.canEditRateCards;
                                  if (systemAdminClaim === false) {
                                    alert("⛔ Permission Denied: Your SAML token lacks the administrative write claim 'canEditRateCards' needed to modify corporate rate contracts.");
                                    return;
                                  }
                                  setRateCards((prev: any[]) => prev.filter((item: any) => item.id !== rc.id));
                                  onAddLog('system', `Removed standardized rate card for vertical: ${rc.vertical}`, 'warning');
                                }}
                                className="text-red-500 hover:text-red-400 text-[10px] font-bold uppercase font-mono"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <form 
                    onSubmit={e => {
                      e.preventDefault();
                      const systemAdminClaim = permissions?.[0]?.canEditRateCards;
                      if (systemAdminClaim === false) {
                        alert("⛔ Permission Denied: Your SAML token lacks the administrative write claim 'canEditRateCards' needed to modify corporate rate contracts.");
                        return;
                      }
                      const form = e.target as HTMLFormElement;
                      const vertical = (form.elements.namedItem('vertical') as HTMLSelectElement).value as VerticalType;
                      const category = (form.elements.namedItem('category') as HTMLInputElement).value;
                      const pay = Number((form.elements.namedItem('pay') as HTMLInputElement).value);
                      const bill = Number((form.elements.namedItem('bill') as HTMLInputElement).value);
                      
                      const newRC = {
                        id: 'rc-' + Math.floor(Math.random() * 1000 + 100),
                        vertical,
                        category,
                        standardBillRate: bill,
                        standardPayRate: pay,
                        customClientMarkupPercent: Math.round(((bill - pay)/pay)*100)
                      };
                      
                      setRateCards((prev: any[]) => [...prev, newRC]);
                      onAddLog('system', `Automated Rate Card locked-in: std pay $${pay}/hr, bill $${bill}/hr specified for ${category}.`, 'success');
                      form.reset();
                      alert("Category rate card registered!");
                    }}
                    className="bg-zinc-950 p-4 rounded-lg space-y-3 border border-zinc-800"
                  >
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">Lock-In New Standardized Category Rate</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Vertical</label>
                        <select name="vertical" className="bg-zinc-900 border border-zinc-800 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]">
                          {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Role Category</label>
                        <input name="category" required placeholder="e.g. Lead Bartender" className="bg-zinc-900 border border-zinc-800 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Std Payout ($/hr)</label>
                        <input name="pay" type="number" required placeholder="24" className="bg-zinc-900 border border-zinc-800 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Std Billing ($/hr)</label>
                        <input name="bill" type="number" required placeholder="33" className="bg-zinc-900 border border-zinc-800 text-white rounded p-1.5 w-full outline-none focus:border-[#10B981]" />
                      </div>
                    </div>
                    <button type="submit" className="bg-[#10B981] hover:bg-emerald-400 text-[#0f1115] font-extrabold text-[10px] uppercase tracking-wide px-3.5 py-1.5 rounded transition font-sans">
                      + Register Core Category Rate Card
                    </button>
                  </form>
                </div>
              )}

            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
