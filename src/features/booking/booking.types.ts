import { Job, VerticalType, BlockType } from '../../shared/types/domain';

export interface BookingFormValues {
  businessName: string;
  location: string;
  selectedVertical: VerticalType;
  selectedCategory: string;
  selectedBlockId: BlockType;
  selectedBranch: string;
  startWindow: string;
  skillsText: string;
}

export interface BookLaborProps {
  onBookJob: (job: Job) => void;
  setView: (view: 'client' | 'staff' | 'home') => void;
  isEnterprise?: boolean;
  branches?: any[];
  rateCards?: any[];
}
