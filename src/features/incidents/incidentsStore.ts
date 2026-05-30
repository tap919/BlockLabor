import { create } from 'zustand';
import { IncidentReport, SystemLog } from '../../shared/types/domain';
import { mockIncidentReports } from '../../shared/mocks/data';

interface IncidentsStore {
  incidents: IncidentReport[];
  addIncident: (incident: IncidentReport) => void;
  updateIncidentStatus: (id: string, status: IncidentReport['status'], resolutionNotes?: string) => void;
}

export const useIncidentsStore = create<IncidentsStore>((set) => ({
  incidents: mockIncidentReports,
  addIncident: (incident) => set((state) => ({ incidents: [incident, ...state.incidents] })),
  updateIncidentStatus: (id, status, resolutionNotes) =>
    set((state) => ({
      incidents: state.incidents.map((inc) =>
        inc.id === id ? { ...inc, status, ...(resolutionNotes ? { resolutionNotes } : {}) } : inc
      ),
    })),
}));
