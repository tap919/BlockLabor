import { mockJobs } from '../mocks/data';
import { Job } from '../types/domain';

export const jobService = {
  getAll: (): Job[] => mockJobs,
  getById: (id: string): Job | undefined => mockJobs.find(job => job.id === id),
};
