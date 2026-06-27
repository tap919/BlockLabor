import { useState, useMemo, DragEvent, ChangeEvent, FormEvent } from 'react';
import { Job, WorkerCandidate, IncidentReport } from '../../../shared/types/domain';
import { motion, AnimatePresence } from 'motion/react';
import VerifiedStamp from '../../../components/ui/VerifiedStamp';
import { 
  MapPin, DollarSign, Clock, ShieldCheck, CheckSquare, 
  Smartphone, BellRing, Navigation as NavIcon, FileSignature, 
  AlertTriangle, Play, CheckCircle2, Calendar, FileText, 
  CreditCard, Send, User, ChevronRight, Inbox, RefreshCw, 
  X, Check, Lock, ArrowRight, UserCheck, HelpCircle, Upload, Shuffle
} from 'lucide-react';

interface ContractorPortalProps {
  jobs: Job[];
  candidates: WorkerCandidate[];
  incidentReports?: IncidentReport[];
  onAddIncident?: (newIncident: IncidentReport) => void;
  onChangeJobStatus: (jobId: string, status: Job['status'], contractorId?: string, updates?: Partial<Job>) => void;
  onUpdateCandidate: (candidateId: string, updates: Partial<WorkerCandidate>) => void;
  onAddLog: (category: string, message: string, type?: 'info' | 'success' | 'warning' | 'sms') => void;
}

type SubTab = 'jobs' | 'availability' | 'onboarding' | 'messaging';

export function ContractorPortalView({
  jobs,
  candidates,
  incidentReports = [],
  onAddIncident,
  onChangeJobStatus,
  onUpdateCandidate,
  onAddLog
}: ContractorPortalProps) {
  // Available contractors to choose from
  const activeContractors = candidates.filter(c => c.status === 'active' || c.status === 'onboarded');
  const defaultWorker = activeContractors[0] ?? candidates[0];

  // Track sub-tabs
  const [currentTab, setCurrentTab] = useState<SubTab>('jobs');
  const [activeWorkerId, setActiveWorkerId] = useState<string>(defaultWorker?.id ?? '');

  // Derived current worker - updates when activeWorkerId or candidates change
  const currentWorker = useMemo(() => 
    candidates.find(c => c.id === activeWorkerId) ?? defaultWorker!,
    [activeWorkerId, candidates, defaultWorker]
  );

  // Job List Filters inside worker experience
  const openJobs = jobs.filter(j => j.status === 'open' && currentWorker.verticals.includes(j.vertical));
  const myJobs = jobs.filter(j => j.contractorId === currentWorker.id);

  // States for active operations
  const [activeShiftComments, setActiveShiftComments] = useState<string>('');
  const [selectedMobileView, setSelectedMobileView] = useState<'desktop_portal' | 'mobile_phone'>('mobile_phone');
  
  // Custom document upload choices and expires parameters
  const [selectedUploadDocType, setSelectedUploadDocType] = useState<string>('i9');
  const [customExpiryInput, setCustomExpiryInput] = useState<string>('');

  // Chat input states
  const [chatMessageText, setChatMessageText] = useState<string>('');
  
  // Direct Deposit Form States
  const [bankName, setBankName] = useState<string>(currentWorker.directDepositDetail?.bankName || '');
  const [routingNum, setRoutingNum] = useState<string>(currentWorker.directDepositDetail?.routing || '');
  const [accountNum, setAccountNum] = useState<string>(currentWorker.directDepositDetail?.account || '');
  const [payOption, setPayOption] = useState<'direct_deposit' | 'pay_card'>(currentWorker.payOption || 'direct_deposit');

  // Drag and drop simulator states
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // If there is no candidate, render an empty state
  if (!candidates.length || !defaultWorker) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center text-zinc-400">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">No contractor profile available</h2>
          <p className="text-sm">Once a candidate is onboarded, this portal will populate with their shifts.</p>
        </div>
      </div>
    );
  }

  const handleOptInJob = (jobId: string) => {
    if (currentWorker.status !== 'active') {
      alert("Compliance Hold: Your candidate files are undergoing Gusto/Checkr background integration checks. Please review and sign your onboarding files on the 'Onboarding & Documents' tab!");
      return;
    }

    const job = jobs.find(j => j.id === jobId);
    if (job) {
      onChangeJobStatus(jobId, 'accepted', currentWorker.id);
      onAddLog('scheduler', `[1099 Dispatch] Contractor ${currentWorker.name} accepted SOW for ${job.businessName} (Block payout: $${job.payout})`, 'sms');
      
      // Inject automated message for shift confirmation
      const systemMsg = {
        id: 'msg-' + Date.now(),
        sender: 'Dispatch Bot',
        text: `Contract Confirmed: You accepted "${job.category}" block at ${job.location}. Check-in opens at scheduled window: ${job.startWindow}. GPS Geofencing active.`,
        timestamp: new Date().toISOString()
      };
      
      const currentMessages = currentWorker.messages || [];
      onUpdateCandidate(currentWorker.id, {
        messages: [...currentMessages, systemMsg]
      });
    }
  };

  const handleCheckIn = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      const timesheet = {
        checkInTime: new Date().toISOString(),
        gpsVerified: true,
        notes: 'Worker checked in via mobile browser interface.'
      };
      onChangeJobStatus(jobId, 'accepted', currentWorker.id, { timesheet });
      onAddLog('worker', `[GPS Checked-In] Contractor ${currentWorker.name} checked in at ${job.businessName}. Site Coordinates Verified.`, 'info');
    }
  };

  const handleCheckOut = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      const timesheet = {
        ...job.timesheet,
        checkOutTime: new Date().toISOString(),
        notes: activeShiftComments || 'Contract block completed following safety instructions.',
        workerSignature: currentWorker.name
      };
      
      onChangeJobStatus(jobId, 'completed', currentWorker.id, { timesheet });
      onAddLog('worker', `[GPS Checked-Out] Contractor ${currentWorker.name} finished shift at ${job.businessName}. Timesheet dispatched for client approval.`, 'success');
      
      setActiveShiftComments('');
    }
  };

  const handleToggleCheckstep = (jobId: string, stepId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      const updatedChecklist = job.checklist.map(item => {
        if (item.id === stepId) {
          return { ...item, completed: !item.completed };
        }
        return item;
      });
      onChangeJobStatus(jobId, job.status, currentWorker.id, { checklist: updatedChecklist });
    }
  };

  const handleRequestSwap = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      onChangeJobStatus(jobId, job.status, currentWorker.id, { swapRequested: true });
      onAddLog('scheduler', `[Swap Requested] 1099 Contractor ${currentWorker.name} requested shift swap for ${job.businessName} Block. Available to team.`, 'warning');
      alert("Shift Swap requested. This block is now marked as available for swapping among team members. Schedulers notified.");
    }
  };

  const handleRequestDrop = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      onChangeJobStatus(jobId, 'open', undefined, { dropRequested: true, swapRequested: false });
      onAddLog('scheduler', `[Shift Dropped/Cancelled] Contractor ${currentWorker.name} dropped block assignment at ${job.businessName}. SOW returned to open board.`, 'warning');
      alert("Shift dropped. Since you are an independent 1099 contractor, this was returned to the open board without penalty.");
    }
  };

  // Availability calendar modifier
  const handleToggleAvailability = (day: string) => {
    const currentAvail = currentWorker.weeklyAvailability || {
      Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false, Sunday: false
    };
    const updatedAvail = {
      ...currentAvail,
      [day]: !currentAvail[day]
    };
    onUpdateCandidate(currentWorker.id, { weeklyAvailability: updatedAvail });
    onAddLog('recruiter', `[Preferences Change] Contractor ${currentWorker.name} updated availability calendar.`, 'info');
  };

  // Change Shift Time Preferences
  const handleTogglePreference = (preference: string) => {
    const currentPrefs = currentWorker.shiftPreferences || ['morning', 'afternoon'];
    let updatedPrefs: string[];
    if (currentPrefs.includes(preference)) {
      updatedPrefs = currentPrefs.filter(p => p !== preference);
    } else {
      updatedPrefs = [...currentPrefs, preference];
    }
    onUpdateCandidate(currentWorker.id, { shiftPreferences: updatedPrefs });
    onAddLog('recruiter', `[Preferences Change] Contractor ${currentWorker.name} modified task shift timing preferences to [${updatedPrefs.join(', ')}].`, 'info');
  };

  // Chat message sender
  const handleSendChatMessage = () => {
    if (!chatMessageText.trim()) return;

    const newMsg = {
      id: 'msg-' + Date.now(),
      sender: currentWorker.name,
      text: chatMessageText,
      timestamp: new Date().toISOString()
    };

    const currentMessages = currentWorker.messages || [];
    const updatedMessages = [...currentMessages, newMsg];

    onUpdateCandidate(currentWorker.id, { messages: updatedMessages });
    onAddLog('worker', `[App Chat] Message posted by contractor ${currentWorker.name}: "${chatMessageText}"`, 'info');
    
    const submittedText = chatMessageText;
    setChatMessageText('');

    // Simulated automated prompt reply after 800ms
    setTimeout(() => {
      let replyText = "Understood. Our Gusto verification bridge is tracking compliance logs active on profile.";
      if (submittedText.toLowerCase().includes('pay') || submittedText.toLowerCase().includes('direct') || submittedText.toLowerCase().includes('wallet')) {
        replyText = "Direct deposit and prepaid RapidPay card information syncs instantly to our Gusto ledger. Payouts process on timesheet approval.";
      } else if (submittedText.toLowerCase().includes('schedule') || submittedText.toLowerCase().includes('shift') || submittedText.toLowerCase().includes('work') || submittedText.toLowerCase().includes('swap')) {
        replyText = "Our scheduling engine monitors swap requests and automatically dispatches open slots via Twilio alerts.";
      } else if (submittedText.toLowerCase().includes('document') || submittedText.toLowerCase().includes('verify') || submittedText.toLowerCase().includes('passport') || submittedText.toLowerCase().includes('license')) {
        replyText = "Any uploaded credential documents are reviewed instantly using digital AI-OCR extraction. Go Ahead!";
      }

      const botMsg = {
        id: 'msg-bot-' + Date.now(),
        sender: 'Compliance Officer (Automated)',
        text: replyText,
        timestamp: new Date().toISOString()
      };
      
      onUpdateCandidate(currentWorker.id, {
        messages: [...updatedMessages, botMsg]
      });
      onAddLog('sms', `[Recruiting Assistant] Automated chat notification push dispatched to ${currentWorker.name}`, 'sms');
    }, 850);
  };

  // Fast direct deposit synchronization
  const handleSavePayOption = (e: FormEvent) => {
    e.preventDefault();
    onUpdateCandidate(currentWorker.id, {
      payOption: payOption,
      directDepositDetail: payOption === 'direct_deposit' ? {
        bankName: bankName || 'Standard Bank',
        routing: routingNum || '012003456',
        account: accountNum || '******9910'
      } : undefined,
      payCardDetail: payOption === 'pay_card' ? {
        cardNumber: '**** **** **** 5102',
        provider: 'RapidPay Mastercard'
      } : undefined,
      profileUpdated: true
    });
    
    // Log to backoffice
    onAddLog('payroll', `[Pay Preference Set] ${currentWorker.name} updated payment method to ${payOption === 'direct_deposit' ? 'Direct Deposit ('+bankName+')' : 'RapidPay Card'} matched in Gusto.`, 'success');
    alert("Payment credentials synchronized live to our Gusto payroll API ledger.");
  };

  // Handbook instant e-signature simulation
  const handleSignHandbook = () => {
    onUpdateCandidate(currentWorker.id, {
      eSignStatus: 'signed',
      // If signed, background check is passed, then candidate becomes 'active'
      status: currentWorker.backgroundCheckStatus === 'passed' ? 'active' : 'onboarded'
    });
    onAddLog('recruiter', `[DocuSign Handshake] Independent Contractor Agreement signed by ${currentWorker.name}`, 'success');
    alert("DocuSign 1099 Handbook Agreement counter-signed successfully!");
  };

  // Drag and drop or file upload simulation
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSimulatedFileUpload = (fileName: string, fileType: string) => {
    const currentDocs = currentWorker.documents || [];
    
    // Resolve clean human readable labels
    const docTypesMap: {[key: string]: string} = {
      'i9': 'I-9 Employment Verification',
      'w4': 'W-4 Tax Withholding Form',
      'drivers_license': 'Driver’s License ID',
      'forklift_cert': 'Forklift Safety Certificate',
      'cna_license': 'CNA Medical License',
      'insurance_waiver': 'General Liability Waiver'
    };

    const resolvedFormType = docTypesMap[selectedUploadDocType] || 'Verification Attachment';
    const computedExpiry = customExpiryInput 
      ? new Date(customExpiryInput).toISOString() 
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // Default 1 year from today

    const newDoc = {
      id: 'doc-' + Date.now(),
      name: fileName,
      type: resolvedFormType,
      status: 'pending' as const,
      uploadedAt: new Date().toISOString(),
      expiresAt: computedExpiry
    };
    
    const updatedDocs = [...currentDocs, newDoc];
    onUpdateCandidate(currentWorker.id, {
      documents: updatedDocs
    });

    onAddLog('recruiter', `[Document Vault] Contractor ${currentWorker.name} uploaded ${fileName} as ${resolvedFormType}`, 'info');
    setIsDragging(false);

    // Fast AI auto-verification after 1.5 seconds
    setTimeout(() => {
      const verifiedDocs = updatedDocs.map(d => d.id === newDoc.id ? { ...d, status: 'verified' as const } : d);
      // Auto add credential ID to candidate verified list based on type match
      let updatedVerifiedCreds = [...currentWorker.verifiedCredentials];
      
      if (selectedUploadDocType === 'forklift_cert') {
        updatedVerifiedCreds.push('forklift_cert');
      } else if (selectedUploadDocType === 'cna_license') {
        updatedVerifiedCreds.push('cna_license');
      } else {
        // Just general handler
        updatedVerifiedCreds.push(selectedUploadDocType);
      }

      onUpdateCandidate(currentWorker.id, {
        documents: verifiedDocs,
        verifiedCredentials: Array.from(new Set(updatedVerifiedCreds))
      });
      onAddLog('recruiter', `[OCR Verified] Correctly parsed ${resolvedFormType} parameters in ${fileName}. Secure ledger updated.`, 'success');
      setCustomExpiryInput('');
    }, 1500);
  };

  const handleDropFile = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleSimulatedFileUpload(file.name, "Manual Drag-to-Upload");
    }
  };

  const handleManualFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleSimulatedFileUpload(file.name, "Manual File Selection");
    }
  };


  // Sub View Switcher inside layout
  const subTabs = [
    { id: 'jobs', label: 'Labor Sheets', icon: ShieldCheck },
    { id: 'availability', label: 'Availability', icon: Calendar },
    { id: 'onboarding', label: 'Onboarding & Pay', icon: FileText },
    { id: 'messaging', label: 'Inbox & Alerts', icon: Inbox }
  ] as const;

  // -------------------------------------------------------------
  // PHONE PREVIEW COMPONENT
  // -------------------------------------------------------------
  const MobilePhoneLayout = () => {
    return (
      <div id="phone-container" className="mx-auto max-w-[390px] w-full bg-[#030303] rounded-[52px] border-[12px] border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden font-sans relative flex flex-col" style={{ height: '790px' }}>
        {/* Speaker notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-zinc-800 w-32 h-6 rounded-b-2xl z-50 flex items-center justify-center">
          <div className="w-12 h-1 bg-black rounded-full" />
        </div>

        {/* Outer Phone View Inner Frame */}
        <div className="flex-grow pt-8 pb-14 px-4 overflow-y-auto bg-[#0A0C10] text-white flex flex-col">
          
          {/* Top Status Bar Simulator */}
          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mb-2 px-1">
            <span>BlockLabor Net</span>
            <span>LTE 100%</span>
          </div>

          {/* Worker identity selection */}
          <div className="flex justify-between items-center bg-[#13161C] p-3 rounded-xl border border-[#21242C] mb-4">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400">Active Worker Profile</span>
              <select
                value={activeWorkerId}
                onChange={e => {
                  const val = e.target.value;
                  setActiveWorkerId(val);
                  const newW = candidates.find(c => c.id === val);
                  if (newW) {
                    setBankName(newW.directDepositDetail?.bankName || '');
                    setRoutingNum(newW.directDepositDetail?.routing || '');
                    setAccountNum(newW.directDepositDetail?.account || '');
                    setPayOption(newW.payOption || 'direct_deposit');
                  }
                }}
                className="bg-transparent border-0 text-white font-bold text-xs p-0 focus:ring-0 max-w-[150px] truncate block outline-none cursor-pointer"
              >
                {candidates.map(cand2 => (
                  <option key={cand2.id} value={cand2.id} className="bg-[#161920] text-white">
                    {cand2.name}
                  </option>
                ))}
              </select>
            </div>
            
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              currentWorker.status === 'active' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
              {currentWorker.status.toUpperCase()}
            </span>
          </div>

          <div className="flex-grow space-y-4">
            {/* TAB CONTENT: LABORS / ACTIONS */}
            {currentTab === 'jobs' && (
              <div className="space-y-4">
                {/* Balance & Status Summary */}
                <div className="bg-gradient-to-br from-[#1A1D24] to-[#121419] border border-[#232730] rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] uppercase tracking-widest text-[#8E9299]">Independent Collective Wallet</span>
                  <div className="flex justify-between items-end">
                    <span className="text-xl font-mono font-bold text-[#10B981]">${currentWorker.totalEarned}</span>
                    <span className="text-[9px] text-[#8E9299]">Gusto Live Active</span>
                  </div>
                </div>

                {/* ACTIVE CURRENT SHIFTS */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block">Accepted Labor SOWs</span>
                  {myJobs.filter(j => j.status === 'accepted' || j.status === 'completed').map(job => (
                    <div key={job.id} className="bg-[#12151B] border border-[#232730] rounded-xl p-3 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">{job.businessName}</h4>
                          <p className="text-[10px] text-[#8E9299] mt-0.5">{job.category} ({job.blockType})</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          job.status === 'completed' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {job.status === 'completed' ? 'SUBMITTED' : 'ACTIVE'}
                        </span>
                      </div>

                      {/* Site profile & geofence */}
                      <div className="bg-black/30 p-2 rounded border border-zinc-800 text-[10px] space-y-1 text-slate-300">
                        <p className="flex items-center gap-1"><MapPin className="h-3 w-3 text-red-500" /> {job.location}</p>
                        <p className="flex items-center gap-1"><Clock className="h-3 w-3 text-emerald-400" /> Dispatch Window: {job.startWindow}</p>
                        {job.swapRequested && <p className="text-yellow-500 font-bold">✓ Marked for Teammate Swap</p>}
                      </div>

                      {/* Display checklist for active job */}
                      {job.status === 'accepted' && (
                        <div className="space-y-2 pt-2 border-t border-zinc-800">
                          <span className="text-[9px] uppercase tracking-widest font-bold text-[#8E9299]">SOW Execution Steps:</span>
                          <div className="space-y-1 text-xs">
                            {job.checklist.map(step => (
                              <label key={step.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                                <input
                                  type="checkbox"
                                  checked={step.completed}
                                  onChange={() => handleToggleCheckstep(job.id, step.id)}
                                  className="rounded border-[#373A43] bg-black text-[#10B981] h-3.5 w-3.5"
                                />
                                <span className={`${step.completed ? 'line-through text-zinc-500' : 'text-slate-200'} text-[11px]`}>
                                  {step.text}
                                </span>
                              </label>
                            ))}
                          </div>

                          {/* Check in triggers */}
                          <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                            {!job.timesheet?.checkInTime ? (
                              <button
                                onClick={() => handleCheckIn(job.id)}
                                className="w-full bg-[#10B981] text-[#0F1115] hover:bg-emerald-400 font-bold uppercase tracking-wider rounded-lg py-1.5 text-[10px] flex items-center justify-center gap-1"
                              >
                                <Play className="h-3 w-3 fill-current" /> Stamp Geofence Punch-In
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <div className="bg-black/80 px-2 py-1.5 rounded text-[9px] text-[#10B981] flex justify-between">
                                  <span>✓ GPS IN: {new Date(job.timesheet.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span>GEOFENCE PASS</span>
                                </div>

                                <input
                                  type="text"
                                  placeholder="Type completion notes (e.g., loaded 12 pallets)..."
                                  value={activeShiftComments}
                                  onChange={e => setActiveShiftComments(e.target.value)}
                                  className="w-full rounded border-[#373A43] bg-black text-white text-[10px] px-2 py-1.5 border focus:border-[#10B981]"
                                />

                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                                  <button
                                    onClick={() => handleRequestSwap(job.id)}
                                    className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20 rounded py-1"
                                  >
                                    Swap SOW
                                  </button>
                                  <button
                                    onClick={() => handleRequestDrop(job.id)}
                                    className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded py-1"
                                  >
                                    Drop / Cancel
                                  </button>
                                </div>

                                <button
                                  onClick={() => handleCheckOut(job.id)}
                                  className="w-full bg-[#EF4444] text-white hover:bg-red-400 font-bold uppercase tracking-wider rounded-lg py-1.5 text-[10px]"
                                >
                                  Stamp Punch-Out & Submit
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {myJobs.filter(j => j.status === 'accepted' || j.status === 'completed').length === 0 && (
                    <div className="bg-zinc-900/30 text-zinc-500 border border-dashed border-zinc-800 rounded-xl py-5 text-center text-[11px]">
                      No active assignments currently.
                    </div>
                  )}
                </div>

                {/* DISPATCH BOARDS */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block">Open 1099 Boards (Opt-In)</span>
                  <div className="space-y-2.5">
                    {openJobs.map(job => (
                      <div key={job.id} className="bg-[#12151B] border border-[#232730] rounded-xl p-3 space-y-2 flex flex-col">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{job.businessName}</h4>
                            <span className="text-[9px] text-[#10B981] font-mono mt-0.5 block">{job.category}</span>
                          </div>
                          <span className="font-mono text-xs text-[#10B981] font-bold">${job.payout}</span>
                        </div>

                        <div className="text-[10px] text-zinc-400 space-y-0.5">
                          <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {job.startWindow}</p>
                          <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</p>
                        </div>

                        {currentWorker.status === 'active' ? (
                          <button
                            onClick={() => handleOptInJob(job.id)}
                            className="bg-white hover:bg-zinc-200 text-black text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-lg text-center mt-1"
                          >
                            Accept Block Contract
                          </button>
                        ) : (
                          <div className="text-[9px] bg-red-500/10 text-red-500 p-2 rounded border border-red-500/20 text-center">
                            Onboarding Hold active (Action required)
                          </div>
                        )}
                      </div>
                    ))}

                    {openJobs.length === 0 && (
                      <div className="text-zinc-500 text-center py-5 text-[11px] bg-[#12151B]/50 rounded-xl border border-zinc-800/50">
                        No open blocks matches your vertical categories currently.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: AVAILABILITY & PREFERENCES */}
            {currentTab === 'availability' && (
              <div className="space-y-4">
                <div className="bg-[#121419] p-3 rounded-xl border border-zinc-800">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#10B981]" /> Weekly Availability
                  </h3>
                  <p className="text-[10px] text-[#8E9299] mb-3">
                    Select days you are available to receive on-demand dispatch offers:
                  </p>
                  
                  {/* Calendar day buttons */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const avail = currentWorker.weeklyAvailability || {
                        Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false, Sunday: false
                      };
                      const isActive = avail[day];
                      return (
                        <button
                          key={day}
                          onClick={() => handleToggleAvailability(day)}
                          className={`py-2 px-3 rounded-lg border text-left font-semibold flex justify-between items-center transition ${
                            isActive 
                              ? 'bg-[#10B98111] border-[#10B98133] text-white' 
                              : 'bg-black/45 border-zinc-800 text-zinc-500'
                          }`}
                        >
                          <span>{day}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#10B981]' : 'bg-transparent'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SHIFT TIMEOUT PREFERENCES */}
                <div className="bg-[#121419] p-3 rounded-xl border border-zinc-800 space-y-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#3B82F6]" /> Shift Window Preferences
                  </h3>
                  <p className="text-[10px] text-[#8E9299]">
                    Select shift timing classes you prefer to offer services for:
                  </p>

                  <div className="space-y-2 text-xs pt-1">
                    {[
                      { id: 'morning', label: 'Morning Dispatch (6am - 2pm)' },
                      { id: 'afternoon', label: 'Afternoon Dispatch (2pm - 10pm)' },
                      { id: 'night', label: 'Night Owl Dispatch (10pm - 6am)' }
                    ].map(pref => {
                      const prefs = currentWorker.shiftPreferences || ['morning', 'afternoon'];
                      const isSelected = prefs.includes(pref.id);
                      return (
                        <label key={pref.id} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-zinc-800/80 cursor-pointer">
                          <span className="text-slate-300 text-[11px]">{pref.label}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTogglePreference(pref.id)}
                            className="rounded border-zinc-700 bg-black text-[#10B981] h-3.5 w-3.5"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Liability notes */}
                <div className="bg-zinc-900/40 p-3 rounded-lg text-[9px] text-[#8E9299] border border-zinc-800/60 font-serif">
                  * Note: Setting your availability assists the system in matchmaking, but you retain 100% active mandate choice over whether to accept any individual dispatch block contract.
                </div>
              </div>
            )}

            {/* TAB CONTENT: ONBOARDING & DOCUMENTS & PAY */}
            {currentTab === 'onboarding' && (
              <div className="space-y-4">
                {/* Background Check Consent Checkr */}
                <div className="bg-[#121419] p-3 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#10B981]" /> Checkr Background API
                    </h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      currentWorker.backgroundCheckStatus === 'passed' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {currentWorker.backgroundCheckStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8E9299]">
                    Compliance background checks are submitted instantly after direct onboarding authorization.
                  </p>
                </div>

                {/* DOCUSIGN HANDBOOK AGREEMENT STATUS */}
                <div className="bg-[#121419] p-3 rounded-xl border border-zinc-800 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-[#3B82F6]" /> DocuSign 1099 Agreement
                    </h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                      currentWorker.eSignStatus === 'signed' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {currentWorker.eSignStatus.toUpperCase()}
                    </span>
                  </div>

                  {currentWorker.eSignStatus !== 'signed' ? (
                    <div>
                      <p className="text-[10px] text-[#8E9299] mb-2">
                        Requires single sign-off to complete onboarding into independent contractor pool:
                      </p>
                      <button
                        onClick={handleSignHandbook}
                        className="w-full bg-[#10B981] text-[#0F1115] hover:bg-emerald-400 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg"
                      >
                        Sign E-Signature Waiver
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-400 italic">
                      ✓ Authenticated Handbook executed safely on {new Date().toLocaleDateString()}.
                    </p>
                  )}
                </div>

                {/* MULTI-METHOD PAYMENTS DIRECT DEPOSIT AND DEBIT CARD */}
                <div className="bg-[#121419] p-3 rounded-xl border border-zinc-800 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-[#F59E0B]" /> Gusto Pay Options Setup
                  </h3>
                  
                  <div className="flex gap-2 p-0.5 bg-black rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPayOption('direct_deposit')}
                      className={`flex-1 py-1.5 rounded-md font-semibold ${payOption === 'direct_deposit' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                    >
                      Direct Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayOption('pay_card')}
                      className={`flex-1 py-1.5 rounded-md font-semibold ${payOption === 'pay_card' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                    >
                      RapidPay Debit Card
                    </button>
                  </div>

                  {payOption === 'direct_deposit' ? (
                    <form onSubmit={handleSavePayOption} className="space-y-2 text-xs">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Bank Name (e.g., Chase)"
                          value={bankName}
                          onChange={e => setBankName(e.target.value)}
                          className="w-full rounded border-zinc-800 bg-[#0A0C10] text-white text-[10px] px-2 py-1.5 border focus:border-[#10B981]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Routing Number"
                          value={routingNum}
                          onChange={e => setRoutingNum(e.target.value)}
                          className="w-full rounded border-zinc-800 bg-[#0A0C10] text-[#10B981] font-mono text-[10px] px-2 py-1.5 border focus:border-[#10B981]"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Account Number"
                          value={accountNum}
                          onChange={e => setAccountNum(e.target.value)}
                          className="w-full rounded border-zinc-800 bg-[#0A0C10] text-white text-[10px] px-2 py-1.5 border focus:border-[#10B981]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-[#10B981] hover:bg-emerald-400 text-xs py-1.5 rounded font-bold uppercase text-[#0F1115]"
                      >
                        Sync Gusto Deposit Account
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="bg-black/50 p-3 rounded-lg border border-yellow-500/20 text-slate-300 text-[10px] space-y-1">
                        <span className="font-bold text-yellow-500 uppercase block">Active RapidPay Card:</span>
                        <p>Provider: RapidPay Visa Prepaid Association</p>
                        <p className="font-mono text-[11px] text-[#10B981]">Card Number: **** **** **** 8855</p>
                        <p className="text-[9px] text-zinc-500">Earnings auto-payout to card within 4 hours of check-out completion.</p>
                      </div>
                      <button
                        onClick={() => {
                          setPayOption('pay_card');
                          onUpdateCandidate(currentWorker.id, { payOption: 'pay_card', payCardDetail: { cardNumber: '**** **** **** 8855', provider: 'RapidPay' } });
                          onAddLog('payroll', `[Debit Card Selected] ${currentWorker.name} activated RapidPay direct dispatch ledger.`, 'success');
                          alert("Instant-payout RapidPay Mastercard bound to contractor wallet profile.");
                        }}
                        className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-1.5 rounded uppercase text-[10px]"
                      >
                        Re-issue / Refresh Pay Card
                      </button>
                    </div>
                  )}
                </div>

                {/* DOCUMENT UPLOAD ZONE (DRAG-DROP COMPLIANT) */}
                <div className="bg-[#121419] p-4 rounded-xl border border-zinc-800 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                    <Upload className="h-4 w-4 text-[#10B981]" /> Onboarding Document Vault
                  </h3>

                  {/* Vault options selector form */}
                  <div className="space-y-2.5 bg-black/30 p-3 rounded-lg border border-zinc-800">
                    <div className="text-xs">
                    <label htmlFor="doc-type" className="block text-[9px] uppercase tracking-widest text-[#8E9299] font-bold mb-1">Document Specification</label>
                    <select 
                      id="doc-type"
                        onChange={e => setSelectedUploadDocType(e.target.value)}
                        className="w-full bg-[#1F232B] border border-zinc-700 rounded p-1.5 text-[11px] text-white focus:border-[#10B981] outline-none"
                      >
                        <option value="i9">I-9 Identity Verification Form (+Passport/ID)</option>
                        <option value="w4">W-4 Contractor Withholding Form</option>
                        <option value="drivers_license">Driver’s License ID Card (CDL Class)</option>
                        <option value="forklift_cert">OSHA Forklift Operator Licence</option>
                        <option value="cna_license">CNA Nursing Certificate Board</option>
                        <option value="insurance_waiver">General Liability Hold Waiver</option>
                      </select>
                    </div>

                    <div className="text-xs">
                    <label htmlFor="expiry-date" className="block text-[9px] uppercase tracking-widest text-[#8E9299] font-bold mb-1">Expiration Date Selector (Optional)</label>
                    <input 
                      id="expiry-date"
                        value={customExpiryInput}
                        onChange={e => setCustomExpiryInput(e.target.value)}
                        className="w-full bg-[#1F232B] border border-zinc-700 rounded p-1.5 text-[11px] text-white focus:border-[#10B981] outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Drag-drop box */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDropFile}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                      isDragging 
                        ? 'border-[#10B981] bg-[#10B981]/5 text-white' 
                        : 'border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Upload className="h-5 w-5 text-[#8E9299] mx-auto mb-1.5" />
                    <p className="text-[10px] font-semibold text-slate-300">
                      Drag-and-Drop verification files here
                    </p>
                    <p className="text-[9px] text-[#8E9299] mt-0.5">
                      Or click to browse files locally
                    </p>
                    
                    <input
                      type="file"
                      onChange={handleManualFileChange}
                      className="hidden"
                      id="mobile-file-input"
                    />
                    <label
                      htmlFor="mobile-file-input"
                      className="mt-2 inline-block px-2.5 py-1 text-[9px] uppercase tracking-wider bg-zinc-800 text-white rounded font-bold hover:bg-zinc-700 cursor-pointer"
                    >
                      Choose File
                    </label>
                  </div>

                  {/* Uploaded Documents List */}
                  {currentWorker.documents && currentWorker.documents.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 block">Uploaded Compliance Vault:</span>
                      {currentWorker.documents.map(doc => {
                        const daysLeft = doc.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                        const isExpiringSoon = daysLeft !== null && daysLeft <= 30;
                        const isExpired = daysLeft !== null && daysLeft <= 0;

                        return (
                          <div key={doc.id} className="bg-black/85 p-2.5 rounded border border-zinc-800 space-y-1 text-[10px]">
                            <div className="flex justify-between items-start gap-2">
                              <div className="truncate pr-2">
                                <span className="font-bold text-white block truncate">{doc.name}</span>
                                <span className="text-[#10B981] text-[9px] font-mono uppercase">{doc.type}</span>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                doc.status === 'verified' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-yellow-500/10 text-yellow-500'
                              }`}>
                                {doc.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="text-[9px] text-[#8E9299] font-mono flex flex-wrap gap-2 pt-1 border-t border-zinc-900 justify-between">
                              <span>Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}</span>
                              <span>Expires: {doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString() : 'N/A'}</span>
                            </div>

                            {isExpired ? (
                              <div className="mt-1 bg-red-500/20 text-red-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider block text-center">
                                🚨 DOCUMENT EXPIRED - DISPATCH SUSPENDED
                              </div>
                            ) : isExpiringSoon ? (
                              <div className="mt-1 bg-yellow-500/20 text-yellow-555 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider block text-center">
                                ⚠️ EXPIRING SOON ({daysLeft} DAYS)
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: IN-APP CHAT & ALERTS */}
            {currentTab === 'messaging' && (
              <div className="flex flex-col h-[500px]">
                {/* Chat window viewport */}
                <div className="flex-grow overflow-y-auto space-y-3 pr-1 scrollbar-thin bg-black/30 p-2.5 rounded-xl border border-zinc-900">
                  {currentWorker.messages && currentWorker.messages.map(msg => {
                    const isMe = msg.sender === currentWorker.name;
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-xl p-2.5 text-xs text-white ${
                          isMe 
                            ? 'bg-[#10B98133] ml-auto border border-[#10B98144] rounded-tr-none' 
                            : 'bg-zinc-800 mr-auto border border-zinc-700/60 rounded-tl-none'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1 text-[8px] text-slate-400 font-mono">
                          <span className="font-bold text-[#10B981]">{msg.sender}</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed select-text">{msg.text}</p>
                      </div>
                    );
                  })}
                  
                  {(!currentWorker.messages || currentWorker.messages.length === 0) && (
                    <div className="text-center text-zinc-500 text-[10px] py-10">
                      No recruitment logs or chat feeds in vault.
                    </div>
                  )}
                </div>

                {/* Input box */}
                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Type dispatch / compliance query..."
                    value={chatMessageText}
                    onChange={e => setChatMessageText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                    className="flex-grow rounded border-[#373A43] bg-[#12151B] text-white text-[11px] px-3 py-1.5 border focus:border-[#10B981]"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    className="bg-[#10B981] hover:bg-emerald-400 text-black rounded px-3 py-1.5 text-xs font-bold"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Simulated Bottom Tab Navigator on Phone Device */}
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-[#111317] border-t border-[#1D2128] px-3 flex justify-between items-center text-[10px] z-50">
            {subTabs.map(st => {
              const Icon = st.icon;
              const isSel = currentTab === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setCurrentTab(st.id)}
                  className={`flex flex-col items-center flex-1 py-1 transition ${isSel ? 'text-[#10B981] font-bold' : 'text-zinc-500 hover:text-white'}`}
                >
                  <Icon className="h-4.5 w-4.5 mb-0.5" />
                  <span className="text-[9px] tracking-tight whitespace-nowrap">{st.label}</span>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // DESKTOP PREVIEW COMPONENT
  // -------------------------------------------------------------
  const DesktopPortalLayout = () => {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Block */}
        <header className="md:flex md:items-center md:justify-between bg-[#161920] rounded-xl p-6 border border-[#2A2D35]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold leading-7 text-white sm:truncate font-sans tracking-tight">
                Independent Contractor Console: <span className="text-[#10B981]">{currentWorker.name}</span>
              </h2>
              <VerifiedStamp
                status={currentWorker.workerVerificationStatus || 'pending'}
                size="md"
                showTier={false}
              />
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
              <div className="mt-2 flex items-center text-xs text-[#8E9299]">
                <ShieldCheck className="mr-1.5 h-4 w-4 flex-shrink-0 text-[#10B981]" aria-hidden="true" />
                Single compliance role classification: 1099 Independent Service Facilitator
              </div>
              <div className="mt-2 flex items-center text-xs font-mono text-[#8E9299]">
                <DollarSign className="mr-1.5 h-4 w-4 flex-shrink-0 text-blue-500" aria-hidden="true" />
                Ledger Direct Wallet: ${currentWorker.totalEarned} payout earned
              </div>
            </div>
          </div>
          
          <div className="mt-4 sm:mt-0 flex gap-2">
            <select
              value={activeWorkerId}
              onChange={e => {
                const val = e.target.value;
                setActiveWorkerId(val);
                const nw = candidates.find(c => c.id === val);
                if (nw) {
                  setBankName(nw.directDepositDetail?.bankName || '');
                  setRoutingNum(nw.directDepositDetail?.routing || '');
                  setAccountNum(nw.directDepositDetail?.account || '');
                  setPayOption(nw.payOption || 'direct_deposit');
                }
              }}
              className="bg-[#1F232B] border border-[#373A43] text-xs text-white rounded p-2 focus:ring-1 focus:ring-[#10B981] outline-none cursor-pointer"
            >
              {candidates.map(cand3 => (
                <option key={cand3.id} value={cand3.id}>
                  Switch Persona: {cand3.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Sub tabs line */}
        <div className="border-b border-[#2A2D35] flex gap-4 text-xs font-bold">
          {subTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setCurrentTab(t.id)}
              className={`pb-2 px-1 border-b-2 uppercase tracking-wider transition ${
                currentTab === t.id 
                  ? 'border-[#10B981] text-[#10B981]' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content screens */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            
            {/* LABORS TAB CARD */}
            {currentTab === 'jobs' && (
              <div className="space-y-6">
                
                {/* Active Assignments List */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">My Active Work schedules</h3>
                  
                  {myJobs.filter(j => j.status === 'accepted' || j.status === 'completed').map(job => (
                    <div key={job.id} className="bg-[#1F232B] p-4 rounded-lg border border-[#373A43] space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-white uppercase text-xs tracking-wider">{job.businessName} • {job.category}</h4>
                          <span className="text-[10px] text-slate-400 font-mono italic">Start Window: {job.startWindow}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                          job.status === 'accepted' ? 'bg-[#EF444422] text-[#EF4444]' : 'bg-[#10B98111] text-[#10B981]'
                        }`}>
                          {job.status === 'accepted' ? 'ON-ROUTE' : job.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-black/30 p-2.5 rounded text-slate-300">
                          <strong>Dispatch Address:</strong>
                          <p>{job.location}</p>
                        </div>
                        <div className="bg-black/30 p-2.5 rounded text-slate-300">
                          <strong>Required Credentials Verified:</strong>
                          <p className="text-emerald-400">✓ Industry standard checked</p>
                        </div>
                      </div>

                      {/* Display checklists */}
                      {job.status === 'accepted' && (
                        <div className="space-y-2 border-t border-[#2A2D35] pt-3">
                          <span className="text-[10px] uppercase font-bold text-[#8E9299]">Active task checklist:</span>
                          <div className="space-y-1.5 text-xs">
                            {job.checklist.map(itm => (
                              <label key={itm.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={itm.completed}
                                  onChange={() => handleToggleCheckstep(job.id, itm.id)}
                                  className="rounded border-[#373A43] bg-black text-[#10B981]"
                                />
                                <span className={itm.completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                                  {itm.text}
                                </span>
                              </label>
                            ))}
                          </div>

                          <div className="pt-3 flex gap-3 flex-wrap items-center">
                            {!job.timesheet?.checkInTime ? (
                              <button
                                onClick={() => handleCheckIn(job.id)}
                                className="bg-[#10B981] text-black text-xs font-bold py-1.5 px-4 rounded hover:bg-emerald-400 uppercase tracking-widest"
                              >
                                Stamp Punch-In (GPS Verify)
                              </button>
                            ) : (
                              <div className="bg-black/40 p-3 rounded-lg border border-[#10B98111] flex-grow space-y-3">
                                <div className="text-xs text-[#10B981] flex justify-between items-center font-mono">
                                  <span>✓ Checked-In: {new Date(job.timesheet.checkInTime).toLocaleString()}</span>
                                  <span>Site Geofence matched OK</span>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Add optional completion statement..."
                                    value={activeShiftComments}
                                    onChange={e => setActiveShiftComments(e.target.value)}
                                    className="bg-black border border-[#373A43] text-xs text-white px-3 py-1 rounded flex-grow"
                                  />
                                  <button
                                    onClick={() => handleCheckOut(job.id)}
                                    className="bg-red-500 hover:bg-red-400 text-white font-bold text-xs py-1.5 px-4 rounded uppercase tracking-wider"
                                  >
                                    Stamp Punch-Out
                                  </button>
                                </div>
                              </div>
                            )}

                            {job.status === 'accepted' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleRequestSwap(job.id)}
                                  className="border border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-bold py-1.5 px-3 rounded uppercase"
                                >
                                  Request Teammate Swap
                                </button>
                                <button
                                  onClick={() => handleRequestDrop(job.id)}
                                  className="border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-bold py-1.5 px-3 rounded uppercase"
                                >
                                  Drop Block SOW
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {myJobs.filter(j => j.status === 'accepted' || j.status === 'completed').length === 0 && (
                    <div className="text-zinc-500 text-center py-6 text-xs bg-[#1F232B]/40 rounded-lg border border-dashed border-zinc-800">
                      You are not allocated to any active SOW shifts. Open dispatcher offers below.
                    </div>
                  )}
                </div>

                {/* Open boards for desktop */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Available dispatch blocks (matching credentials)</h3>
                  <div className="space-y-3">
                    {openJobs.map(job => (
                      <div key={job.id} className="bg-[#1F232B] p-4 rounded-lg border border-[#373A43] flex justify-between items-center gap-4">
                        <div>
                          <h4 className="font-bold text-white text-xs">{job.businessName}</h4>
                          <p className="text-[11px] text-slate-400 mt-1">{job.category} • Location: {job.location}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-1"><Clock className="inline h-3 w-3 mr-1" /> Delivery Window: {job.startWindow}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-[#10B981] font-bold text-sm block mb-2">${job.payout} payout</span>
                          <button
                            onClick={() => handleOptInJob(job.id)}
                            className="bg-white text-black text-xs font-bold py-1 px-3 rounded hover:bg-slate-200 uppercase tracking-wider"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}

                    {openJobs.length === 0 && (
                      <div className="text-zinc-500 text-center py-6 text-xs bg-[#1F232B]/30 rounded-lg">
                        Zero open contracts currently matching. Check back shortly.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* AVAILABILITY CALENDAR DESKTOP */}
            {currentTab === 'availability' && (
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-[#10B981]" /> Weekly Availability Calendar
                  </h3>
                  <p className="text-xs text-[#8E9299]">
                    Select the weekdays where you choose to allow system matching and automatic dispatch scheduling notifications.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const aval = currentWorker.weeklyAvailability || {
                      Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false, Sunday: false
                    };
                    const isSet = aval[day];
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleAvailability(day)}
                        className={`p-3.5 rounded-lg border text-xs font-bold transition flex flex-col justify-between items-start gap-3 text-left ${
                          isSet 
                            ? 'bg-[#10B98111] border-[#10B98133] text-white' 
                            : 'bg-[#1F232B]/50 border-zinc-800 text-zinc-500 hover:text-zinc-400'
                        }`}
                      >
                        <span className="uppercase tracking-wide text-[10px]">{day}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest ${isSet ? 'bg-[#10B98133] text-[#10B981]' : 'bg-transparent text-zinc-500'}`}>
                          {isSet ? 'AVAILABLE' : 'OFFLINE'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-[#2A2D35] pt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Shift Window preferences:</h4>
                    <p className="text-xs text-[#8E9299]">
                      Help other dispatchers understand your preferences over work patterns.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'morning', label: 'Morning SOWs (6 AM - 2 PM)' },
                      { id: 'afternoon', label: 'Afternoon Rushes (2 PM - 10 PM)' },
                      { id: 'night', label: 'Overnight Crews (10 PM - 6 AM)' }
                    ].map(prefObj => {
                      const selPrefs = currentWorker.shiftPreferences || ['morning', 'afternoon'];
                      const isChecked = selPrefs.includes(prefObj.id);
                      return (
                        <button
                          key={prefObj.id}
                          onClick={() => handleTogglePreference(prefObj.id)}
                          className={`p-3 rounded-lg border text-xs text-left font-bold transition ${
                            isChecked ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-[#1F232B]/40 border-zinc-800 text-zinc-500'
                          }`}
                        >
                          {prefObj.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ONBOARDING & DOCUMENTS & PAY TAB */}
            {currentTab === 'onboarding' && (
              <div className="space-y-6">
                
                {/* Onboarding Checks card */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Onboarding & E-Signature Vault</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1F232B] p-4 rounded-lg border border-[#373A43] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white block">DocuSign 1099 Terms:</span>
                        <span className={`px-1 rounded text-[9px] ${currentWorker.eSignStatus === 'signed' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-red-500/10 text-red-400'}`}>
                          {currentWorker.eSignStatus.toUpperCase()}
                        </span>
                      </div>
                      
                      {currentWorker.eSignStatus !== 'signed' ? (
                        <button
                          onClick={handleSignHandbook}
                          className="w-full bg-[#10B981] text-black text-xs font-bold py-1 px-2 rounded uppercase mt-2 hover:bg-emerald-400"
                        >
                          Sign 1099 Terms
                        </button>
                      ) : (
                        <span className="text-zinc-500 text-[11px] block">✓ Handshake Agreement Validated. No outstanding terms.</span>
                      )}
                    </div>

                    <div className="bg-[#1F232B] p-4 rounded-lg border border-[#373A43] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white block">Checkr BG Check:</span>
                        <span className={`px-1 rounded text-[9px] ${currentWorker.backgroundCheckStatus === 'passed' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-yellow-500/10 text-yellow-500'}`}>
                          {currentWorker.backgroundCheckStatus.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-zinc-500 text-[11px] block">✓ Automatic Gusto screening synchronizer verified.</span>
                    </div>
                  </div>
                </div>

                {/* Direct Deposit vs RapidPay card */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Gusto integration Payment Setup</h3>

                  <div className="flex gap-4 p-1 bg-black rounded-lg text-xs max-w-sm">
                    <button
                      onClick={() => setPayOption('direct_deposit')}
                      className={`flex-1 py-1.5 rounded text-center transition font-bold ${payOption === 'direct_deposit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Direct Deposit Setup
                    </button>
                    <button
                      onClick={() => setPayOption('pay_card')}
                      className={`flex-1 py-1.5 rounded text-center transition font-bold ${payOption === 'pay_card' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                    >
                      RapidPay Mastercard
                    </button>
                  </div>

                  {payOption === 'direct_deposit' ? (
                    <form onSubmit={handleSavePayOption} className="space-y-4 max-w-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-3">
                          <label htmlFor="bank-name" className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Bank Name</label>
                          <input
                            id="bank-name"
                            required
                            placeholder="Bank Name (e.g., Chase)"
                            value={bankName}
                            onChange={e => setBankName(e.target.value)}
                            className="bg-[#1F232B] border border-[#373A43] text-xs text-white p-2 rounded w-full focus:border-[#10B981] outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="routing-number" className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Routing Number</label>
                          <input
                            id="routing-number"
                            required
                            placeholder="9 digit code"
                            value={routingNum}
                            onChange={e => setRoutingNum(e.target.value)}
                            className="bg-[#1F232B] border border-[#373A43] font-mono text-xs text-[#10B981] p-2 rounded w-full focus:border-[#10B981] outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="account-number" className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Account Number</label>
                          <input
                            id="account-number"
                            required
                            placeholder="Account number"
                            value={accountNum}
                            onChange={e => setAccountNum(e.target.value)}
                            className="bg-[#1F232B] border border-[#373A43] text-xs text-white p-2 rounded w-full focus:border-[#10B981] outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="bg-[#10B981] hover:bg-emerald-400 text-xs text-black uppercase tracking-widest font-bold px-4 py-2 rounded"
                      >
                        Sync direct deposit
                      </button>
                    </form>
                  ) : (
                    <div className="bg-black/50 p-4 rounded-xl border border-yellow-500/10 space-y-3 max-w-lg">
                      <div className="space-y-1">
                        <span className="text-yellow-500 uppercase font-bold tracking-wider text-[11px] block">RapidPay Live Debit Allocation:</span>
                        <p className="text-xs text-slate-300">Fast 1099 dispatch debit settlement. Complete check-out, and earnings are wired to your prepaid card instantly.</p>
                        <p className="font-mono text-[#10B981] pt-1">Card Connected: **** **** **** 5102 (RapidPay Visa)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateCandidate(currentWorker.id, { payOption: 'pay_card', payCardDetail: { cardNumber: '**** **** **** 5102', provider: 'RapidPay' } });
                          alert("Prepaid Card updated.");
                        }}
                        className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded uppercase hover:bg-slate-200"
                      >
                        Re-issue New Debit Card
                      </button>
                    </div>
                  )}
                </div>

                {/* DRAG-DROP DOCUMENT COMPLIANT ZONE DESKTOP */}
                <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-[#2A2D35]">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Credential Document Vault (OCR Verified)</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Submit legal IDs, I-9, W-4, tax withholdings certificates and professional licenses.</p>
                    </div>
                    <span className="text-[9px] text-[#8E9299] font-mono bg-[#1F232B] px-2.5 py-1 rounded border border-zinc-850">Lobby ID check validation level 2</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="onboarding-doc-type" className="block text-[10px] uppercase font-bold text-[#8E9299]">Onboarding Document Type</label>
                      <select 
                        id="onboarding-doc-type"
                        onChange={e => setSelectedUploadDocType(e.target.value)}
                        className="w-full bg-[#1F232B] border border-[#373A43] text-xs text-white p-2.5 rounded focus:border-[#10B981] outline-none cursor-pointer"
                      >
                        <option value="i9">I-9 Employment Eligibility Verification (+ID passport)</option>
                        <option value="w4">W-4 Form Employer Withholding Certificate</option>
                        <option value="drivers_license">US Driver’s License ID Card (Commercial CDL/Standard)</option>
                        <option value="forklift_cert">OSHA Compliant Forklift Operator Permit Certification</option>
                        <option value="cna_license">State Nursing CNA Assistant Board Registration</option>
                        <option value="insurance_waiver">General Team Liability Insurance Waiver agreement</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="optional-expiry" className="block text-[10px] uppercase font-bold text-[#8E9299]">Optional Expiration Calendar</label>
                      <input 
                        id="optional-expiry"
                        value={customExpiryInput}
                        onChange={e => setCustomExpiryInput(e.target.value)}
                        className="w-full bg-[#1F232B] border border-[#373A43] text-xs text-white p-2 text-center rounded focus:border-[#10B981] outline-none font-mono"
                      />
                    </div>
                  </div>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDropFile}
                    className={`border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center transition cursor-pointer hover:border-zinc-700 ${
                      isDragging ? 'border-[#10B981] bg-[#10B981]/5' : 'bg-[#1F232B]/30'
                    }`}
                  >
                    <Upload className="h-8 w-8 text-[#10B981] mx-auto mb-2" />
                    <h5 className="text-sm font-bold text-white uppercase tracking-wider">Drag & drop compliance files here</h5>
                    <p className="text-xs text-[#8E9299] mt-1">Accepts PNG, JPG, or PDF files. OCR extracts certificates and matches expiration gates in real-time.</p>
                    <input
                      type="file"
                      onChange={handleManualFileChange}
                      id="desktop-manual-file-input"
                      className="hidden"
                    />
                    <label
                      htmlFor="desktop-manual-file-input"
                      className="mt-3 inline-block bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] uppercase font-bold px-4 py-2 rounded cursor-pointer"
                    >
                      Browse Files
                    </label>
                  </div>

                  {/* Documents List */}
                  {currentWorker.documents && currentWorker.documents.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block pb-1 border-b border-[#2A2D35]">Verified Documents vault:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentWorker.documents.map(d => {
                          const daysLeft = d.expiresAt ? Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                          const isExpiringSoon = daysLeft !== null && daysLeft <= 30;
                          const isExpired = daysLeft !== null && daysLeft <= 0;

                          return (
                            <div key={d.id} className="bg-[#1F232B] p-4 rounded-lg border border-[#373A43] flex flex-col justify-between gap-3">
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <span className="font-bold text-xs text-white block">{d.name}</span>
                                  <span className="text-[#10B981] text-[10px] uppercase font-mono tracking-wider">{d.type}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  d.status === 'verified' ? 'bg-[#10B98122] text-[#10B981]' : 'bg-yellow-500/10 text-yellow-500'
                                }`}>
                                  {d.status.toUpperCase()}
                                </span>
                              </div>

                              <div className="text-[10px] text-[#8E9299] font-mono grid grid-cols-2 pt-2 border-t border-zinc-805 justify-between">
                                  <span>Uploaded: {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : 'N/A'}</span>
                                  <span className="text-right">Expires: {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : 'N/A'}</span>
                              </div>

                              {isExpired ? (
                                <div className="bg-red-500/20 text-red-400 text-[9px] px-2.5 py-1 rounded font-bold uppercase tracking-wider text-center">
                                  🚨 EXPIRED - GUSTO LABOR BOARD HOLD
                                </div>
                              ) : isExpiringSoon ? (
                                <div className="bg-yellow-500/20 text-yellow-500 text-[9px] px-2.5 py-1 rounded font-bold uppercase tracking-wider text-center">
                                  ⚠️ EXPIRING SOON ({daysLeft} DAYS)
                                </div>
                              ) : (
                                <div className="bg-[#10B98111] text-[#10B981] text-[9px] px-2.5 py-1 rounded font-bold uppercase tracking-wider text-center font-mono">
                                  ✓ STANDING COMPLIANT OK
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* CHAT INBOX MESSAGING TAB DESKTOP */}
            {currentTab === 'messaging' && (
              <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 flex flex-col h-[600px] space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Sourcing Recruiting Inbox & alerts</h3>
                  <p className="text-xs text-[#8E9299]">Live chat integration on block safety checklists, timesheet disputes, and credentials.</p>
                </div>

                <div className="flex-grow overflow-y-auto space-y-3 bg-[#0F1115] p-4 rounded-lg border border-[#2A2D35] pr-2">
                  {currentWorker.messages && currentWorker.messages.map(msgObj => {
                    const isM = msgObj.sender === currentWorker.name;
                    return (
                      <div
                        key={msgObj.id}
                        className={`max-w-[70%] rounded-xl p-3 text-xs mb-3 text-white ${
                          isM ? 'bg-[#10B98133] border border-[#10B98144] ml-auto rounded-tr-none' : 'bg-[#1F232B] border border-zinc-700/60 mr-auto rounded-tl-none'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1 text-[9px] text-[#8E9299] font-mono">
                          <span className="font-bold text-[#10B981]">{msgObj.sender}</span>
                          <span>{new Date(msgObj.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="leading-relaxed select-text text-sm">{msgObj.text}</p>
                      </div>
                    );
                  })}
                  {(!currentWorker.messages || currentWorker.messages.length === 0) && (
                    <div className="text-zinc-500 text-center py-24 text-xs font-mono">My messaging history is empty.</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter message text..."
                    value={chatMessageText}
                    onChange={e => setChatMessageText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                    className="bg-[#1F232B] border border-[#373A43] text-xs text-white px-4 py-2.5 rounded flex-grow outline-none focus:border-[#10B981] transition"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    className="bg-[#10B981] hover:bg-emerald-400 text-black text-xs font-bold px-6 py-2.5 rounded uppercase tracking-wider"
                  >
                    Send message
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Hand Side Status Sidebar */}
          <div className="space-y-6">
            
            {/* Persona card details */}
            <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4 text-xs">
              <h3 className="font-bold uppercase tracking-widest text-[#8E9299] text-[10px]">1099 Portal Verification</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white uppercase">
                    {currentWorker.name[0]}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">{currentWorker.name}</span>
                    <span className="text-[10px] text-[#8E9299] block">{currentWorker.email}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2A2D35]/50 space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Verified credentials:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentWorker.verifiedCredentials.map(cr => (
                        <span key={cr} className="bg-[#10B98111] text-[#10B981] border border-[#10B98122] px-1.5 py-0.5 rounded text-[8px] font-mono whitespace-nowrap">
                          {cr.replace('_', ' ').toUpperCase()}
                        </span>
                      ))}
                      {currentWorker.verifiedCredentials.length === 0 && (
                        <span className="text-zinc-500 text-[10px]">None passed yet. Use document uploader.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Vertical capability:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentWorker.verticals.map(v => (
                        <span key={v} className="bg-blue-500/15 text-blue-400 border border-blue-500/25 px-1.5 py-0.5 rounded text-[8px] font-bold">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick platform notes */}
            <div className="bg-[#1F232B] p-4 rounded-xl border border-[#373A43] text-xs text-[#8E9299]">
              <div className="font-bold text-white mb-1.5 uppercase flex items-center gap-1">
                <HelpCircle className="h-4 w-4 text-[#10B981]" /> Why flexible payroll?
              </div>
              As an independent team, you choose whether to settle blocks to your direct bank account via standard deposit or choose instant Visa/Mastercard RapidPay settlement. This respects IRS guidelines and streamlines independent contractor accounting sync with QuickBooks.
            </div>

          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F1115] py-4 sm:py-8 px-4 sm:px-6 lg:px-8 text-white">
      
      {/* Selector display modes */}
      <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">Worker Experience Portal</h1>
          <p className="text-xs text-[#8E9299]">Configure availability, select payout options, sign 1099 waivers, and check-in to SOWs.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button 
            onClick={() => setSelectedMobileView('desktop_portal')}
            className={`px-3 py-1.5 rounded transition font-bold ${selectedMobileView === 'desktop_portal' ? 'bg-[#10B981] text-black' : 'bg-[#161920] text-[#8E9299] hover:text-white'}`}
          >
            Desktop Layout
          </button>
          <button 
            onClick={() => setSelectedMobileView('mobile_phone')}
            className={`px-3 py-1.5 rounded transition font-bold ${selectedMobileView === 'mobile_phone' ? 'bg-[#10B981] text-black' : 'bg-[#161920] text-[#8E9299] hover:text-white'}`}
          >
            Mobile Simulator
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedMobileView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {selectedMobileView === 'mobile_phone' ? <MobilePhoneLayout /> : <DesktopPortalLayout />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
