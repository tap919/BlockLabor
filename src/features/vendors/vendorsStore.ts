import { create } from 'zustand';
import { PartnerVendor, SystemLog } from '../../shared/types/domain';
import { vendorService } from '../../shared/services/vendors.service';

interface VendorsStore {
  vendors: PartnerVendor[];
  addVendor: (vendor: PartnerVendor) => void;
  updateVendorStatus: (id: string, status: PartnerVendor['status']) => void;
}

export const useVendorsStore = create<VendorsStore>((set) => ({
  vendors: [],
  addVendor: (vendor) => set((state) => ({ vendors: [...state.vendors, vendor] })),
  updateVendorStatus: (id, status) =>
    set((state) => ({
      vendors: state.vendors.map((v) => (v.id === id ? { ...v, status } : v)),
    })),
}));
