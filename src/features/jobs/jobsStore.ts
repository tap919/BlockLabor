import { create } from 'zustand';
import { Job } from '../../shared/types/domain';
import { jobService } from '../../shared/services/jobs.service';

interface JobsStore {
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  setJobs: (jobs: Job[]) => void;
  fetchJobs: () => Promise<void>;
  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => Promise<void>;
  updateJobStatus: (id: string, status: Job['status'], contractorId?: string, extraUpdates?: Partial<Job>) => Promise<void>;
}

export const useJobsStore = create<JobsStore>((set) => ({
  jobs: [],
  isLoading: false,
  error: null,
  setJobs: (jobs) => set({ jobs }),
  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const jobs = await jobService.getAll();
      set({ jobs, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  addJob: async (job) => {
    try {
      const { data, error } = await (await import('../../shared/lib/supabaseClient')).supabase
        .from('jobs')
        .insert(job as never)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        set((state) => ({ jobs: [data as unknown as Job, ...state.jobs] }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
  updateJobStatus: async (id, status, contractorId, extraUpdates) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (contractorId !== undefined) updates.contractor_id = contractorId;
      if (extraUpdates) {
        if (extraUpdates.businessName) updates.business_name = extraUpdates.businessName;
        if (extraUpdates.vertical) updates.vertical = extraUpdates.vertical;
        if (extraUpdates.category) updates.category = extraUpdates.category;
        if (extraUpdates.blockType) updates.block_type = extraUpdates.blockType;
        if (extraUpdates.payout !== undefined) updates.payout = extraUpdates.payout;
        if (extraUpdates.charge !== undefined) updates.charge = extraUpdates.charge;
        if (extraUpdates.isOutsourced !== undefined) updates.is_outsourced = extraUpdates.isOutsourced;
        if (extraUpdates.vendorName) updates.vendor_name = extraUpdates.vendorName;
        if (extraUpdates.vendorId) updates.vendor_id = extraUpdates.vendorId;
        if (extraUpdates.swapRequested !== undefined) updates.swap_requested = extraUpdates.swapRequested;
        if (extraUpdates.dropRequested !== undefined) updates.drop_requested = extraUpdates.dropRequested;
        if (extraUpdates.incidentsCount !== undefined) updates.incidents_count = extraUpdates.incidentsCount;
        if (extraUpdates.headcount !== undefined) updates.headcount = extraUpdates.headcount;
        if (extraUpdates.hoursPerShift !== undefined) updates.hours_per_shift = extraUpdates.hoursPerShift;
        if (extraUpdates.durationShifts !== undefined) updates.duration_shifts = extraUpdates.durationShifts;
        if (extraUpdates.shiftHours !== undefined) updates.shift_hours = extraUpdates.shiftHours;
        if (extraUpdates.overtimeHours !== undefined) updates.overtime_hours = extraUpdates.overtimeHours;
        if (extraUpdates.billRate !== undefined) updates.bill_rate = extraUpdates.billRate;
        if (extraUpdates.payRate !== undefined) updates.pay_rate = extraUpdates.payRate;
        if (extraUpdates.markup !== undefined) updates.markup = extraUpdates.markup;
      }
      const { error } = await (await import('../../shared/lib/supabaseClient')).supabase
        .from('jobs')
        .update(updates as never)
        .eq('id', id);
      if (error) throw error;
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id
            ? { ...job, status, ...(contractorId !== undefined ? { contractorId } : {}), ...extraUpdates }
            : job
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
