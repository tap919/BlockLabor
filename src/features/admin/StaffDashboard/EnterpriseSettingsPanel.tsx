import { Dispatch, SetStateAction } from 'react';

export interface EnterpriseSettingsPanelProps {
  isEnterprise: boolean;
  setIsEnterprise: Dispatch<SetStateAction<boolean>>;
}

export function EnterpriseSettingsPanel({ isEnterprise, setIsEnterprise }: EnterpriseSettingsPanelProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white">Enterprise Settings</h3>
      <button 
        onClick={() => setIsEnterprise(!isEnterprise)}
        className="text-xs bg-zinc-800 p-2 rounded text-white"
      >
        Toggle Enterprise Mode: {isEnterprise ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
