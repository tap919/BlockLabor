import { IncidentReport } from '../../../shared/types/domain';

export interface IncidentManagerProps {
  incidentReports: IncidentReport[];
  onAddIncident?: (newIncident: IncidentReport) => void;
  onUpdateIncidentStatus?: (id: string, status: IncidentReport['status'], resolutionNotes?: string) => void;
}

export function IncidentManager({ incidentReports }: IncidentManagerProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
        Incident Reports ({incidentReports.length})
      </h3>
      <div className="text-zinc-500 text-xs font-mono py-4 text-center">
        {incidentReports.length === 0 ? 'No incidents reported.' : 'Incidents list management here.'}
      </div>
    </div>
  );
}
