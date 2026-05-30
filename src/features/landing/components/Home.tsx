import { ArrowRight, CheckCircle2, ShieldCheck, Clock, Zap } from 'lucide-react';
import { VERTICALS } from '../../../constants';
import { ViewState } from '../../../components/common/Navigation';
import { motion } from 'motion/react';

interface HomeViewProps {
  setView: (view: ViewState) => void;
}

export function HomeView({ setView }: HomeViewProps) {
  return (
    <div className="bg-[#0F1115] min-h-screen">
      {/* Hero Section */}
      <section className="relative px-6 py-24 sm:py-32 lg:px-8 max-w-7xl mx-auto text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
        >
          <div className="hidden sm:mb-8 sm:flex sm:justify-center">
            <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-[#8E9299] ring-1 ring-[#2A2D35] hover:ring-[#373A43] bg-[#161920]">
              Not a temp agency. A transparent labor collective.{' '}
              <a href="#how-it-works" className="font-semibold text-[#10B981]">
                <span className="absolute inset-0" aria-hidden="true" />
                See how it works <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-white sm:text-6xl">
            Rent reliable labor by the <span className="text-[#10B981]">hour, shift, or week.</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-[#8E9299] max-w-2xl mx-auto">
            Scale your operations on-demand without the liability of employment. 
            We provide pre-vetted independent contractors for your core tasks.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={() => setView('book')}
              className="rounded px-4 py-2 text-xs font-bold text-black bg-white uppercase tracking-wide shadow-sm hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 flex items-center transition-colors"
            >
              Book Labor Now <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button onClick={() => setView('pricing')} className="text-sm font-semibold leading-6 text-[#8E9299] hover:text-white transition-colors">
              View Pricing <span aria-hidden="true">→</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* Value Prop Section */}
      <section className="bg-[#161920] border-t border-b border-[#2A2D35] py-24 sm:py-32" id="how-it-works">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-[10px] font-bold leading-7 text-[#10B981] uppercase tracking-widest">The Cleanest Model</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Zero recruiting overhead. Zero employee liability.
            </p>
            <p className="mt-6 text-lg leading-8 text-[#8E9299]">
              You rent the labor, you carry the standard commercial liability, we handle the marketplace. 
              Our block-based system keeps independent contractors independent while getting your work done.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col items-start bg-[#0F1115] p-8 rounded-xl border border-[#2A2D35]">
                <div className="rounded bg-[#1F232B] p-2 border border-[#373A43]">
                  <Clock className="h-6 w-6 text-[#10B981]" aria-hidden="true" />
                </div>
                <dt className="mt-4 font-bold text-white text-lg font-display uppercase tracking-wide">Block-Based Shifts</dt>
                <dd className="mt-2 text-sm leading-7 text-[#8E9299]">
                  Book from 1 hour to 1 month. You define the task category and start window, not exact micromanaged times, preserving 1099 compliance perfectly.
                </dd>
              </div>
              <div className="flex flex-col items-start bg-[#0F1115] p-8 rounded-xl border border-[#2A2D35]">
                <div className="rounded bg-[#1F232B] p-2 border border-[#373A43]">
                  <ShieldCheck className="h-6 w-6 text-[#10B981]" aria-hidden="true" />
                </div>
                <dt className="mt-4 font-bold text-white text-lg font-display uppercase tracking-wide">Clean Liability</dt>
                <dd className="mt-2 text-sm leading-7 text-[#8E9299]">
                  You carry standard workers comp and liability insurance. We provide the labor agreement and Scope of Work to maintain clear boundaries.
                </dd>
              </div>
              <div className="flex flex-col items-start bg-[#0F1115] p-8 rounded-xl border border-[#2A2D35]">
                <div className="rounded bg-[#1F232B] p-2 border border-[#373A43]">
                  <Zap className="h-6 w-6 text-[#10B981]" aria-hidden="true" />
                </div>
                <dt className="mt-4 font-bold text-white text-lg font-display uppercase tracking-wide">Automated Operations</dt>
                <dd className="mt-2 text-sm leading-7 text-[#8E9299]">
                  Our system handles booking, opt-in acceptance by contractors, clear SOW generation, and transparent payouts automatically.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center border border-[#2A2D35] bg-[#161920] rounded-xl p-12">
          <h2 className="text-3xl font-display font-bold tracking-tight text-white mb-8">What We Do</h2>
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {VERTICALS.map(vertical => (
              <span key={vertical} className="inline-flex items-center gap-x-2 text-sm text-[#E0E0E6] bg-[#0F1115] px-4 py-2 rounded border border-[#2A2D35] shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                {vertical}
              </span>
            ))}
          </div>
          <button onClick={() => setView('services')} className="text-sm font-semibold leading-6 text-[#8E9299] hover:text-white transition-colors">
            Learn more about our services <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
