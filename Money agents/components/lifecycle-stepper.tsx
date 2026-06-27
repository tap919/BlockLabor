'use client';

import { Check, CircleDot, ChevronRight } from 'lucide-react';
import { lifecycleSteps } from '@/lib/data';

interface LifecycleStepperProps {
  currentStep: number;
}

export function LifecycleStepper({ currentStep }: LifecycleStepperProps) {
  return (
    <div className="w-full bg-neutral-900/50 border-b border-neutral-800 p-4 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max px-4">
        {lifecycleSteps.map((s, idx) => {
          const isCompleted = s.step < currentStep;
          const isActive = s.step === currentStep;

          return (
            <div key={s.step} className="flex items-center gap-2">
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                  isActive 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                    : isCompleted 
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-400' 
                      : 'bg-neutral-950 border-neutral-800 text-neutral-600'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <CircleDot className={`w-3.5 h-3.5 ${isActive ? 'animate-pulse' : ''}`} />
                )}
                <span className="text-xs font-bold whitespace-nowrap">
                  {s.step}. {s.title}
                </span>
              </div>
              {idx < lifecycleSteps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-neutral-800" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
