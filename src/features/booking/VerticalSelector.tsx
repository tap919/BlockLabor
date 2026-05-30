import { VERTICALS } from '../../constants';

export function VerticalSelector({ selectedVertical, onSelect }: any) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#8E9299] uppercase tracking-wider mb-2">Business Vertical & Safety System</label>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {VERTICALS.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            className={`px-2 py-3 rounded text-xs font-bold transition-all border ${
              selectedVertical === v 
                ? 'bg-[#10B981] text-[#0F1115] border-[#10B981]' 
                : 'bg-[#1F232B] text-[#8E9299] border-[#373A43] hover:text-white'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
