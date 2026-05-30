import { PartnerVendor } from '../../../shared/types/domain';

export interface VendorManagerProps {
  partnerVendors: PartnerVendor[];
  onAddPartnerVendor?: (vendor: PartnerVendor) => void;
  onUpdatePartnerVendorStatus?: (id: string, status: PartnerVendor['status']) => void;
}

export function VendorManager({ partnerVendors }: VendorManagerProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white">Partner Vendor Manager</h3>
      <div className="text-zinc-500 text-xs font-mono py-4 text-center">
        {partnerVendors.length === 0 ? 'No partner vendors managed.' : 'Partner vendors list here.'}
      </div>
    </div>
  );
}
