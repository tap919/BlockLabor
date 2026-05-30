import { create } from 'zustand';
import { WorkerCandidate } from '../../shared/types/domain';
import { candidateService } from '../../shared/services/candidates.service';

interface CandidatesStore {
  candidates: WorkerCandidate[];
  setCandidates: (candidates: WorkerCandidate[]) => void;
  updateCandidate: (id: string, updates: Partial<WorkerCandidate>) => void;
}

export const useCandidatesStore = create<CandidatesStore>((set) => ({
  candidates: candidateService.getAll(),
  setCandidates: (candidates) => set({ candidates }),
  updateCandidate: (id, updates) =>
    set((state) => ({
      candidates: state.candidates.map((cand) =>
        cand.id === id ? { ...cand, ...updates } : cand
      ),
    })),
}));
