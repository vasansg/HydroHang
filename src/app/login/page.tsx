'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WashingMachine, Eye, EyeOff, Loader2 } from 'lucide-react';
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
      {welcomeEmail && (
        <WelcomeOverlay email={welcomeEmail} onDone={handleWelcomeDone} />
      )}

      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ animation: 'fadeInUp 0.5s ease both' }}
      >
        {/* Background gradient blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Logo */}
          <div
            className="flex flex-col items-center mb-8"
            style={{ animation: 'fadeInUp 0.5s ease 0.05s both' }}
          >
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/40">
              <WashingMachine size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">HydroHang</h1>
            <p className="text-white/50 mt-1 text-sm">Smart laundry management</p>
          </div>

          {/* Card */}
          <div
            className="card shadow-2xl shadow-black/40"
            style={{ animation: 'fadeInUp 0.5s ease 0.15s both' }}
          >
            <h2 className="text-xl font-bold mb-6">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div style={{ animation: 'fadeInUp 0.5s ease 0.25s both' }}>
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

              <div style={{ animation: 'fadeInUp 0.5s ease 0.32s both' }}>
                <label className="label">Password</label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  key={error}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3"
                  style={{ animation: 'shakeX 0.5s ease both' }}
                >
                  {error}
                </div>
              )}

              <div style={{ animation: 'fadeInUp 0.5s ease 0.38s both' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>

            <div
              className="flex flex-col items-center gap-2 mt-6"
              style={{ animation: 'fadeInUp 0.5s ease 0.44s both' }}
            >
              <p className="text-center text-white/40 text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary-light hover:underline font-semibold">
                  Create one
                </Link>
              </p>
              <Link
                href="/forgot-password"
                className="text-white/30 hover:text-white/60 text-xs underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
