import { mockCandidates } from '../mocks/data';
import { WorkerCandidate } from '../types/domain';

export const candidateService = {
  getAll: (): WorkerCandidate[] => mockCandidates,
  getById: (id: string): WorkerCandidate | undefined => mockCandidates.find(candidate => candidate.id === id),
};
