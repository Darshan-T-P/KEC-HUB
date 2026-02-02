
import React, { useState } from 'react';
import { authService, UserRole } from '../services/auth';

interface AuthPageProps {
  onLoginSuccess: (userData: any) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Details

  const [role, setRole] = useState<UserRole>('student');
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    
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
    setLoading(true);
    const res = await authService.register(name, email, password, role);
    if (res.success) {
      if (res.user) {
        onLoginSuccess({
          name: res.user.name || name,
          email: res.user.email || email,
          role: res.user.role || role,
          department: res.user.department || 'Computer Science'
        });
      } else {
        onLoginSuccess({ name, email, role, department: "Computer Science" });
      }
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await authService.login(email, password, role);
    if (res.success) {
      if (res.user) {
        onLoginSuccess({
          name: res.user.name || 'Student',
          email: res.user.email || email,
          role: res.user.role || role,
          department: res.user.department || 'Computer Science'
        });
      } else {
        onLoginSuccess({ name: "Student", email, role, department: "Computer Science" });
      }
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const RoleSelector = ({ compact }: { compact?: boolean }) => (
    <div>
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Role</label>
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
        {(
          [
            { value: 'student' as const, label: 'Student' },
            { value: 'event_manager' as const, label: 'Event Manager' },
            { value: 'alumni' as const, label: 'Alumini' },
            { value: 'management' as const, label: 'Management' },
          ]
        ).map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border font-black text-xs uppercase tracking-wider cursor-pointer transition-all ${
              role === opt.value
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white'
            }`}
          >
            <input
              type="radio"
              name="role"
              value={opt.value}
              checked={role === opt.value}
              onChange={() => setRole(opt.value)}
              className="accent-indigo-600"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-10 relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-6 shadow-lg shadow-indigo-100">
            K
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">KEC Career Hub</h1>
          <p className="text-slate-500 font-bold mt-2">Institution Opportunity Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-bold flex items-center gap-2">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        {successMsg && !error && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-sm font-bold flex items-center gap-2">
            <span className="text-lg">📩</span> {successMsg}
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <RoleSelector compact />
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kongu Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@kongu.edu"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold"
              />
            </div>
            <button 
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {step === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <RoleSelector compact />
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kongu Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@kongu.edu"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold"
                  />
                  <p className="mt-3 text-[10px] text-slate-400 font-bold ml-1 uppercase tracking-wider">Restricted to @kongu.edu / @kongu.ac.in</p>
                </div>
                <button 
                  disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Verify Email via OTP'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="text-center mb-4">
                  <p className="text-sm font-bold text-slate-600">Enter code sent to:</p>
                  <p className="text-xs font-black text-indigo-600 mt-1">{email}</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">6-Digit Code</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="000000"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-center text-2xl font-black tracking-[0.5em]"
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button type="button" onClick={() => setStep(1)} className="w-full text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors">Change Email</button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleRegister} className="space-y-6">
                <RoleSelector compact />
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold"
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-8 text-center border-t border-slate-50 pt-8">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setStep(1);
              setError('');
              setSuccessMsg('');
            }}
            className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
          >
            {isLogin ? "New user? Create an account" : "Back to Sign In"}
          </button>
        </div>
      </div>
      
      <p className="mt-10 text-slate-400 text-xs font-black uppercase tracking-[0.3em] relative z-10">
        © 2024 Kongu Engineering College
      </p>

      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>
    </div>
  );
};

export default AuthPage;
