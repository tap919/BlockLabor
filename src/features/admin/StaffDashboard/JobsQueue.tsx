import { Job, VerticalType } from '../../../shared/types/domain';

export interface JobsQueueProps {
  jobs: Job[];
  onBookJob?: (job: Job) => void;
  onChangeJobStatus: (jobId: string, status: Job['status'], contractorId?: string, extraUpdates?: Partial<Job>) => void;
}

export function JobsQueue({ jobs, onChangeJobStatus }: JobsQueueProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Direct Dispatch Roster List</h3>
      <div className="divide-y divide-zinc-800/60">
        {jobs.map(job => (
          <div key={job.id} className="py-5 border-b border-zinc-800/80 last:border-0 last:pb-0 space-y-3">
             <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="font-bold text-white uppercase text-xs block">{job.businessName}</span>
                  <span className="text-zinc-400 text-[10px] block">{job.category} ({job.blockType})</span>
                </div>
                <div className="text-right shrink-0 space-y-1.5">
                  <span className="font-mono text-[#10B981] font-bold block text-xs">${job.payout} payout</span>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
