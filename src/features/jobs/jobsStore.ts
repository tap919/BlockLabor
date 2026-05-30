import { create } from 'zustand';
import { Job } from '../../shared/types/domain';
import { jobService } from '../../shared/services/jobs.service';

interface JobsStore {
  jobs: Job[];
  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  updateJobStatus: (id: string, status: Job['status'], contractorId?: string, extraUpdates?: Partial<Job>) => void;
}

export const useJobsStore = create<JobsStore>((set) => ({
  jobs: jobService.getAll(),
  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  updateJobStatus: (id, status, contractorId, extraUpdates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id
          ? {
              ...job,
              status,
              ...(contractorId !== undefined ? { contractorId } : {}),
              ...extraUpdates,
            }
          : job
      ),
    })),
}));
