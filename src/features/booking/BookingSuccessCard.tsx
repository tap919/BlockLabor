import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileSignature } from 'lucide-react';
import { PRICING_BLOCKS, VERTICAL_WORKFLOWS } from '../../constants';

export function BookingSuccessCard({
  lastCreatedId,
  selectedVertical,
  selectedCategory,
  selectedBlockId,
  activeWorkflow,
  onReset,
  onGoToDashboard
}: any) {
  const activeBlock = PRICING_BLOCKS.find(b => b.id === selectedBlockId) || PRICING_BLOCKS[1];

  return (
    <div className="min-h-screen py-24 px-6 sm:px-8 bg-[#0F1115] flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-[#161920] p-8 rounded-xl border border-[#2A2D35]"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#10B98133] mb-6">
            <FileSignature className="h-8 w-8 text-[#10B981]" />
          </div>
          <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Block Requested Successfully</h2>
          <p className="text-[#8E9299] text-sm max-w-md mx-auto mb-6">
            Your labor block is published to dispatch! A 1099 compliant Scope of Work has been compiled for your review.
          </p>
        </div>

        <div className="bg-[#1F232B] p-6 rounded-lg text-sm border border-[#373A43] mb-8 space-y-4">
          <div className="flex justify-between border-b border-[#2A2D35] pb-2 text-xs font-mono">
            <span className="text-[#8E9299]">JOB TRACKING ID:</span>
            <span className="text-white font-bold">{lastCreatedId}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#8E9299] uppercase tracking-wider block">Vertical / Category:</span>
              <span className="text-white font-bold block">{selectedVertical} — {selectedCategory}</span>
            </div>
            <div>
              <span className="text-[#8E9299] uppercase tracking-wider block">Block Booking:</span>
              <span className="text-white font-bold block">{activeBlock.label} ({activeBlock.clientRate})</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#2A2D35]">
            <span className="text-xs uppercase tracking-wider text-[#10B981] font-bold block mb-1">Interactive Compliance Waiver:</span>
            <p className="text-[#8E9299] text-xs italic">
              "{activeWorkflow.clientLiabilityTerms}"
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={onReset}
            className="rounded bg-[#1F232B] border border-[#373A43] px-4 py-3 text-xs font-bold text-white uppercase tracking-wide hover:bg-[#2A2D35] transition-colors"
          >
            Request Another Block
          </button>
          <button 
            onClick={onGoToDashboard}
            className="rounded bg-[#10B981] px-4 py-3 text-xs font-bold text-[#0F1115] uppercase tracking-wide hover:bg-[#0ea5e9] transition-colors text-center"
          >
            Go to Client Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
