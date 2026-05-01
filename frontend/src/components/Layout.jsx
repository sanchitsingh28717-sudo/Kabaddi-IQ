import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Users, UserSquare, Gavel, LogOut, Settings, X, Edit2 } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  
  // Global Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ email: '', phone: '' });

  React.useEffect(() => {
    // Basic mock user logic for UI demonstration. In production, use Supabase Auth and context.
    const currentUser = JSON.parse(localStorage.getItem('pkl_user'));
    if (!currentUser && location.pathname !== '/login') {
      navigate('/login');
    } else {
      setUser(currentUser);
    }
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('pkl_user');
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleOpenSettings = () => {
    setSettingsForm({ 
        email: user?.email || '', 
        phone: user?.phone || '' 
    });
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const updatedUser = { ...user, ...settingsForm };
    setUser(updatedUser);
    localStorage.setItem('pkl_user', JSON.stringify(updatedUser));
    setIsSettingsOpen(false);
  };

  if (!user || location.pathname === '/login') {
    return <Outlet />;
  }

  const role = user?.role || 'analyst';

  const navItems = [
    { name: 'Coach Dashboard', path: '/coach', icon: Users, roles: ['coach', 'auction_manager'] },
    { name: 'Player Profile', path: '/player', icon: UserSquare, roles: ['player', 'coach', 'analyst', 'auction_manager'] },
    { name: 'League Analytics', path: '/analyst', icon: LayoutDashboard, roles: ['analyst', 'coach', 'auction_manager'] },
    { name: 'Auction Tool', path: '/auction', icon: Gavel, roles: ['auction_manager'] },
  ].filter(item => item.roles.includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface font-body mat-texture selection:bg-primary selection:text-on-primary">
      {/* Sidebar: Command Column */}
      <aside className="w-64 bg-surface/90 border-r border-white/5 flex flex-col z-20 backdrop-blur-xl shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-white/5 bg-surface-container-low/50">
          <div className="font-black text-4xl uppercase tracking-tighter text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] font-headline italic">
            KABADDI<span className="text-primary not-italic tracking-normal"> IQ</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 bg-transparent">
          <div className="px-6 text-xs font-headline font-bold tracking-widest text-outline uppercase mb-4 opacity-50">Modules</div>
          <ul className="space-y-2 px-3">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 group rounded-xl ${
                    active
                      ? 'neomorphic-interactive text-primary border border-primary/30'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <item.icon className={`h-5 w-5 mr-3 flex-shrink-0 transition-transform duration-300 ${
                    active ? 'text-primary scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'text-neutral-500 group-hover:text-neutral-300'
                  }`} />
                  {item.name}
                </Link>
              </li>
            );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="fixed inset-0 bg-grain pointer-events-none z-[1]"></div>
        {/* Top Navbar: Status HUD */}
        <header className="h-16 bg-surface/80 border-b border-white/5 flex items-center justify-between px-8 z-10 w-full backdrop-blur-md">
          <div className="flex items-center">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter font-headline">
              {navItems.find(i => i.path === location.pathname)?.name || 'Command Center'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 silk-inset px-4 py-1.5 rounded-full border border-white/5 hidden sm:flex">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
              <span className="text-[10px] font-headline font-black uppercase tracking-widest text-white">{role} MODE</span>
            </div>
            
            <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-white uppercase font-body tracking-wide">{user?.email || 'Admin User'}</div>
                <div className="text-[10px] font-headline font-bold text-primary uppercase tracking-widest flex items-center justify-end gap-2">
                    {user?.phone ? user.phone : 'NO PHONE SECURED'} • {user?.team_id || 'System Access'}
                </div>
              </div>
              
              <button 
                onClick={handleOpenSettings}
                className="w-10 h-10 silk-card flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 text-primary transition-all rounded-full border border-white/5 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] shadow-silk-soft"
                title="Account Settings"
              >
                <Settings className="h-4 w-4" />
              </button>

              <button 
                onClick={handleLogout}
                className="w-10 h-10 silk-card flex items-center justify-center hover:bg-error/20 hover:border-error/50 hover:text-error active:shadow-silk-pressed transition-all text-neutral-400 rounded-full border border-white/5"
                title="Disconnect"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Global Account Edit Modal overlay */}
        {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e0e0e]/80 backdrop-blur-md animate-fade-up">
                <div className="absolute inset-0" onClick={() => setIsSettingsOpen(false)}></div>
                <div className="relative z-10 w-full max-w-md bg-surface-container-low border border-primary/20 rounded-2xl p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] shadow-primary/10">
                    <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-2xl font-black font-headline tracking-tighter uppercase text-white mb-2 flex items-center gap-3">
                        <Edit2 className="text-primary w-6 h-6" /> Account Specs
                    </h3>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mb-6 border-b border-white/5 pb-6">Modify Global Access Credentials</p>

                    <form onSubmit={handleSaveSettings} className="space-y-5">
                        <div>
                            <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em] mb-1">Communication Email</label>
                            <input 
                                type="email"
                                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white font-headline focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all" 
                                value={settingsForm.email} 
                                onChange={e => setSettingsForm({...settingsForm, email: e.target.value})} 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em] mb-1">Secure Phone Line</label>
                            <input 
                                type="tel"
                                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white font-headline focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all" 
                                value={settingsForm.phone} 
                                onChange={e => setSettingsForm({...settingsForm, phone: e.target.value})}
                                placeholder="+91 00000 00000"
                            />
                        </div>
                        
                        <div className="pt-4 flex gap-4">
                            <button type="submit" className="flex-1 bg-primary text-[#0e0e0e] font-black uppercase tracking-widest text-xs py-3 rounded-xl hover:brightness-125 transition-all shadow-silk-soft">
                                Commit Upgrades
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto scroll-smooth relative z-10 p-6 md:p-8 pt-10 pb-32">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
