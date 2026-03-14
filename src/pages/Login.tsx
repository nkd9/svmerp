import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        navigate('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(169,190,255,0.32),_transparent_30%),linear-gradient(90deg,_#5f79e6_0%,_#7173db_48%,_#9a61c8_100%)] [font-family:'Poppins',sans-serif] flex items-center justify-center p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left,_rgba(255,255,255,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.12),_transparent_28%)]" />
      <motion.div 
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-[980px] min-w-[320px] overflow-hidden rounded-[30px] bg-white/10 shadow-[0_30px_80px_rgba(31,41,55,0.22)] ring-1 ring-white/10 backdrop-blur-[2px] lg:h-[400px]"
      >
        <div className="grid h-full lg:grid-cols-[0.5fr_0.5fr]">
          <section className="flex items-center bg-[#f7f7f8] px-6 py-8 sm:px-10 lg:px-10 lg:py-7">
            <div className="mx-auto w-full max-w-[430px]">
              <div className="mb-6 lg:mb-5">
                <h1 className="text-[28px] font-black tracking-[-0.04em] text-[#1f2937]">Welcome Back</h1>
                <p className="mt-2 text-[14px] font-medium text-[#6b7280] lg:text-[13px]">Sign in to access your admin dashboard</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-3.5">
                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                    {error}
                  </div>
                )}

                <div className="relative">
                  <User className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 lg:h-4.5 lg:w-4.5" />
                  <input
                    required
                    type="text"
                    placeholder="Purna Ch Das"
                    className="h-[62px] w-full rounded-2xl border border-[#d7dde8] bg-[#e9edf5] pl-14 pr-5 text-[16px] font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 lg:h-[54px] lg:text-[15px]"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 lg:h-4.5 lg:w-4.5" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="•••"
                    className="h-[62px] w-full rounded-2xl border border-[#d7dde8] bg-[#e9edf5] pl-14 pr-16 text-[16px] font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 lg:h-[54px] lg:text-[15px]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 lg:h-4.5 lg:w-4.5" /> : <Eye className="h-5 w-5 lg:h-4.5 lg:w-4.5" />}
                  </button>
                </div>

                <div className="flex justify-end pr-1">
                  <button type="button" className="text-[13px] font-semibold text-[#3267f1] transition hover:text-[#244fc4] lg:text-[12px]">
                    Forgot your password?
                  </button>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="flex h-[60px] w-full items-center justify-center rounded-[16px] bg-[linear-gradient(90deg,_#3267f1_0%,_#7443f1_100%)] px-6 py-4 text-[18px] font-bold text-white shadow-[0_18px_40px_rgba(84,102,240,0.32)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(84,102,240,0.38)] hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 lg:h-[52px] lg:text-[16px]"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-8 rounded-[24px] bg-[linear-gradient(160deg,_rgba(112,139,244,0.9)_0%,_rgba(121,120,221,0.88)_42%,_rgba(120,86,198,0.9)_100%)] px-6 py-7 text-center text-white shadow-[0_18px_40px_rgba(56,67,160,0.22)] lg:hidden">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-yellow-300 bg-white">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,_#ffe07d,_#f8b531)] text-sm font-black tracking-[0.16em] text-slate-800">
                    SVM
                  </div>
                </div>
                <p className="text-xl font-black tracking-[-0.04em]">SVM CLASSES</p>
                <p className="mt-2 text-sm text-white/80">Amrit Vihar, Digapahandi (Ganjam)</p>
                <p className="mt-4 text-xs text-white/70">&copy; 2026 SVM classes ERP System. All rights reserved.</p>
              </div>

            </div>
          </section>

          <section className="relative hidden items-center overflow-hidden bg-[linear-gradient(160deg,_rgba(112,139,244,0.6)_0%,_rgba(121,120,221,0.6)_42%,_rgba(120,86,198,0.64)_100%)] px-10 py-7 text-white lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.08),_transparent_28%)]" />
            <div className="relative mx-auto flex max-w-[380px] flex-col items-center text-center">
              <div className="mb-6 flex h-[86px] w-[86px] items-center justify-center rounded-full border-[5px] border-yellow-300 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[linear-gradient(180deg,_#ffe07d,_#f8b531)] text-[16px] font-black tracking-[0.18em] text-slate-800">
                  SVM
                </div>
              </div>
              <h2 className="text-[38px] font-black tracking-[-0.05em]">SVM CLASSES</h2>
              <p className="mt-4 text-[15px] font-medium text-white/92">Amrit Vihar, Digapahandi (Ganjam)</p>
              <p className="mt-6 max-w-[340px] text-[15px] leading-7 text-white/88">
                Empowering students with quality education and excellence in learning. Your journey to success starts here.
              </p>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
