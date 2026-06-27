import { Job, JobChecklistItem, BlockType, VerticalType } from '../../shared/types/domain';
import { PRICING_BLOCKS, CATEGORIES_BY_VERTICAL, VERTICAL_WORKFLOWS } from '../../constants';

export const calculateJobData = (
  values: any,
  isEnterprise: boolean,
  activeRateCard: any,
  activeBlock: any,
  activeWorkflow: any,
  jobId: string
) => {
  const { 
    businessName, 
    selectedVertical, 
    selectedCategory, 
    selectedBlockId, 
    startWindow, 
    location, 
    skillsText,
    selectedBranch 
  } = values;

  const skillsList = skillsText ? skillsText.split(',').map((s: string) => s.trim()) : ['General Assistance'];

  const checklist: JobChecklistItem[] = activeWorkflow.complianceChecklist.map((c: string, i: number) => ({
    id: `${jobId}-check-${i}`,
    text: c,
    completed: false
  }));

  checklist.unshift({ id: `${jobId}-check-init`, text: `Check in with site supervisor on arrival`, completed: false });
  checklist.push({ id: `${jobId}-check-final`, text: `Acquire supervisor timestamp approval signature`, completed: false });

  const hours = 
    selectedBlockId === '1-month' ? 160 :
    selectedBlockId === '1-week' ? 40 :
    selectedBlockId === '8-hour' ? 8 :
    selectedBlockId === '1-hour' ? 1 : 4;

  const payoutRate = isEnterprise && activeRateCard ? activeRateCard.standardPayRate : (activeBlock.value / 4);
  const billingRate = isEnterprise && activeRateCard ? activeRateCard.standardBillRate : (activeBlock.chargeVal / 4);

  const calculatedPayout = payoutRate * hours;
  const calculatedCharge = billingRate * hours;

  const fallbackCategory = CATEGORIES_BY_VERTICAL[selectedVertical]?.[0] ?? 'General Assistance';

  return {
    id: jobId,
    businessName: businessName || 'Anonymous Corp',
    vertical: selectedVertical,
    category: selectedCategory || fallbackCategory,
    blockType: selectedBlockId,
    startWindow: startWindow || 'Immediate Start Window',
    location: location || 'On Site Location Specified',
    requiredSkills: skillsList,
    status: 'open',
    payout: calculatedPayout,
    charge: calculatedCharge,
    createdAt: new Date().toISOString(),
    checklist,
    branchName: isEnterprise ? selectedBranch : undefined,
    payRate: payoutRate,
    billRate: billingRate,
    markup: Math.round(((billingRate - payoutRate) / payoutRate) * 100)
  };
};
