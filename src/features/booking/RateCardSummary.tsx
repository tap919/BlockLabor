import { PRICING_BLOCKS } from '../../constants';

export function RateCardSummary({ selectedBlockId }: { selectedBlockId: string }) {
  const activeBlock = PRICING_BLOCKS.find(b => b.id === selectedBlockId) ?? PRICING_BLOCKS[0] ?? PRICING_BLOCKS[1]!;
  
  return (
    <div className="text-xs text-[#8E9299]">
      Estimating block charge: <span className="text-[#10B981] font-mono font-bold text-sm ml-1">{activeBlock.clientRate}</span>
    </div>
  );
}
