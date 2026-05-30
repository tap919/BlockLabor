import { create } from 'zustand';
import { WorkerCandidate } from '../../shared/types/domain';
import { mockCandidates } from '../../shared/mocks/data';

interface CandidatesStore {
  candidates: WorkerCandidate[];
  setCandidates: (candidates: WorkerCandidate[]) => void;
  updateCandidate: (id: string, updates: Partial<WorkerCandidate>) => void;
}

export const useCandidatesStore = create<CandidatesStore>((set) => ({
  candidates: mockCandidates,
  setCandidates: (candidates) => set({ candidates }),
  updateCandidate: (id, updates) =>
    set((state) => ({
      candidates: state.candidates.map((cand) =>
        cand.id === id ? { ...cand, ...updates } : cand
      ),
    })),
}));
