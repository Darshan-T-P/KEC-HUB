import React, { useState } from 'react';
import { authService, UserRole, AuthResponse } from '../services/auth';

interface AuthPageProps {
  onLoginSuccess: (data: AuthResponse) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState(1); // Used for register and forgot_password

  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validateEmail = (email: string) => {
    return email.toLowerCase().endsWith('@kongu.edu') || email.toLowerCase().endsWith('@kongu.ac.in');
  };

  const resetState = (newMode: AuthMode) => {
    setMode(newMode);
    setStep(1);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setOtpInput('');
    setShowPassword(false);
  };

  const handleSendOtpRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validateEmail(email)) {
      setError('Please use a valid Kongu email (@kongu.edu or @kongu.ac.in)');
      return;
    }

    setLoading(true);
    // 1. Check if user already exists
    const checkRes = await authService.checkUser(email, role);
    if (checkRes.success) {
      setError('This account is already registered. Please sign in instead.');
      setLoading(false);
      return;
    }

    // 2. Send OTP if user doesn't exist
    const res = await authService.sendOTP(email);
    if (res.success) {
      setSuccessMsg(res.message);
      setStep(2);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleSendOtpForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validateEmail(email)) {
      setError('Please use a valid Kongu email (@kongu.edu or @kongu.ac.in)');
      return;
    }

    setLoading(true);
    // 1. Check if user exists
    const checkRes = await authService.checkUser(email, role);
    if (!checkRes.success) {
      setError('No account found with this email and role.');
      setLoading(false);
      return;
    }

    // 2. Send OTP
    const res = await authService.sendOTP(email);
    if (res.success) {
      setSuccessMsg(res.message);
      setStep(2);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpInput.length < 4) {
      setError('Please enter a valid verification code');
      return;
    }

    setLoading(true);
    const res = await authService.verifyOTP(email, otpInput);
    if (res.success) {
      setStep(3);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 3) {
      setError('Full name must be at least 3 characters long');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    const res = await authService.register(name, email, password, role);
    if (res.success) {
      onLoginSuccess(res);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    const res = await authService.resetPassword(email, password, role);
    if (res.success) {
      setSuccessMsg('Password updated successfully! Please sign in.');
      setTimeout(() => resetState('login'), 2000);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please use a valid Kongu email (@kongu.edu or @kongu.ac.in)');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    const res = await authService.login(email, password, role);
    if (res.success) {
      onLoginSuccess(res);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  const RoleSelector = () => (
    <div className="mb-4">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Role</label>
      <div className="grid grid-cols-2 gap-2">
        {(['student', 'event_manager', 'alumni', 'management'] as UserRole[]).map((r) => (
          <label
            key={r}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all ${role === r
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white'
              }`}
          >
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => setRole(r)}
              className="accent-indigo-600 w-3 h-3"
            />
            {r.replace('_', ' ')}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-8 sm:p-10 relative z-10 max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-4 shadow-lg shadow-indigo-100">
            K
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">KEC Career Hub</h1>
          <p className="text-slate-500 font-bold text-sm mt-1">Institution Opportunity Portal</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in duration-300">
            <span className="text-base">⚠️</span> {error}
          </div>
        )}

        {successMsg && !error && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in duration-300">
            <span className="text-base">📩</span> {successMsg}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <RoleSelector />
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kongu Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@kongu.edu"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Password *</label>
                <button type="button" onClick={() => resetState('forgot_password')} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest">Forgot?</button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 text-sm mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <div className="space-y-4">
            {step === 1 && (
              <form onSubmit={handleSendOtpRegister} className="space-y-4">
                <RoleSelector />
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kongu Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@kongu.edu"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                  <p className="mt-2 text-[9px] text-slate-400 font-bold ml-1 uppercase tracking-wider">Restricted to @kongu.edu / @kongu.ac.in</p>
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Checking Account...' : 'Verify Email via OTP'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-xs font-bold text-slate-600">Enter code sent to:</p>
                  <p className="text-xs font-black text-indigo-600 mt-0.5">{email}</p>
                </div>
                <div className="space-y-1 text-center">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">6-Digit Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-center text-xl font-black tracking-[0.4em]"
                  />
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button type="button" onClick={() => setStep(1)} className="w-full text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Change Email</button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleRegister} className="space-y-4">
                <RoleSelector />
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </form>
            )}
          </div>
        )}

        {mode === 'forgot_password' && (
          <div className="space-y-4">
            {step === 1 && (
              <form onSubmit={handleSendOtpForgotPassword} className="space-y-4">
                <RoleSelector />
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kongu Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@kongu.edu"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Verifying Account...' : 'Send OTP'}
                </button>
                <button type="button" onClick={() => resetState('login')} className="w-full text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Back to Login</button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-xs font-bold text-slate-600">Enter code sent to:</p>
                  <p className="text-xs font-black text-indigo-600 mt-0.5">{email}</p>
                </div>
                <div className="space-y-1 text-center">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">6-Digit Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-center text-xl font-black tracking-[0.4em]"
                  />
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button type="button" onClick={() => setStep(1)} className="w-full text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">Change Email</button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <button
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Updating Password...' : 'Reset Password'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-6 text-center border-t border-slate-50 pt-6">
          <button
            onClick={() => resetState(mode === 'login' ? 'register' : 'login')}
            className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
          >
            {mode === 'login' ? "New user? Create an account" : "Back to Sign In"}
          </button>
        </div>
      </div>

      <p className="mt-6 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] relative z-10">
        © 2024 Kongu Engineering College
      </p>

      {/* Background Blobs - Reduced size and opacity to be less distracting */}
      <div className="fixed top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-30 -translate-y-1/4 translate-x-1/4 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl opacity-30 translate-y-1/4 -translate-x-1/4 pointer-events-none"></div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
