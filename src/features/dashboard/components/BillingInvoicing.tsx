import { Job, WorkerCandidate } from '../../../shared/types/domain';
import React, { useMemo, useState } from 'react';
import { 
  FileText, DollarSign, Calendar, Clock, RotateCw, Send, CheckCircle, 
  Plus, AlertTriangle, Printer, Trash2, ShieldCheck, Mail, ArrowUpRight
} from 'lucide-react';

interface BillingInvoicingProps {
  jobs: Job[];
  candidates: WorkerCandidate[];
  onAddLog: (category: string, message: string, type?: 'info' | 'success' | 'warning' | 'sms') => void;
  onChangeJobStatus: (jobId: string, status: Job['status'], contractorId?: string, updates?: Partial<Job>) => void;
}

export function BillingInvoicing({ jobs, candidates, onAddLog, onChangeJobStatus }: BillingInvoicingProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(jobs[3]?.id || (jobs[0]?.id || null));
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<'all' | 'unbilled' | 'billed'>('all');
  
  // Custom Invoice Adjustments States
  const [newSurchargeName, setNewSurchargeName] = useState<string>('');
  const [newSurchargeAmount, setNewSurchargeAmount] = useState<number>(0);
  const [selectedNetTerms, setSelectedNetTerms] = useState<number>(30);

  // Filter and compute active invoices matching jobs
  const invoiceData = useMemo(() => {
    return jobs.map(job => {
      // Find worker associated
      const worker = candidates.find(c => c.id === job.contractorId);
      
      // Hourly rate billing baseline calculations
      const hrs = job.shiftHours || (job.blockType === '1-week' ? 40 : job.blockType === '8-hour' ? 8 : 4);
      const regularHours = Math.min(hrs, 40);
      const otHours = job.overtimeHours || Math.max(0, hrs - 40);
      
      const billRate = job.billRate || 30;
      const baseBill = regularHours * billRate;
      const otBill = otHours * billRate * 1.5; // Overtime client markup is standard 1.5x hourly rate charge
      
      // Calculate custom surcharge inputs
      let adjustmentsAmount = job.invoiceAmountAdjusted || 0;
      
      const grandTotal = baseBill + otBill + adjustmentsAmount;
      
      // Net due date calculation (based on start date or creation date + invoice terms)
      const termDays = job.invoiceTermDays || 30;
      const createdDate = new Date(job.createdAt);
      const dueDate = new Date(createdDate.getTime() + termDays * 24 * 60 * 60 * 1000);
      
      // Determine past due status if completed/accepted but not paid and past local date
      const isPastDue = job.status !== 'paid' && dueDate.getTime() < Date.now();

      return {
        ...job,
        workerName: worker?.name || 'Unassigned',
        regularHours,
        otHours,
        baseBill,
        otBill,
        adjustmentsAmount,
        grandTotal,
        termDays,
        dueDateStr: dueDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
        isPastDue
      };
    });
  }, [jobs, candidates]);

  const filteredInvoices = useMemo(() => {
    if (activeInvoiceTab === 'all') return invoiceData;
    if (activeInvoiceTab === 'unbilled') {
      return invoiceData.filter(idp => idp.status === 'open' || idp.status === 'accepted');
    }
    // completed or paid are billed states
    return invoiceData.filter(idp => idp.status === 'completed' || idp.status === 'paid');
  }, [invoiceData, activeInvoiceTab]);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoiceData.find(idp => idp.id === selectedInvoiceId) || invoiceData[0] || null;
  }, [invoiceData, selectedInvoiceId]);

  // Handle adding custom margin adjustment fees or mileage surcharges
  const handleAddSurcharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !selectedInvoice) return;
    if (!newSurchargeName.trim() || newSurchargeAmount === 0) return;

    // Apply surcharge directly as invoice adjustments inside central state
    const updatedAdjustment = (selectedInvoice.invoiceAmountAdjusted || 0) + newSurchargeAmount;
    const notes = selectedInvoice.invoiceAdjustmentNotes 
      ? `${selectedInvoice.invoiceAdjustmentNotes}; Added surcharge: ${newSurchargeName} ($${newSurchargeAmount})`
      : `Surcharge: ${newSurchargeName} ($${newSurchargeAmount})`;

    // Re-trigger global status update with custom values
    onChangeJobStatus(selectedInvoice.id, selectedInvoice.status, selectedInvoice.contractorId, {
      invoiceAmountAdjusted: updatedAdjustment,
      invoiceAdjustmentNotes: notes
    });

    onAddLog('payroll', `[Billing Surcharge Added] Surcharge "${newSurchargeName}" for $${newSurchargeAmount} applied to invoice INV-${selectedInvoice.id}`, 'info');
    
    setNewSurchargeName('');
    setNewSurchargeAmount(0);
    alert(`Adjusted billing invoice spread successfully! Added $${newSurchargeAmount} charge lines.`);
  };

  // Adjust Net Term dates dynamically
  const handleUpdateTerms = (days: number) => {
    if (!selectedInvoiceId) return;
    onChangeJobStatus(selectedInvoiceId, selectedInvoice?.status || 'open', selectedInvoice?.contractorId, {
      invoiceTermDays: days
    });
    onAddLog('payroll', `[Invoice Net Terms Modified] Adjusted INV-${selectedInvoiceId} net client terms to Net ${days}`, 'info');
    alert(`Payment terms updated to Net ${days}. Due date recalculated.`);
  };

  // Manual payment trigger reconciliation with QuickBooks
  const handleMarkAsPaid = () => {
    if (!selectedInvoiceId || !selectedInvoice) return;
    onChangeJobStatus(selectedInvoice.id, 'paid');
    onAddLog('payroll', `[QuickBooks Escrow Check-off] Manually reconciled invoice INV-${selectedInvoice.id} for $${selectedInvoice.grandTotal}. Accounts Receivable updated.`, 'success');
    alert("Invoice status cleared! Synced payment status with QuickBooks Ledger.");
  };

  const handleDispatchBillEmail = () => {
    if (!selectedInvoice) return;
    onAddLog('sms', `[Outbound Billing Dispatch]: Dispatched billing INV-${selectedInvoice.id} invoice statement PDF to client finance contact at ${selectedInvoice.businessName}.`, 'sms');
    alert(`Invoice sent! Invoice package INV-${selectedInvoice.id} successfully emailed to accounts payable.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Invoice Billing Ledger List */}
      <div className="lg:col-span-1 bg-[#161920] border border-[#2A2D35] p-5 rounded-xl space-y-4">
        
        <div className="border-b border-zinc-800 pb-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Automated AR Billing Registry</h3>
          <p className="text-[10px] text-zinc-400 mt-0.5">Track shifts, calculate regular/OT bills, and control invoicing status.</p>
        </div>

        {/* Filters and Search Toggles */}
        <div className="flex bg-[#1F232B] p-1 rounded-lg border border-zinc-800 text-xs text-center">
          {[
            { id: 'all', label: 'All Invoices' },
            { id: 'unbilled', label: 'Unbilled / Active' },
            { id: 'billed', label: 'Billed Statements' }
          ].map(tb => (
            <button
              key={tb.id}
              onClick={() => setActiveInvoiceTab(tb.id as any)}
              className={`flex-1 py-1 font-semibold text-[10px] uppercase rounded transition-all ${
                activeInvoiceTab === tb.id 
                  ? 'bg-[#10B981] text-[#0F1115]' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Invoice Statement Cards */}
        <div className="space-y-2 max-h-[38rem] overflow-y-auto pr-1">
          {filteredInvoices.map(inv => {
            const isSelected = inv.id === selectedInvoiceId;
            let statusBadgeColor = 'bg-zinc-600 text-zinc-100 border-zinc-500';
            if (inv.status === 'paid') statusBadgeColor = 'bg-[#10B98133] text-[#10B981] border-emerald-900';
            else if (inv.status === 'completed') statusBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-900';
            else if (inv.isPastDue) statusBadgeColor = 'bg-red-500/15 text-red-400 border-red-900';
            else if (inv.status === 'accepted') statusBadgeColor = 'bg-yellow-500/10 text-yellow-500 border-yellow-900';

            return (
              <button
                key={inv.id}
                onClick={() => setSelectedInvoiceId(inv.id)}
                className={`w-full text-left p-3.5 rounded-lg border transition-all duration-150 flex flex-col justify-between space-y-2 ${
                  isSelected 
                    ? 'bg-[#1F232B] border-[#10B981] shadow-md shadow-[#10B9811A]' 
                    : 'bg-[#1F232B]/55 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white uppercase text-xs">{inv.businessName}</h4>
                    <span className="text-[10px] text-zinc-500 font-mono">Invoice: INV-{inv.id}</span>
                  </div>
                  <span className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusBadgeColor}`}>
                    {inv.isPastDue && inv.status !== 'paid' ? 'PAST DUE' : inv.status}
                  </span>
                </div>

                <div className="flex justify-between items-end font-mono">
                  <div className="text-[10px] text-zinc-400">
                    <p>Due: {inv.dueDateStr}</p>
                    <p>Terms: Net {inv.termDays}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">Total Billed</span>
                    <strong className="text-white font-bold block">${inv.grandTotal.toLocaleString()}</strong>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredInvoices.length === 0 && (
            <p className="text-xs text-center py-6 text-zinc-500 font-mono">No matching records found in selected invoice drawer.</p>
          )}
        </div>

      </div>

      {/* Center & Right Column combined: Invoice PDF Live Simulation Render */}
      <div className="lg:col-span-2 space-y-6">
        
        {selectedInvoice ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Invoice Statement Render Area */}
            <div className="md:col-span-2 bg-[#1A1D24] border border-[#2A2D35] rounded-xl p-6 space-y-6 shadow-2xl relative overflow-hidden text-zinc-300">
              
              {/* Slate Aesthetic Grid Watermark */}
              <div className="absolute top-0 right-0 p-4 font-mono font-bold text-zinc-700 text-[10px] uppercase select-none tracking-widest border-bl border-zinc-800">
                QuickBooks Sync Active
              </div>

              {/* Invoice Headings */}
              <div className="flex justify-between items-start border-b border-zinc-800 pb-5">
                <div>
                  <h3 className="text-[#10B981] font-mono font-bold tracking-widest uppercase text-sm">BLOCKLABOR SOLUTIONS</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">100 Pine Street, Floor 14<br />San Francisco, CA 94111</p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-white text-lg font-bold block">INVOICE STATEMENT</span>
                  <span className="text-zinc-500 text-xs block">Ref: #INV-{selectedInvoice.id}</span>
                  <p className="text-[10px] text-zinc-400 mt-2">Date Issued: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Bill To addresses */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-zinc-500 uppercase font-bold text-[9px] block mb-1 font-mono">BILL TO CLIENT:</span>
                  <strong className="text-white text-sm block uppercase">{selectedInvoice.businessName}</strong>
                  <p className="text-zinc-400 mt-1">{selectedInvoice.locationName || selectedInvoice.location}</p>
                  <p className="text-zinc-500 mt-1 font-mono">Tax ID: XX-XXX4912 ({selectedInvoice.stateCode || 'CA'})</p>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 uppercase font-bold text-[9px] block mb-1 font-mono">PAYMENT TERMS:</span>
                  <strong className="text-white block">Net {selectedInvoice.termDays} Days</strong>
                  <p className="text-zinc-400 mt-1">Payment Due: <span className="font-bold text-[#10B981] font-mono">{selectedInvoice.dueDateStr}</span></p>
                  <span className="text-[10px] text-zinc-500 mt-1 font-mono block">Operator: {selectedInvoice.workerName}</span>
                </div>
              </div>

              {/* Invoice Rates breakdown items table */}
              <div className="border-t border-b border-zinc-800 py-3 text-xs space-y-3 font-mono">
                <div className="grid grid-cols-5 text-zinc-500 font-bold uppercase text-[9px] pb-1 border-b border-zinc-800/40">
                  <div className="col-span-2">Service Description / Shifts</div>
                  <div className="text-center">Hours</div>
                  <div className="text-center">Bill Rate</div>
                  <div className="text-right">Line Total</div>
                </div>

                {/* Regular hours billing item line */}
                <div className="grid grid-cols-5 py-1 text-slate-300">
                  <div className="col-span-2">
                    <strong className="text-white block text-xs">{selectedInvoice.category}</strong>
                    <span className="text-[9px] text-zinc-500">Regular hours labor deployment (Standard rate terms)</span>
                  </div>
                  <div className="text-center">{selectedInvoice.regularHours} hrs</div>
                  <div className="text-center">${selectedInvoice.billRate}</div>
                  <div className="text-right text-white">${selectedInvoice.baseBill.toLocaleString()}</div>
                </div>

                {/* Overtime line item if OT hours exist */}
                {selectedInvoice.otHours > 0 && (
                  <div className="grid grid-cols-5 py-1 text-slate-300 border-t border-dashed border-zinc-800/40">
                    <div className="col-span-2">
                      <strong className="text-yellow-500 block text-xs font-bold">Premium Overtime Labor Rate</strong>
                      <span className="text-[9px] text-zinc-500">Hours worked exceeding statutory regular 40h block (1.5x Multiplier)</span>
                    </div>
                    <div className="text-center">{selectedInvoice.otHours} hrs</div>
                    <div className="text-center">${Math.round((selectedInvoice.billRate ?? 0) * 1.5 * 10) / 10}</div>
                    <div className="text-right text-white">${selectedInvoice.otBill.toLocaleString()}</div>
                  </div>
                )}

                {/* Custom Adjustments / Surcharges lines */}
                {selectedInvoice.adjustmentsAmount !== 0 && (
                  <div className="grid grid-cols-5 py-1 text-slate-300 border-t border-dashed border-[#10B98133] bg-[#10B981]/[0.01] p-1 rounded">
                    <div className="col-span-2">
                      <strong className="text-[#10B981] block text-xs">A&O Administrative Surcharges</strong>
                      <span className="text-[9px] text-zinc-500">{selectedInvoice.invoiceAdjustmentNotes || 'Custom dispatch surcharge line items'}</span>
                    </div>
                    <div className="text-center">-</div>
                    <div className="text-center">-</div>
                    <div className="text-right text-[#10B981] font-bold">+${selectedInvoice.adjustmentsAmount.toLocaleString()}</div>
                  </div>
                )}

              </div>

              {/* Total calculations block */}
              <div className="flex justify-between items-start font-mono">
                <div className="text-[10px] text-zinc-500 leading-relaxed max-w-sm">
                  <strong>Corporate Payment Instructions:</strong> Payments on this statement can be authorized automatically via linked ACH escrow setups in QuickBooks, or routed directly to routing: 021000021 acct: ********4389. Title 1099 labor disburse terms map.
                </div>
                <div className="text-right space-y-1.5">
                  <div className="flex justify-end gap-6 text-xs text-zinc-400">
                    <span>Subtotal:</span>
                    <span>${(selectedInvoice.baseBill + selectedInvoice.otBill).toLocaleString()}</span>
                  </div>
                  {selectedInvoice.adjustmentsAmount !== 0 && (
                    <div className="flex justify-end gap-6 text-xs text-zinc-400">
                      <span>Surcharges:</span>
                      <span>+${selectedInvoice.adjustmentsAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-6 border-t border-zinc-800 pt-2 text-sm">
                    <strong className="text-white uppercase font-bold">Grand Invoice Total:</strong>
                    <strong className="font-bold text-[#10B981] text-base">${selectedInvoice.grandTotal.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Action Pane on Right */}
            <div className="space-y-4">
              
              {/* Payment Control Card */}
              <div className="bg-[#161920] border border-[#2A2D35] p-4 rounded-xl space-y-3.5 text-xs">
                <span className="text-[10px] uppercase font-bold text-[#10B981] tracking-wider block">Billing Action Dashboard</span>
                
                <div className="space-y-2">
                  <button
                    onClick={handleDispatchBillEmail}
                    className="w-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white font-bold uppercase transition py-2 rounded text-[10px] inline-flex items-center justify-center gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5 text-indigo-400" /> Send Invoice Package
                  </button>

                  {selectedInvoice.status !== 'paid' ? (
                    <button
                      onClick={handleMarkAsPaid}
                      className="w-full bg-[#10B981] hover:bg-emerald-400 text-black font-bold uppercase py-2 rounded text-[10px] inline-flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Capture Client Payment
                    </button>
                  ) : (
                    <div className="p-2.5 rounded border border-[#10B98133] bg-[#10B981]/5 text-[#10B981] font-mono font-bold text-center">
                      ✓ ACCOUNT PAID & CLOSED
                    </div>
                  )}
                </div>
              </div>

              {/* Adjust Net Terms Options */}
              <div className="bg-[#161920] border border-[#2A2D35] p-4 rounded-xl space-y-3 text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Modify Client Terms</span>
                <p className="text-[10px] text-zinc-500">Changes immediately recalculate statement payment timelines and trigger QuickBooks sync:</p>
                
                <div className="grid grid-cols-3 gap-1">
                  {[15, 30, 45].map((days) => (
                    <button
                      key={days}
                      onClick={() => handleUpdateTerms(days)}
                      className={`py-1 text-[10px] font-bold font-mono rounded border transition-all ${
                        selectedInvoice.termDays === days
                          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]'
                          : 'bg-zinc-850 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      Net {days}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjust Invoice Surcharges Card form */}
              <div className="bg-[#161920] border border-[#2A2D35] p-4 rounded-xl space-y-3">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Add Adjustments/Tech Fees</span>
                
                <form onSubmit={handleAddSurcharge} className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Surcharge / Adjustment Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ACH Admin Processing Fee"
                      value={newSurchargeName}
                      onChange={e => setNewSurchargeName(e.target.value)}
                      className="bg-[#1F232B] border border-zinc-800 rounded p-1.5 text-xs text-white w-full outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-0.5">Charge Amount ($)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 15.00"
                      value={newSurchargeAmount || ''}
                      onChange={e => setNewSurchargeAmount(Number(e.target.value))}
                      className="bg-[#1F232B] border border-zinc-800 rounded p-1.5 text-xs text-white w-full font-mono outline-none focus:border-[#10B981]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/20 transition py-1.5 rounded uppercase font-bold text-[9px] tracking-wider"
                  >
                    Apply Surcharge To Invoice
                  </button>
                </form>
              </div>

            </div>

          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500 text-xs font-mono bg-[#161920] border border-dashed border-zinc-800 rounded-xl">
            Select an invoice statement from the sidebar registry to loaded automated billing files.
          </div>
        )}

      </div>

    </div>
  );
}
