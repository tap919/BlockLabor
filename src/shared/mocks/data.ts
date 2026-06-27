import { Job, WorkerCandidate, IntegrationSetting, SystemLog, PartnerVendor, IncidentReport, BranchDivision, RateCard, SsoConfig, AdminPermissions } from '../../shared/types/domain';

export const mockJobs: Job[] = [
  {
    id: 'job-101',
    businessName: 'Apex Materials Inc',
    vertical: 'Light Industrial',
    category: 'Warehouse Packing',
    blockType: '4-hour',
    startWindow: 'Tomorrow, Afternoon (2 PM - 6 PM)',
    location: 'Downtown Warehouse D-12',
    requiredSkills: ['Forklift Certified', 'Lifting 50lbs', 'Barcode Scanning'],
    status: 'open',
    payout: 100,
    charge: 130,
    createdAt: new Date().toISOString(),
    checklist: [
      { id: '1', text: 'Wear safety vest and steel-toe boots', completed: true },
      { id: '2', text: 'Complete morning supervisor forklift induction safety checklist', completed: false },
      { id: '3', text: 'Strap and sort pallet row A to G', completed: false }
    ],
    headcount: 2,
    billRate: 32.5,
    payRate: 25.0,
    markup: 30,
    hoursPerShift: 4,
    durationShifts: 1,
    locationName: 'Downtown Warehouse D-12',
    shiftStartTime: '14:00',
    shiftEndTime: '18:00',
    recruiterId: 'rec-01',
    recruiterName: 'Sonia K.',
    branchName: 'Dallas Logistics',
    stateCode: 'TX',
    invoiceTermDays: 30,
    verificationStatus: 'pending',
    applicationResponseSLA: null,
  },
  {
    id: 'job-102',
    businessName: 'Summit General Hospital',
    vertical: 'Healthcare',
    category: 'Nursing Assistant (CNA) Support',
    blockType: '8-hour',
    startWindow: 'This Saturday, Day (7 AM - 3 PM)',
    location: 'West Wing Ward B, Room 4',
    requiredSkills: ['CNA License', 'HIPAA Certified', 'BLS certified'],
    status: 'open',
    payout: 190,
    charge: 250,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    checklist: [
      { id: '1', text: 'Check in with nursing supervisor for wing B', completed: false },
      { id: '2', text: 'Complete patient lift protocols training waiver signoff', completed: false },
      { id: '3', text: 'Update digital intake database log', completed: false }
    ],
    headcount: 1,
    billRate: 31.25,
    payRate: 23.75,
    markup: 31.5,
    hoursPerShift: 8,
    durationShifts: 1,
    locationName: 'West Wing Clinic Site',
    shiftStartTime: '07:00',
    shiftEndTime: '15:00',
    recruiterId: 'rec-02',
    recruiterName: 'David L.',
    branchName: 'Houston East',
    stateCode: 'TX',
    invoiceTermDays: 15,
    verificationStatus: 'pending',
    applicationResponseSLA: null,
  },
  {
    id: 'job-103',
    businessName: 'Vanguard Events Corp',
    vertical: 'Events',
    category: 'Event Ticket Scanner',
    blockType: '4-hour',
    startWindow: 'Today, Evening (5 PM - 9 PM)',
    location: 'Convention Center Pavilion A',
    requiredSkills: ['Customer Service', 'Smartphone ticket scanning experience'],
    status: 'accepted',
    payout: 100,
    charge: 130,
    contractorId: 'c-001',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    checklist: [
      { id: '1', text: 'Obtain Motorola Ticket Scanner and align badge scanner system', completed: true },
      { id: '2', text: 'Review crowd flow bypass gates procedure', completed: true },
      { id: '3', text: 'Complete wristband distribution instructions review', completed: false }
    ],
    timesheet: {
      checkInTime: new Date(Date.now() - 7200000).toISOString(),
      gpsVerified: true,
      notes: 'Checked in on-site. Crowds are already pouring in.'
    },
    headcount: 3,
    billRate: 32.5,
    payRate: 25.0,
    markup: 30,
    hoursPerShift: 4,
    durationShifts: 1,
    locationName: 'Pavilion Arena Site',
    shiftStartTime: '17:00',
    shiftEndTime: '21:00',
    recruiterId: 'rec-03',
    recruiterName: 'Elisa M.',
    branchName: 'San Francisco Main',
    stateCode: 'CA',
    invoiceTermDays: 30,
    verificationStatus: 'pending',
    applicationResponseSLA: null,
  },
  {
    id: 'job-104',
    businessName: 'Downtown Legal Group',
    vertical: 'Clerical',
    category: 'Data Entry backlog',
    blockType: '1-week',
    startWindow: 'Starting Next Monday',
    location: 'Financial District Tower, Suite 400',
    requiredSkills: ['Wordpress', 'Data Typing', 'Sensitive records protocol'],
    status: 'completed',
    payout: 935, // regular hours (40 * 21.25 = 850) + overtime (4 * 21.25 * 1.5 = 127.5 - deductions/withholding adjustments inside)
    charge: 1254, // bill hours regular (40 * 27.5 = 1100) + billing overtime (4 * 27.5 * 1.4 = 154 multiplier terms)
    contractorId: 'c-001',
    createdAt: new Date(Date.now() - 432000000).toISOString(),
    checklist: [
      { id: '1', text: 'Review secure terminal guidelines & NDA sign-off parameters', completed: true },
      { id: '2', text: 'Batch enter legacy 2025 archival indexes', completed: true },
      { id: '3', text: 'Verify metadata accuracy for indexed client folders', completed: true }
    ],
    timesheet: {
      checkInTime: new Date(Date.now() - 432000000).toISOString(),
      checkOutTime: new Date(Date.now() - 345600000).toISOString(),
      gpsVerified: true,
      notes: 'Finished early! Excel records matching is complete.',
      workerSignature: 'Marcus Hayes',
      clientSignatureName: 'Eleanor Vance (Office Partner)'
    },
    headcount: 1,
    billRate: 27.5,
    payRate: 21.25,
    markup: 29.4,
    hoursPerShift: 40,
    durationShifts: 1,
    locationName: 'Downtown Office HQ',
    shiftStartTime: '09:00',
    shiftEndTime: '17:00',
    recruiterId: 'rec-01',
    recruiterName: 'Sonia K.',
    branchName: 'New York Corporate',
    stateCode: 'NY',
    invoiceTermDays: 45,
    shiftHours: 44, // 4 hours over standard 40
    overtimeHours: 4,
    expensesCaptured: [
      { id: 'exp-101', amount: 35.00, description: 'Client office parking pass', status: 'approved' },
      { id: 'exp-102', amount: 15.50, description: 'Archival index folder tabs', status: 'approved' }
    ],
    deductionsCaptured: [
      { id: 'ded-101', amount: 12.00, description: 'Uniform safety security badge' }
    ],
    verificationStatus: 'pending',
    applicationResponseSLA: null,
  },
  {
    id: 'job-105',
    businessName: 'Stellar Catering & Events',
    vertical: 'Hospitality',
    category: 'Banquet Server',
    blockType: '8-hour',
    startWindow: 'Last Night (4 PM - 12 AM)',
    location: 'Metropolitan Ball Room',
    requiredSkills: ['Food Handler Certificate', 'Fine dining serving skill'],
    status: 'paid',
    payout: 190,
    charge: 250,
    contractorId: 'c-002',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    checklist: [
      { id: '1', text: 'Verify sanitation certificate at door', completed: true },
      { id: '2', text: 'Table serving course coordination briefing', completed: true },
      { id: '3', text: 'Post-cleanup and tray return complete', completed: true }
    ],
    timesheet: {
      checkInTime: new Date(Date.now() - 172800000).toISOString(),
      checkOutTime: new Date(Date.now() - 144000000).toISOString(),
      gpsVerified: true,
      notes: 'All tips split nicely. Work finished flawlessly.',
      workerSignature: 'Sarah Lin',
      clientSignatureName: 'Thomas Granger (Banquet Mgr)'
    },
    headcount: 4,
    billRate: 31.25,
    payRate: 23.75,
    markup: 31.5,
    hoursPerShift: 8,
    durationShifts: 1,
    locationName: 'Main Ballroom Venue',
    shiftStartTime: '16:00',
    shiftEndTime: '24:00',
    recruiterId: 'rec-02',
    recruiterName: 'David L.',
    branchName: 'Dallas Logistics',
    stateCode: 'TX',
    invoiceTermDays: 30,
    shiftHours: 8,
    overtimeHours: 0,
    verificationStatus: 'pending',
    applicationResponseSLA: null
  }
];

export const mockCandidates: WorkerCandidate[] = [
  {
    id: 'c-001',
    name: 'Marcus Hayes',
    email: 'marcus.hayes@contractor.test',
    phone: '(555) 438-9011',
    skills: ['OSHA Driving', 'Heavy Lifting', 'Data Typing'],
    verticals: ['Light Industrial', 'Clerical', 'Events'],
    totalEarned: 3450,
    status: 'active',
    backgroundCheckStatus: 'passed',
    eSignStatus: 'signed',
    verifiedCredentials: ['forklift_cert', 'heavy_lifting_waiver', 'typing_speed'],
    workerVerificationStatus: 'pending',
    weeklyAvailability: { Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false, Sunday: false },
    shiftPreferences: ['morning', 'afternoon'],
    payOption: 'direct_deposit',
    directDepositDetail: { bankName: 'Chase Bank', routing: '021000021', account: '*****4389' },
    profileUpdated: true,
    stateCode: 'CA',
    recruiterName: 'Sonia K.',
    branchName: 'San Francisco Main',
    performanceScore: 94,
    timeToOnboardDays: 4,
    noShowCount: 0,
    isRedeployed: true,
    documents: [
      { id: 'doc-1', name: 'US_Passport_Verification.pdf', type: 'I-9 Identification', status: 'verified', expirationDate: '2030-12-01', uploadedAt: '12-05', description: 'Form I-9 identity qualification checked' },
      { id: 'doc-2', name: 'W4_Employee_Withholding.pdf', type: 'W-4 Form Verification', status: 'verified', uploadedAt: '12-05', description: 'Internal Revenue tax form' },
      { id: 'doc-3', name: 'Forklift_OSHA_License.pdf', type: 'Professional License', status: 'verified', expirationDate: '2026-08-30', uploadedAt: '2026-02-15', description: 'Class IV forklift operating authorization' },
      { id: 'doc-10', name: 'Voided_Check_Deposit.pdf', type: 'Direct Deposit Authorization', status: 'verified' }
    ],
    messages: [
      { id: 'm-1', sender: 'Support Recruiter', text: 'Hi Marcus, your background checks have cleared! Please verify your direct deposit preferences.', timestamp: new Date(Date.now() - 345600000).toISOString() },
      { id: 'm-2', sender: 'Schedule Dispatcher', text: 'You have been assigned to Vanguard Events ticket scanner shift. Please confirm.', timestamp: new Date(Date.now() - 86400000).toISOString() }
    ],
    reliabilityScore: 98,
    attendanceRate: 100,
    punctualityRate: 97,
    completionRate: 100,
    clientRatingClass: 'A+'
  },
  {
    id: 'c-002',
    name: 'Sarah Lin',
    email: 'sarah.lin@contractor.test',
    phone: '(555) 902-1244',
    skills: ['Banquet Service', 'Sanitation Safety', 'Basic Intake Support'],
    verticals: ['Hospitality', 'Healthcare'],
    totalEarned: 190,
    status: 'active',
    backgroundCheckStatus: 'passed',
    eSignStatus: 'signed',
    verifiedCredentials: ['food_handler', 'sanitation_induction', 'bls_cert', 'hipaa_cert'],
    workerVerificationStatus: 'pending',
    weeklyAvailability: { Monday: true, Tuesday: false, Wednesday: true, Thursday: false, Friday: true, Saturday: true, Sunday: true },
    shiftPreferences: ['afternoon', 'night'],
    payOption: 'pay_card',
    payCardDetail: { cardNumber: '**** **** **** 8821', provider: 'RapidPay Visa Card' },
    profileUpdated: true,
    stateCode: 'TX',
    recruiterName: 'David L.',
    branchName: 'Dallas Logistics',
    performanceScore: 98,
    timeToOnboardDays: 3,
    noShowCount: 0,
    isRedeployed: true,
    documents: [
      { id: 'doc-4', name: 'I9_Identity_Card.pdf', type: 'I-9 Identification', status: 'verified', expirationDate: '2029-05-18', uploadedAt: '2026-02-01', description: 'Form I-9 compliance file' },
      { id: 'doc-11', name: 'W4_IRS_Form.pdf', type: 'W-4 Form Verification', status: 'verified', uploadedAt: '2026-02-01' },
      { id: 'doc-5', name: 'ServSafe_FoodHandler_2026.pdf', type: 'Food safety certificate', status: 'verified', expirationDate: '2026-11-20', uploadedAt: '2026-02-14', description: 'ServSafe sanitation clearance' },
      { id: 'doc-6', name: 'CNA_State_License.pdf', type: 'Professional License', status: 'verified', expirationDate: '2026-12-31', uploadedAt: '2026-02-18', description: 'Nurses Aide practicing certificate' },
      { id: 'doc-7', name: 'American_RedCross_CPR.pdf', type: 'Safety Certification', status: 'expired', expirationDate: '2026-04-10', uploadedAt: '2024-04-10', description: 'Cardiopulmonary CPR credential, expired state' }
    ],
    messages: [
      { id: 'm-3', sender: 'System Verification', text: 'Your CNA credential status has been automatically verified via Gusto integrate.', timestamp: new Date(Date.now() - 432000000).toISOString() }
    ],
    reliabilityScore: 99,
    attendanceRate: 100,
    punctualityRate: 98,
    completionRate: 100,
    clientRatingClass: 'A+'
  },
  {
    id: 'c-003',
    name: 'Carlos Mendez',
    email: 'carlos.mendez@applicant.test',
    phone: '(555) 283-9900',
    skills: ['Warehouse Stacking', 'Event Greeting'],
    verticals: ['Light Industrial', 'Events'],
    totalEarned: 0,
    status: 'onboarded',
    backgroundCheckStatus: 'passed',
    eSignStatus: 'signed',
    verifiedCredentials: ['heavy_lifting_waiver'],
    workerVerificationStatus: 'pending',
    weeklyAvailability: { Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true, Sunday: false },
    shiftPreferences: ['morning', 'night'],
    payOption: 'direct_deposit',
    directDepositDetail: { bankName: 'Well Fargo', routing: '121000248', account: '*****1102' },
    profileUpdated: true,
    stateCode: 'TX',
    recruiterName: 'Sonia K.',
    branchName: 'Houston East',
    performanceScore: 88,
    timeToOnboardDays: 5,
    noShowCount: 1,
    isRedeployed: false,
    documents: [
      { id: 'doc-8', name: 'Driver_License_Validation.pdf', type: 'State ID', status: 'verified', expirationDate: '2028-09-12', uploadedAt: '2026-03-01' },
      { id: 'doc-9', name: 'W4_Mendez_Final.pdf', type: 'W-4 Form Verification', status: 'verified', uploadedAt: '2026-03-02' },
      { id: 'doc-12', name: 'Section_2_Employer_Verification.pdf', type: 'I-9 Identification', status: 'pending', uploadedAt: '2026-05-25', description: 'Awaiting backoffice signature matching' }
    ],
    messages: [
      { id: 'm-4', sender: 'Staff Sourcing', text: 'Hi Carlos, we ready for your first booking block. Click "Accept" when scheduler alerts you!', timestamp: new Date(Date.now() - 172800000).toISOString() }
    ],
    reliabilityScore: 84,
    attendanceRate: 90,
    punctualityRate: 85,
    completionRate: 95,
    clientRatingClass: 'B'
  },
  {
    id: 'c-004',
    name: 'Drina Joshi',
    email: 'drina.j@intake.test',
    phone: '(555) 817-2711',
    skills: ['Clinics Intake', 'CPR First Aid', 'Patient Transport'],
    verticals: ['Healthcare'],
    totalEarned: 0,
    status: 'screening',
    backgroundCheckStatus: 'pending',
    eSignStatus: 'sent',
    verifiedCredentials: ['bls_cert'],
    workerVerificationStatus: 'pending',
    weeklyAvailability: { Monday: false, Tuesday: true, Wednesday: false, Thursday: true, Friday: false, Saturday: false, Sunday: false },
    shiftPreferences: ['morning'],
    payOption: 'direct_deposit',
    profileUpdated: false,
    stateCode: 'NY',
    recruiterName: 'Elisa M.',
    branchName: 'New York Corporate',
    performanceScore: 82,
    timeToOnboardDays: 14,
    noShowCount: 0,
    isRedeployed: false,
    documents: [
      { id: 'doc-13', name: 'Draft_BLS_Waiver.pdf', type: 'Safety Certification', status: 'pending', uploadedAt: '2026-05-20', description: 'Advanced Basic Life Support certificate' }
    ],
    messages: [
      { id: 'm-5', sender: 'Onboarding Helpdesk', text: 'We noticed your background check is still pending. We will alert Checkr to expedite.', timestamp: new Date(Date.now() - 86400000).toISOString() }
    ],
    reliabilityScore: 92,
    attendanceRate: 95,
    punctualityRate: 91,
    completionRate: 100,
    clientRatingClass: 'A'
  },
  {
    id: 'c-005',
    name: 'Jeremy Croft',
    email: 'jeremy.croft@newworker.test',
    phone: '(555) 728-1110',
    skills: ['Clerical backlog sorting', 'Document Archiving'],
    verticals: ['Clerical'],
    totalEarned: 0,
    status: 'applied',
    backgroundCheckStatus: 'not_started',
    eSignStatus: 'unsigned',
    verifiedCredentials: [],
    weeklyAvailability: { Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false, Sunday: false },
    shiftPreferences: ['morning', 'afternoon'],
    payOption: 'direct_deposit',
    profileUpdated: false,
    stateCode: 'CA',
    recruiterName: 'Elisa M.',
    branchName: 'San Francisco Main',
    performanceScore: 70,
    timeToOnboardDays: 1,
    noShowCount: 2,
    isRedeployed: false,
    documents: [],
    messages: [
      { id: 'm-6', sender: 'System Automated Onboarding', text: 'Welcome to BlockLabor! Please review and sign your 1099 independent contractor handbook via docusign.', timestamp: new Date(Date.now() - 1800000).toISOString() }
    ],
    reliabilityScore: 68,
    attendanceRate: 75,
    punctualityRate: 65,
    completionRate: 80,
    clientRatingClass: 'C'
  }
];

export const mockIntegrations: IntegrationSetting[] = [
  {
    id: 'int-gusto',
    name: 'Gusto (Payroll & W9/1099 sync)',
    category: 'payroll',
    status: 'connected',
    apiKey: '**********_gusto_live_4102',
    webhookUrl: 'https://blocklabor.api/webhooks/gusto-payout',
    lastSync: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'int-qbo',
    name: 'QuickBooks Online (Invoicing & Accounts)',
    category: 'accounting',
    status: 'connected',
    apiKey: '**********_qbo_auth_773',
    webhookUrl: 'https://blocklabor.api/webhooks/qbo-sync',
    lastSync: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'int-checkr',
    name: 'Checkr (Background Check Platform)',
    category: 'background_checks',
    status: 'connected',
    apiKey: '**********_checkr_dev_8891',
    webhookUrl: 'https://blocklabor.api/webhooks/checkr-updates',
    lastSync: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'int-docusign',
    name: 'DocuSign (e-Sign 1099 Agreements)',
    category: 'signature',
    status: 'connected',
    apiKey: '**********_docusign_auth_2120',
    webhookUrl: 'https://blocklabor.api/webhooks/docusign-signatures',
    lastSync: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'int-indeed',
    name: 'Indeed Sync (Automated Sourcing API)',
    category: 'job_boards',
    status: 'disconnected',
    lastSync: 'Never'
  },
  {
    id: 'int-workday',
    name: 'Workday HRIS Bridge',
    category: 'hris',
    status: 'disconnected',
    lastSync: 'Never'
  }
];

export const initialLogs: SystemLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    category: 'payroll',
    message: '[QuickBooks] Automatically matched and closed invoice #INV-J105 for Stellar Catering ($250)',
    type: 'success'
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 150000000).toISOString(),
    category: 'payroll',
    message: '[Gusto] Prepared contractor 1099 direct deposit payout authorization of $190 to Sarah Lin',
    type: 'success'
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 90000000).toISOString(),
    category: 'scheduler',
    message: '[Schedule Engine] Automated check-in dispatch notification triggered via Twilio SMS to Marcus Hayes',
    type: 'sms'
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 43200000).toISOString(),
    category: 'recruiter',
    message: '[Checkr API] Background Check result for Carlos Mendez changed to Status: PASSED',
    type: 'success'
  },
  {
    id: 'log-5',
    timestamp: new Date(Date.now() - 36000000).toISOString(),
    category: 'recruiter',
    message: '[DocuSign Webhook] Independent Contractor 1099 Agreement signed by Carlos Mendez',
    type: 'success'
  },
  {
    id: 'log-6',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    category: 'scheduler',
    message: '[Schedule Board] Customer Vanguard Events requested a 4-hour Ticket Scanner block on system',
    type: 'info'
  }
];

export const mockPartnerVendors: PartnerVendor[] = [
  {
    id: 'v-001',
    name: 'Apex Labor Suppliers Inc',
    contactName: 'James Caan',
    email: 'james.caan@apexsuppliers.test',
    phone: '(555) 781-8022',
    verticals: ['Light Industrial', 'Clerical'],
    markupShare: 0.12,
    status: 'active',
    assignedJobsCount: 1,
    insuranceExpiry: '2027-01-15',
    taxId: 'XX-XXXX901'
  },
  {
    id: 'v-002',
    name: 'Elite Hospitality Partners',
    contactName: 'Helena Bonham',
    email: 'helena@elitehospitality.test',
    phone: '(555) 912-4040',
    verticals: ['Hospitality', 'Events'],
    markupShare: 0.15,
    status: 'active',
    assignedJobsCount: 0,
    insuranceExpiry: '2026-12-01',
    taxId: 'XX-XXXX414'
  },
  {
    id: 'v-003',
    name: 'MedForce Healthcare Staffing',
    contactName: 'Marcus Welby',
    email: 'welby@medforce.test',
    phone: '(555) 811-9290',
    verticals: ['Healthcare'],
    markupShare: 0.18,
    status: 'suspended',
    assignedJobsCount: 0,
    insuranceExpiry: '2026-04-10', // expired
    taxId: 'XX-XXXX551'
  }
];

export const mockIncidentReports: IncidentReport[] = [
  {
    id: 'inc-01',
    jobId: 'job-103',
    businessName: 'Vanguard Events Corp',
    contractorId: 'c-001',
    contractorName: 'Marcus Hayes',
    reportedBy: 'client',
    category: 'safety',
    severity: 'medium',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    description: 'Minor dispute: Event scanner was placed near the direct sunlight gate. Replaced and re-oriented safety equipment.',
    status: 'resolved',
    resolutionNotes: 'Site manager Eleanor Vance confirmed the scanner setup is now safe.'
  }
];

export const mockBranches: BranchDivision[] = [
  { id: 'br-01', name: 'Downtown Austin Logistics', city: 'Austin', manager: 'Sonia K.', marginTarget: 28, activeJobsCount: 4, activeWorkersCount: 6 },
  { id: 'br-02', name: 'New York Wall Street HQ', city: 'New York', manager: 'David L.', marginTarget: 32, activeJobsCount: 3, activeWorkersCount: 5 },
  { id: 'br-03', name: 'Miami West Port Hub', city: 'Miami', manager: 'Elisa M.', marginTarget: 30, activeJobsCount: 2, activeWorkersCount: 3 },
  { id: 'br-04', name: 'Denver Healthcare Wing', city: 'Denver', manager: 'Laura V.', marginTarget: 35, activeJobsCount: 3, activeWorkersCount: 4 }
];

export const mockRateCards: RateCard[] = [
  { id: 'rc-01', vertical: 'Light Industrial', category: 'Warehouse Packing', standardBillRate: 35, standardPayRate: 25, customClientMarkupPercent: 40 },
  { id: 'rc-02', vertical: 'Light Industrial', category: 'Assembly Line Helper', standardBillRate: 38, standardPayRate: 27, customClientMarkupPercent: 40.7 },
  { id: 'rc-03', vertical: 'Clerical', category: 'Data Entry backlog', standardBillRate: 30, standardPayRate: 21, customClientMarkupPercent: 42.8 },
  { id: 'rc-04', vertical: 'Clerical', category: 'Document Scanning', standardBillRate: 28, standardPayRate: 20, customClientMarkupPercent: 40 },
  { id: 'rc-05', vertical: 'Hospitality', category: 'Room Turnover Cleaner', standardBillRate: 32, standardPayRate: 23, customClientMarkupPercent: 39.1 },
  { id: 'rc-06', vertical: 'Hospitality', category: 'Dishwasher / Kitchen Utility', standardBillRate: 28, standardPayRate: 20, customClientMarkupPercent: 40 },
  { id: 'rc-07', vertical: 'Healthcare', category: 'Nursing Assistant (CNA) Support', standardBillRate: 45, standardPayRate: 32, customClientMarkupPercent: 40.6 },
  { id: 'rc-08', vertical: 'Healthcare', category: 'Medical Intake Assistant', standardBillRate: 40, standardPayRate: 28, customClientMarkupPercent: 42.8 },
  { id: 'rc-09', vertical: 'Events', category: 'Event Ticket Scanner', standardBillRate: 32, standardPayRate: 22, customClientMarkupPercent: 45.4 },
  { id: 'rc-10', vertical: 'Events', category: 'Stage Helper', standardBillRate: 35, standardPayRate: 24, customClientMarkupPercent: 45.8 }
];

export const defaultSsoConfig: SsoConfig = {
  id: 'sso-01',
  provider: 'Okta',
  domain: 'enterprise.blocklabor.okta.com/sso',
  enabled: true,
  activeDirectoryGroup: 'BlockLabor-Enterprise-Group',
  lastSyncDate: new Date().toISOString()
};

export const defaultPermissions: AdminPermissions[] = [
  { id: 'perm-01', roleName: 'System Administrator (SAML)', canEditRateCards: true, canApprovePayroll: true, canVerifyDocs: true, canDeployDispatches: true, canManageBranches: true },
  { id: 'perm-02', roleName: 'Branch Scheduler', canEditRateCards: false, canApprovePayroll: false, canVerifyDocs: true, canDeployDispatches: true, canManageBranches: false },
  { id: 'perm-03', roleName: 'Recruiter / Compliance Auditor', canEditRateCards: false, canApprovePayroll: false, canVerifyDocs: true, canDeployDispatches: false, canManageBranches: false },
  { id: 'perm-04', roleName: 'Financial / Payroll Specialist', canEditRateCards: true, canApprovePayroll: true, canVerifyDocs: false, canDeployDispatches: false, canManageBranches: false }
];

