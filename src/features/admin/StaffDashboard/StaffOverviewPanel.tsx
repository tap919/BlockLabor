import { useState } from 'react';
import { Job, WorkerCandidate, IntegrationSetting, SystemLog, PartnerVendor, IncidentReport } from '../../../shared/types/domain';

export interface StaffOverviewPanelProps {
  jobs: Job[];
  candidates: WorkerCandidate[];
  isEnterprise: boolean;
}

export function StaffOverviewPanel({ jobs, candidates, isEnterprise }: StaffOverviewPanelProps) {
  const totalVolume = jobs.reduce((acc, curr) => acc + curr.charge, 0);
  const totalPayout = jobs.reduce((acc, curr) => acc + (curr.status === 'paid' || curr.status === 'completed' ? curr.payout : 0), 0);
  const estimatedProfit = jobs.reduce((acc, curr) => acc + (curr.charge - curr.payout), 0);
  const activeFulfillmentRate = jobs.length > 0 
    ? Math.round((jobs.filter(j => j.status !== 'open').length / jobs.length) * 100) 
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-2">
        <span className="text-[10px] uppercase font-bold text-[#8E9299] tracking-wider block">Billed Charge Value</span>
        <span className="text-2xl font-mono text-white font-bold block">${totalVolume.toLocaleString()}</span>
      </div>
      <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-2">
        <span className="text-[10px] uppercase font-bold text-[#8E9299] tracking-wider block">Contractor Disbursements</span>
        <span className="text-2xl font-mono text-white font-bold block">${totalPayout.toLocaleString()}</span>
      </div>
      <div className="bg-[#161920] border border-[#10B98133] bg-[#10B981]/[0.02] rounded-xl p-5 space-y-2">
        <span className="text-[10px] uppercase font-bold text-[#10B981] tracking-wider block">Est. Facilitation Margin</span>
        <span className="text-2xl font-mono text-[#10B981] font-bold block">${estimatedProfit.toLocaleString()}</span>
      </div>
      <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-2">
        <span className="text-[10px] uppercase font-bold text-[#8E9299] tracking-wider block">Fulfillment Ratio</span>
        <span className="text-2xl font-mono text-white font-bold block">{activeFulfillmentRate}%</span>
      </div>
    </div>
  );
}
