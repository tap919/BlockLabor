import { ShieldAlert } from 'lucide-react';
import { PRICING_BLOCKS, CATEGORIES_BY_VERTICAL } from '../../constants';
import type { BranchDivision, RateCard, VerticalType } from '../../shared/types/domain';
import type { FormEvent } from 'react';

interface BookingFormProps {
  values: {
    businessName: string;
    location: string;
    selectedVertical: VerticalType;
    selectedCategory: string;
    selectedBlockId: string;
    selectedBranch: string;
    startWindow: string;
    skillsText: string;
  };
  setValues: (values: any) => void;
  isEnterprise: boolean;
  branches: BranchDivision[];
  activeRateCard?: RateCard;
  onSubmit: (e: FormEvent) => void;
  selectedVertical: VerticalType;
}

export function BookingForm({
  values,
  setValues,
  isEnterprise,
  branches,
  activeRateCard,
  onSubmit,
  selectedVertical
}: BookingFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
        <div className={isEnterprise ? 'sm:col-span-1' : 'sm:col-span-2'}>
          <label htmlFor="company" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Business Name</label>
          <input 
            required 
            type="text" 
            id="company" 
            value={values.businessName} 
            onChange={e => setValues({ ...values, businessName: e.target.value })} 
            className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2.5 border bg-[#1F232B] text-white" 
            placeholder="e.g. Apex Materials Inc" 
          />
        </div>
        
        {isEnterprise && (
          <div>
            <label htmlFor="branch" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Assign to Corporate Branch</label>
            <select
              id="branch"
              value={values.selectedBranch}
              onChange={e => setValues({ ...values, selectedBranch: e.target.value })}
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
            value={values.location} 
            onChange={e => setValues({ ...values, location: e.target.value })} 
            className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2.5 border bg-[#1F232B] text-white" 
            placeholder="e.g. 123 Industrial Dr, Dock B" 
          />
        </div>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="category" className="block text-[11px] font-medium text-[#8E9299] uppercase tracking-wider">Specific Role Category</label>
        <select 
          id="category" 
          required 
          value={values.selectedCategory} 
          onChange={e => setValues({ ...values, selectedCategory: e.target.value })} 
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
          value={values.selectedBlockId} 
          onChange={e => setValues({ ...values, selectedBlockId: e.target.value })} 
          className="mt-1 block w-full rounded border-[#373A43] focus:border-[#10B981] focus:ring-[#10B981] text-xs px-4 py-2 border bg-[#1F232B] text-white"
        >
          {PRICING_BLOCKS.map(b => (
            <option key={b.id} value={b.id}>{b.label} ({b.clientRate})</option>
          ))}
        </select>
      </div>

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
        {/* Placeholder for RateCardSummary component would go here */}
        <button
          type="submit"
          className="rounded bg-white py-2 px-6 text-xs uppercase tracking-wide font-bold text-black shadow-sm hover:bg-gray-200 focus:outline-none transition-colors"
        >
          Authorized & Request Dispatch
        </button>
      </div>
    </form>
  );
}
