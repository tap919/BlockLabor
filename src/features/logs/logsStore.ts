import { create } from 'zustand';
import { SystemLog } from '../../shared/types/domain';
import { initialLogs } from '../../shared/mocks/data';

interface LogsStore {
  logs: SystemLog[];
  addLog: (category: SystemLog['category'], message: string, type: SystemLog['type']) => void;
}

export const useLogsStore = create<LogsStore>((set) => ({
  logs: initialLogs,
  addLog: (category, message, type = 'info') =>
    set((state) => ({
      logs: [
        {
          id: 'log-' + Math.floor(Math.random() * 100000 + 400),
          timestamp: new Date().toISOString(),
          category,
          message,
          type,
        },
        ...state.logs,
      ],
    })),
}));
