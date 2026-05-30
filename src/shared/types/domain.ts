export type BlockType = '1-hour' | '4-hour' | '8-hour' | '1-week' | '1-month';

export type VerticalType = 'Light Industrial' | 'Clerical' | 'Hospitality' | 'Healthcare' | 'Events';

export type JobStatus = 'open' | 'accepted' | 'completed' | 'paid';

export interface RequiredCredential {
  id: string;
  name: string;
  description: string;
}

export interface CustomVerticalWorkflow {
  vertical: VerticalType;
  mandatoryCredentials: RequiredCredential[];
  complianceChecklist: string[];
  clientLiabilityTerms: string;
}

export interface JobChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Timesheet {
  checkInTime?: string;
  checkOutTime?: string;
  gpsVerified?: boolean;
  notes?: string;
  workerSignature?: string;
  clientSignatureName?: string;
  gpsCheckInLat?: number;
  gpsCheckInLng?: number;
  gpsVerifiedRadius?: boolean;
  geofenceStatus?: 'passed' | 'failed' | 'not_verified';
  gpsCheckOutLat?: number;
  gpsCheckOutLng?: number;
}

export interface Job {
  id: string;
  businessName: string;
  vertical: VerticalType;
  category: string;
  blockType: BlockType;
  startWindow: string; // e.g. "Tomorrow morning"
  location: string;
  requiredSkills: string[];
  status: JobStatus;
  payout: number;       // Contractor pay
  charge: number;       // Client cost
  contractorId?: string;
  createdAt: string;
  checklist: JobChecklistItem[];
  timesheet?: Timesheet;
  // Placements and advanced scheduling values
  headcount?: number;
  billRate?: number;
  payRate?: number;
  markup?: number;
  hoursPerShift?: number;
  durationShifts?: number;
  locationName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  swapRequested?: boolean;
  dropRequested?: boolean;
  timesheetVerifiedAt?: string;
  // Advanced tracking
  recruiterId?: string;
  recruiterName?: string;
  branchName?: string;
  shiftHours?: number;   // actual worked hours for payroll
  overtimeHours?: number; // OT hours worked
  expensesCaptured?: { id: string; amount: number; description: string; status: 'pending' | 'approved' }[];
  deductionsCaptured?: { id: string; amount: number; description: string }[];
  stateCode?: string;    // Client tax state
  invoiceTermDays?: number; // e.g., Net 15, Net 30, Net 45
  invoiceAmountAdjusted?: number; // additions/deductions
  invoiceAdjustmentNotes?: string;
  payrollExpenses?: number;
  payrollDeductions?: number;
  vendorId?: string; // If outsourced to a vendor partner
  vendorName?: string; // The outsourced vendor name
  incidentsCount?: number;
  isOutsourced?: boolean;
}

export interface WorkerCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  verticals: VerticalType[];
  totalEarned: number;
  status: 'applied' | 'screening' | 'onboarded' | 'active';
  backgroundCheckStatus: 'not_started' | 'pending' | 'passed' | 'failed';
  eSignStatus: 'unsigned' | 'sent' | 'signed';
  verifiedCredentials: string[]; // List of credential IDs
  // Worker Self-Service & Experience details
  weeklyAvailability?: Record<string, boolean>; // Sunday-Saturday
  shiftPreferences?: string[]; // ['morning', 'afternoon', 'night']
  payOption?: 'direct_deposit' | 'pay_card';
  directDepositDetail?: { bankName: string; routing: string; account: string };
  payCardDetail?: { cardNumber: string; provider: string };
  profileUpdated?: boolean;
  // Advanced document and certification tracking
  documents?: { 
    id: string; 
    name: string; 
    type: string; 
    status: 'verified' | 'pending' | 'expired' | 'missing';
    expirationDate?: string; // Expiring document tracker
    expiresAt?: string;
    uploadedAt?: string;
    description?: string;
  }[];
  stateCode?: string; // Worker state code (for multi-state tax payroll support)
  recruiterName?: string;
  branchName?: string;
  performanceScore?: number; // Scale out of 100 for productivity
  timeToOnboardDays?: number; // Track time to fill metrics
  noShowCount?: number;
  isRedeployed?: boolean;
  messages?: { id: string; sender: string; text: string; timestamp: string }[];
  
  // Reliability Metrics (Worker reliability score based on attendance, punctuality, completion, client feedback)
  reliabilityScore?: number;
  attendanceRate?: number;
  punctualityRate?: number;
  completionRate?: number;
  clientRatingClass?: string; // e.g. "A+"
  vendorId?: string; // If supplied by a partner vendor supplier
}

export interface IncidentReport {
  id: string;
  jobId: string;
  businessName: string;
  contractorId?: string;
  contractorName?: string;
  reportedBy: 'worker' | 'client' | 'agency';
  category: 'safety' | 'misconduct' | 'dispute' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  description: string;
  status: 'pending' | 'under_review' | 'resolved';
  resolutionNotes?: string;
}

export interface PartnerVendor {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  verticals: VerticalType[];
  markupShare: number; // e.g. 0.15 (15% agency commission)
  status: 'active' | 'suspended';
  assignedJobsCount: number;
  insuranceExpiry: string;
  taxId: string;
}

export interface IntegrationSetting {
  id: string;
  name: string;
  category: 'payroll' | 'accounting' | 'background_checks' | 'signature' | 'job_boards' | 'hris';
  status: 'disconnected' | 'connected' | 'syncing';
  apiKey?: string;
  webhookUrl?: string;
  lastSync?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  category: 'system' | 'payroll' | 'scheduler' | 'recruiter' | 'worker' | 'sms';
  message: string;
  type: 'info' | 'success' | 'warning' | 'sms';
}

export type SimulatorRole = 'owner' | 'recruiter' | 'scheduler' | 'payroll' | 'client' | 'worker';

export interface BranchDivision {
  id: string;
  name: string;
  city: string;
  manager: string;
  marginTarget: number;
  activeJobsCount: number;
  activeWorkersCount: number;
}

export interface RateCard {
  id: string;
  vertical: VerticalType;
  category: string;
  standardBillRate: number;
  standardPayRate: number;
  customClientMarkupPercent: number;
}

export interface SsoConfig {
  id: string;
  provider: 'Okta' | 'Azure AD' | 'Ping Identity' | 'None';
  domain: string;
  enabled: boolean;
  activeDirectoryGroup: string;
  lastSyncDate?: string;
}

export interface AdminPermissions {
  id: string;
  roleName: string;
  canEditRateCards: boolean;
  canApprovePayroll: boolean;
  canVerifyDocs: boolean;
  canDeployDispatches: boolean;
  canManageBranches: boolean;
}

