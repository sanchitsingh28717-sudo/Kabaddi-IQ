import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import playerCredentials from '../data/player_credentials.json';
import coachCredentials from '../data/coach_credentials.json';

/* ─── Animated kabaddi mat canvas background ─── */
function MatCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Raider dots
    const dots = Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const W = canvas.width;
      const H = canvas.height;

      // ── Court outline ──
      ctx.save();
      ctx.strokeStyle = 'rgba(99,102,241,0.12)';
      ctx.lineWidth = 1;
      // outer rect
      const mx = W * 0.08, my = H * 0.12;
      ctx.strokeRect(mx, my, W - mx * 2, H - my * 2);
      // center line
      ctx.beginPath();
      ctx.moveTo(W / 2, my);
      ctx.lineTo(W / 2, H - my);
      ctx.stroke();
      // baulk lines
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(99,102,241,0.08)';
      [0.35, 0.65].forEach(frac => {
        ctx.beginPath();
        ctx.moveTo(mx, H * frac);
        ctx.lineTo(W - mx, H * frac);
        ctx.stroke();
      });
      // bonus lines
      ctx.strokeStyle = 'rgba(99,102,241,0.05)';
      [0.25, 0.75].forEach(frac => {
        ctx.beginPath();
        ctx.moveTo(mx, H * frac);
        ctx.lineTo(W - mx, H * frac);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // ── Animated pulse ring at center ──
      const pulse = (Math.sin(t * 2) + 1) / 2;
      const ringR = 60 + pulse * 30;
      const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, ringR);
      grad.addColorStop(0, 'rgba(99,102,241,0)');
      grad.addColorStop(0.7, `rgba(99,102,241,${0.06 * pulse})`);
      grad.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, ringR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // ── Moving dots (raiders) ──
      dots.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > W) d.vx *= -1;
        if (d.y < 0 || d.y > H) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(129,140,248,${d.alpha})`;
        ctx.fill();
      });

      // ── Connect nearby dots ──
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}

/* ─── Ticker tape of kabaddi stats ─── */
const TICKER_ITEMS = [
  'RAID SUCCESS RATE  68.4%',
  'SUPER RAIDS THIS SEASON  142',
  'TOTAL MATCHES PLAYED  103',
  'AVG POINTS PER MATCH  31.2',
  'SUPER TACKLES  89',
  'ALL-OUTS INFLICTED  47',
  'WIN PROBABILITY ENGINE  ACTIVE',
  'PLAYERS TRACKED  500+',
];

function Ticker() {
  return (
    <div className="overflow-hidden whitespace-nowrap border-y border-white/5 py-2 bg-black/30 backdrop-blur-sm">
      <div className="inline-flex animate-ticker">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-3 mx-6 text-[10px] font-black font-headline uppercase tracking-[0.2em] text-neutral-500">
            <span className="w-1 h-1 rounded-full bg-primary inline-block" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Role card selector ─── */
const ROLES = [
  { id: 'analyst',        label: 'Analyst',     icon: '📊', desc: 'League & match data' },
  { id: 'coach',          label: 'Coach',        icon: '🧠', desc: 'Tactical dashboard' },
  { id: 'player',         label: 'Player',       icon: '⚡', desc: 'Personal profile' },
  { id: 'auction_manager',label: 'Auction Mgr',  icon: '🔨', desc: 'Roster & valuation' },
];

/* ─── Main Login component ─── */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('analyst');
  const [teamObj, setTeamObj]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [step, setStep]         = useState('role'); // 'role' | 'creds'
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    let foundPlayerId = null;
    let explicitTeamId = teamObj;

    if (role === 'player') {
      const match = playerCredentials.find(
        c => c.email.toLowerCase() === email.toLowerCase() && c.password === password
      );
      if (!match) {
        alert('Invalid player credentials.');
        setLoading(false);
        return;
      }
      foundPlayerId = match.player_id;
    }

    if (role === 'coach') {
      const match = coachCredentials.find(
        c => c.email.toLowerCase() === email.toLowerCase() && c.password === password
      );
      if (!match) {
        alert('Invalid coach credentials.');
        setLoading(false);
        return;
      }
      explicitTeamId = match.team_id;
    }

    localStorage.setItem('pkl_user', JSON.stringify({ email, role, team_id: explicitTeamId, player_id: foundPlayerId }));
    setTransitioning(true);

    setTimeout(() => {
      setLoading(false);
      if (role === 'coach')           navigate('/coach');
      else if (role === 'player')     navigate('/player');
      else if (role === 'analyst')    navigate('/analyst');
      else                            navigate('/auction');
    }, 2400);
  };

  const selectedRole = ROLES.find(r => r.id === role);

  return (
    <>
      {/* ── Global keyframes injected once ── */}
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .animate-ticker { animation: ticker 28s linear infinite; }

        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-fade-up {
          opacity: 0;
          animation: loginFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards;
        }

        @keyframes glowPulse {
          0%,100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.08); }
        }
        .glow-orb { animation: glowPulse 4s ease-in-out infinite; }

        @keyframes rotateSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .rotate-slow { animation: rotateSlow 20s linear infinite; }

        @keyframes scanLine {
          0%   { top: 0%;   opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scan-line { animation: scanLine 5s linear infinite; }

        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        .cursor-blink { animation: blink 1s step-end infinite; }

        @keyframes slideRight {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        .slide-right { animation: slideRight 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }

        .role-card {
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.02);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .role-card:hover {
          border-color: rgba(99,102,241,0.4);
          background: rgba(99,102,241,0.06);
        }
        .role-card.active {
          border-color: rgba(99,102,241,0.7);
          background: rgba(99,102,241,0.12);
          box-shadow: 0 0 20px rgba(99,102,241,0.15);
        }

        .glass-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 13px 16px;
          color: #fff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px;
          outline: none;
          transition: all 0.25s;
        }
        .glass-input:focus {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.05);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .glass-input::placeholder { color: rgba(255,255,255,0.18); }

        .glass-select {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 13px 16px;
          color: #fff;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13px;
          outline: none;
          transition: all 0.25s;
          appearance: none;
          cursor: pointer;
        }
        .glass-select:focus {
          border-color: rgba(99,102,241,0.6);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .glass-select option { background: #0e0e0e; }

        .auth-btn {
          width: 100%;
          padding: 15px;
          border-radius: 12px;
          border: none;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s;
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%);
          color: #fff;
          box-shadow: 0 8px 30px rgba(99,102,241,0.4);
        }
        .auth-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(99,102,241,0.55);
        }
        .auth-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-btn .sweep {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }
        .auth-btn:hover .sweep { transform: translateX(100%); }

        /* Transition overlay */
        @keyframes expandCircle {
          from { transform: scale(0); opacity: 1; }
          to   { transform: scale(40); opacity: 1; }
        }
        .expand-circle { animation: expandCircle 0.8s cubic-bezier(0.4,0,0.2,1) forwards; }

        @keyframes transitionText {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          30%  { opacity: 1; transform: translateY(0) scale(1); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .transition-text { animation: transitionText 2.2s ease forwards; }

        @keyframes bounceDrop {
          0%   { opacity: 0; transform: translateY(-80px) scale(0.6); }
          55%  { opacity: 1; transform: translateY(16px) scale(1.08); }
          72%  { transform: translateY(-8px) scale(0.97); }
          84%  { transform: translateY(6px) scale(1.03); }
          93%  { transform: translateY(-3px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatBounce {
          0%,100% { transform: translateY(0);   }
          50%     { transform: translateY(-8px); }
        }
        .bounce-word-1 {
          opacity: 0;
          animation: bounceDrop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.35s forwards;
        }
        .bounce-word-2 {
          opacity: 0;
          animation: bounceDrop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.6s forwards;
        }
        .float-loop {
          animation: floatBounce 2s ease-in-out 1.3s infinite;
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-[#07070f] relative overflow-hidden">

        {/* ── Canvas background ── */}
        <div className="absolute inset-0">
          <MatCanvas />
        </div>

        {/* ── Glow orbs ── */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full glow-orb pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full glow-orb pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)', animationDelay: '2s' }} />

        {/* ── Scan line ── */}
        <div className="scan-line absolute left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)' }} />

        {/* ── Top nav bar ── */}
        <header className={`relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 ${mounted ? 'login-fade-up' : 'opacity-0'}`}
          style={{ animationDelay: '0s' }}>
          <div className="flex items-center gap-3">
            {/* Rotating hexagon logo mark */}
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full rotate-slow opacity-60">
                <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="#6366f1" strokeWidth="1.5" />
              </svg>
              <span className="text-primary font-black text-xs font-headline relative z-10">K</span>
            </div>
            <div>
              <p className="font-headline font-black text-white text-sm uppercase tracking-[0.15em] leading-none">
                Kabaddi<span className="text-primary">IQ</span>
              </p>
              <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-[0.3em] leading-none mt-0.5">Pro Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black font-headline uppercase tracking-widest text-neutral-500">Systems Online</span>
          </div>
        </header>

        {/* ── Ticker ── */}
        <div className={`relative z-10 ${mounted ? 'login-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
          <Ticker />
        </div>

        {/* ── Main content ── */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-4xl">

            {/* ── Hero headline ── */}
            <div className={`text-center mb-10 ${mounted ? 'login-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-black font-headline uppercase tracking-[0.3em] text-primary">Season 11 · Live Intelligence</span>
              </div>

              <h1 className="font-headline font-black uppercase leading-none tracking-tighter text-white mb-3"
                style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)' }}>
                THE ARENA
                <br />
                <span style={{
                  background: 'linear-gradient(90deg, #6366f1, #818cf8, #a5b4fc, #818cf8, #6366f1)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'ticker 4s linear infinite',
                }}>
                  AWAITS
                </span>
              </h1>
              <p className="text-neutral-500 font-body text-sm max-w-md mx-auto leading-relaxed">
                Real-time match intelligence, AI win-probability forecasting, and tactical analytics for every role in the game.
              </p>
            </div>

            {/* ── Two-column layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

              {/* LEFT: Role selector */}
              <div className={`${mounted ? 'login-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.35s' }}>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm">
                  <p className="text-[10px] font-black font-headline uppercase tracking-[0.3em] text-neutral-500 mb-4">
                    01 — Select Clearance Level
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {ROLES.map(r => (
                      <div
                        key={r.id}
                        className={`role-card ${role === r.id ? 'active' : ''}`}
                        onClick={() => setRole(r.id)}
                      >
                        <span className="text-xl leading-none">{r.icon}</span>
                        <div>
                          <p className="text-xs font-black font-headline uppercase tracking-wide text-white leading-none">{r.label}</p>
                          <p className="text-[9px] text-neutral-500 font-bold mt-0.5">{r.desc}</p>
                        </div>
                        {role === r.id && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Active role display */}
                  <div className="border-t border-white/5 pt-4">
                    <div className="flex items-center gap-3 bg-primary/8 border border-primary/15 rounded-xl p-3">
                      <span className="text-2xl">{selectedRole?.icon}</span>
                      <div>
                        <p className="text-xs font-black font-headline uppercase tracking-widest text-primary">{selectedRole?.label} Access</p>
                        <p className="text-[10px] text-neutral-500 font-bold">{selectedRole?.desc}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-[9px] font-black font-headline uppercase tracking-widest text-neutral-600">Clearance</p>
                        <p className="text-[10px] font-black text-white font-headline">T3 GRANTED</p>
                      </div>
                    </div>
                  </div>

                  {/* Squad selector (only relevant for coach/player) */}
                  {(role === 'analyst' || role === 'auction_manager') ? null : (
                    <div className="mt-4">
                      <label className="block text-[10px] font-black font-headline uppercase tracking-[0.3em] text-neutral-500 mb-2">Squad Affiliation</label>
                      <div className="relative">
                        <select value={teamObj} onChange={e => setTeamObj(e.target.value)} className="glass-select">
                          <option value="">— Select Team —</option>
                          <option value="Bengal Warriors">Bengal Warriors</option>
                          <option value="Bengaluru Bulls">Bengaluru Bulls</option>
                          <option value="Dabang Delhi K.C.">Dabang Delhi K.C.</option>
                          <option value="Gujarat Fortunegiants">Gujarat Fortunegiants</option>
                          <option value="Haryana Steelers">Haryana Steelers</option>
                          <option value="Jaipur Pink Panthers">Jaipur Pink Panthers</option>
                          <option value="Patna Pirates">Patna Pirates</option>
                          <option value="Puneri Paltan">Puneri Paltan</option>
                          <option value="Tamil Thalaivas">Tamil Thalaivas</option>
                          <option value="Telugu Titans">Telugu Titans</option>
                          <option value="U Mumba">U Mumba</option>
                          <option value="U.P. Yoddha">U.P. Yoddha</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                            <path d="M1 1l4 4 4-4" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Credentials form */}
              <div className={`${mounted ? 'login-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.5s' }}>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm">
                  <p className="text-[10px] font-black font-headline uppercase tracking-[0.3em] text-neutral-500 mb-4">
                    02 — Enter Credentials
                  </p>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black font-headline uppercase tracking-widest text-neutral-500 mb-2">
                        Operator ID <span className="text-primary">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="glass-input"
                        placeholder="operator@kabaddiiq.com"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black font-headline uppercase tracking-widest text-neutral-500 mb-2">
                        Access Key <span className="text-primary">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="glass-input"
                        placeholder="••••••••••"
                      />
                    </div>

                    {/* Terminal-style status line */}
                    <div className="bg-black/40 border border-white/5 rounded-lg px-4 py-3 font-headline text-[11px]">
                      <span className="text-emerald-400">▶</span>
                      <span className="text-neutral-500 ml-2">role</span>
                      <span className="text-white ml-1 font-black uppercase">{selectedRole?.label}</span>
                      <span className="text-neutral-600 mx-2">·</span>
                      <span className="text-neutral-500">status</span>
                      <span className="text-emerald-400 ml-1 font-black">READY</span>
                      <span className="cursor-blink text-primary ml-1">_</span>
                    </div>

                    <button type="submit" disabled={loading || transitioning} className="auth-btn">
                      <div className="sweep" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {(loading || transitioning) && (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                        )}
                        {loading || transitioning ? 'AUTHENTICATING...' : 'ENTER THE ARENA →'}
                      </span>
                    </button>

                    <div className="text-center">
                      <Link
                        to="/forgot-password"
                        className="text-[10px] font-black font-headline uppercase tracking-widest text-neutral-600 hover:text-primary transition-colors"
                      >
                        System Override / Recovery
                      </Link>
                    </div>
                  </form>
                </div>

                {/* Bottom stat strip */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { val: '12', label: 'Teams' },
                    { val: '103', label: 'Matches' },
                    { val: '500+', label: 'Players' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-center">
                      <p className="font-headline font-black text-white text-lg leading-none">{s.val}</p>
                      <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className={`relative z-10 border-t border-white/5 px-8 py-4 flex items-center justify-between ${mounted ? 'login-fade-up' : 'opacity-0'}`}
          style={{ animationDelay: '0.7s' }}>
          <p className="text-[10px] font-bold font-headline uppercase tracking-[0.3em] text-neutral-700">
            Pro Kabaddi League · Analytics Platform · v2.0
          </p>
          <p className="text-[10px] font-bold font-headline uppercase tracking-[0.3em] text-neutral-700">
            T3 Clearance Required
          </p>
        </footer>
      </div>

      {/* ── Cinematic transition overlay (original RAID SUCCESS) ── */}
      {transitioning && (
        <div className="fixed inset-0 z-50 bg-[#0e0e0e] flex items-center justify-center overflow-hidden">
          {/* Background texture & pulse */}
          <div className="absolute inset-0 bg-primary/5 mat-texture pointer-events-none opacity-50"></div>

          {/* Baulk line sweep — horizontal bar */}
          <div
            className="absolute left-0 top-1/2 h-[4px] bg-primary z-0 shadow-[0_0_30px_rgba(99,102,241,1)] transition-all ease-out duration-[1500ms] w-0"
            ref={el => { if (el) setTimeout(() => { el.style.width = '100%'; }, 50); }}
          />
          <div
            className="absolute left-0 top-1/2 h-[60px] bg-gradient-to-t from-primary/0 via-primary/20 to-primary/0 z-0 transition-all ease-out duration-[1500ms] w-0 -translate-y-1/2"
            ref={el => { if (el) setTimeout(() => { el.style.width = '100%'; }, 50); }}
          />

          {/* Text */}
          <div className="relative z-10 flex flex-col items-center justify-center mix-blend-screen text-center px-4 w-full h-full pt-16">
            <div className="float-loop flex flex-col items-center">
              <div className="flex items-end gap-4 md:gap-6">
                <h1 className="bounce-word-1 text-6xl md:text-9xl font-black font-headline uppercase tracking-tighter text-white">
                  KHEL
                </h1>
                <h1 className="bounce-word-2 text-6xl md:text-9xl font-black font-headline uppercase tracking-tighter">
                  <span className="text-primary italic">KABBADI</span>
                </h1>
              </div>
            </div>
            <p
              className="mt-6 md:mt-4 font-headline font-bold text-xs md:text-sm text-primary uppercase tracking-[0.4em] transition-all duration-700 opacity-0"
              ref={el => { if (el) setTimeout(() => { el.style.opacity = '1'; }, 1200); }}
            >
              Crossing the Baulk Line...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
