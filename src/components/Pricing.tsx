import { PRICING_BLOCKS } from '../constants';
import { motion } from 'motion/react';
import { Check, ShieldCheck, Sparkles, Building2, Key } from 'lucide-react';

interface PricingViewProps {
  isEnterprise?: boolean;
}

export function PricingView({ isEnterprise = false }: PricingViewProps) {
  return (
    <div className="min-h-screen bg-[#0F1115] py-16 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-white mb-4">Pricing System</h1>
          <p className="text-[#8E9299] max-w-2xl mx-auto">
            Block-based pricing with built-in discounts for longer coverage. 
            You only pay for the time you rent. No hidden placement fees unless you opt for a permanent hire.
          </p>
        </div>

        {/* Current enterprise status badge */}
        {isEnterprise && (
          <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg max-w-lg mx-auto text-center flex items-center justify-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div className="text-left">
              <p className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Suite Active</p>
              <p className="text-[10px] text-zinc-400">All advanced multi-branch APIs, SSO credentials, and automation controls unlocked.</p>
            </div>
          </div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {PRICING_BLOCKS.map((block, index) => (
            <div 
              key={block.id} 
              className={`flex flex-col rounded-xl p-8 ${
                block.id === '8-hour' 
                  ? 'bg-[#1F232B] border border-[#10B981] relative shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-[#161920] border border-zinc-800'
              }`}
            >
              {block.id === '8-hour' && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#10B981] text-[#0F1115] px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                   Most Popular
                 </div>
              )}
              <h3 className="text-lg font-bold text-white uppercase tracking-wide">{block.label}</h3>
              <p className="text-[#8E9299] text-sm mt-2 flex-grow">{block.description}</p>
              
              <div className="mt-8 mb-6">
                <span className="text-4xl font-mono text-white font-bold">{block.clientRate}</span>
                <span className="text-[#63666F] text-sm ml-2">/ block</span>
              </div>

              <ul className="space-y-3 text-sm text-[#E0E0E6] mb-8">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#10B981]" /> Full contractor opt-in logic
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#10B981]" /> Scope of Work generator
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#10B981]" /> Standard liability waiver
                </li>
              </ul>
              
              <button className={`mt-auto w-full rounded py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                 block.id === '8-hour'
                   ? 'bg-[#10B981] text-[#0F1115] hover:bg-[#0ea5e9]'
                   : 'bg-[#2A2D35] text-white hover:bg-[#373A43]'
              }`}>
                Book Block
              </button>
            </div>
          ))}

          {/* New Custom Enterprise Plan Visual Box */}
          <div className={`p-8 rounded-xl flex flex-col relative transition-all border ${
            isEnterprise 
              ? 'bg-[#10B981]/10 border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
              : 'bg-[#10B9810b] border-[#10B98122]'
          }`}>
            <span className="absolute top-0 right-4 -translate-y-1/2 bg-indigo-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="h-2 w-2" /> CORPORATE
            </span>
            <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
              Enterprise Suite
            </h3>
            <p className="text-[#8E9299] text-xs mt-2 flex-grow">
              Ideal for multi-state, high-volume logistics, events, and hospital providers seeking advanced dispatch compliance.
            </p>
            
            <div className="mt-6 mb-6">
              <span className="text-3xl font-mono text-emerald-400 font-bold">Custom Volume</span>
              <span className="text-[#63666F] text-xs block mt-1 font-mono">Volume based 15% discount structure</span>
            </div>

            <ul className="space-y-2 text-xs text-[#E0E0E6] mb-6">
              <li className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-emerald-400" /> Multi-branch compliance centers
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Live AI candidate matching matrix
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400" /> Rate Card enforcement automation
              </li>
              <li className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-emerald-400" /> SAML SSO / Okta configurations
              </li>
            </ul>

            <div className="bg-black/35 p-3 rounded text-[10px] text-zinc-400 font-mono mb-4 border border-dashed border-zinc-700">
              {isEnterprise ? '✓ ACTIVE LICENSE' : '🔒 INACTIVE LICENSE GATE'}
            </div>

            <button className={`w-full rounded py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              isEnterprise 
                ? 'bg-[#10B981] text-[#0F1115] hover:bg-emerald-400' 
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
            }`}>
              {isEnterprise ? 'Licensed Suite Active' : 'Upgrade to Enterprise'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

