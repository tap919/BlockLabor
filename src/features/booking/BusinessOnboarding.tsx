import { useState } from 'react';
import { verificationService } from '../../shared/services/verification.service';
import VerifiedStamp from '../../components/ui/VerifiedStamp';

interface BusinessOnboardingProps {
  onComplete?: (businessName: string) => void;
}

export function BusinessOnboarding({ onComplete }: BusinessOnboardingProps) {
  const [step, setStep] = useState<'form' | 'verifying' | 'verified' | 'failed'>('form')
  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEin, setBusinessEin] = useState('')
  const [businessState, setBusinessState] = useState('')
  const [callId, setCallId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!businessName || !businessPhone || !businessEin || !businessState) {
      setError('All fields are required.')
      return
    }
    setStep('verifying')
    try {
      const result = await verificationService.verifyBusinessIdentity({
        businessName,
        businessPhone,
        businessEin,
        businessState,
        tenantId: 'blocklabor-default',
      })
      setCallId(result.call_id ?? null)
      setStep('verified')
      onComplete?.(businessName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStep('failed')
    }
  }

  const inputClass =
    'bg-[#0B0E13] border border-[#2A2D35] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-full'

  if (step === 'verifying') {
    return (
      <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-6 text-center space-y-3">
        <div className="animate-pulse text-xs font-mono text-yellow-400 uppercase tracking-widest">
          Initiating outbound verification call...
        </div>
        <p className="text-xs text-zinc-500">
          Aetherdesk is calling {businessPhone} to verify {businessName}.
        </p>
      </div>
    )
  }

  if (step === 'verified') {
    return (
      <div className="bg-[#161920] border border-[#2A2D35] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <VerifiedStamp status="pending" size="lg" />
          <span className="text-xs text-zinc-400">
            Verification call initiated. Awaiting confirmation.
          </span>
        </div>
        {callId && (
          <p className="text-[10px] font-mono text-zinc-500">Call ID: {callId}</p>
        )}
        <p className="text-xs text-zinc-300">
          Your business will appear as <span className="text-white font-semibold">T1 (Pending Verification)</span>{' '}
          until the outbound call completes. Trust tier will be promoted automatically upon confirmation.
        </p>
      </div>
    )
  }

  if (step === 'failed') {
    return (
      <div className="bg-[#161920] border border-red-500/40 rounded-xl p-6 space-y-3">
        <VerifiedStamp status="flagged" size="lg" />
        <p className="text-xs text-red-400">{error}</p>
        <button
          onClick={() => {
            setStep('form')
            setError(null)
          }}
          className="text-xs px-4 py-2 bg-[#0B0E13] border border-[#2A2D35] rounded-lg text-zinc-300 hover:border-blue-500 cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#161920] border border-[#2A2D35] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white">
          Business Identity Verification
        </h3>
        <VerifiedStamp status="pending" size="sm" showTier={false} />
      </div>
      <p className="text-xs text-zinc-400">
        Required to post jobs on Overlay365. Aetherdesk will call your business line to confirm EIN and state
        registration before activating your account.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Legal Business Name
          </label>
          <input
            className={inputClass}
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="Apex Materials Inc"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Business Phone
          </label>
          <input
            className={inputClass}
            value={businessPhone}
            onChange={e => setBusinessPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            EIN
          </label>
          <input
            className={inputClass}
            value={businessEin}
            onChange={e => setBusinessEin(e.target.value)}
            placeholder="12-3456789"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            State of Registration
          </label>
          <input
            className={inputClass}
            value={businessState}
            onChange={e => setBusinessState(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="TX"
          />
        </div>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
      >
        Submit & Initiate Verification Call
      </button>
    </form>
  )
}
