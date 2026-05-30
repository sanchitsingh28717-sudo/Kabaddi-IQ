import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Zap, Activity, Edit2, Upload, ExternalLink } from 'lucide-react';
import { Bar, BarChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { playerService } from '../services/playerService';

const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop";
const DEFAULT_THUMBNAIL = "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop";

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [chartType, setChartType] = useState('radar');
  
  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', position: '', photo_url: '' });

  useEffect(() => {
    const userStr = localStorage.getItem('pkl_user');
    let uRole = null;
    let pId = null;
    let tId = null;
    if (userStr) {
      const u = JSON.parse(userStr);
      uRole = u.role;
      pId = u.player_id;
      tId = u.team_id;
      setUserRole(uRole);
    }
    fetchPlayers(uRole, pId, tId);
  }, []);

  const fetchPlayers = async (role, pId, tId) => {
    setLoading(true);
    const teamFilter = (role === 'coach' && tId) ? tId : undefined;
    
    try {
      const data = await playerService.getPlayers(undefined, teamFilter);
      setPlayers(data);
      
      if (role === 'player' && pId) {
         const myData = data.find(p => p.id === pId);
         if (myData) {
           setSelectedPlayer(myData);
         }
      } else if (data.length > 0) {
          setSelectedPlayer(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.position && p.position.toLowerCase().includes(term)) ||
      (p.team?.name && p.team.name.toLowerCase().includes(term))
    );
  });

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditForm({ 
        name: selectedPlayer?.name || '', 
        position: selectedPlayer?.position || '', 
        photo_url: selectedPlayer?.photo_url || '' 
      });
    }
    setIsEditing(!isEditing);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, photo_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const updatedPlayer = { ...selectedPlayer, ...editForm };
    
    // Optimistic UI Update
    setSelectedPlayer(updatedPlayer);
    setPlayers(players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
    setIsEditing(false);
    
    // Save to Database via Service
    playerService.updatePlayer(updatedPlayer.id, {
      name: editForm.name,
      position: editForm.position,
      photo_url: editForm.photo_url
    }).catch(err => {
      console.error("Error saving profile:", err);
      alert("Error: " + (err.message || "Could not save modifications. Make sure the backend server is running."));
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Loading Player Data...</p>
      </div>
    );
  }

  if (!loading && players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Shield className="w-12 h-12 text-neutral-700" />
        <p className="text-white font-headline text-xl font-black uppercase">No Players Found</p>
        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest max-w-xs">
          The backend may be offline or the database is empty. Make sure the server is running.
        </p>
        <button
          onClick={() => fetchPlayers(userRole, null, null)}
          className="mt-2 px-6 py-2 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-lg hover:brightness-125 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const p = selectedPlayer || { name: 'NO PLAYER', position: '-', points: 0, successful_raid_pct: 0, tackle_success_rate: 0 };
  const pdr = Math.round((p.successful_raid_pct * 0.6) + (p.tackle_success_rate * 0.4) + (p.points / 10));

  const radarData = [
    { subject: 'Raid %', A: p.successful_raid_pct || 0, fullMark: 100 },
    { subject: 'Tackle %', A: p.tackle_success_rate || 0, fullMark: 100 },
    { subject: 'Super Raids', A: Math.min((p.super_raids || 0) * 10, 100), fullMark: 100 },
    { subject: 'Super 10s', A: Math.min((p.super_10s || 0) * 10, 100), fullMark: 100 },
    { subject: 'High 5s', A: Math.min((p.high_5s || 0) * 20, 100), fullMark: 100 },
    { subject: 'Not Out %', A: p.not_out_pct || 0, fullMark: 100 },
  ];

  return (
    <div className="space-y-6 animate-fade-up w-full relative z-10">
      {/* Hero Section: Featured Player */}
      {selectedPlayer && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-end">
          <div className="lg:col-span-6 relative group">
            <div className="absolute -top-12 -left-8 text-[6rem] sm:text-[12rem] font-black text-white/[0.03] font-headline leading-none select-none uppercase overflow-hidden whitespace-nowrap hidden sm:block">
              {p.position?.split(' ')[0] || 'PLAYER'}
            </div>
            
            <div className="relative z-10 aspect-[4/5] md:aspect-[4/3] overflow-hidden rounded-xl bg-surface-container shadow-2xl border border-white/5 transition-all duration-500 group-hover:border-primary/40 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              
              {/* Image Layer */}
              <img 
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-110 group-hover:scale-100" 
                alt={p.name} 
                src={p.photo_url || DEFAULT_PHOTO} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent opacity-90"></div>
              
              {/* Player Ownership Edit Toggle */}
              {userRole === 'player' && (
                  <div className="absolute top-4 right-4 z-30">
                    <button 
                      onClick={handleEditToggle} 
                      className="flex items-center gap-2 bg-surface-container-highest/80 backdrop-blur-sm border border-white/10 text-white font-bold uppercase tracking-widest text-[10px] py-2 px-4 rounded-full hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95"
                    >
                      <Edit2 className="w-3 h-3" /> {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                    </button>
                  </div>
              )}

              {/* Edit Profile Overlay Form */}
              {isEditing && (
                <form onSubmit={handleSaveProfile} className="absolute inset-0 bg-[#0e0e0e]/95 backdrop-blur-xl z-20 flex flex-col justify-center px-8 sm:px-12 animate-fade-up border border-primary/20 rounded-xl">
                    <h3 className="text-2xl font-black font-headline tracking-tighter uppercase text-white mb-6 flex items-center gap-3">
                        <Edit2 className="text-primary w-6 h-6" /> Modify Profile Parameters
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em] mb-1">Operator Alias / Name</label>
                            <input 
                                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white font-headline focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all" 
                                value={editForm.name} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em] mb-1">Tactical Position</label>
                            <input 
                                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white font-headline focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all" 
                                value={editForm.position} 
                                onChange={e => setEditForm({...editForm, position: e.target.value})} 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-primary font-bold uppercase tracking-[0.2em] mb-1">Visual Identity Upload</label>
                            <label className="w-full flex items-center justify-center gap-2 bg-surface border border-white/10 border-dashed rounded-lg px-4 py-4 text-white font-body text-sm cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors group">
                                <Upload className="w-4 h-4 text-neutral-400 group-hover:text-primary transition-colors" />
                                <span className="text-neutral-400 group-hover:text-primary transition-colors">Select new avatar image</span>
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                            </label>
                            {editForm.photo_url && editForm.photo_url.startsWith('data:') && (
                                <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Image data cached for commit
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex gap-4 mt-8">
                        <button type="submit" className="flex-1 bg-primary text-[#0e0e0e] font-black uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:brightness-125 transition-all shadow-silk-soft">
                            Commit Changes
                        </button>
                    </div>
                </form>
              )}

              {/* Read-Only Info Layer */}
              <div className={`absolute bottom-8 left-8 right-8 transition-opacity duration-300 ${isEditing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center gap-4 mb-2">
                  <span className="bg-primary text-white px-3 py-1 text-[10px] font-bold font-headline rounded-full tracking-widest uppercase shadow-lg shadow-primary/20">
                    {p.team?.name || 'No Team'}
                  </span>
                  <span className="text-primary font-headline font-black text-xl tracking-tighter italic">
                    {pdr > 0 ? `${pdr} PDR` : ''}
                  </span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black font-headline tracking-tighter uppercase text-white leading-tight">
                  {p.name?.split(' ').map((n, i) => i === 0 ? <React.Fragment key={i}>{n}<br/></React.Fragment> : <span key={i} className="text-primary">{n} </span>)}
                </h2>
              </div>
            </div>
          </div>

          {/* Asymmetric Stats Bento */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4 h-full">
            <div className="col-span-2 neomorphic-interactive p-6 rounded-xl flex flex-col justify-between border-l-4 border-primary shadow-silk-extruded">
              <div className="flex justify-between items-center mb-4">
                 <p className="text-neutral-500 font-headline font-bold text-xs tracking-widest uppercase">Performance Analysis</p>
                 <div className="flex space-x-1 border border-white/5 p-1 rounded-lg bg-surface-container-high/50">
                    {['radar', 'bar', 'histogram', 'line'].map(type => (
                        <button 
                          key={type}
                          onClick={() => setChartType(type)}
                          className={`px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest transition-colors rounded ${chartType === type ? 'bg-primary text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'text-neutral-500 hover:text-white'}`}
                        >
                          {type}
                        </button>
                    ))}
                 </div>
              </div>

              <div className="flex justify-center py-2 h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'radar' && (
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#262626" />
                            <PolarAngleAxis dataKey="subject" tick={{fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk'}} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <RechartsTooltip contentStyle={{backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff'}} />
                            <Radar name={p.name} dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                        </RadarChart>
                    )}
                    {chartType === 'bar' && (
                        <BarChart data={radarData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis dataKey="subject" type="category" tick={{fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk'}} width={85} axisLine={false} tickLine={false} />
                            <RechartsTooltip contentStyle={{backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff'}} />
                            <Bar dataKey="A" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                    )}
                    {chartType === 'histogram' && (
                        <BarChart data={radarData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis dataKey="subject" tick={{fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk'}} axisLine={false} tickLine={false} />
                            <YAxis type="number" domain={[0, 100]} tick={{fill: '#adaaaa', fontSize: 10}} axisLine={false} tickLine={false} />
                            <RechartsTooltip contentStyle={{backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff'}} />
                            <Bar dataKey="A" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                    )}
                    {chartType === 'line' && (
                        <LineChart data={radarData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis dataKey="subject" tick={{fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk'}} axisLine={false} tickLine={false} />
                            <YAxis type="number" domain={[0, 100]} tick={{fill: '#adaaaa', fontSize: 10}} axisLine={false} tickLine={false} />
                            <RechartsTooltip contentStyle={{backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff'}} />
                            <Line type="monotone" dataKey="A" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, stroke: '#fff' }} />
                        </LineChart>
                    )}
                 </ResponsiveContainer>
              </div>
            </div>
            <div className="neomorphic-interactive p-6 rounded-xl flex flex-col gap-2 group">
              <Zap className="text-primary text-3xl transition-transform group-hover:scale-125 duration-300" />
              <p className="text-3xl font-headline font-black stat-highlight">{p.points || 0}</p>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Total Points</p>
            </div>
            <div className="neomorphic-interactive p-6 rounded-xl flex flex-col gap-2 group">
              <Shield className="text-primary text-3xl transition-transform group-hover:rotate-12 duration-300" />
              <p className="text-3xl font-headline font-black stat-highlight">{p.tackle_success_rate || 0}%</p>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Tackle Succ</p>
            </div>
          </div>
        </section>
      )}

      {/* Roster Section (Hidden for authenticated players limiting access to own profile) */}
      {userRole !== 'player' && (
        <section className="mb-24 animate-fade-up">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h3 className="text-4xl font-black font-headline tracking-tighter uppercase mb-2">Performance Roster</h3>
              <p className="text-neutral-500 font-body max-w-md">Real-time biomechanical analysis and strategic efficiency scoring for the active arena lineup.</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto relative group">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-outline group-focus-within:text-primary transition-colors" />
              <input 
                  type="text" 
                  placeholder="SEARCH DIRECTORY" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 bg-surface-container-high/50 pl-10 pr-4 py-3 rounded-xl border border-white/5 text-sm font-headline text-white focus:outline-none focus:border-primary/50 transition-all uppercase placeholder-neutral-600" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlayers.length === 0 ? (
               <div className="col-span-full py-12 text-center text-outline font-headline uppercase tracking-widest text-xs">NO RESULTS FOUND</div>
            ) : (
              filteredPlayers.map(player => (
                <div 
                  key={player.id} 
                  onClick={() => navigate(`/player/${player.id}`)}
                  className={`group neomorphic-interactive rounded-xl overflow-hidden cursor-pointer ${selectedPlayer?.id === player.id ? '!border-primary ring-1 ring-primary/40 shadow-silk-soft' : ''}`}
                >
                  <div className="h-40 overflow-hidden relative">
                    <img 
                        className="w-full h-full object-cover grayscale transition-transform duration-700 group-hover:scale-110 group-hover:grayscale-0" 
                        src={player.photo_url || DEFAULT_THUMBNAIL} 
                        alt="Player Profile" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-transparent"></div>
                  </div>
                  <div className="p-6 -mt-10 relative z-10 bg-transparent">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="text-xl font-black font-headline tracking-tighter uppercase leading-none group-hover:text-white transition-colors text-white">
                            {player.name}
                        </h4>
                        <p className="text-primary font-bold text-[10px] uppercase tracking-[0.2em] mt-1 stat-highlight">
                            {player.position}
                        </p>
                      </div>
                      <div className="iq-badge bg-surface-container/80 px-2 py-1 rounded-lg text-center border border-white/5 transition-all duration-300">
                        <p className="text-primary font-black text-sm leading-none stat-highlight">
                            {Math.round((player.successful_raid_pct*0.6) + (player.tackle_success_rate*0.4) + (player.points/10)) || 'N/A'}
                        </p>
                        <p className="text-[7px] font-bold text-neutral-500 uppercase mt-1">PDR</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400 font-bold uppercase tracking-widest text-[9px]">Tackle Success</span>
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="progress-fill h-full bg-primary/60 transition-all duration-500" style={{ width: `${player.tackle_success_rate || 0}%` }}></div>
                        </div>
                        <span className="font-headline font-bold text-neutral-300 group-hover:text-white">{player.tackle_success_rate || 0}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400 font-bold uppercase tracking-widest text-[9px]">Succ Raid %</span>
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="progress-fill h-full bg-primary/60 transition-all duration-500" style={{ width: `${player.successful_raid_pct || 0}%` }}></div>
                        </div>
                        <span className="font-headline font-bold text-neutral-300 group-hover:text-white">{player.successful_raid_pct || 0}%</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/player/${player.id}`); }}
                      className="w-full py-2.5 rounded-lg font-bold font-headline text-[10px] uppercase tracking-widest transition-all bg-white/5 text-neutral-400 group-hover:bg-primary/20 group-hover:text-primary border border-white/5 flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Full Profile
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
