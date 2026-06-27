'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Trash2, 
  Plus, 
  Save, 
  Zap, 
  ShieldAlert,
  HardDrive,
  History,
  Activity,
  Server,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore, Secret } from '@/lib/store';

export function SettingsView() {
  const { 
    budget, setBudget, 
    stopLoss, setStopLoss, 
    telemetry, setTelemetry, 
    secrets, setSecrets,
    killSwitch, setKillSwitch,
    receipts
  } = useStore();

  const [showSecretId, setShowSecretId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState({ name: '', value: '', category: 'CRM' as Secret['category'] });

  const saveSettings = () => {
    // zustand persist handles this, but we can show a confirmation
    alert('System Configuration Synchronized to Local Territory.');
  };

  const addSecret = () => {
    if (!newSecret.name || !newSecret.value) return;
    const secret: Secret = {
      id: Date.now().toString(),
      ...newSecret
    };
    setSecrets([...secrets, secret]);
    setNewSecret({ name: '', value: '', category: 'CRM' });
  };

  const deleteSecret = (id: string) => {
    setSecrets(secrets.filter(s => s.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-12 bg-neutral-950">
      {/* Risk Railings */}
      <section className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
          <ShieldAlert className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl font-bold">Mandatory Risk Railings (Commandment VI)</h2>
        </div>
        
        <div className="relative p-8 bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden group">
          {/* Safety Cage Visualizer */}
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute inset-0 border-[20px] border-emerald-500/20" />
            <div className="w-full h-full bg-[radial-gradient(circle,transparent_20%,#000_70%)]" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-400">Execution Budget ($)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-neutral-500">$</span>
                </div>
                <input 
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg py-3 pl-8 pr-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>
              <p className="text-xs text-neutral-500 italic">&quot;No Fronts&quot; Enforcement: Defining exactly what you are willing to re-load.</p>
            </div>
            
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-400">Hard Stop-Loss (%)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="1"
                  max="50"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                  className="flex-1 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="w-12 text-center font-bold text-emerald-500">{stopLoss}%</span>
              </div>
              <p className="text-xs text-neutral-500 italic">Protects essential funds like rent/family stability.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Plug: Secrets Vault */}
      <section className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
          <Key className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold">The Plug: Secrets Vault (Commandment III)</h2>
        </div>
        
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select 
              value={newSecret.category}
              onChange={(e) => setNewSecret({...newSecret, category: e.target.value as Secret['category']})}
              className="bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm text-neutral-300"
            >
              <option value="CRM">CRM (HubSpot/Airtable)</option>
              <option value="Email">Email (Gmail/Outlook)</option>
              <option value="Payments">Payments (Stripe)</option>
              <option value="Automation">Automation (n8n/MCP)</option>
              <option value="Other">Other</option>
            </select>
            <input 
              type="text"
              placeholder="Secret Name (e.g. Stripe API Key)"
              value={newSecret.name}
              onChange={(e) => setNewSecret({...newSecret, name: e.target.value})}
              className="bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
            />
            <input 
              type="password"
              placeholder="Value"
              value={newSecret.value}
              onChange={(e) => setNewSecret({...newSecret, value: e.target.value})}
              className="bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
            />
            <button 
              onClick={addSecret}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors transition-transform active:scale-95 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Plug
            </button>
          </div>

          <div className="space-y-3">
            {secrets.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Lock className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-200">{s.name}</div>
                    <div className="text-xs text-neutral-500 font-mono">
                      {showSecretId === s.id ? s.value : '••••••••••••••••'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowSecretId(showSecretId === s.id ? null : s.id)}
                    className="p-2 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showSecretId === s.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => deleteSecret(s.id)}
                    className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {secrets.length === 0 && (
              <div className="text-center py-8 text-neutral-500 border-2 border-dashed border-neutral-800 rounded-xl">
                No secrets stored in current block territory.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Infrastructure & Privacy */}
      <section className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Digital Blocks */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-2">
            <Server className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold">Isolated Territory (Blocks)</h3>
          </div>
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Docker Sandbox</span>
              <span className="text-emerald-500 flex items-center gap-1"><Activity className="w-3 h-3" /> Active</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">IaC Compliance</span>
              <span className="text-emerald-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Audited</span>
            </div>
            <div className="pt-2 border-t border-neutral-800 text-xs text-neutral-500">
              Cross-contamination prevention enabled. No hot zone leakage detected.
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-neutral-800 pb-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold">Privacy Layer (Commandment IX)</h3>
          </div>
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Zero Telemetry</div>
                <div className="text-xs text-neutral-500">Strip 3rd-party trackers</div>
              </div>
              <button 
                onClick={() => setTelemetry(!telemetry)}
                className={`w-12 h-6 rounded-full transition-colors relative ${telemetry ? 'bg-orange-500' : 'bg-neutral-800'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${telemetry ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <div className="text-xs text-neutral-500 italic">
              &quot;Stay away from watchers you don&apos;t control.&quot; Local-first data primitives active.
            </div>
          </div>
        </div>
      </section>

      {/* Kill Switch & Global Actions */}
      <section className="max-w-4xl mx-auto p-8 border-2 border-red-500/20 bg-red-500/5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-xl font-bold flex items-center gap-2 justify-center md:justify-start">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            Tactical Kill-Switch
          </h2>
          <p className="text-sm text-neutral-400">Instantly sever all integrations and halt active deployments if an agent acts sketchy.</p>
        </div>
        <button 
          onClick={() => {
            setKillSwitch(!killSwitch);
          }}
          className={`px-8 py-4 rounded-xl font-black text-lg transition-all ${killSwitch ? 'bg-red-600 text-white animate-pulse' : 'bg-neutral-800 text-neutral-400 hover:bg-red-950 hover:text-red-500 border border-red-500/30'}`}
        >
          {killSwitch ? 'DISENGAGE' : 'ENGAGE TERMINATION'}
        </button>
      </section>

      {/* Receipts History */}
      <section className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
          <History className="w-6 h-6 text-neutral-500" />
          <h2 className="text-xl font-bold">Audit Logs & Receipts</h2>
        </div>
        
        <div className="space-y-4">
          {receipts.map((rcpt) => (
            <div key={rcpt.id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="font-bold text-sm">{rcpt.id}</div>
                  <div className="text-xs text-neutral-400">{rcpt.agent} - {rcpt.strategy}</div>
                  <div className="text-[10px] text-neutral-500 font-mono mt-1">{rcpt.logic}</div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest ${
                  rcpt.status === 'Validated' ? 'bg-emerald-500/20 text-emerald-500' :
                  rcpt.status === 'Flagged' ? 'bg-red-500/20 text-red-500' :
                  'bg-blue-500/20 text-blue-500'
                }`}>{rcpt.status}</span>
                <span className="text-[10px] text-neutral-600 mt-1">{rcpt.timestamp}</span>
              </div>
            </div>
          ))}
          {receipts.length === 0 && (
            <div className="p-12 text-center text-neutral-600 border border-dashed border-neutral-800 rounded-xl">
              No tactical receipts generated in the current session.
            </div>
          )}
          <p className="text-center text-xs text-neutral-600">Viewing recent telemetry evidence.</p>
        </div>
      </section>

      {/* Global Save Button - Floating */}
      <div className="fixed bottom-8 right-8 z-50">
        <button 
          onClick={saveSettings}
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-black px-8 py-4 rounded-full shadow-2xl shadow-emerald-500/20 flex items-center gap-2 transform transition-transform hover:scale-105 active:scale-95"
        >
          <Save className="w-5 h-5" /> SYNCHRONIZE VAULT
        </button>
      </div>
    </div>
  );
}

