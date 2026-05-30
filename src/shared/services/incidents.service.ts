import { mockIncidentReports } from '../mocks/data';
import { IncidentReport } from '../types/domain';

export const incidentService = {
  getAll: (): IncidentReport[] => mockIncidentReports,
  getById: (id: string): IncidentReport | undefined => mockIncidentReports.find(inc => inc.id === id),
};
