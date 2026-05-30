import { Dispatch, SetStateAction } from 'react';

export interface PermissionsManagerProps {
  permissions: any[];
  setPermissions: Dispatch<SetStateAction<any[]>>;
}

export function PermissionsManager({ permissions, setPermissions }: PermissionsManagerProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white">Permissions Manager</h3>
      <div className="text-zinc-500 text-xs">Manage permissions here. Count: {permissions.length}</div>
    </div>
  );
}
