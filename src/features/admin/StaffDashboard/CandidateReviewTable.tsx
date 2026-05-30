import { WorkerCandidate } from '../../../shared/types/domain';

export interface CandidateReviewTableProps {
  candidates: WorkerCandidate[];
  onUpdateCandidate: (candidateId: string, updates: Partial<WorkerCandidate>) => void;
}

export function CandidateReviewTable({ candidates, onUpdateCandidate }: CandidateReviewTableProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl overflow-hidden">
      <table className="min-w-full divide-y divide-[#2A2D35] text-left">
        <thead className="bg-[#0F1115] text-[#8E9299]">
          <tr>
            <th className="px-6 py-3 font-semibold uppercase text-[10px]">Candidate Details</th>
            <th className="px-6 py-3 font-semibold uppercase text-[10px]">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2D35]">
          {candidates.map(cand => (
            <tr key={cand.id} className="hover:bg-[#1F232B] transition-colors">
              <td className="px-6 py-4">
                <span className="font-bold text-white text-sm block">{cand.name}</span>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                  cand.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {cand.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
