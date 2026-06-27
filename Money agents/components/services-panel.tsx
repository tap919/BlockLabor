'use client';

import { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Activity, 
  Zap, 
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useStore, ServiceStatus } from '@/lib/store';

function ServiceCard({ service, onCheck }: { service: ServiceStatus; onCheck: () => void }) {
  const [isChecking, setIsChecking] = useState(false);
  
  const handleCheck = async () => {
    setIsChecking(true);
    onCheck();
    setTimeout(() => setIsChecking(false), 2000);
  };
  
  const statusColor = {
    online: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5',
    offline: 'text-red-500 border-red-500/30 bg-red-500/5',
    checking: 'text-amber-500 border-amber-500/30 bg-amber-500/5',
  };
  
  const StatusIcon = service.status === 'online' ? CheckCircle2 
    : service.status === 'offline' ? XCircle 
    : AlertCircle;
  
  return (
    <div className={`p-4 rounded-xl border ${statusColor[service.status]} transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <span className="font-bold">{service.name}</span>
        </div>
        <StatusIcon className={`w-5 h-5 ${service.status === 'online' ? 'text-emerald-500' : service.status === 'offline' ? 'text-red-500' : 'text-amber-500'}`} />
      </div>
      
      <div className="text-xs text-neutral-400 space-y-1">
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={service.status === 'online' ? 'text-emerald-500' : service.status === 'offline' ? 'text-red-500' : 'text-amber-500'}>
            {service.status.toUpperCase()}
          </span>
        </div>
        {service.latency !== null && (
          <div className="flex justify-between">
            <span>Latency:</span>
            <span>{service.latency}ms</span>
          </div>
        )}
        {service.error && (
          <div className="text-red-500 mt-2 text-[10px]">{service.error}</div>
        )}
      </div>
      
      <button 
        onClick={handleCheck}
        disabled={isChecking}
        className="w-full mt-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
        {isChecking ? 'Checking...' : 'Ping'}
      </button>
    </div>
  );
}

export function ServicesPanel() {
  const { services, updateServiceStatus } = useStore();
  
  const checkService = async (service: ServiceStatus) => {
    // Build health URL per service healthPath configuration
    const isCli = service.url === 'cli';
    if (isCli) {
      updateServiceStatus(service.name, { 
        status: 'online', 
        latency: 0,
        error: null
      });
      return;
    }
    const base = service.url.startsWith('http') ? service.url : `http://${service.url}`;
    const path = service.healthPath ?? '/health';
    const url = path.startsWith('http') ? path : `${base}${path}`;
    
    updateServiceStatus(service.name, { status: 'checking' });
    
    const start = Date.now();
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      const latency = Date.now() - start;
      
      if (res.ok) {
        updateServiceStatus(service.name, { 
          status: 'online', 
          latency,
          error: null 
        });
      } else {
        updateServiceStatus(service.name, { 
          status: 'offline', 
          latency: null,
          error: `HTTP ${res.status}` 
        });
      }
    } catch (err: any) {
      updateServiceStatus(service.name, { 
        status: 'offline', 
        latency: null,
        error: err.message 
      });
    }
  };
  
  useEffect(() => {
    // Check all services on mount
    services.forEach(s => checkService(s));
    
    // Auto-check every 30 seconds
    const interval = setInterval(() => {
      services.forEach(s => checkService(s));
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const onlineCount = services.filter(s => s.status === 'online').length;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-lg">Network Status</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-neutral-800 rounded-full">
          <span className="text-xs text-neutral-400">{onlineCount}/{services.length}</span>
          <span className="text-emerald-500 text-xs font-bold">ONLINE</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {services.map((service) => (
          <ServiceCard 
            key={service.name} 
            service={service} 
            onCheck={() => checkService(service)} 
          />
        ))}
      </div>
      
      <div className="flex items-center justify-center gap-4 pt-2">
        <button 
          onClick={() => services.forEach(s => checkService(s))}
          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-500 text-sm flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Check All Services
        </button>
      </div>
    </div>
  );
}
