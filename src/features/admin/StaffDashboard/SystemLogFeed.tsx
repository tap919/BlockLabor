import { SystemLog } from '../../../shared/types/domain';

export interface SystemLogFeedProps {
  logs: SystemLog[];
}

export function SystemLogFeed({ logs }: SystemLogFeedProps) {
  return (
    <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white">System Log Feed</h3>
      <div className="text-zinc-500 text-xs font-mono">
        {logs.slice(-5).map(log => (
          <div key={log.id} className="py-1">[{log.category}] {log.message}</div>
        ))}
      </div>
    </div>
  );
}
