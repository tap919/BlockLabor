import React from 'react';

export type VerificationLevel = 'pending' | 'verified' | 'flagged' | 'audited';

interface VerifiedStampProps {
  status: VerificationLevel;
  trustTier?: number; // 1-5
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showTier?: boolean;
}

const VerifiedStamp: React.FC<VerifiedStampProps> = ({
  status,
  trustTier,
  size = 'md',
  label,
  showTier = true,
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const tierLabel = trustTier ? `T${trustTier}` : null;

  const getConfig = () => {
    switch (status) {
      case 'verified':
        return {
          bg: 'bg-emerald-950/60',
          border: 'border-emerald-500/50',
          text: 'text-emerald-300',
          dot: 'bg-emerald-500',
          icon: '✓',
          defaultLabel: 'VERIFIED',
        };
      case 'flagged':
        return {
          bg: 'bg-red-950/60',
          border: 'border-red-500/50',
          text: 'text-red-300',
          dot: 'bg-red-500',
          icon: '⚠',
          defaultLabel: 'FLAGGED',
        };
      case 'audited':
        return {
          bg: 'bg-purple-950/60',
          border: 'border-purple-500/50',
          text: 'text-purple-300',
          dot: 'bg-purple-500',
          icon: '◎',
          defaultLabel: 'AUDITED',
        };
      case 'pending':
      default:
        return {
          bg: 'bg-yellow-950/40',
          border: 'border-yellow-500/40',
          text: 'text-yellow-300',
          dot: 'bg-yellow-500',
          icon: '◯',
          defaultLabel: 'PENDING',
        };
    }
  };

  const config = getConfig();
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-widest ${config.bg} ${config.border} ${config.text} ${sizeClasses[size]}`}
      title={`Status: ${config.defaultLabel}${trustTier ? ` | Trust Tier: T${trustTier}` : ''}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} inline-block`} />
      <span>{config.icon}</span>
      <span>{displayLabel}</span>
      {showTier && tierLabel && (
        <span className={`ml-1 px-1 rounded ${config.bg} ${config.text} border-l ${config.border} pl-2`}>
          {tierLabel}
        </span>
      )}
    </span>
  );
};

export default VerifiedStamp;
