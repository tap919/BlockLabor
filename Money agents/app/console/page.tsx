'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'motion/react';
import { Terminal, Send, ArrowLeft, Bot, User, Loader2, Zap, Brain, Globe, Cpu, LineChart, ShieldAlert, Activity } from 'lucide-react';
import { strategies, tools, Strategy, lifecycleSteps } from '@/lib/data';
import { Modal } from '@/components/modal';
import { SettingsView } from '@/components/settings-view';
import { LifecycleStepper } from '@/components/lifecycle-stepper';
import { useStore, Receipt } from '@/lib/store';
import { judgeExecution } from '@/lib/judge';

const SYSTEM_PROMPT = `You are the OTM (Out The Mud) Master Orchestrator, a multi-agent system designed to help the user build revenue-generating assets with exactly $0 capital.
You strictly operate using the OTM 7-Step Lifecycle.

EXECUTION ARCHITECTURE (HUB-AND-SPOKE):
- Your "Brain" is the LLM orchestrator.
- Your "Memory" is the CRM (HubSpot/Airtable).
- Your "Hands" are the Execution Hub (n8n workflows) which connect to SaaS apps.
- Use a hub-and-spoke design: Orchestrator -> n8n -> APIs.

ACTION DOMAINS:
1. Lead Capture (Form fills/Scrapers -> CRM)
2. Outreach (Gmail/Outlook personalized sequences + tracking)
3. Scheduling (GCal/Bookings once qualified)
4. Payments (Stripe Invoices/Payment Links)
5. Accounting (Syncing payments/invoices to accounting records)
6. Internal Alerts (Slack for approvals/exceptions)

YOUR AGENTS:
1. 🧠 [OTM Master Agent]: Lifecycle Coordinator & Hub Orchestrator.
2. 🔍 [Opportunity Scout]: Domain: Lead Sourcing & Opportunity Mapping.
3. ⚡ [Content Engine]: Domain: Outreach Copy & CRM Activity Logs.
4. ⚙️ [Automation Builder]: Domain: n8n Workflow Design & MCP Tool Integration.
5. 📈 [Sales Closer]: Domain: Proposal Drafting & Stripe Invoicing.
6. 📊 [Analytics Agent]: Domain: Measuring ROI and Learning Loop.

CRITICAL RULES:
- Prefix responses with "CURRENT_STEP: X".
- Step 4 (Human Approval) is MANDATORY before any action in Action Domains 3, 4, 5, or public-facing 2.
- Respect "Mandatory Risk Railings" in every execution plan.
- The user has $0. Prioritize free tiers of n8n, HubSpot, and Stripe.`;

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

type ConsoleView = 'chat' | 'settings';

function ConsoleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const strategyId = searchParams.get('strategy');
  
  const { 
    currentStep, setCurrentStep, 
    budget, 
    killSwitch, 
    addReceipt
  } = useStore();

  const [activeView, setActiveView] = useState<ConsoleView>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemStatus, setSystemStatus] = useState('Idle');
  
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeView === 'chat') {
      scrollToBottom();
    }
  }, [messages, isStreaming, activeView]);

  const processResponse = (fullText: string) => {
    // Extract Step
    const stepMatch = fullText.match(/CURRENT_STEP:\s*(\d)/);
    if (stepMatch) {
      setCurrentStep(parseInt(stepMatch[1]));
    }

    // Judge Execution and Return Receipt
    const result = judgeExecution(fullText, budget, killSwitch);
    return result;
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initChat = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setMessages([{ id: 'error', role: 'model', text: '⚠️ Error: NEXT_PUBLIC_GEMINI_API_KEY is missing. Please configure your API key in the settings.' }]);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      chatRef.current = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
        }
      });

      if (strategyId) {
        const strategy = strategies.find(s => s.id === strategyId);
        if (strategy) {
          const initialPrompt = `Initialize Step 1 (Goal Intake) for the "${strategy.title}" strategy. I am starting with $0 capital. Ask me for the necessary targets and boundaries to define the strategy framework.`;
          
          setMessages([{ id: 'init-user', role: 'user', text: initialPrompt }]);
          setIsStreaming(true);
          setSystemStatus('Agents are working...');
          
          const modelMsgId = Date.now().toString();
          setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);

          try {
            const responseStream = await chatRef.current.sendMessageStream({ message: initialPrompt });
            let fullText = '';
            for await (const chunk of responseStream) {
              const chunkText = chunk.text() || '';
              fullText += chunkText;
              processResponse(fullText);
              setMessages(prev => prev.map(msg => 
                msg.id === modelMsgId ? { ...msg, text: msg.text + chunkText } : msg
              ));
            }
            // Finalize Receipt
            const result = processResponse(fullText);
            if (result.receipt) {
              const strategy = strategies.find(s => s.id === strategyId);
              const receipt: Receipt = {
                id: result.receipt.id!,
                timestamp: new Date().toLocaleTimeString(),
                agent: result.receipt.agent || 'System',
                strategy: strategy?.title || 'Unknown',
                status: result.receipt.status || 'Validated',
                logic: result.receipt.logic || ''
              };
              addReceipt(receipt);
            }
          } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { 
              id: Date.now().toString(), 
              role: 'model', 
              text: `⚠️ **System Error:** ${error.message || 'Failed to communicate with the agent network.'}` 
            }]);
          } finally {
            setIsStreaming(false);
            setSystemStatus('Idle');
          }
        }
      } else {
        setMessages([{ 
          id: 'welcome', 
          role: 'model', 
          text: 'CURRENT_STEP: 1\n### 🧠 [OTM Master Agent]\n\nSystem initialized. We are currently at **Step 1: Goal Intake**. What are your revenue targets, risk thresholds, and which business channels should we approve for this $0 capital venture?' 
        }]);
        setCurrentStep(1);
      }
    };

    initChat();
  }, [strategyId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming || !chatRef.current) return;

    const userText = input;
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setInput('');
    setIsStreaming(true);
    setSystemStatus('Agents are working...');
    
    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);

    try {
      const responseStream = await chatRef.current.sendMessageStream({ message: userText });
      let fullText = '';
      let isBlocked = false;

      for await (const chunk of responseStream) {
        if (isBlocked) break;
        
        const chunkText = chunk.text() || '';
        fullText += chunkText;
        
        const result = processResponse(fullText);
        if (!result.valid && !isBlocked) {
          isBlocked = true;
          setMessages(prev => prev.map(msg => 
            msg.id === modelMsgId ? { ...msg, text: `⚠️ **SYSTEM INTERVENTION:** ${result.reason}` } : msg
          ));
          if (result.receipt) {
            addReceipt({
              id: result.receipt.id!,
              timestamp: new Date().toLocaleTimeString(),
              agent: result.receipt.agent || 'SYSTEM',
              strategy: 'Blocked Op',
              status: 'Flagged',
              logic: result.reason
            });
          }
          break;
        }

        setMessages(prev => prev.map(msg => 
          msg.id === modelMsgId ? { ...msg, text: msg.text + chunkText } : msg
        ));
      }

      if (!isBlocked) {
        // Finalize Receipt
        const result = processResponse(fullText);
        if (result.receipt) {
          const receipt: Receipt = {
            id: result.receipt.id!,
            timestamp: new Date().toLocaleTimeString(),
            agent: result.receipt.agent || 'System',
            strategy: 'Active Operation',
            status: result.receipt.status || 'Validated',
            logic: result.receipt.logic || ''
          };
          addReceipt(receipt);
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: `⚠️ **System Error:** ${error.message || 'Failed to communicate with the agent network.'}` 
      }]);
    } finally {
      setIsStreaming(false);
      setSystemStatus('Idle');
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-neutral-800">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-neutral-400 hover:text-emerald-500 transition-colors text-sm font-medium mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-500">
            <Terminal className="w-5 h-5" />
            OTM Console
          </h2>
        </div>
        
        <nav className="p-2 space-y-1">
          <button 
            onClick={() => setActiveView('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeView === 'chat' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            <Terminal className="w-4 h-4" />
            <span>Terminal Core</span>
          </button>
          <button 
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeView === 'settings' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-lg shadow-blue-500/5' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Block Vault</span>
          </button>
        </nav>

        <div className="p-4 flex-grow overflow-y-auto">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-4 px-3 text-center">System Specialist Agents</h3>
          <ul className="space-y-3">
            {[
              { name: 'Master Agent', icon: Brain, color: 'text-emerald-500' },
              { name: 'Opportunity Scout', icon: Globe, color: 'text-blue-500' },
              { name: 'Content Engine', icon: Zap, color: 'text-yellow-500' },
              { name: 'Automation Builder', icon: Cpu, color: 'text-purple-500' },
              { name: 'Sales Closer', icon: LineChart, color: 'text-rose-500' },
              { name: 'Analytics Agent', icon: Activity, color: 'text-orange-500' },
            ].map((agent, i) => (
              <li key={i} className={`flex items-center gap-3 text-sm text-neutral-300 bg-neutral-800/10 p-2 rounded-lg border border-neutral-800/30`}>
                <agent.icon className={`w-4 h-4 ${agent.color}`} />
                {agent.name}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 space-y-2">
          {killSwitch && (
            <div className="flex items-center gap-2 text-xs font-mono justify-center text-red-500 animate-pulse border border-red-500/20 py-1 rounded bg-red-500/5">
              <ShieldAlert className="w-3 h-3" />
              <span>KILL-SWITCH ACTIVE</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs font-mono justify-center">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className={isStreaming ? 'text-amber-500' : 'text-emerald-500'}>{systemStatus}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === 'chat' ? (
        <div className="flex-1 flex flex-col relative">
          <LifecycleStepper currentStep={currentStep} />
          
          {/* Mobile Header */}
          <div className="md:hidden p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <button 
              onClick={() => router.push('/')}
              className="text-neutral-400 hover:text-emerald-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-4">
              <button onClick={() => setActiveView('chat')} className={activeView === 'chat' ? 'text-emerald-500 font-bold' : 'text-neutral-500'}>Core</button>
              <button onClick={() => setActiveView('settings')} className="text-neutral-500 hover:text-blue-500 transition-colors">Vault</button>
            </div>
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-neutral-800 text-white' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block rounded-2xl px-5 py-4 ${msg.role === 'user' ? 'bg-neutral-800 text-white' : 'bg-neutral-900 border border-neutral-800 text-neutral-300 w-full'}`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="prose prose-invert prose-emerald max-w-none prose-pre:bg-neutral-950 prose-pre:border prose-pre:border-neutral-800 prose-headings:text-emerald-400 prose-a:text-emerald-500">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {isStreaming && (
              <div className="flex gap-4 max-w-4xl mx-auto">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="flex-1">
                  <div className="inline-block rounded-2xl px-5 py-4 bg-neutral-900 border border-neutral-800 text-neutral-400">
                    Agents are thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-neutral-950 border-t border-neutral-800">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Command the OTM Agents... (e.g., 'Build me a Twitter growth automation')"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl pl-4 pr-12 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="absolute right-2 top-2 bottom-2 p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-black rounded-lg transition-colors flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <div className="text-center mt-2 text-xs text-neutral-600">
              OTM Agents prioritize $0 strategies. Verify code before executing live ops.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Mobile Header (Settings) */}
          <div className="md:hidden p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <button 
              onClick={() => setActiveView('chat')}
              className="text-neutral-400 hover:text-emerald-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-blue-500">Block Vault</span>
            <div className="w-5 h-5" />
          </div>
          <SettingsView />
        </div>
      )}
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-neutral-950 text-emerald-500"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ConsoleContent />
    </Suspense>
  );
}
