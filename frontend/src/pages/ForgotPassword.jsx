import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import playerCredentials from '../data/player_credentials.json';
import coachCredentials from '../data/coach_credentials.json';
import { Activity, ShieldAlert, Mail, Smartphone, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  // Multi-step flow state: 'identify' -> 'contact' -> 'verify'
  const [step, setStep] = useState('identify');
  
  // Identify State
  const [operatorEmail, setOperatorEmail] = useState('');
  const [targetUser, setTargetUser] = useState(null); 

  // Contact State
  const [recoveryMethod, setRecoveryMethod] = useState('email'); // 'email' or 'phone'
  const [contactValue, setContactValue] = useState('');

  // Verify State
  const [otpValue, setOtpValue] = useState('');
  
  const [loading, setLoading] = useState(false);

  // Step 1
  const handleIdentify = (e) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const playerMatch = playerCredentials.find(c => c.email.toLowerCase() === operatorEmail.toLowerCase());
      if (playerMatch) {
        setTargetUser({ email: playerMatch.email, role: 'player', team_id: null, player_id: playerMatch.player_id });
        setLoading(false);
        setStep('contact');
        return;
      }

      const coachMatch = coachCredentials.find(c => c.email.toLowerCase() === operatorEmail.toLowerCase());
      if (coachMatch) {
        setTargetUser({ email: coachMatch.email, role: 'coach', team_id: coachMatch.team_id, player_id: null });
        setLoading(false);
        setStep('contact');
        return;
      }

      alert("Operator ID not found in system registers.");
      setLoading(false);
    }, 800); 
  };

  // Step 2
  const handleRecovery = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: recoveryMethod, contact: contactValue })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send recovery message');
      }

      setStep('verify');
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3
  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contactValue, otp: otpValue })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to verify OTP');
      }

      // Automatically log them in
      localStorage.setItem('pkl_user', JSON.stringify(targetUser));
      
      if (targetUser.role === 'coach') navigate('/coach');
      else if (targetUser.role === 'player') navigate('/player');
      else if (targetUser.role === 'analyst') navigate('/analyst');
      else navigate('/auction');

    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden mat-texture">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-error/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md p-10 bg-surface-container-low/80 backdrop-blur-xl border border-white/5 relative z-10 shadow-2xl rounded-2xl">
        <div className="text-center mb-8 flex flex-col items-center">
          <ShieldAlert className="w-12 h-12 text-error mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse" />
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white mb-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] font-headline italic">SYSTEM <span className="text-error tracking-normal not-italic">OVERRIDE</span></h1>
          <p className="text-neutral-400 font-headline font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Emergency Recovery Protocol</p>
        </div>

        {step === 'identify' && (
          <form onSubmit={handleIdentify} className="space-y-6 animate-fade-in">
             <div>
              <label className="block font-headline font-bold text-[10px] text-outline uppercase tracking-widest mb-2">
                Registered Operator Email
              </label>
              <input 
                type="email" 
                required
                value={operatorEmail}
                onChange={e => setOperatorEmail(e.target.value)}
                className="w-full bg-surface-container border border-white/10 px-4 py-3 text-white font-headline focus:outline-none focus:border-error focus:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all rounded-lg"
                placeholder="coach@patnapirates.com"
              />
            </div>
            
            <div className="pt-4 space-y-4">
              <button 
                type="submit" 
                disabled={loading || !operatorEmail}
                className="w-full bg-error/10 border border-error text-error hover:bg-error hover:text-white font-black uppercase tracking-widest text-[10px] py-4 transition-all duration-300 rounded-xl disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.2)] flex justify-center items-center gap-2"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'LOCATING ACCOUNT...' : 'INITIATE OVERRIDE SEQUENCE'}
              </button>
              <div className="text-center mt-4">
                <Link to="/login" className="font-headline font-bold text-[10px] text-neutral-500 hover:text-primary transition-all uppercase tracking-widest">
                  &lt; Abort Protocol & Return
                </Link>
              </div>
            </div>
          </form>
        )}

        {step === 'contact' && (
          <form onSubmit={handleRecovery} className="space-y-6 animate-fade-in">
            <div className="p-4 border border-primary/30 bg-primary/10 rounded-lg text-left mb-6">
              <p className="text-white font-headline text-xs font-bold uppercase tracking-widest">
                Account Secured: <span className="text-primary">{targetUser.email}</span>
              </p>
            </div>

            <div className="flex bg-surface-container rounded-xl border border-white/5 mb-4 p-1">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 py-3 font-headline font-black text-[10px] uppercase tracking-widest transition-all rounded-lg ${recoveryMethod === 'email' ? 'bg-primary text-[#0e0e0e] shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'text-neutral-500 hover:text-white'}`}
                onClick={() => { setRecoveryMethod('email'); setContactValue(''); }}
              >
                <Mail className="w-3 h-3" /> Email OTP
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 py-3 font-headline font-black text-[10px] uppercase tracking-widest transition-all rounded-lg ${recoveryMethod === 'phone' ? 'bg-primary text-[#0e0e0e] shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'text-neutral-500 hover:text-white'}`}
                onClick={() => { setRecoveryMethod('phone'); setContactValue(''); }}
              >
                <Smartphone className="w-3 h-3" /> SMS OTP
              </button>
            </div>

            <div>
              <label className="block font-headline font-bold text-[10px] text-outline uppercase tracking-widest mb-2">
                {recoveryMethod === 'email' ? 'Secure Email Relay Target' : 'Secure Phone Line Target'}
              </label>
              <input 
                type={recoveryMethod === 'email' ? 'email' : 'tel'} 
                required
                value={contactValue}
                onChange={e => setContactValue(e.target.value)}
                className="w-full bg-surface-container border border-white/10 px-4 py-3 text-white font-headline focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all rounded-lg"
                placeholder={recoveryMethod === 'email' ? 'singhsanchit28717@gmail.com' : '+91 8353945200'}
              />
            </div>
            
            <div className="pt-4 space-y-4">
              <button 
                type="submit" 
                disabled={loading || !contactValue}
                className="w-full bg-primary border-none text-[#0e0e0e] font-black uppercase tracking-widest text-[10px] py-4 transition-all duration-300 rounded-xl disabled:opacity-50 disabled:pointer-events-none hover:brightness-125 shadow-[0_0_15px_rgba(99,102,241,0.3)] flex justify-center items-center gap-2"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loading ? 'TRANSMITTING KEY...' : 'TRANSMIT RECOVERY KEY'}
              </button>
              <div className="text-center mt-4">
                <button 
                  type="button"
                  onClick={() => setStep('identify')} 
                  className="font-headline font-bold text-[10px] text-neutral-500 hover:text-white transition-all uppercase tracking-widest bg-transparent border-none cursor-pointer"
                >
                  &lt; Step Back
                </button>
              </div>
            </div>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-6 animate-fade-in">
            <div className="p-4 border border-primary/30 bg-primary/10 rounded-lg text-center mb-6">
              <p className="text-xs font-bold text-white uppercase tracking-widest leading-relaxed">
                Key Dispatched To:<br/><span className="text-primary text-sm">{contactValue}</span>
              </p>
            </div>
            <div>
              <label className="block text-center font-headline font-bold text-[10px] text-outline uppercase tracking-widest mb-2">
                Input 6-Digit Decryption Key
              </label>
              <input 
                type="text" 
                required
                maxLength="6"
                value={otpValue}
                onChange={e => setOtpValue(e.target.value)}
                className="w-full bg-surface-container border border-white/10 px-4 py-3 text-white font-headline text-center tracking-[0.5em] font-black text-2xl focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all rounded-lg"
                placeholder="000000"
              />
            </div>
            <div className="pt-4 space-y-4">
              <button 
                type="submit" 
                disabled={loading || otpValue.length < 6}
                className="w-full bg-primary border-none text-[#0e0e0e] font-black uppercase tracking-widest text-[10px] py-4 transition-all duration-300 rounded-xl disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:brightness-125 flex justify-center gap-2 items-center"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'DECRYPTING...' : 'DECRYPT & LOGIN'}
              </button>
              <div className="text-center mt-4">
                <button 
                  type="button"
                  onClick={() => setStep('contact')} 
                  className="font-headline font-bold text-[10px] text-error/70 hover:text-error transition-all uppercase tracking-widest bg-transparent border-none cursor-pointer"
                >
                  &lt; Target incorrect? Retransmit.
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
