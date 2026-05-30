import { Job, WorkerCandidate } from '../shared/types/domain';
import { useMemo, useState } from 'react';
import { 
  TrendingUp, Layers, Users, Building, Calendar, DollarSign,
  Filter, CheckCircle, Percent, ArrowUpRight, Award, Plus, Compass
} from 'lucide-react';

interface MarginTrackerProps {
  jobs: Job[];
  candidates: WorkerCandidate[];
}

type MarginGrouping = 'placement' | 'shift' | 'client' | 'branch' | 'recruiter';

export function MarginTracker({ jobs, candidates }: MarginTrackerProps) {
  const [activeGrouping, setActiveGrouping] = useState<MarginGrouping>('placement');

  // Compute margins for various criteria:
  
  // 1. Grouped by Client
  const clientMargins = useMemo(() => {
    const map: Record<string, { name: string; billed: number; pay: number; count: number }> = {};
    jobs.forEach(j => {
      const client = j.businessName || 'Other';
      if (!map[client]) {
        map[client] = { name: client, billed: 0, pay: 0, count: 0 };
      }
      map[client].billed += j.charge;
      map[client].pay += j.payout;
      map[client].count += 1;
    });

    return Object.values(map).map(c => {
      const profit = c.billed - c.pay;
      const marginPct = c.billed > 0 ? Math.round((profit / c.billed) * 100) : 0;
      return { ...c, profit, marginPct };
    }).sort((a, b) => b.profit - a.profit);
  }, [jobs]);

  // 2. Grouped by Shift (Morning/Afternoon/Night)
  const shiftMargins = useMemo(() => {
    const map: Record<string, { type: string; billed: number; pay: number; count: number }> = {
      'Morning Shift (6AM-2PM)': { type: 'Morning Shift (6AM-2PM)', billed: 0, pay: 0, count: 0 },
      'Afternoon Shift (2PM-10PM)': { type: 'Afternoon Shift (2PM-10PM)', billed: 0, pay: 0, count: 0 },
      'Night/Graveyard Shift (10PM-6AM)': { type: 'Night/Graveyard Shift (10PM-6AM)', billed: 0, pay: 0, count: 0 }
    };

    jobs.forEach(j => {
      const startHour = j.shiftStartTime ? parseInt(j.shiftStartTime.split(':')[0]) : 8;
      let shiftKey = 'Morning Shift (6AM-2PM)';
      if (startHour >= 14 && startHour < 22) {
        shiftKey = 'Afternoon Shift (2PM-10PM)';
      } else if (startHour >= 22 || startHour < 6) {
        shiftKey = 'Night/Graveyard Shift (10PM-6AM)';
      }
      
      map[shiftKey].billed += j.charge;
      map[shiftKey].pay += j.payout;
      map[shiftKey].count += 1;
    });

    return Object.values(map).map(s => {
      const profit = s.billed - s.pay;
      const marginPct = s.billed > 0 ? Math.round((profit / s.billed) * 100) : 0;
      return { ...s, profit, marginPct };
    });
  }, [jobs]);

  // 3. Grouped by Branch Location
  const branchMargins = useMemo(() => {
    const map: Record<string, { name: string; billed: number; pay: number; count: number }> = {};
    
    // Seed standard branches to guarantee coverage
    const defaultBranches = ['Dallas Logistics', 'Houston East', 'San Francisco Main', 'New York Corporate'];
    defaultBranches.forEach(b => {
      map[b] = { name: b, billed: 0, pay: 0, count: 0 };
    });

    jobs.forEach(j => {
      const br = j.branchName || 'San Francisco Main';
      if (!map[br]) {
        map[br] = { name: br, billed: 0, pay: 0, count: 0 };
      }
      map[br].billed += j.charge;
      map[br].pay += j.payout;
      map[br].count += 1;
    });

    return Object.values(map).map(b => {
      const profit = b.billed - b.pay;
      const marginPct = b.billed > 0 ? Math.round((profit / b.billed) * 100) : 0;
      return { ...b, profit, marginPct };
    }).sort((a, b) => b.profit - a.profit);
  }, [jobs]);

  // 4. Grouped by Recruiter
  const recruiterMargins = useMemo(() => {
    const map: Record<string, { name: string; billed: number; pay: number; placements: number }> = {};
    const defaultRecs = ['Sonia K.', 'David L.', 'Elisa M.'];
    defaultRecs.forEach(r => {
      map[r] = { name: r, billed: 0, pay: 0, placements: 0 };
    });

    jobs.forEach(j => {
      const rec = j.recruiterName || 'Sonia K.';
      if (!map[rec]) {
        map[rec] = { name: rec, billed: 0, pay: 0, placements: 0 };
      }
      map[rec].billed += j.charge;
      map[rec].pay += j.payout;
      if (j.contractorId) {
        map[rec].placements += 1;
      }
    });

    return Object.values(map).map(r => {
      const profit = r.billed - r.pay;
      const marginPct = r.billed > 0 ? Math.round((profit / r.billed) * 100) : 0;
      return { ...r, profit, marginPct };
    }).sort((a, b) => b.profit - a.profit);
  }, [jobs]);

  // Overall calculations
  const summaryStats = useMemo(() => {
    const totalBilled = jobs.reduce((acc, curr) => acc + curr.charge, 0);
    const totalPay = jobs.reduce((acc, curr) => acc + curr.payout, 0);
    const profit = totalBilled - totalPay;
    const marginPercent = totalBilled > 0 ? Math.round((profit / totalBilled) * 1000) / 10 : 25;
    
    // Low margin threshold warnings counts (under 20% mark)
    const lowMarginJobs = jobs.filter(j => j.charge > 0 && ((j.charge - j.payout) / j.charge) < 0.20);

    return {
      totalBilled,
      totalPay,
      profit,
      marginPercent,
      warningCount: lowMarginJobs.length
    };
  }, [jobs]);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-[#161920] border border-[#2A2D35] p-5 rounded-xl space-y-1 relative">
          <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono block">Aggregate Agency Revenue</span>
          <span className="text-2xl font-mono font-bold text-white block">${summaryStats.totalBilled.toLocaleString()}</span>
          <p className="text-[9px] text-[#10B981] font-mono mt-1">Total billing generated from dispatch blocks</p>
          <div className="absolute top-4 right-4 bg-[#10B981]/15 text-[#10B981] rounded-full p-1.5">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-[#161920] border border-[#10B98133] bg-[#10B981]/[0.01] p-5 rounded-xl space-y-1 relative">
          <span className="text-[10px] uppercase font-bold text-[#10B981] font-mono block">Retained Net Spread</span>
          <span className="text-2xl font-mono font-bold text-[#10B981] block">${summaryStats.profit.toLocaleString()}</span>
          <p className="text-[9px] text-zinc-400 mt-1">Gross Margin Average: <strong className="font-mono text-zinc-200">{summaryStats.marginPercent}%</strong></p>
          <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 rounded-full p-1.5 animate-pulse">
            <Percent className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-[#161920] border border-[#2A2D35] p-5 rounded-xl space-y-1 relative">
          <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono block">Compliance Alert Center</span>
          <span className="text-2xl font-mono font-bold text-white block">{summaryStats.warningCount} Blocks</span>
          <p className="text-[9px] text-red-400 mt-1">Shifts with markup settings under profit threshold (&lt;20%)</p>
          <div className="absolute top-4 right-4 bg-red-500/10 text-red-500 rounded-full p-1.5">
            <Award className="h-4 w-4" />
          </div>
        </div>

      </div>

      {/* Grid Tab Navigation buttons */}
      <div className="flex flex-wrap border-b border-[#2A2D35] pb-2 gap-1.5">
        {[
          { id: 'placement', label: 'Margins by Placement (Shifts)', icon: Compass },
          { id: 'shift', label: 'Margins by Shift Time', icon: Calendar },
          { id: 'client', label: 'Margins by Client Co', icon: Building },
          { id: 'branch', label: 'Margins by Regional Branch', icon: Layers },
          { id: 'recruiter', label: 'Margins by Recruiter Performance', icon: Users }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveGrouping(tab.id as MarginGrouping)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                activeGrouping === tab.id
                  ? 'bg-zinc-800 text-white border-b-2 border-[#10B981]'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab Renders */}
      <div className="bg-[#161920] border border-[#2A2D35] rounded-xl overflow-hidden shadow-xl">
        
        {/* Placement Level Margins Row */}
        {activeGrouping === 'placement' && (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-[#2A2D35] text-left">
              <thead className="bg-[#0F1115] text-[#8E9299]">
                <tr>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Contractor Placement SOW</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Client / Recruiter</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Billed Charge Rate</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Disbursed Pay rate</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Markup Ratio</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono text-right">Margin Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35] bg-[#161920]">
                {jobs.map(job => {
                  const profit = job.charge - job.payout;
                  const marginPct = job.charge > 0 ? Math.round((profit / job.charge) * 100) : 0;
                  const isLowMargin = marginPct < 20;

                  return (
                    <tr key={job.id} className="hover:bg-[#1F232B] transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-bold text-white text-sm block">{job.category}</span>
                        <span className="text-[10px] text-[#10B981] font-mono mt-0.5">SOW Block ID: {job.id} • {job.blockType}</span>
                      </td>
                      <td className="px-5 py-4">
                        <strong className="text-white block">{job.businessName}</strong>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">Branch: {job.branchName || 'San Francisco Main'} • Recruiter: {job.recruiterName || 'Sonia K.'}</span>
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-white">
                        ${job.charge.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">(${job.billRate || '-'}/hr)</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-[#10B981]">
                        ${job.payout.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">(${job.payRate || '-'}/hr)</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-yellow-500 font-bold">
                        {job.status === 'open' ? '-' : `${marginPct}%`}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold">
                        <span className={isLowMargin ? 'text-red-400' : 'text-[#10B981]'}>
                          +${profit.toLocaleString()}
                        </span>
                        {isLowMargin && (
                          <span className="block text-[8px] bg-red-500/10 text-red-500 rounded px-1 uppercase font-bold tracking-widest mt-1 w-max ml-auto">LOW MARKUP</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Shift Time Margins */}
        {activeGrouping === 'shift' && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-zinc-400">Analysis of agency gross profit margins segregated across daily operational schedules:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {shiftMargins.map((sh, key) => (
                <div key={key} className="bg-black/30 p-4 rounded-lg border border-zinc-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block font-mono">{sh.type}</span>
                  <div>
                    <span className="text-xl font-mono font-bold text-white block">${sh.profit.toLocaleString()} Profit</span>
                    <span className="text-xs text-[#10B981] font-mono mt-1 block">Margin: {sh.marginPct}%</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
                    Billed: <span className="text-white font-mono">${sh.billed}</span> | Disbursed: <span className="text-white font-mono">${sh.pay}</span> ({sh.count} shifts)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client Co Margins Row */}
        {activeGrouping === 'client' && (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-[#2A2D35] text-left">
              <thead className="bg-[#0F1115] text-[#8E9299]">
                <tr>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Corporate Client Partner</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Billed Value</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Disbursed Contractor Pay</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Markup / Margin Rate</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35]">
                {clientMargins.map((cl, key) => (
                  <tr key={key} className="hover:bg-zinc-800/2 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-white text-sm block">{cl.name}</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">{cl.count} dispatch orders placed</span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-white">${cl.billed.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-[#10B981]">${cl.pay.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono">
                      <span className="bg-[#10B9811A] text-[#10B981] px-2 py-0.5 rounded font-bold text-[10px]">
                        {cl.marginPct}% Margin
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-right text-emerald-400">+${cl.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Regional Branch-wise Margins */}
        {activeGrouping === 'branch' && (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-[#2A2D35] text-left">
              <thead className="bg-[#0F1115] text-[#8E9299]">
                <tr>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Regional Staffing Branch</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Associated shifts</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Gross Billed Out</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Gross Disbursements</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Retained Spread</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono text-right">Margin Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35]">
                {branchMargins.map((br, key) => (
                  <tr key={key} className="hover:bg-zinc-800/2 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-white text-sm block">{br.name} Group</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Automated branch division routing</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-300">{br.count} scheduled blocks</td>
                    <td className="px-5 py-4 font-mono font-bold text-white">${br.billed.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-[#10B981]">${br.pay.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono font-bold text-emerald-400">+${br.profit.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold">
                      <span className="bg-[#3B82F61A] text-[#3B82F6] px-2 py-0.5 rounded text-[10px] font-bold">
                        {br.marginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grouped by Recruiter Performance */}
        {activeGrouping === 'recruiter' && (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-[#2A2D35] text-left">
              <thead className="bg-[#0F1115] text-[#8E9299]">
                <tr>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Recruiting Manager</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px]">Roster placements</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Total Billed Customer charge</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Total Disbursements</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono">Retained net spread</th>
                  <th className="px-5 py-3 font-semibold uppercase text-[10px] font-mono text-right">Gross profit margins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D35]">
                {recruiterMargins.map((rc, key) => (
                  <tr key={key} className="hover:bg-zinc-800/2 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-white text-sm block">{rc.name}</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">Sourcing & compliance operations</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-white">{rc.placements} placements</td>
                    <td className="px-5 py-4 font-mono font-bold text-white">${rc.billed.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-[#10B981]">${rc.pay.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono font-bold text-emerald-400">+${rc.profit.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold">
                      <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        {rc.marginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
      
      {/* Footer warning indicators */}
      <div className="bg-[#1F232B]/40 p-4 rounded-xl border border-dashed border-[#2A2D35] text-[11px] text-zinc-400 leading-relaxed">
        <strong>Compliance Notice regarding Gross Spreads:</strong> SOW block billing requires minimum markups of 25.0% to offset multi-state payroll unemployment insurance and staffing liabilities. Schedulers are preemptively warned on manual dispatch forms if calculated spreads slide below the threshold bounds.
      </div>

    </div>
  );
}
