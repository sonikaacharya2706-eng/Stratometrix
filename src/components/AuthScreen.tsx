import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/supabase';
import { CloudLightning, Eye, Shield, Activity, ArrowRight, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role);
      if (error) setError(error);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(56,189,248,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(14,165,233,0.2) 0%, transparent 50%)',
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
                <CloudLightning className="w-7 h-7 text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Stratometrix</h1>
                <p className="text-xs text-slate-400">Forecast Confidence & Bust Intelligence</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold leading-tight mb-3">
                Region-wise forecast<br />confidence mapping<br />across <span className="text-sky-400">Day 1–10</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-md">
                A probabilistic meteorological intelligence platform that quantifies
                structural model failure risk and isolates the physical drivers behind
                low-confidence zones.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-md">
              <FeatureItem icon={<Activity className="w-5 h-5" />} title="Real-Time Bust Probability Engine" desc="Statistical likelihood of forecast failure per coordinate sector" />
              <FeatureItem icon={<Eye className="w-5 h-5" />} title="Meteorological Driver Explainer" desc="Feature attribution isolating moisture, pressure & wind-shear anomalies" />
              <FeatureItem icon={<Shield className="w-5 h-5" />} title="Operational Dashboard & REST API" desc="Secure programmatic access with role-based controls" />
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Powered by ERA5 reanalysis · GFS / ECMWF IFS · GraphCast & Pangu-Weather architectures
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
              <CloudLightning className="w-6 h-6 text-sky-400" />
            </div>
            <h1 className="text-xl font-bold">Stratometrix</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-slate-400">
              {mode === 'signin'
                ? 'Sign in to access the operational dashboard.'
                : 'Select your portal and start analyzing forecast confidence.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800/50 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Jane Doe"
                    className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@metagency.gov"
                  className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select your portal</label>
                <div className="grid grid-cols-2 gap-3">
                  <RoleCard
                    selected={role === 'forecaster'}
                    onClick={() => setRole('forecaster')}
                    title="Forecaster / Admin"
                    desc="Full operational access: run models, manage regions, issue alerts"
                    icon={<Shield className="w-5 h-5" />}
                  />
                  <RoleCard
                    selected={role === 'user'}
                    onClick={() => setRole('user')}
                    title="Standard User"
                    desc="View dashboards, confidence maps, and receive alerts"
                    icon={<Eye className="w-5 h-5" />}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {submitting ? 'Please wait…' : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(null); }} className="text-sky-400 hover:text-sky-300 font-medium transition">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => { setMode('signin'); setError(null); }} className="text-sky-400 hover:text-sky-300 font-medium transition">
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-500 text-center">
            Authentication secured with unique IDs, passwords, and MFA-ready infrastructure.
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-slate-200 text-sm">{title}</h3>
        <p className="text-slate-400 text-sm">{desc}</p>
      </div>
    </div>
  );
}

function RoleCard({ selected, onClick, title, desc, icon }: { selected: boolean; onClick: () => void; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-lg border transition-all ${
        selected
          ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500'
          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
      }`}
    >
      <div className={`mb-2 ${selected ? 'text-sky-400' : 'text-slate-400'}`}>{icon}</div>
      <h4 className="font-semibold text-sm text-slate-100 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </button>
  );
}
