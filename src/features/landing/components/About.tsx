import { ShieldCheck, Crosshair, Users, Mail } from 'lucide-react';
import { motion } from 'motion/react';

export function AboutView() {
  return (
    <div className="min-h-screen bg-[#0F1115] py-16 px-6 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-white mb-4">About BlockLabor</h1>
          <p className="text-[#8E9299]">A transparent, high-efficiency independent labor collective.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-8 sm:p-12">
            <h2 className="text-xl font-bold tracking-tight text-white mb-6">Our Mission</h2>
            <p className="text-[#E0E0E6] text-lg leading-relaxed">
              We started BlockLabor to solve the oldest problem in operations: unpredictable labor demands vs. rigid hiring constraints. 
              Temp agencies are expensive and slow. Full-time hiring carries immense liability and overhead. 
              We created a clean, compliant marketplace where businesses can rent independent contractors purely by the block.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-8">
              <div className="w-12 h-12 bg-[#3B82F622] text-[#3B82F6] rounded flex items-center justify-center mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">100% Compliant</h3>
              <p className="text-[#8E9299] text-sm leading-relaxed">
                We are not employers. We are a marketplace. We ensure all workers remain genuine 1099 independent contractors, completely eliminating your HR liability and keeping operations highly scalable.
              </p>
            </div>
            
            <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-8">
              <div className="w-12 h-12 bg-[#F59E0B22] text-[#F59E0B] rounded flex items-center justify-center mb-6">
                <Crosshair className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Focused Execution</h3>
              <p className="text-[#8E9299] text-sm leading-relaxed">
                By stripping away the red tape, our contractors opt-in to the scopes they want to perform. You get motivated operators matching your direct requirements exactly when you need them.
              </p>
            </div>
          </div>

          <div className="bg-[#1F232B] border border-[#373A43] rounded-xl p-8 text-center">
            <Users className="h-8 w-8 text-[#10B981] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-4">Join the Collective</h2>
            <p className="text-[#8E9299] mb-8 max-w-xl mx-auto">
              Whether you are a business looking for agile operational support, or a contractor looking for stable, opt-in work, we want to hear from you.
            </p>
            <div className="flex justify-center gap-4">
               <a href="mailto:contact@blocklabor.test" className="inline-flex items-center rounded bg-[#10B981] px-4 py-2 text-xs font-bold text-[#0F1115] uppercase tracking-wide hover:bg-[#0ea5e9] transition-colors">
                 <Mail className="mr-2 h-4 w-4" /> Get in touch
               </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
