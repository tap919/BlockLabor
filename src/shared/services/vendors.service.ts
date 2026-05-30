import { mockPartnerVendors } from '../mocks/data';
import { PartnerVendor } from '../types/domain';

export const vendorService = {
  getAll: (): PartnerVendor[] => mockPartnerVendors,
  getById: (id: string): PartnerVendor | undefined => mockPartnerVendors.find(vendor => vendor.id === id),
};
