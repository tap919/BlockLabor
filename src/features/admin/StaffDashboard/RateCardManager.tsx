import { Dispatch, SetStateAction } from 'react';
import { RateCard } from '../../../shared/types/domain';

export interface RateCardManagerProps {
  rateCards: RateCard[];
  setRateCards: Dispatch<SetStateAction<RateCard[]>>;
}

export function RateCardManager({ rateCards, setRateCards }: RateCardManagerProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white">Rate Card Manager</h3>
      <div className="text-zinc-500 text-xs">Manage rate cards here. Count: {rateCards.length}</div>
    </div>
  );
}
