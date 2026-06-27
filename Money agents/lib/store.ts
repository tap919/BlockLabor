'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Secret {
  id: string;
  name: string;
  value: string;
  category: 'CRM' | 'Email' | 'Payments' | 'Automation' | 'Other';
}

export interface ServiceStatus {
  name: string;
  url: string;
  healthPath?: string;
  status: 'online' | 'offline' | 'checking';
  lastCheck: string | null;
  latency: number | null;
  error: string | null;
}

export interface Receipt {
  id: string;
  timestamp: string;
  agent: string;
  strategy: string;
  status: 'Validated' | 'Pending' | 'Flagged';
  logic: string;
}

interface SystemStore {
  budget: number;
  stopLoss: number;
  telemetry: boolean;
  secrets: Secret[];
  killSwitch: boolean;
  receipts: Receipt[];
  currentStep: number;
  services: ServiceStatus[];
  
  setBudget: (val: number) => void;
  setStopLoss: (val: number) => void;
  setTelemetry: (val: boolean) => void;
  setSecrets: (secrets: Secret[]) => void;
  setKillSwitch: (val: boolean) => void;
  addReceipt: (receipt: Receipt) => void;
  setCurrentStep: (step: number) => void;
  updateServiceStatus: (name: string, status: Partial<ServiceStatus>) => void;
}

export const useStore = create<SystemStore>()(
  persist(
    (set) => ({
      budget: 100,
      stopLoss: 10,
      telemetry: false,
      secrets: [],
      killSwitch: false,
      receipts: [],
      currentStep: 1,
      services: [
        { name: 'Hermes', url: 'cli', status: 'offline', lastCheck: null, latency: null, error: null },
        { name: 'Sports Steve MVP', url: 'http://localhost:8010', healthPath: '/health', status: 'offline', lastCheck: null, latency: null, error: null },
        { name: 'OmniVoice', url: 'http://localhost:8000', healthPath: '/health', status: 'offline', lastCheck: null, latency: null, error: null },
        { name: 'Bet Buddy', url: 'http://localhost:3001', healthPath: '/health', status: 'offline', lastCheck: null, latency: null, error: null },
      ],
      
      setBudget: (budget) => set({ budget }),
      setStopLoss: (stopLoss) => set({ stopLoss }),
      setTelemetry: (telemetry) => set({ telemetry }),
      setSecrets: (secrets) => set({ secrets }),
      setKillSwitch: (killSwitch) => set({ killSwitch }),
      addReceipt: (receipt) => set((state) => ({ receipts: [receipt, ...state.receipts].slice(0, 50) })),
      setCurrentStep: (currentStep) => set({ currentStep }),
      updateServiceStatus: (name, updates) => set((state) => ({
        services: state.services.map(s => s.name === name ? { ...s, ...updates, lastCheck: new Date().toLocaleTimeString() } : s)
      })),
    }),
    {
      name: 'otm_system_v1',
    }
  )
);
