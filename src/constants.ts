import { CustomVerticalWorkflow, RequiredCredential } from './types';

export const PRICING_BLOCKS = [
  { id: '1-hour', label: '1 Hour Block', description: 'Quick task relief.', clientRate: '$35', contractorRate: '$25', value: 25, chargeVal: 35 },
  { id: '4-hour', label: 'Half-Day Shift', description: 'Solid coverage for a busy rush.', clientRate: '$130', contractorRate: '$100', value: 100, chargeVal: 130 },
  { id: '8-hour', label: 'Full-Day Shift', description: 'Complete daily operational support.', clientRate: '$250', contractorRate: '$190', value: 190, chargeVal: 250 },
  { id: '1-week', label: '1 Week Block', description: 'Stable support for project sprints.', clientRate: '$1,100', contractorRate: '$850', value: 850, chargeVal: 1100 },
  { id: '1-month', label: '1 Month Block', description: 'Long-term predictable capacity.', clientRate: '$4,200', contractorRate: '$3,300', value: 3300, chargeVal: 4200 },
];

export const VERTICALS = ['Light Industrial', 'Clerical', 'Hospitality', 'Healthcare', 'Events'] as const;

export const CATEGORIES_BY_VERTICAL: Record<string, string[]> = {
  'Light Industrial': ['Warehouse Packing', 'Assembly Line Helper', 'Machinery Loader', 'Pallet Sorter'],
  'Clerical': ['Data Entry backlog', 'Document Scanning', 'Reception Cover', 'Invoicing Clerk'],
  'Hospitality': ['Room Turnover Cleaner', 'Dishwasher / Kitchen Utility', 'Banquet Server', 'Janitorial Support'],
  'Healthcare': ['Nursing Assistant (CNA) Support', 'Medical Intake Assistant', 'Surgical Room Preparer', 'Patient Transport Runner'],
  'Events': ['Fringes Marshall', 'Event Ticket Scanner', 'Heavy Tech Setter', 'Stage Helper']
};

export const VERTICAL_WORKFLOWS: CustomVerticalWorkflow[] = [
  {
    vertical: 'Light Industrial',
    mandatoryCredentials: [
      { id: 'forklift_cert', name: 'Forklift Safety License', description: 'OSHA standard forklift driving certification' },
      { id: 'heavy_lifting_waiver', name: 'Heavy Lifting Capacity Validation', description: 'Certified physical check for 50lbs+' }
    ],
    complianceChecklist: [
      'Site safety supervisor assignment verified',
      'Steel-toe boots requirement communicated',
      'Emergency egress paths review complete'
    ],
    clientLiabilityTerms: 'Client holds primary commercial liability for industrial machinery operations on site. Worker is independent.'
  },
  {
    vertical: 'Clerical',
    mandatoryCredentials: [
      { id: 'nda_signed', name: 'Standard Proprietary Information Agreement', description: 'Client-specific NDA' },
      { id: 'typing_speed', name: 'Typing Certification (50+ WPM)', description: 'Validated typing and office tool exam' }
    ],
    complianceChecklist: [
      'Client secure guest network credentials prepared',
      'Confidentiality reminder accepted',
      'Workstation seating check'
    ],
    clientLiabilityTerms: 'Client provides secure terminals. Worker agrees not to export proprietary IP. Independent liability limits apply.'
  },
  {
    vertical: 'Hospitality',
    mandatoryCredentials: [
      { id: 'food_handler', name: 'ServSafe Food Handler Certificate', description: 'Local Department of Health certification' },
      { id: 'sanitation_induction', name: 'Cleaning Chemical Safety (HAZMAT) Review', description: 'Safe chemical handling validation' }
    ],
    complianceChecklist: [
      'Uniform standards (black shoes, collared shirt) accepted',
      'Sanitation post briefing scheduled',
      'Break schedule aligned with state regulations'
    ],
    clientLiabilityTerms: 'Client holds food safety liability on site and provides high-temp disinfection equipment.'
  },
  {
    vertical: 'Healthcare',
    mandatoryCredentials: [
      { id: 'cna_license', name: 'State CNA / Care Provider License', description: 'Active clinical license board check' },
      { id: 'hipaa_cert', name: 'HIPAA Patient Privacy Certification', description: 'Standard medical protocol briefing verification' },
      { id: 'bls_cert', name: 'Basic Life Support (BLS) / CPR', description: 'American Heart Association certified first response' }
    ],
    complianceChecklist: [
      'Verified zero medical board restriction history',
      'Malpractice insurance supplement assigned on system',
      'Acknowledge worker never administers high-danger meds unmonitored'
    ],
    clientLiabilityTerms: 'Extreme Liability Separation: BlockLabor does not run clinical therapy. Worker acts under licensed facility supervision.'
  },
  {
    vertical: 'Events',
    mandatoryCredentials: [
      { id: 'crowd_briefing', name: 'Mass Assembly Crowd Protocol Cert', description: 'Crowd direction basic principles' },
      { id: 'radio_comms', name: 'Two-Way Radio Standard Operating Procedure', description: 'Simulated communication protocol' }
    ],
    complianceChecklist: [
      'Event site badge provisioning active',
      'Weather policy backup plan distributed',
      'Command center contacts directory synced'
    ],
    clientLiabilityTerms: 'Client retains primary public congregation event permit liability.'
  }
];
