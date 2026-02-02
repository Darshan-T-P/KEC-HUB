
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService, UserRole } from '../services/auth';

interface AuthPageProps {
  onLoginSuccess: (userData: any) => void;
  mode?: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess, mode = 'login' }) => {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Details

  const [role, setRole] = useState<UserRole>('student');
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sync mode prop with isLogin state when route changes
  useEffect(() => {
    setIsLogin(mode === 'login');
    setStep(1);
    setError('');
    setSuccessMsg('');
  }, [mode]);

  // Also sync based on location pathname
  useEffect(() => {
    const isLoginPath = location.pathname === '/login' || location.pathname === '/';
    setIsLogin(isLoginPath);
    setStep(1);
    setError('');
    setSuccessMsg('');
  }, [location.pathname]);

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
    const res = await authService.register(name, email, password, role, department);
    if (res.success) {
      if (res.user) {
        onLoginSuccess({
          name: res.user.name || name,
          email: res.user.email || email,
          role: res.user.role || role,
          department: res.user.department || department,
          roll_number: rollNumber || undefined,
          phone_number: phoneNumber || undefined
        });
      } else {
        onLoginSuccess({ name, email, role, department, roll_number: rollNumber, phone_number: phoneNumber });
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
          department: res.user.department || 'Computer Science',
          roll_number: res.user.roll_number,
          phone_number: res.user.phone_number
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
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col items-center justify-center p-4 relative">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-slate-200 border border-slate-100 p-6 relative z-10">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-4 shadow-lg shadow-indigo-100">
            K
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">KEC Career Hub</h1>
          <p className="text-slate-500 font-bold text-sm mt-1">Institution Opportunity Portal</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="text-base">⚠️</span> {error}
          </div>
        )}

        {successMsg && !error && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="text-base">📩</span> {successMsg}
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <RoleSelector compact />
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kongu Email <span className="text-rose-500">*</span></label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@kongu.edu"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button 
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {step === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <RoleSelector compact />
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kongu Email Address <span className="text-rose-500">*</span></label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@kongu.edu"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                  <p className="mt-2 text-[10px] text-slate-400 font-bold ml-1 uppercase tracking-wider">Restricted to @kongu.edu / @kongu.ac.in</p>
                </div>
                <button 
                  disabled={loading}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Verify Email via OTP'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center mb-3">
                  <p className="text-xs font-bold text-slate-600">Enter code sent to:</p>
                  <p className="text-xs font-black text-indigo-600 mt-0.5">{email}</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">6-Digit Code <span className="text-rose-500">*</span></label>
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
                  className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-black text-sm shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button type="button" onClick={() => setStep(1)} className="w-full text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors">Change Email</button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleRegister} className="space-y-3">
                <RoleSelector compact />
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Roll Number</label>
                    <input 
                      type="text" 
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g., 22CS101"
                      className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone</label>
                    <input 
                      type="tel" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91XXXXXXXXXX"
                      className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Department <span className="text-rose-500">*</span></label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics and Communication">Electronics and Communication</option>
                    <option value="Electrical and Electronics">Electrical and Electronics</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                    <option value="Chemical">Chemical</option>
                    <option value="Biotechnology">Biotechnology</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button 
                  disabled={loading}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-6 text-center border-t border-slate-50 pt-5">
          {isLogin ? (
            <Link 
              to="/register"
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              New user? Create an account
            </Link>
          ) : (
            <Link 
              to="/login"
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Back to Sign In
            </Link>
          )}
        </div>
      </div>
      
      <p className="mt-6 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">
        © 2024 Kongu Engineering College
      </p>

      {/* <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div> */}
    </div>
  );
};

export default AuthPage;
