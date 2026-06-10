'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import WelcomeOverlay from '@/components/WelcomeOverlay';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeEmail, setWelcomeEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setWelcomeEmail(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setError('Invalid email or password.');
      } else if (msg.includes('user-not-found')) {
        setError('No account found with this email.');
      } else {
        setError('Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleWelcomeDone = useCallback(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <>
      {welcomeEmail && <WelcomeOverlay email={welcomeEmail} onDone={handleWelcomeDone} />}

      <div className="auth-bg min-h-screen flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.5s ease both' }}>

        {/* Animated background orbs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="orb-1 absolute -top-32 -left-32 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="orb-2 absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-600/18 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-purple-700/8 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md">

          {/* Logo mark */}
          <div className="flex flex-col items-center mb-10" style={{ animation: 'fadeInUp 0.5s ease 0.05s both' }}>
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-3xl bg-violet-600/20 blur-2xl scale-110" />
              <Image src="/logo.png" alt="HydroHang" width={96} height={96} className="relative rounded-3xl shadow-2xl shadow-violet-500/30" />
            </div>
            <h1 className="text-4xl font-black tracking-tight gradient-text">HydroHang</h1>
            <p className="text-white/40 mt-1.5 text-sm font-medium flex items-center gap-1.5">
              <Sparkles size={13} className="text-violet-400" />
              Smart laundry management
            </p>
          </div>

          {/* Card */}
          <div
            className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/40 p-8"
            style={{ animation: 'fadeInUp 0.5s ease 0.15s both' }}
          >
            {/* Card inner glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-600/10 blur-2xl" />

            <div className="relative">
              <h2 className="text-2xl font-black mb-1">Welcome back</h2>
              <p className="text-white/40 text-sm mb-8">Sign in to continue</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div style={{ animation: 'fadeInUp 0.4s ease 0.25s both' }}>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div style={{ animation: 'fadeInUp 0.4s ease 0.32s both' }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Password</label>
                    <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input pr-12"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    key={error}
                    className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2"
                    style={{ animation: 'shakeX 0.4s ease both' }}
                  >
                    <span className="text-red-500 text-base">!</span>
                    {error}
                  </div>
                )}

                <div style={{ animation: 'fadeInUp 0.4s ease 0.38s both' }}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 mt-1"
                  >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-3 my-7">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-white/25 text-xs font-semibold">NEW HERE?</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <Link
                href="/register"
                className="flex items-center justify-center w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-sm font-bold text-white/70 hover:text-white transition-all duration-200"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
