import { useState, useMemo } from 'react';
import { Job, VerticalType } from '../../../shared/types/domain';
import VerifiedStamp from '../../../components/ui/VerifiedStamp';

export interface JobsQueueProps {
  jobs: Job[];
  onBookJob?: (job: Job) => void;
  onChangeJobStatus: (jobId: string, status: Job['status'], contractorId?: string, extraUpdates?: Partial<Job>) => void;
}

export function JobsQueue({ jobs, onChangeJobStatus }: JobsQueueProps) {
  const [trustTierFilter, setTrustTierFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified'>('all');

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Trust tier mock: derive a tier from job.id hash (in real life, this comes from the business)
      const hash = job.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const derivedTier = (hash % 5) + 1;

      if (trustTierFilter !== 'all' && derivedTier !== trustTierFilter) {
        return false;
      }
      if (verificationFilter === 'verified' && job.verificationStatus !== 'verified') {
        return false;
      }
      return true;
    });
  }, [jobs, trustTierFilter, verificationFilter]);

  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Direct Dispatch Roster List</h3>
        <span className="text-[10px] text-zinc-500 font-mono">{filteredJobs.length} / {jobs.length} shown</span>
      </div>

      {/* Trust Tier & Verification Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-mono uppercase text-zinc-500 mr-1">Trust Tier:</span>
        {(['all', 1, 2, 3, 4, 5] as const).map(t => (
          <button
            key={t}
            onClick={() => setTrustTierFilter(t)}
            className={`text-[10px] font-mono uppercase px-2 py-1 rounded border transition-colors cursor-pointer ${
              trustTierFilter === t
                ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300'
                : 'bg-transparent border-[#2A2D35] text-zinc-400 hover:border-emerald-500/30'
            }`}
          >
            {t === 'all' ? 'All' : `T${t}`}
          </button>
        ))}
        <span className="text-[10px] font-mono uppercase text-zinc-500 mx-2 ml-4">Status:</span>
        {(['all', 'verified'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVerificationFilter(v)}
            className={`text-[10px] font-mono uppercase px-2 py-1 rounded border transition-colors cursor-pointer ${
              verificationFilter === v
                ? 'bg-blue-900/40 border-blue-500/50 text-blue-300'
                : 'bg-transparent border-[#2A2D35] text-zinc-400 hover:border-blue-500/30'
            }`}
          >
            {v === 'all' ? 'All' : 'Verified Only'}
          </button>
        ))}
      </div>

      <div className="divide-y divide-zinc-800/60">
        {filteredJobs.length === 0 && (
          <div className="py-5 text-center text-zinc-500 text-xs italic">
            No jobs match the selected filters.
          </div>
        )}
        {filteredJobs.map(job => {
          // TODO: Replace this placeholder hash derivation with the real
          // businesses.trust_tier once jobs.business_id is joined in the
          // jobs service. The hash is acceptable for the verified-stamp UI
          // demo but must not be relied upon for tier-gated features.
          const hash = job.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const derivedTier = (hash % 5) + 1;

          return (
            <div key={job.id} className="py-5 border-b border-zinc-800/80 last:border-0 last:pb-0 space-y-3">
               <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white uppercase text-xs">{job.businessName}</span>
                      <VerifiedStamp
                        status={job.verificationStatus || 'pending'}
                        trustTier={derivedTier}
                        size="sm"
                      />
                    </div>
                    <span className="text-zinc-400 text-[10px] block">{job.category} ({job.blockType})</span>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <span className="font-mono text-[#10B981] font-bold block text-xs">${job.payout} payout</span>
                    {job.applicationResponseSLA && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        SLA: {new Date(job.applicationResponseSLA).toLocaleDateString()}
                      </span>
                    )}
                  </div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
