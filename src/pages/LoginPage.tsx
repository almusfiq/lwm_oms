import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Lock, BadgeCheck, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(identifier, password);
      onLoginSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-red-800/10 dark:bg-red-900/20 blur-[100px]" />
        <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-slate-300/30 dark:bg-slate-800/40 blur-[120px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="mx-auto w-24 h-24 rounded-2xl overflow-hidden shadow-xl shadow-red-900/30 border-2 border-white/30 dark:border-slate-700/50 transform hover:scale-105 transition-transform duration-300">
          <img
            src="/logo.jpeg"
            alt="Liberation War Museum Logo"
            className="w-full h-full object-cover"
          />
        </div>

        <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Liberation War Museum
        </h2>
        <div className="mt-1 text-sm font-sans text-red-800 dark:text-red-400 font-semibold tracking-wide">
          মুক্তিযুদ্ধ জাদুঘর • ঢাকা, বাংলাদেশ
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enterprise Office &amp; Task Management System
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl py-10 px-6 shadow-2xl rounded-3xl sm:px-10 border border-white/20 dark:border-slate-700/50">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-sm font-medium text-red-700 dark:text-red-300 rounded-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                Email or Employee ID
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <BadgeCheck className="h-5 w-5 text-slate-400 group-focus-within:text-red-700 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter your email or Employee ID"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-800/50 focus:border-red-800/50 transition-all sm:text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                Security Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-red-700 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-11 py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-800/50 focus:border-red-800/50 transition-all sm:text-sm shadow-sm"
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff className="h-5 w-5" />
                      : <Eye className="h-5 w-5" />}
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-red-800 to-red-700 hover:from-red-900 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className={`w-5 h-5 ${submitting ? 'animate-pulse' : ''}`} />
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wide">
          Plot 1/1, Sher-e-Bangla Nagar, Agargaon, Dhaka-1207
          <br className="mt-1" />
          Official Liberation War Museum Portal
        </p>
      </div>
    </div>
  );
};
