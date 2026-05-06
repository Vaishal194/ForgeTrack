import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Lock, 
  Mail, 
  ArrowRight, 
  GraduationCap, 
  Briefcase,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [isStudent, setIsStudent] = useState(true);
  const [identifier, setIdentifier] = useState(''); // USN or Email
  const [password, setPassword] = useState('');
  const [errorStatus, setErrorStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const inferRoleFromUser = (user) => {
    const metaRole = user?.user_metadata?.role;
    if (metaRole === 'mentor' || metaRole === 'student') return metaRole;
    if (user?.email?.toLowerCase().endsWith('@forge.com')) return 'student';
    return 'mentor';
  };

  const redirectByRole = async (user) => {
    // Fetch role from public.users table
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle(); // Use maybeSingle to avoid error if row doesn't exist yet

    if (error) {
      console.error("Error fetching user role:", error.message);
    }

    // Determine role: Table value > Metadata > Inference
    const role = data?.role || user?.user_metadata?.role || inferRoleFromUser(user);

    if (role === 'mentor') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (role === 'student') {
      navigate('/me/attendance', { replace: true });
      return;
    }

    navigate('/403', { replace: true });
  };

  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await redirectByRole(user);
      }
    };

    redirectIfAuthenticated();
  }, []);

  const submitAuth = async () => {
    setErrorStatus('');
    setLoading(true);
    try {
      const cleanIdentifier = identifier.trim();
      const emailObj = isStudent
        ? (cleanIdentifier.includes('@')
          ? cleanIdentifier.toLowerCase()
          : `${cleanIdentifier.toUpperCase()}@forge.com`)
        : cleanIdentifier.toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailObj,
        password: password
      });

      if (error) throw error;

      const studentDefaultPasswordSeed = cleanIdentifier.includes('@')
        ? cleanIdentifier.split('@')[0].toUpperCase()
        : cleanIdentifier.toUpperCase();

      if (isStudent && password === studentDefaultPasswordSeed) {
        setNeedsPasswordChange(true);
        setLoading(false);
        return;
      }

      await redirectByRole(data.user);
    } catch (err) {
      console.error("Auth error detail:", err);
      const msg = err?.message || "Invalid credentials provided";
      
      // Handle the specific generic error that often indicates a backend trigger/policy failure
      if (msg.toLowerCase().includes('database error querying schema') || 
          msg.toLowerCase().includes('database error')) {
        setErrorStatus('A database policy or trigger issue occurred. Please ensure SQL in schema.sql is applied correctly.');
      } else {
        setErrorStatus(msg);
      }
    } finally {
      if (!needsPasswordChange) setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorStatus('');
    if (newPassword.length < 6) {
      setErrorStatus("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      setNeedsPasswordChange(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await redirectByRole(user);
      }
    } catch (err) {
      setErrorStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-void overflow-hidden">
      {/* Left Side: Illustration & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-inset items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-40">
           <img 
             src="/login_bg.png" 
             alt="Background" 
             className="w-full h-full object-cover"
           />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent opacity-80" />
        
        <div className="relative z-10 max-w-lg animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-accent-glow flex items-center justify-center shadow-2xl mb-8">
            <span className="text-3xl font-display font-bold text-white">F</span>
          </div>
          <h2 className="text-4xl font-display font-bold text-fg-primary mb-4 leading-tight">
            Elevate Your <span className="text-accent-glow">Mentorship</span> Journey
          </h2>
          <p className="text-lg text-fg-secondary leading-relaxed">
            ForgeTrack connects students with expert mentors to build the next generation of innovators. Track progress, share materials, and grow together.
          </p>
        </div>
        
        {/* Subtle decorative elements */}
        <div className="absolute bottom-12 left-12 flex items-center gap-2 text-fg-tertiary text-sm">
          <ShieldCheck size={16} />
          <span>Secure Enterprise Access</span>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 app-main overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent-glow flex items-center justify-center shadow-focus">
              <span className="text-xl font-display font-bold text-white">F</span>
            </div>
          </div>

          <div className="text-center lg:text-left mb-10">
            <h1 className="text-3xl font-display font-bold text-fg-primary mb-2">Welcome Back</h1>
            <p className="text-fg-secondary">Sign in to continue to ForgeTrack</p>
          </div>

          <div className="glass-card rounded-2xl p-8 border border-white/5 relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-glow/50 to-transparent" />

            {needsPasswordChange ? (
              <div className="flex flex-col gap-6">
                <div className="p-4 rounded-xl bg-info-bg/50 border border-info-border flex gap-3">
                  <AlertCircle className="text-info-fg shrink-0" size={20} />
                  <p className="text-sm text-fg-secondary leading-tight">
                    For security, please set a new password for your account.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-fg-secondary uppercase tracking-widest mb-2 ml-1">New Password</label>
                  <div className="relative focus-glow rounded-xl">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" size={18} />
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-surface-inset border border-border-default rounded-xl py-3 pl-11 pr-4 text-fg-primary placeholder:text-fg-tertiary focus:outline-none transition-all"
                      placeholder="At least 6 characters"
                    />
                  </div>
                </div>

                {errorStatus && (
                  <div className="text-xs text-danger-fg bg-danger-bg/50 py-2 px-3 rounded-lg border border-danger-border flex items-center gap-2">
                    <AlertCircle size={14} /> {errorStatus}
                  </div>
                )}

                <button 
                  onClick={handlePasswordReset} 
                  disabled={loading}
                  className="w-full bg-fg-primary text-void font-bold py-3 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </div>
            ) : (
              <>
                {/* Role Switcher */}
                <div className="flex p-1 bg-surface-inset rounded-xl border border-border-default mb-8">
                  <button 
                    onClick={() => { setIsStudent(true); setErrorStatus(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                      isStudent ? 'bg-surface-raised text-fg-primary shadow-sm' : 'text-fg-tertiary hover:text-fg-secondary'
                    }`}
                  >
                    <GraduationCap size={16} /> Student
                  </button>
                  <button 
                    onClick={() => { setIsStudent(false); setErrorStatus(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                      !isStudent ? 'bg-surface-raised text-fg-primary shadow-sm' : 'text-fg-tertiary hover:text-fg-secondary'
                    }`}
                  >
                    <Briefcase size={16} /> Mentor
                  </button>
                </div>

                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-xs font-bold text-fg-secondary uppercase tracking-widest mb-2 ml-1">
                      {isStudent ? 'University Seat Number' : 'Email Address'}
                    </label>
                    <div className="relative focus-glow rounded-xl">
                      {isStudent ? (
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" size={18} />
                      ) : (
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" size={18} />
                      )}
                      <input 
                        type={isStudent ? 'text' : 'email'} 
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        className={`w-full bg-surface-inset border border-border-default rounded-xl py-3 pl-11 pr-4 text-fg-primary placeholder:text-fg-tertiary focus:outline-none transition-all ${isStudent ? 'font-mono uppercase' : ''}`}
                        placeholder={isStudent ? '4SH...' : 'mentor@forge.com'}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2 ml-1">
                      <label className="block text-xs font-bold text-fg-secondary uppercase tracking-widest">Password</label>
                      <button className="text-[10px] font-bold text-accent-glow uppercase tracking-widest hover:underline">Forgot?</button>
                    </div>
                    <div className="relative focus-glow rounded-xl">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" size={18} />
                      <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-surface-inset border border-border-default rounded-xl py-3 pl-11 pr-4 text-fg-primary placeholder:text-fg-tertiary focus:outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {errorStatus && (
                    <div className="text-xs text-danger-fg bg-danger-bg/50 py-2 px-3 rounded-lg border border-danger-border flex items-center gap-2 animate-fade-in">
                      <AlertCircle size={14} /> {errorStatus}
                    </div>
                  )}

                  <button 
                    onClick={submitAuth}
                    disabled={loading || !identifier || !password}
                    className="w-full bg-fg-primary text-void font-bold py-3.5 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-lg shadow-accent-glow/10"
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                    {!loading && <ArrowRight size={18} />}
                  </button>
                </div>
              </>
            )}
          </div>
          
          <p className="mt-8 text-center text-sm text-fg-tertiary">
            Having trouble? <button className="text-fg-secondary hover:text-accent-glow font-medium transition-colors">Contact Support</button>
          </p>
        </div>
      </div>
    </div>
  );
}
