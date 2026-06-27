'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { 
  Rocket, 
  Brain, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Zap, 
  Target, 
  Layers, 
  Wrench, 
  Server, 
  Shield, 
  Activity, 
  ArrowRight, 
  CheckCircle2,
  Cpu,
  Globe,
  Database,
  LineChart,
  Terminal
} from 'lucide-react';
import { strategies, tools, Strategy, lifecycleSteps } from '@/lib/data';
import { Modal } from '@/components/modal';
import { ServicesPanel } from '@/components/services-panel';

export default function Home() {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<'details' | 'implementation' | 'architecture' | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  const openDetails = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setActiveModal('details');
  };

  const openImplementation = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setActiveModal('implementation');
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'zero': return 'bg-emerald-500 text-black';
      case 'low': return 'bg-amber-500 text-black';
      case 'medium': return 'bg-red-500 text-white';
      default: return 'bg-neutral-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 sm:p-10 rounded-2xl shadow-[0_8px_30px_rgb(16,185,129,0.2)] mb-12 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between"
        >
          <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
            <Rocket className="w-64 h-64" />
          </div>
          <div className="relative z-10 mb-6 md:mb-0">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight text-white drop-shadow-md flex items-center gap-4">
              <Rocket className="w-10 h-10" />
              OTM Agent - Out The Mud
            </h1>
            <p className="text-xl sm:text-2xl text-emerald-50 font-light max-w-2xl">
              AI-Powered Revenue Generation & Bootstrapping System
            </p>
          </div>
          <div className="relative z-10">
            <button 
              onClick={() => router.push('/console')}
              className="bg-neutral-950 hover:bg-black text-emerald-400 border border-emerald-500/50 font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgb(16,185,129,0.5)] flex items-center gap-3 text-lg"
            >
              <Terminal className="w-6 h-6" />
              Launch Agent Console
            </button>
          </div>
        </motion.header>

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {[
            { label: 'Active Strategies', value: '8', icon: Activity },
            { label: 'Zero Capital', value: '5', icon: Zap },
            { label: 'Est. Monthly Potential', value: '$5K-$15K', icon: TrendingUp },
            { label: 'Time to First Dollar', value: '24-72h', icon: Clock },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg flex items-start justify-between group"
            >
              <div>
                <div className="text-neutral-400 text-sm uppercase tracking-wider font-semibold mb-2">{stat.label}</div>
                <div className="text-3xl font-bold text-emerald-500">{stat.value}</div>
              </div>
              <div className="p-3 bg-neutral-800 rounded-lg text-emerald-500 group-hover:bg-emerald-500/10 transition-colors">
                <stat.icon className="w-6 h-6" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Strategies Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 pb-4 border-b-2 border-emerald-500/30 inline-flex items-center gap-3">
            <Target className="w-8 h-8 text-emerald-500" />
            Revenue Strategies
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {strategies.map((strategy, i) => (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden group hover:border-emerald-500/50 hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)] transition-all duration-300 flex flex-col"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300" />
                
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-emerald-400">{strategy.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getBadgeColor(strategy.badge.type)}`}>
                    {strategy.badge.text}
                  </span>
                </div>
                
                <p className="text-neutral-400 mb-6 leading-relaxed flex-grow">
                  {strategy.description}
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-6 pt-4 border-t border-neutral-800/50">
                  {strategy.metrics.map((metric, j) => (
                    <div key={j}>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">{metric.label}</div>
                      <div className="text-sm font-bold text-emerald-500">{metric.value}</div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3 mt-auto">
                  <button 
                    onClick={() => openDetails(strategy)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 hover:shadow-[0_0_15px_rgb(16,185,129,0.4)] flex items-center justify-center gap-2"
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => openImplementation(strategy)}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    Build <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Services Status Panel */}
        <div className="mb-16 p-6 bg-neutral-900 border border-neutral-800 rounded-xl">
          <ServicesPanel />
        </div>

        {/* Architecture & Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Architecture Summary */}
          <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-xl p-8 flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
              <Layers className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-4">OTM Architecture</h2>
            <p className="text-neutral-400 mb-8">
              Multi-agent system built on OpenClaw framework with specialized agents for each revenue stream.
            </p>
            <button 
              onClick={() => setActiveModal('architecture')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:shadow-[0_0_20px_rgb(16,185,129,0.3)]"
            >
              View Full Architecture
            </button>
          </div>

          {/* Tools Stack */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Wrench className="w-6 h-6 text-emerald-500" />
              Essential Tools Stack
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {tools.map((tool, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -2 }}
                  className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-700/50 hover:border-emerald-500/50 transition-colors text-center"
                >
                  <div className="font-semibold text-emerald-400 mb-1">{tool.name}</div>
                  <div className="text-xs text-neutral-400">{tool.purpose}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={activeModal === 'details'} onClose={() => setActiveModal(null)}>
        {selectedStrategy && (
          <div>
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Brain className="w-8 h-8 text-emerald-500" />
              {selectedStrategy.details.title}
            </h2>
            <div 
              className="prose prose-invert prose-emerald max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedStrategy.details.content }}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={activeModal === 'implementation'} onClose={() => setActiveModal(null)}>
        {selectedStrategy && (
          <div>
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
              <Rocket className="w-8 h-8 text-emerald-500" />
              {selectedStrategy.implementation.title}
            </h2>
            <p className="text-neutral-400 mb-8 text-lg">
              Follow these steps to implement this revenue strategy from zero to first dollar.
            </p>
            <div className="space-y-4 mb-8">
              {selectedStrategy.implementation.steps.map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-4 bg-neutral-800/50 p-4 rounded-lg border border-neutral-700/50"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold border border-emerald-500/30">
                    {i + 1}
                  </div>
                  <div className="pt-1 text-neutral-200">{step}</div>
                </motion.div>
              ))}
            </div>
            
            <div className="pt-6 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => router.push(`/console?strategy=${selectedStrategy.id}`)}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 px-8 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgb(16,185,129,0.4)] flex items-center gap-3"
              >
                <Terminal className="w-5 h-5" />
                Deploy Agents for this Strategy
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={activeModal === 'architecture'} onClose={() => setActiveModal(null)}>
        <div>
          <h2 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
            <Layers className="w-8 h-8 text-emerald-500" />
            OTM 7-Step Lifecycle
          </h2>
          <p className="text-neutral-400 mb-8 text-lg">
            The formal agentic framework for $0 capital ventures, ensuring systemic growth and risk mitigation.
          </p>
          
          <div className="space-y-4">
            {lifecycleSteps.map((step) => (
              <div key={step.step} className="p-5 bg-neutral-900/50 border border-neutral-800 rounded-xl flex gap-5 transition-all hover:border-emerald-500/30 group">
                <div className="text-3xl font-black text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors w-10 flex-shrink-0 pt-1">0{step.step}</div>
                <div>
                  <div className="font-bold text-emerald-500 mb-2 text-lg">{step.title}</div>
                  <p className="text-sm text-neutral-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-4">
            <Shield className="w-6 h-6 text-emerald-500" />
            <p className="text-sm text-neutral-400 italic">
              Human-centered decision loops integrated at Step 4 for maximum safety in live capital environments.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
