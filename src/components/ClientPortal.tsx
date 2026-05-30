import { useState } from 'react';
import { Job, WorkerCandidate, IncidentReport, BranchDivision, RateCard } from '../types';
import { VERTICAL_WORKFLOWS } from '../constants';
import { motion } from 'motion/react';
import { 
  Building2, CreditCard, ChevronRight, CheckCircle2, AlertTriangle, 
  Clock, MapPin, CheckSquare, Pencil, Users, ShieldAlert, Sparkles 
} from 'lucide-react';

interface ClientPortalProps {
  jobs: Job[];
  candidates: WorkerCandidate[];
  incidentReports?: IncidentReport[];
  onAddIncident?: (newIncident: IncidentReport) => void;
  onChangeJobStatus: (jobId: string, status: Job['status'], contractorId?: string, updates?: Partial<Job>) => void;
  onAddLog: (category: string, message: string, type?: 'info' | 'success' | 'warning' | 'sms') => void;
  isEnterprise?: boolean;
  branches?: BranchDivision[];
  rateCards?: RateCard[];
}

export function ClientPortalView({
  jobs,
  candidates,
  incidentReports = [],
  onAddIncident,
  onChangeJobStatus,
  onAddLog,
  isEnterprise = false,
  branches = [],
  rateCards = []
}: ClientPortalProps) {
  // Available distinct business options from jobs
  const clientCompanies = Array.from(new Set(jobs.map(j => j.businessName)));
  const defaultCompany = clientCompanies.includes('Vanguard Events Corp') ? 'Vanguard Events Corp' : clientCompanies[0] || 'Apex Materials Inc';
  
  const [activeCompany, setActiveCompany] = useState<string>(defaultCompany);
  const [hireRequestContractorId, setHireRequestContractorId] = useState<string>('');
  const [signOffJobId, setSignOffJobId] = useState<string | null>(null);
  const [supervisorName, setSupervisorName] = useState('');
  
  // Dynamic Tab and billing states
  const [selectedViewTab, setSelectedViewTab] = useState<'roster' | 'billing'>('roster');
  const [simulateInvoiceLoading, setSimulateInvoiceLoading] = useState<boolean>(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('All Branches');
  
  // Filter jobs by current selected company
  const companyJobs = jobs.filter(j => j.businessName === activeCompany);
  
  // Candidates who have worked with this specific client
  const companyWorkedContractorIds = Array.from(new Set(jobs.filter(j => j.businessName === activeCompany && j.contractorId).map(j => j.contractorId as string)));
  const activeWorkedCandidates = candidates.filter(c => companyWorkedContractorIds.includes(c.id));

  const handleSignOffTimesheet = (jobId: string) => {
    if (!supervisorName.trim()) {
      alert("Please provide the supervisor's name.");
      return;
    }
    
    const targetJob = jobs.find(j => j.id === jobId);
    if (targetJob) {
      // Transition from accepted/completed to completed with timesheet and signatures
      const updatedTimesheet = {
        ...targetJob.timesheet,
        checkOutTime: new Date().toISOString(),
        clientSignatureName: supervisorName,
        gpsVerified: true
      };
      
      onChangeJobStatus(jobId, 'completed', targetJob.contractorId, { timesheet: updatedTimesheet });
      onAddLog('payroll', `[Timesheet Approved] Manager ${supervisorName} signed off completed work block #${jobId} for ${targetJob.category}`, 'success');
      
      setSignOffJobId(null);
      setSupervisorName('');
      alert("Timesheet approved! Placed in payroll queue for Gusto disbursal.");
    }
  };

  const handlePermanentHireRequest = (candId: string) => {
    const cand = candidates.find(c => c.id === candId);
    if (cand) {
      onAddLog('payroll', `[Conversion Processed] ${activeCompany} requested permanent conversion for 1099 contractor ${cand.name}. QuickBooks registered one-time placement invoice ($2,500 fee)`, 'success');
      alert(`Permanent separation contract dispatched! The $2,500 placement fee invoice has been added to your QuickBooks billing summary.`);
      setHireRequestContractorId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Banner with Identity selection */}
        <header className="md:flex md:items-center md:justify-between bg-[#161920] p-6 rounded-xl border border-[#2A2D35] gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex gap-2 items-center text-[#10B981] font-mono text-[10px] uppercase tracking-wider font-bold">
              <Building2 className="h-4 w-4" /> Client Portal Safe-Access
            </div>
            <h2 className="text-xl font-bold uppercase tracking-widest text-white mt-1 sm:truncate font-sans">
              Client Portal: {activeCompany}
            </h2>
            <p className="mt-1 text-xs text-[#8E9299]">Adjust company workspace selector to view alternative mock clients.</p>
          </div>
          
          <div className="mt-4 flex sm:mt-0 gap-3">
            <div>
              <label className="block text-[9px] uppercase font-bold text-[#8E9299] mb-1">Active Client Account</label>
              <select 
                value={activeCompany} 
                onChange={e => setActiveCompany(e.target.value)}
                className="bg-[#1F232B] border border-[#373A43] text-xs text-white rounded p-2 focus:ring-[#10B981] font-bold"
              >
                {clientCompanies.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
                {clientCompanies.length === 0 && <option value="Apex Materials Inc">Apex Materials Inc</option>}
              </select>
            </div>
          </div>
        </header>

        {/* Enterprise Operations Panel */}
        {isEnterprise && (
          <div className="bg-[#161920] border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[9px] uppercase font-mono tracking-widest px-3 py-1 rounded-bl-lg font-bold border-l border-b border-emerald-500/20">
              🛡️ Enterprise Module Active
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Building2 className="h-4 w-4 text-emerald-400" /> Multi-Branch Division Management
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">Filter entire workspace roster and billing records below by active division.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Select Division:</span>
                <select
                  value={selectedBranchFilter}
                  onChange={e => setSelectedBranchFilter(e.target.value)}
                  className="bg-[#1f232b] text-white text-xs rounded border border-zinc-700 px-3 py-1.5 focus:border-[#10B981] font-bold outline-none"
                >
                  <option value="All Branches">All Branches Combined</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {branches.map(b => {
                const branchJobs = companyJobs.filter(j => j.branchName === b.name);
                const activeDispatches = branchJobs.filter(j => j.status === 'accepted' || j.status === 'open').length;
                const totalFinancialSpend = branchJobs.reduce((sum, j) => sum + (j.charge || 0), 0);
                const isMatchingSelection = selectedBranchFilter === 'All Branches' || selectedBranchFilter === b.name;

                return (
                  <div 
                    key={b.id} 
                    onClick={() => setSelectedBranchFilter(b.name)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      isMatchingSelection 
                        ? 'bg-[#1f232b] border-emerald-500/40 shadow-md' 
                        : 'bg-[#111317] border-zinc-900 opacity-60 hover:opacity-100 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-mono font-bold text-emerald-400 uppercase">{b.city} Office</p>
                      {isMatchingSelection && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    </div>
                    <h5 className="font-extrabold text-white text-xs mt-1 truncate">{b.name}</h5>
                    
                    <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60 text-[10px]">
                      <div>
                        <span className="text-zinc-500 block">Total Booked</span>
                        <strong className="text-zinc-200 text-xs">{branchJobs.length} Shifts</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 block">Aggregate Spend</span>
                        <strong className="text-zinc-200 text-xs">${totalFinancialSpend.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2A2D35] gap-6 pb-px">
          <button
            onClick={() => setSelectedViewTab('roster')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 outline-none ${
              selectedViewTab === 'roster' ? 'border-[#10B981] text-white font-black' : 'border-transparent text-[#8E9299] hover:text-white'
            }`}
          >
            Labor Bookings & Deliverables
          </button>
          <button
            onClick={() => setSelectedViewTab('billing')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 outline-none flex items-center gap-1.5 ${
              selectedViewTab === 'billing' ? 'border-[#10B981] text-white font-black' : 'border-transparent text-[#8E9299] hover:text-white'
            }`}
          >
            <CreditCard className="h-4 w-4 text-[#10B981]" /> Automated Invoicing & Billing
          </button>
        </div>

        {selectedViewTab === 'roster' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* List of client jobs */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#161920] border border-[#2A2D35] sm:rounded-xl overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-[#2A2D35] bg-[#0F1115] flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                    {selectedBranchFilter === 'All Branches' ? 'Labor Block Bookings (All Combined)' : `Labor Block Bookings: ${selectedBranchFilter}`}
                  </h3>
                  <span className="text-xs text-[#10B981] font-mono">
                    {companyJobs.filter(j => selectedBranchFilter === 'All Branches' || j.branchName === selectedBranchFilter).length} Active
                  </span>
                </div>
                
                <ul className="divide-y divide-[#2A2D35]">
                  {companyJobs.filter(j => selectedBranchFilter === 'All Branches' || j.branchName === selectedBranchFilter).map((job) => {
                    const wf = VERTICAL_WORKFLOWS.find(v => v.vertical === job.vertical);
                    const activeContractor = candidates.find(c => c.id === job.contractorId);

                    return (
                      <li key={job.id} className="p-6 hover:bg-[#1F232B] transition-colors space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="h-10 w-10 shrink-0 rounded bg-[#10B98133] flex items-center justify-center text-[#10B981]">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-white">
                                {job.category} ({job.blockType})
                              </h4>
                              <div className="flex flex-wrap gap-x-3 text-xs text-[#8E9299]">
                                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Start: {job.startWindow}</span>
                                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Loc: {job.location}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status elements */}
                          <div className="sm:text-right flex sm:flex-col items-start sm:items-end justify-between shrink-0">
                            <span className="text-sm font-mono text-white font-bold">${job.charge}</span>
                            <div>
                              {job.status === 'open' && (
                                <span className="text-[10px] uppercase font-bold text-[#F59E0B]">
                                  Searching Marketplace...
                                </span>
                              )}
                              {job.status === 'accepted' && (
                                <span className="text-[10px] uppercase font-bold text-[#10B981]">
                                  Worker On Route
                                </span>
                              )}
                              {job.status === 'completed' && (
                                <span className="text-[10px] uppercase font-bold text-indigo-400">
                                  Pending Invoicing / Syncs
                                </span>
                              )}
                              {job.status === 'paid' && (
                                <span className="text-[10px] uppercase font-bold text-gray-400">
                                  Paid & Closed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Display matched worker info and checklists */}
                        {activeContractor && (
                          <div className="bg-[#1F232B] p-4 rounded-lg border border-[#373A43] space-y-3">
                            <div className="flex justify-between items-center border-b border-[#2A2D35] pb-2 text-xs">
                              <div>
                                <span className="text-gray-400">Assigned 1099 Contractor:</span>
                                <span className="text-white font-bold ml-1">{activeContractor.name}</span>
                              </div>
                              <span className="text-[#10B981] font-mono text-[10px]">Verified Credentials Check cleared ✓</span>
                            </div>

                            {/* Dynamic checklist */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold">On-Site Deliverable Checklist</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                                {job.checklist.map(item => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    <input 
                                      type="checkbox" 
                                      disabled 
                                      checked={item.completed} 
                                      className="rounded border-[#373A43] bg-[#0F1115]" 
                                    />
                                    <span className={item.completed ? 'line-through text-[#8E9299]' : ''}>{item.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action to approve timesheet */}
                            {job.status === 'accepted' && (
                              <div className="pt-3 border-t border-[#2A2D35] flex justify-end">
                                {signOffJobId === job.id ? (
                                  <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
                                    <input 
                                      type="text" 
                                      placeholder="Enter your name (Supervisor)" 
                                      value={supervisorName}
                                      onChange={e => setSupervisorName(e.target.value)}
                                      className="bg-[#0F1115] border border-[#373A43] rounded px-3 py-1 text-xs text-white flex-grow"
                                    />
                                    <div className="flex gap-1.5 shrink-0">
                                      <button 
                                        onClick={() => setSignOffJobId(null)}
                                        className="px-2.5 py-1 text-xs text-[#8E9299] bg-[#2A2D35] rounded font-bold"
                                      >
                                        Cancel
                                      </button>
                                      <button 
                                        onClick={() => handleSignOffTimesheet(job.id)}
                                        className="px-4 py-1 text-xs text-[#0F1115] bg-[#10B981] rounded font-bold uppercase tracking-wider"
                                      >
                                        Approve
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setSignOffJobId(job.id)}
                                    className="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-200 transition-colors"
                                  >
                                    Sign Off Completed Timesheet
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Compliance Waiver notice */}
                        {wf && (
                          <div className="text-[10px] text-zinc-500 italic">
                            Safe-Harbour Liability clause: "{wf.clientLiabilityTerms}"
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {companyJobs.length === 0 && (
                    <div className="p-12 text-center text-[#8E9299] text-sm">No booked labor blocks found for {activeCompany}.</div>
                  )}
                </ul>
              </motion.div>
            </div>

            {/* Right sidebar - Permanent conversion requests */}
            <div className="space-y-6">
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wide border-b border-[#2A2D35] pb-2">
                  <Users className="h-4.5 w-4.5 text-[#10B981]" /> Permanent Hire Conversion
                </div>
                <p className="text-xs text-[#8E9299]">
                  Want to hire one of our block contractors permanently onto your roster as full-time W2 staff? Select from candidates who have worked with you.
                </p>

                {activeWorkedCandidates.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <select 
                      value={hireRequestContractorId} 
                      onChange={e => setHireRequestContractorId(e.target.value)}
                      className="w-full bg-[#1F232B] border border-[#373A43] text-xs text-white rounded p-2 focus:ring-[#10B981]"
                    >
                      <option value="">Select candidate roster...</option>
                      {activeWorkedCandidates.map(cand => (
                        <option key={cand.id} value={cand.id}>{cand.name} ({cand.verticals.join(', ')})</option>
                      ))}
                    </select>

                    <button 
                      disabled={!hireRequestContractorId}
                      onClick={() => handlePermanentHireRequest(hireRequestContractorId)}
                      className="w-full bg-[#10B981] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-[#0F1115] text-xs font-bold uppercase tracking-wider py-2.5 rounded transition-colors"
                    >
                      Request Separation Agreement
                    </button>

                    <div className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                      One-time conversion fee: $2,500
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#1F232B] border border-[#373A43] text-center rounded text-xs text-[#8E9299]">
                    No contractors have completed shifts with {activeCompany} yet to qualify for direct hire conversion selection.
                  </div>
                )}
              </div>

              <div className="bg-[#1F232B] border border-[#373A43] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wide">
                  <ShieldAlert className="h-4 w-4 text-[#10B981]" /> Safe Compliance Logs
                </div>
                <p className="text-xs text-gray-400">
                  To prevent joint-employment common law triggers, our API automatically flags any single contractor exceeding 40 hours inside a single rolling calendar month.
                </p>
                <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2.5 py-1.5 rounded border border-[#10B98133]">
                  Audit check status: PASSED (IRS Section 530 Compliance secured).
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* BILLING AND AUTOMATED INVOICING DESK */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#161920] border border-[#2A2D35] p-5 rounded-xl">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#8E9299] block font-mono">Contractor Markup Rate</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-white">
                    {activeCompany.includes('Vanguard') ? '1.45x' : activeCompany.includes('Apex') ? '1.35x' : '1.40x'}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Standard 1099 Class</span>
                </div>
                <p className="text-[10px] text-[#8E9299] mt-2">Includes occupational accident cover and contract dispatch facilitation fees.</p>
              </div>

              <div className="bg-[#161920] border border-[#2A2D35] p-5 rounded-xl">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#8E9299] block font-mono">Pending Billable Blocks</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-[#F59E0B]">
                    {companyJobs.filter(j => j.status === 'completed').length} Block(s)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">timesheet signed</span>
                </div>
                <p className="text-[10px] text-[#8E9299] mt-2">Completed and awaiting automatic QuickBooks ledger sync run.</p>
              </div>

              <div className="bg-[#161920] border border-[#2A2D35] p-5 rounded-xl">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#8E9299] block font-mono">Current Bill Period Due</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-black text-white">
                    ${companyJobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + j.charge, 0)}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Net 15 terms</span>
                </div>
                <p className="text-[10px] text-[#8E9299] mt-2">Auto-debit configured via ACH transfer protocol linked in Stripe.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Billing terms & QuickBooks setup parameters */}
              <div className="space-y-6">
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#10B981] pb-2 border-b border-[#2A2D35]">Company Client Terms</h4>
                  
                  <div className="space-y-3.5 text-xs text-slate-300">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Billing Arrangement</span>
                      <div className="bg-[#1F232B] px-3 py-2 rounded font-mono text-[11px] text-white">
                        On-Demand Block Settlement (ACH-Direct)
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Markups & Margin Structure</span>
                      <p className="text-[11px]">
                        All booked labor categories carry standard markups added directly to contractor base pay rates.
                      </p>
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-zinc-400 text-[10px]">
                        <li>Forklift operator base pay: $25.00/hr → Billed: $35.00/hr (1.40x)</li>
                        <li>Hospitality staff base pay: $20.00/hr → Billed: $28.00/hr (1.40x)</li>
                        <li>Event assistant base pay: $30.00/hr → Billed: $43.50/hr (1.45x)</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-[#10B98111] border border-[#10B98122] rounded text-[10px] text-emerald-400 font-mono">
                      ✓ QuickBooks Online Sync: ACTIVE<br/>
                      ✓ Stripe Auto-Pay Method: BOUND<br/>
                      ✓ Next Scheduled Pull: Today 11:59PM
                    </div>
                  </div>
                </div>

                <div className="bg-[#1F232B] p-4 rounded-xl border border-[#373A43] text-xs text-[#8E9299]">
                  <div className="flex gap-1.5 items-center font-bold text-white mb-2 text-[10px] uppercase">
                    <Clock className="h-4 w-4 text-[#F59E0B]" /> Automatic Overtime Limit Guard
                  </div>
                  Any contractor block that breaches 8 consecutive hours triggers an automatic time card block on-site to enforce compliance warnings. True 1099 contractor status checks are performed hourly.
                </div>
              </div>

              {/* Drafts or Unbilled Items and Current Invoice Ledger */}
              <div className="lg:col-span-2 space-y-6">
                {/* Ledger */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#2A2D35] bg-[#0F1115] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white">Automated Client Billing Run</h3>
                      <p className="text-[10px] text-[#8E9299] mt-0.5">Approve individual signed-off timesheet blocks and create formal invoices.</p>
                    </div>
                    
                    {companyJobs.filter(j => j.status === 'completed').length > 0 && (
                      <button
                        onClick={() => {
                          setSimulateInvoiceLoading(true);
                          setTimeout(() => {
                            companyJobs.filter(j => j.status === 'completed').forEach(j => {
                              onChangeJobStatus(j.id, 'paid');
                            });
                            setSimulateInvoiceLoading(false);
                            onAddLog('payroll', `[ACH Auto-Invoiced] QuickBooks processed direct bank settlement run for completed shifts on ${activeCompany}.`, 'success');
                            alert(`QuickBooks run completed successfully! ${companyJobs.filter(j => j.status === 'completed').length} timesheets have been invoiced, synced, and completed via direct ACH auto-debit.`);
                          }, 1200);
                        }}
                        className="bg-[#10B981] hover:bg-emerald-400 text-[#0F1115] font-black text-[10px] uppercase tracking-wider py-1.5 px-3 rounded font-mono cursor-pointer"
                        disabled={simulateInvoiceLoading}
                      >
                        {simulateInvoiceLoading ? 'Invoicing...' : 'Debit All Completed Blocks'}
                      </button>
                    )}
                  </div>

                  <div className="p-0">
                    {companyJobs.filter(j => j.status === 'completed' || j.status === 'paid').length > 0 ? (
                      <div className="overflow-x-auto text-[#fff]">
                        <table className="w-full text-left text-xs divide-y divide-[#2A2D35]">
                          <thead className="bg-[#121419] text-[9px] uppercase tracking-wider text-[#8E9299] font-mono">
                            <tr>
                              <th className="p-3 pl-5">Block ID</th>
                              <th className="p-3">Matched Contractor</th>
                              <th className="p-3">Deliverable Category</th>
                              <th className="p-3">Formula / Billing Multiplier</th>
                              <th className="p-3">Invoice Amount</th>
                              <th className="p-3 pr-5 text-right font-bold text-white">Direct Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2A2D35]">
                            {companyJobs.filter(j => j.status === 'completed' || j.status === 'paid').map(job => {
                              const matcher = candidates.find(c => c.id === job.contractorId);
                              const isCompleted = job.status === 'completed';
                              const parsedPay = job.category.includes('Forklift') ? 25 : job.category.includes('Event') ? 30 : 20;
                              const multiplier = activeCompany.includes('Vanguard') ? 1.45 : activeCompany.includes('Apex') ? 1.35 : 1.40;

                              return (
                                  <tr key={job.id} className="hover:bg-black/20 text-slate-300 font-sans">
                                    <td className="p-4 pl-5 font-mono text-[10px] text-slate-400">#BLK-{job.id}</td>
                                    <td className="p-4">
                                      <span className="font-bold text-white block">{matcher ? matcher.name : 'Unassigned'}</span>
                                      <span className="text-[9px] text-[#8E9299] uppercase block">1099 Contractor</span>
                                    </td>
                                    <td className="p-4 font-bold">{job.category} ({job.blockType})</td>
                                    <td className="p-4 font-mono text-[10px] text-[#8E9299]">
                                      Base ${parsedPay}.00/hr × {multiplier}x<br/>
                                      Term: net-15 direct Sync
                                    </td>
                                    <td className="p-4 font-mono font-black text-white text-sm">${job.charge}</td>
                                    <td className="p-4 text-right pr-5">
                                      {isCompleted ? (
                                        <button
                                          onClick={() => {
                                            onChangeJobStatus(job.id, 'paid');
                                            onAddLog('payroll', `[Single Settle] Paid individual block invoice #${job.id} manually. QuickBooks synced.`, 'success');
                                            alert(`Direct settlement processed successfully for task block #${job.id}! QuickBooks has cleared of due.`);
                                          }}
                                          className="bg-white hover:bg-zinc-200 text-black text-[9px] uppercase font-bold px-2.5 py-1 rounded cursor-pointer"
                                        >
                                          ACH Pay Instantly
                                        </button>
                                      ) : (
                                        <div className="inline-flex items-center gap-1.5 text-[#10B981] font-mono text-[9px] uppercase font-bold bg-[#10B98111] px-2 py-0.5 rounded border border-[#10B98122]">
                                          <CheckCircle2 className="h-3 w-3" /> Paid & QuickBooks Synced
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-10 text-center text-zinc-500 text-xs flex flex-col items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-zinc-600 mb-2" />
                        No pending timesheet sign-offs or past invoice history for {activeCompany}. Complete a timesheet checkout first!
                      </div>
                    )}
                  </div>
                </div>

                {/* Accounting Ledger Summary card */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#8E9299] pb-1 border-b border-[#2A2D35]">Integrated Services Ledger Logs</h4>
                  
                  <div className="space-y-2 text-[10px] text-[#8E9299]">
                    <div className="flex justify-between font-mono bg-black/40 p-2 rounded">
                      <span>Invoice Sync Engine:</span>
                      <span className="text-[#10B981] font-bold">READY (QuickBooks Intuit Sandbox)</span>
                    </div>
                    <div className="flex justify-between font-mono bg-black/40 p-2 rounded">
                      <span>Automated ACH Debiting:</span>
                      <span className="text-[#10B981] font-bold">ACTIVE (Plaza Stripe Bank link)</span>
                    </div>
                    <div className="flex justify-between font-mono bg-black/40 p-2 rounded">
                      <span>End-User 1099 Form Dispatches:</span>
                      <span className="text-zinc-500">Scheduled on Fiscal Settles</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
