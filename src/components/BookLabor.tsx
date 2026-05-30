import { useState, FormEvent, useEffect } from 'react';
import { PRICING_BLOCKS, VERTICALS, CATEGORIES_BY_VERTICAL, VERTICAL_WORKFLOWS } from '../constants';
import { Job, VerticalType, BlockType, JobChecklistItem } from '../shared/types/domain';
import { motion } from 'motion/react';
import { ShieldAlert, FileSignature, CheckCircle, HelpCircle } from 'lucide-react';

interface BookLaborProps {
  onBookJob: (job: Job) => void;
  setView: (view: 'client' | 'staff' | 'home') => void;
  isEnterprise?: boolean;
  branches?: any[];
  rateCards?: any[];
}

export function BookLaborView({ 
  onBookJob, 
  setView,
  isEnterprise = false,
  branches = [],
  rateCards = []
}: BookLaborProps) {
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<VerticalType>('Light Industrial');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<BlockType>('4-hour');
  const [selectedBranch, setSelectedBranch] = useState(branches?.[0]?.name || '');
  const [startWindow, setStartWindow] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState('');

  // When vertical changes, reset category to first valid one
  useEffect(() => {
    const cats = CATEGORIES_BY_VERTICAL[selectedVertical] || [];
    if (cats.length > 0) {
      setSelectedCategory(cats[0]);
    }
  }, [selectedVertical]);

  // Sync default branch name
  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0].name);
    }
  }, [branches]);

  const activeWorkflow = VERTICAL_WORKFLOWS.find(v => v.vertical === selectedVertical) || VERTICAL_WORKFLOWS[0];
  const activeBlock = PRICING_BLOCKS.find(b => b.id === selectedBlockId) || PRICING_BLOCKS[1];

  // Active rate card matching for Automations
  const activeRateCard = rateCards?.find(
    rc => rc.vertical === selectedVertical && rc.category === selectedCategory
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    const jobId = 'job-' + Math.floor(Math.random() * 1000 + 200);
    const skillsList = skillsText ? skillsText.split(',').map(s => s.trim()) : ['General Assistance'];

    // Create a dynamic checklist based on vertical compliance terms
    const checklist: JobChecklistItem[] = activeWorkflow.complianceChecklist.map((c, i) => ({
      id: `${jobId}-check-${i}`,
      text: c,
      completed: false
    }));

    // Add extra generic steps
    checklist.unshift({ id: `${jobId}-check-init`, text: `Check in with site supervisor on arrival`, completed: false });
    checklist.push({ id: `${jobId}-check-final`, text: `Acquire supervisor timestamp approval signature`, completed: false });

    // Derive hours count by block
    const hours = 
      selectedBlockId === '1-month' ? 160 :
      selectedBlockId === '1-week' ? 40 :
      selectedBlockId === '8-hour' ? 8 :
      selectedBlockId === '1-hour' ? 1 : 4;

    const payoutRate = isEnterprise && activeRateCard ? activeRateCard.standardPayRate : (activeBlock.value / 4);
    const billingRate = isEnterprise && activeRateCard ? activeRateCard.standardBillRate : (activeBlock.chargeVal / 4);

    const calculatedPayout = payoutRate * hours;
    const calculatedCharge = billingRate * hours;

    const newJob: Job = {
      id: jobId,
      businessName: businessName || 'Anonymous Corp',
      vertical: selectedVertical,
      category: selectedCategory || CATEGORIES_BY_VERTICAL[selectedVertical][0],
      blockType: selectedBlockId,
      startWindow: startWindow || 'Immediate Start Window',
      location: location || 'On Site Location Specified',
      requiredSkills: skillsList,
      status: 'open',
      payout: calculatedPayout,
      charge: calculatedCharge,
      createdAt: new Date().toISOString(),
      checklist,
      branchName: isEnterprise ? selectedBranch : undefined,
      payRate: payoutRate,
      billRate: billingRate,
      markup: Math.round(((billingRate - payoutRate) / payoutRate) * 100)
    };

    onBookJob(newJob);
    setLastCreatedId(jobId);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen py-24 px-6 sm:px-8 bg-[#0F1115] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-[#161920] p-8 rounded-xl border border-[#2A2D35]"
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#10B98133] mb-6">
              <FileSignature className="h-8 w-8 text-[#10B981]" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Block Requested Successfully</h2>
            <p className="text-[#8E9299] text-sm max-w-md mx-auto mb-6">
              Your labor block is published to dispatch! A 1099 compliant Scope of Work has been compiled for your review.
            </p>
          </div>

          <div className="bg-[#1F232B] p-6 rounded-lg text-sm border border-[#373A43] mb-8 space-y-4">
            <div className="flex justify-between border-b border-[#2A2D35] pb-2 text-xs font-mono">
              <span className="text-[#8E9299]">JOB TRACKING ID:</span>
              <span className="text-white font-bold">{lastCreatedId}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#8E9299] uppercase tracking-wider block">Vertical / Category:</span>
                <span className="text-white font-bold block">{selectedVertical} — {selectedCategory}</span>
              </div>
              <div>
                <span className="text-[#8E9299] uppercase tracking-wider block">Block Booking:</span>
                <span className="text-white font-bold block">{activeBlock.label} ({activeBlock.clientRate})</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#2A2D35]">
              <span className="text-xs uppercase tracking-wider text-[#10B981] font-bold block mb-1">Interactive Compliance Waiver:</span>
              <p className="text-[#8E9299] text-xs italic">
                "{activeWorkflow.clientLiabilityTerms}"
              </p>
            </div>

            <div className="bg-[#10B98111] p-3 rounded border border-[#10B98122] text-xs text-[#10B981]">
              <strong>Background Integration Sync:</strong> Gusto W9 compliance verification has placed a hold on invoices successfully. Schedulers notified of new dispatcher mandate.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setIsSubmitted(false);
                setBusinessName('');
                setLocation('');
                setStartWindow('');
                setSkillsText('');
              }}
              className="rounded bg-[#1F232B] border border-[#373A43] px-4 py-3 text-xs font-bold text-white uppercase tracking-wide hover:bg-[#2A2D35] transition-colors"
            >
              Request Another Block
            </button>
            <button 
              onClick={() => setView('client')}
              className="rounded bg-[#10B981] px-4 py-3 text-xs font-bold text-[#0F1115] uppercase tracking-wide hover:bg-[#0ea5e9] transition-colors text-center"
            >
              Go to Client Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-16 px-6 sm:px-8 bg-[#0F1115]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-white">Book Labor Block</h1>
          <p className="mt-2 text-[#8E9299] text-sm">Instantly deploy pre-vetted contractors. Select the business vertical for safety compliance filtering.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Booking Form */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-[#161920] p-6 sm:p-8 rounded-xl border border-[#2A2D35]"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vertical Selection */}
              <div>
                <label className="block text-xs font-bold text-[#8E9299] uppercase tracking-wider mb-2">Business Vertical & Safety System</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {VERTICALS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVertical(v)}
                      className={`px-2 py-3 rounded text-xs font-bold transition-all border ${
                        selectedVertical === v 
                          ? 'bg-[#10B981] text-[#0F1115] border-[#10B981]' 
                          : 'bg-[#1F232B] text-[#8E9299] border-[#373A43] hover:text-white'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Company Info */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-3 border-b border-[#2A2D35] pb-1">Business Identity</h3>
                <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                  <div className={isEnterprise ? 'sm:col-span-1' : 'sm:col-span-2'}>
                    <label htmlFor="company" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Business Name</label>
                    <input 
                      required 
                      type="text" 
                      id="company" 
                      value={businessName} 
                      onChange={e => setBusinessName(e.target.value)} 
                      className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2.5 border bg-[#1F232B] text-white" 
                      placeholder="e.g. Apex Materials Inc" 
                    />
                  </div>
                  
                  {isEnterprise && (
                    <div>
                      <label htmlFor="branch" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Assign to Corporate Branch</label>
                      <select
                        id="branch"
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2.5 border bg-[#1F232B] text-white"
                      >
                        {branches.map((b: any) => (
                          <option key={b.id} value={b.name}>{b.name} ({b.city})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label htmlFor="location" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">On-Site Dispatch Location</label>
                    <input 
                      required 
                      type="text" 
                      id="location" 
                      value={location} 
                      onChange={e => setLocation(e.target.value)} 
                      className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2.5 border bg-[#1F232B] text-white" 
                      placeholder="e.g. 123 Industrial Dr, Dock B" 
                    />
                  </div>
                </div>
              </div>

              {/* Task Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-3 border-b border-[#2A2D35] pb-1">Task Rules & Dimension</h3>
                <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="category" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Specific Role Category</label>
                    <select 
                      id="category" 
                      required 
                      value={selectedCategory} 
                      onChange={e => setSelectedCategory(e.target.value)} 
                      className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2 border bg-[#1F232B] text-white"
                    >
                      {(CATEGORIES_BY_VERTICAL[selectedVertical] || []).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    {isEnterprise && activeRateCard && (
                      <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] rounded flex flex-wrap gap-2 justify-between items-center">
                        <span className="font-sans font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                          ✨ Standard Rate Card Enforced
                        </span>
                        <span>
                          Bill: <strong className="text-white">${activeRateCard.standardBillRate}/hr</strong> • Pay: <strong className="text-white">${activeRateCard.standardPayRate}/hr</strong> <span className="text-zinc-500">({activeRateCard.customClientMarkupPercent}% markup)</span>
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="block" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Block Sizing Type</label>
                    <select 
                      id="block" 
                      required 
                      value={selectedBlockId} 
                      onChange={e => setSelectedBlockId(e.target.value as BlockType)} 
                      className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2 border bg-[#1F232B] text-white"
                    >
                      {PRICING_BLOCKS.map(b => (
                        <option key={b.id} value={b.id}>{b.label} ({b.clientRate})</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="startWindow" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Start Delivery Window</label>
                    <input 
                      required 
                      type="text" 
                      id="startWindow" 
                      value={startWindow} 
                      onChange={e => setStartWindow(e.target.value)} 
                      className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2.5 border bg-[#1F232B] text-white" 
                      placeholder="e.g. Next Tuesday, Morning Shift (8 AM - 12 PM)" 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="requiredSkills" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Required Certificates or Skills (Comma separated)</label>
                    <textarea 
                      id="requiredSkills" 
                      rows={2} 
                      value={skillsText} 
                      onChange={e => setSkillsText(e.target.value)} 
                      className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2 border bg-[#1F232B] text-white" 
                      placeholder="e.g. Forklift License, Lifting safety gear, heavy duties"
                    />
                  </div>
                </div>
              </div>

              {/* Liability Acknowledgment */}
              <div className="bg-[#1F232B] p-5 rounded-lg border border-[#373A43] flex gap-3">
                <ShieldAlert className="h-5 w-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Compliance & 1099 Liability Safe-Harbor Agreement</h4>
                  <div className="mt-2 text-xs text-[#8E9299] space-y-2">
                    <label className="flex items-start">
                      <input type="checkbox" required className="mt-0.5 mr-2.5 rounded border-[#373A43] bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]" />
                      <span>We acknowledge that workers are independent 1099 contractors who control their tasks and methods.</span>
                    </label>
                    <label className="flex items-start">
                      <input type="checkbox" required className="mt-0.5 mr-2.5 rounded border-[#373A43] bg-[#0F1115] text-[#10B981] focus:ring-[#10B981]" />
                      <span>We maintain necessary Commercial General Liability and Workers Comp for our premises.</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#2A2D35] flex justify-between items-center">
                <div className="text-xs text-[#8E9299]">
                  Estimating block charge: <span className="text-[#10B981] font-mono font-bold text-sm ml-1">{activeBlock.clientRate}</span>
                </div>
                <button
                  type="submit"
                  className="rounded bg-white py-2 px-6 text-xs uppercase tracking-wide font-bold text-black shadow-sm hover:bg-gray-200 focus:outline-none transition-colors"
                >
                  Authorized & Request Dispatch
                </button>
              </div>
            </form>
          </motion.div>

          {/* Workflow Side Guidelines */}
          <div className="space-y-6">
            <div className="bg-[#161920] p-5 rounded-xl border border-[#2A2D35]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-3">Vertical Protocols</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#8E9299] block font-semibold">Selected Vertical:</span>
                  <span className="text-white text-sm font-bold">{selectedVertical}</span>
                </div>
                
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#8E9299] block font-semibold">Specialized Credentials:</span>
                  <div className="mt-1 space-y-1.5">
                    {activeWorkflow.mandatoryCredentials.map(cred => (
                      <div key={cred.id} className="bg-[#1F232B] p-2 rounded border border-[#373A43] text-xs">
                        <span className="text-white font-bold block">{cred.name}</span>
                        <span className="text-slate-400 text-[10px]">{cred.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#8E9299] block font-semibold">Verification System Log:</span>
                  <ul className="mt-1 space-y-1 text-xs text-[#8E9299]">
                    {activeWorkflow.complianceChecklist.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-[#1F232B] p-4 rounded-xl border border-[#373A43] text-xs text-[#8E9299]">
              <div className="flex gap-2 items-center text-white font-bold mb-1">
                <HelpCircle className="h-4 w-4 text-[#10B981]" /> Why Block Pricing?
              </div>
              By pre-sizing contracts in blocks (e.g. 1hr, 4hr, 8hr), we satisfy IRS Section 530 and state laws preventing W2 reclassification. Blocks target set deliverables rather than open shifts.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
