import { CheckCircle } from 'lucide-react';

export function CompliancePanel({ activeWorkflow, selectedVertical }: any) {
  return (
    <div className="bg-[#161920] p-5 rounded-xl border border-[#2A2D35]">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-3">Vertical Protocols</h3>
      <div className="space-y-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#8E9299] block font-semibold">Selected Vertical:</span>
          <span className="text-white text-sm font-bold">{selectedVertical}</span>
        </div>
        
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#8E9299] block font-semibold">Specialized Credentials:</span>
          <div className="mt-1 space-y-1.5">
            {activeWorkflow.mandatoryCredentials.map((cred: any) => (
              <div key={cred.id} className="bg-[#1F232B] p-2 rounded border border-[#373A43] text-xs">
                <span className="text-white font-bold block">{cred.name}</span>
                <span className="text-slate-400 text-[10px]">{cred.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#8E9299] block font-semibold">Verification System Log:</span>
          <ul className="mt-1 space-y-1 text-xs text-[#8E9299]">
            {activeWorkflow.complianceChecklist.map((c: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
