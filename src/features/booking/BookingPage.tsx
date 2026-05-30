import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { PRICING_BLOCKS, CATEGORIES_BY_VERTICAL, VERTICAL_WORKFLOWS } from '../../constants';
import { VerticalSelector } from './VerticalSelector';
import { BookingForm } from './BookingForm';
import { RateCardSummary } from './RateCardSummary';
import { CompliancePanel } from './CompliancePanel';
import { BookingSuccessCard } from './BookingSuccessCard';
import { calculateJobData } from './booking.utils';
import { BranchDivision, RateCard, VerticalType, BlockType } from '../../shared/types/domain';

interface BookingPageProps {
  onBookJob: (job: any) => void;
  setView: (view: string) => void;
  isEnterprise?: boolean;
  branches?: BranchDivision[];
  rateCards?: RateCard[];
}

export function BookingPage({ onBookJob, setView, isEnterprise = false, branches = [], rateCards = [] }: BookingPageProps) {
  const [values, setValues] = useState({
    businessName: '',
    location: '',
    selectedVertical: 'Light Industrial' as VerticalType,
    selectedCategory: '',
    selectedBlockId: '4-hour' as BlockType,
    selectedBranch: branches?.[0]?.name || '',
    startWindow: '',
    skillsText: ''
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState('');

  useEffect(() => {
    const cats = CATEGORIES_BY_VERTICAL[values.selectedVertical] || [];
    if (cats.length > 0) {
      setValues(prev => ({ ...prev, selectedCategory: cats[0] }));
    }
  }, [values.selectedVertical]);

  const activeWorkflow = VERTICAL_WORKFLOWS.find(v => v.vertical === values.selectedVertical) || VERTICAL_WORKFLOWS[0];
  const activeRateCard = rateCards?.find((rc: RateCard) => rc.vertical === values.selectedVertical && rc.category === values.selectedCategory);
  const activeBlock = PRICING_BLOCKS.find(b => b.id === values.selectedBlockId) || PRICING_BLOCKS[1];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const jobId = 'job-' + Math.floor(Math.random() * 1000 + 200);
    const newJob = calculateJobData(values, isEnterprise, activeRateCard, activeBlock, activeWorkflow, jobId);
    onBookJob(newJob);
    setLastCreatedId(jobId);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <BookingSuccessCard
        lastCreatedId={lastCreatedId}
        selectedVertical={values.selectedVertical}
        selectedCategory={values.selectedCategory}
        selectedBlockId={values.selectedBlockId}
        activeWorkflow={activeWorkflow}
        onReset={() => {
          setIsSubmitted(false);
          setValues({ ...values, businessName: '', location: '', startWindow: '', skillsText: '' });
        }}
        onGoToDashboard={() => setView('client')}
      />
    );
  }

  return (
    <div className="min-h-screen py-16 px-6 sm:px-8 bg-[#0F1115]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-white">Book Labor Block</h1>
          <p className="mt-2 text-[#8E9299] text-sm">Instantly deploy pre-vetted contractors. Select the business vertical for safety compliance filtering.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-[#161920] p-6 sm:p-8 rounded-xl border border-[#2A2D35]"
          >
            <VerticalSelector 
              selectedVertical={values.selectedVertical} 
              onSelect={(v: VerticalType) => setValues(prev => ({ ...prev, selectedVertical: v }))} 
            />
            
            <div className="mt-8">
              <BookingForm 
                values={values}
                setValues={setValues}
                isEnterprise={isEnterprise}
                branches={branches}
                activeRateCard={activeRateCard}
                onSubmit={handleSubmit}
                selectedVertical={values.selectedVertical}
              />
              <RateCardSummary selectedBlockId={values.selectedBlockId} />
            </div>
          </motion.div>

          <div className="space-y-6">
            <CompliancePanel activeWorkflow={activeWorkflow} selectedVertical={values.selectedVertical} />
          </div>
        </div>
      </div>
    </div>
  );
}
