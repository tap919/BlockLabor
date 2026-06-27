import { useState, FormEvent } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';

export function SignInForm({ onSuccess, redirectTo }: { onSuccess?: () => void; redirectTo?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signInWithMagicLink } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let result;
      if (isMagicLink) {
        result = await signInWithMagicLink(email);
      } else {
        result = await signIn(email, password);
      }

      if (result.error) {
        setError(result.error.message);
      } else {
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0F1115]">
      <div className="w-full max-w-md bg-[#161920] rounded-xl border border-[#2A2D35] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">BlockLabor</h1>
          <p className="text-[#8E9299] text-sm mt-2">
            {isMagicLink ? 'Enter your email to receive a magic link' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[#8E9299] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E9299]" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#1F232B] border border-[#373A43] rounded-lg text-white text-sm placeholder-[#5A5E66] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]"
                placeholder="you@company.com"
                disabled={isLoading}
              />
            </div>
          </div>

          {!isMagicLink && (
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#8E9299] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E9299]" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1F232B] border border-[#373A43] rounded-lg text-white text-sm placeholder-[#5A5E66] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#10B981] hover:bg-[#0EA5E9] text-[#0F1115] font-bold text-sm uppercase tracking-wider py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Please wait...</span>
              </>
            ) : isMagicLink ? (
              'Send Magic Link'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsMagicLink(!isMagicLink)}
            className="text-sm text-[#10B981] hover:text-[#0EA5E9] font-medium underline underline-offset-2"
          >
            {isMagicLink ? 'Use password instead' : 'Sign in with magic link'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-[#5A5E66]">
          Don&apos;t have an account? Contact your administrator for access.
        </p>
      </div>
    </div>
  );
}
