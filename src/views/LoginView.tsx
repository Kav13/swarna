import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Coins, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { api } from '../api';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsLoading(true);
    try {
      if (window.api) {
        await window.api.system.seedDemoData();
        setUsername('admin');
        setPassword('password123');
        setError('');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to seed sample data');
    } finally {
      setIsLoading(false);
    }
  };

  const isDesktop = typeof window !== 'undefined' && Boolean(window.api);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Subtle gold glow */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 mb-3 shadow-lg shadow-amber-500/20">
            <Coins className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SwarnaRaksha</h1>
          <p className="text-xs uppercase tracking-wider text-amber-400/90 font-medium mt-0.5">
            Offline Jewellery Loan Management
          </p>
        </div>

        {!isDesktop && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 text-sm">You are in a Web Browser</p>
              <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                SwarnaRaksha is an offline <strong>desktop application</strong> with an embedded SQLite database. To launch the desktop application window, run this in your terminal:
              </p>
              <div className="mt-2.5 bg-slate-950/90 px-3 py-2 rounded-lg border border-amber-500/30 font-mono text-xs text-amber-300 select-all">
                npm run dev:electron
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" variant="gold" className="w-full mt-2" isLoading={isLoading}>
            Sign In to Vault
          </Button>
        </form>

        {/* Quick development helpers */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center space-y-3">
          <p className="text-xs text-slate-400">Quick Credentials / Demo Setup:</p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                setUsername('admin');
                setPassword('password123');
              }}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              Fill Owner (admin)
            </button>
            <button
              onClick={() => {
                setUsername('worker');
                setPassword('password123');
              }}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              Fill Staff (worker)
            </button>
          </div>

          <div>
            <button
              onClick={handleSeedDemo}
              className="inline-flex items-center gap-1.5 text-xs text-amber-400/90 hover:text-amber-300 hover:underline transition-colors mt-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Load Complete Demo Database
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% Offline Secured &bull; Local AES-256 Encryption</span>
        </div>
      </div>
    </div>
  );
};
