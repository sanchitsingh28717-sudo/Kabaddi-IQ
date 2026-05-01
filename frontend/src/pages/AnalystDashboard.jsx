import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Activity, Target, Shield, Calendar, Search, X, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pro-kl.vercel.app';

export default function AnalystDashboard() {
  const [leagueTable, setLeagueTable] = useState([]);
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, ltRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/api/fixtures/results`),
        fetch(`${API_BASE}/api/league-table`),
        fetch(`${API_BASE}/api/teams`),
      ]);

      if (fRes.ok) setFixtures(await fRes.json());
      if (ltRes.ok) setLeagueTable(await ltRes.json());
      if (tRes.ok) {
        const teamsData = await tRes.json();
        // Shape teams data for the bar chart
        setTeams(teamsData.map(t => ({
          name: t.name,
          raid_points: t.raid_points || t.avg_raid_points || 0,
          tackle_points: t.tackle_points || t.avg_tackle_points || 0,
          avg_points_scored: t.avg_points_scored || 0,
        })));
      }
    } catch (e) {
      console.error('[AnalystDashboard] fetchData error:', e);
      setError('Could not reach the backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const filteredFixtures = fixtures.filter(f => {
     if(!searchTerm) return true;
     const term = searchTerm.toLowerCase();
     return (f.home?.name?.toLowerCase().includes(term) || f.away?.name?.toLowerCase().includes(term));
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">Loading Analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500/60" />
        <p className="text-white font-bold uppercase tracking-widest">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 mt-2 px-6 py-2 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-lg hover:brightness-125 transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Matches', value: '103', icon: Activity, color: 'text-kw-secondary' },
          { label: 'Avg Raid Pts', value: '18.4', icon: Target, color: 'text-kw-primary' },
          { label: 'Avg Tackle Pts', value: '9.8', icon: Shield, color: 'text-kw-secondary' },
          { label: 'Super 10s', value: '142', icon: Trophy, color: 'text-kw-tertiary' },
        ].map((stat, i) => (
          <div key={i} className="solid-card-high no-round p-5 border border-kw-surface-variant flex items-center justify-between hover:border-kw-primary transition-colors">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-kw-outline">{stat.label}</p>
              <h3 className="text-3xl font-bold font-mono text-white mt-1">{stat.value}</h3>
            </div>
            <div className={`p-3 no-round bg-kw-surface border border-kw-surface-variant ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* League Table */}
        <div className="lg:col-span-2 solid-card-high no-round p-6 border-l-4 border-kw-secondary">
          <h2 className="text-lg font-bold font-sans uppercase tracking-wider text-white mb-6 flex items-center">
            <Trophy className="w-5 h-5 mr-3 text-kw-secondary" />
            Active Standings Protocol
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-mono">
              <thead className="text-xs text-kw-outline-variant uppercase tracking-widest bg-kw-surface border-y border-kw-surface-variant">
                <tr>
                  <th className="px-4 py-4">Pos</th>
                  <th className="px-4 py-4">Franchise</th>
                  <th className="px-4 py-4 text-center">P</th>
                  <th className="px-4 py-4 text-center">W</th>
                  <th className="px-4 py-4 text-center">L</th>
                  <th className="px-4 py-4 text-center">T</th>
                  <th className="px-4 py-4 text-center">Diff</th>
                  <th className="px-4 py-4 text-center text-kw-secondary font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {leagueTable.map((row) => (
                  <tr key={row.rank} className="border-b border-kw-surface-variant hover:bg-kw-surface transition-colors">
                    <td className="px-4 py-4 font-bold text-kw-outline">{row.rank}</td>
                    <td className="px-4 py-4 font-bold uppercase tracking-wide text-white">{row.teams?.name}</td>
                    <td className="px-4 py-4 text-center">{row.played}</td>
                    <td className="px-4 py-4 text-center text-kw-primary glow-primary font-bold">{row.wins}</td>
                    <td className="px-4 py-4 text-center text-kw-tertiary">{row.losses}</td>
                    <td className="px-4 py-4 text-center">{row.ties}</td>
                    <td className="px-4 py-4 text-center">{row.score_diff > 0 ? `+${row.score_diff}` : row.score_diff}</td>
                    <td className="px-4 py-4 text-center font-bold text-white bg-kw-surface">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="solid-card-high no-round p-6 border-t-4 border-kw-primary">
          <h2 className="text-lg font-bold font-sans uppercase tracking-wider text-white mb-6">Offense/Defense Parity</h2>
          <div className="h-64 mt-4 text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teams} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#494847" tick={{fill: '#ADAaaa', fontSize: 10}} tickLine={false} axisLine={false} />
                <YAxis stroke="#494847" tick={{fill: '#ADAaaa', fontSize: 10}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#262626'}} contentStyle={{backgroundColor: '#1a1919', borderColor: '#494847', color: '#fff', borderRadius: '0px'}} />
                <Legend iconType="square" wrapperStyle={{paddingTop: '20px', fontFamily: 'Space Grotesk'}}/>
                <Bar dataKey="raid_points" name="Raid Pts" fill="#ffbd5c" radius={[0, 0, 0, 0]} />
                <Bar dataKey="tackle_points" name="Tackle Pts" fill="#6e9bff" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* MATCH-WISE ANALYSIS TABLE */}
      <div className="solid-card-high no-round p-6 mt-6 border border-kw-surface-variant">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-lg font-bold font-sans uppercase tracking-wider text-white flex items-center">
              <Calendar className="w-5 h-5 mr-3 text-kw-primary" />
              Event Log Analysis
            </h2>
            <div className="relative w-full sm:w-64 border-b border-kw-surface-variant focus-within:border-kw-primary transition-colors">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-kw-outline" />
              <input 
                type="text" 
                placeholder="FILTER LOGS..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-kw-surface-container-low pl-10 pr-4 py-3 font-mono text-sm text-white focus:outline-none no-round placeholder-kw-outline-variant" 
              />
            </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-sm text-left font-mono">
              <thead className="text-xs text-kw-outline uppercase tracking-widest bg-kw-surface sticky top-0 z-10 border-b border-kw-surface-variant">
                <tr>
                  <th className="px-4 py-4">Timestamp Date</th>
                  <th className="px-4 py-4">Host Franchise</th>
                  <th className="px-4 py-4">Visiting Franchise</th>
                  <th className="px-4 py-4 text-right">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-kw-outline uppercase tracking-widest">No entries located in database.</td>
                  </tr>
                ) : (
                  filteredFixtures.map((match, idx) => {
                    const isTie = match.result_team_id === null;
                    const homeWon = match.result_team_id === match.home_team_id;
                    const awayWon = match.result_team_id === match.away_team_id;

                    return (
                      <tr 
                        key={match.id || idx} 
                        onClick={() => setSelectedMatch(match)}
                        className="border-b border-kw-surface-variant hover:bg-kw-surface transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-kw-outline-variant whitespace-nowrap">{match.date}</td>
                        <td className={`px-4 py-4 font-bold uppercase tracking-wide ${homeWon ? 'text-kw-primary' : 'text-white'}`}>
                          {match.home?.name || 'UNKNOWN'}
                        </td>
                        <td className={`px-4 py-4 font-bold uppercase tracking-wide ${awayWon ? 'text-kw-primary' : 'text-white'}`}>
                          {match.away?.name || 'UNKNOWN'}
                        </td>
                        <td className="px-4 py-4 text-right font-bold uppercase tracking-wide">
                          {isTie ? (
                            <span className="text-kw-outline">STALEMATE</span>
                          ) : (
                            <span className="text-kw-secondary glow-secondary">
                              {homeWon ? match.home?.name : match.away?.name}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>
      </div>

      {/* Match Details Modal Overlay */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="solid-card-high no-round w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border-l-4 border-kw-primary">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-kw-surface-variant shrink-0 bg-kw-surface">
              <h2 className="text-xl font-bold font-sans uppercase tracking-widest text-white flex items-center">
                <Activity className="w-5 h-5 mr-3 text-kw-primary" />
                Diagnostic Resolution
              </h2>
              <button 
                onClick={() => setSelectedMatch(null)} 
                className="text-kw-outline hover:text-kw-tertiary transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
              {/* Scoreboard / Teams Banner */}
              <div className="flex flex-col md:flex-row items-center justify-between bg-kw-surface border border-kw-surface-variant p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Shield className="w-32 h-32" />
                </div>
                <div className="text-center md:text-left flex-1 relative z-10 w-full">
                  <p className="text-xs font-mono text-kw-outline-variant uppercase tracking-widest mb-2">Host Protocol</p>
                  <h3 className="text-2xl font-bold font-sans uppercase text-white truncate px-2 md:px-0" title={selectedMatch.home?.name || 'UNKNOWN'}>
                    {selectedMatch.home?.name || 'UNKNOWN'}
                  </h3>
                </div>
                <div className="px-8 flex flex-col items-center justify-center py-6 md:py-0 relative z-10">
                  <div className="bg-kw-surface-container-low px-4 py-2 no-round border border-kw-surface-variant shadow-none">
                    <span className="text-lg font-bold font-mono text-kw-tertiary">V / S</span>
                  </div>
                  <p className="text-xs font-mono text-kw-outline mt-3">{selectedMatch.date}</p>
                </div>
                <div className="text-center md:text-right flex-1 relative z-10 w-full">
                  <p className="text-xs font-mono text-kw-outline-variant uppercase tracking-widest mb-2">Visitor Protocol</p>
                  <h3 className="text-2xl font-bold font-sans uppercase text-white truncate px-2 md:px-0" title={selectedMatch.away?.name || 'UNKNOWN'}>
                    {selectedMatch.away?.name || 'UNKNOWN'}
                  </h3>
                </div>
              </div>
              
              <div className="text-center mt-[-2rem] relative z-20">
                 <div className="inline-block bg-kw-surface border border-kw-surface-variant px-8 py-3 no-round text-sm font-bold font-mono text-white uppercase tracking-widest shadow-lg">
                   Outcome Evaluation: <span className={selectedMatch.result_team_id === null ? 'text-kw-outline ml-2' : 'text-kw-primary glow-primary ml-2'}>
                     {selectedMatch.result_team_id === null ? 'STALEMATE' : (selectedMatch.result_team_id === selectedMatch.home_team_id ? `${selectedMatch.home?.name} VICTORIOUS` : `${selectedMatch.away?.name} VICTORIOUS`)}
                   </span>
                 </div>
              </div>

              {/* Head to Head Strengths */}
              <div>
                <h4 className="text-sm font-bold font-mono text-kw-outline uppercase tracking-widest mb-6 border-b border-kw-surface-variant pb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2" /> Comparative Force Output
                </h4>
                
                <div className="space-y-8">
                  {/* Compare Stats Loop */}
                  {[
                    { label: 'Offensive Pts/G', key: 'avg_points_scored' },
                    { label: 'Aggression (Raid)', key: 'raid_points' },
                    { label: 'Defensive Integrity', key: 'tackle_points' },
                    { label: 'Total Dominance', key: 'all_outs_inflicted' }
                  ].map((stat, idx) => {
                    const homeVal = parseFloat(selectedMatch.home?.[stat.key] || 0);
                    const awayVal = parseFloat(selectedMatch.away?.[stat.key] || 0);
                    const homePct = (homeVal / (homeVal + awayVal || 1)) * 100;
                    const awayPct = (awayVal / (homeVal + awayVal || 1)) * 100;

                    return (
                      <div key={idx} className="group relative">
                        <div className="flex justify-between text-sm font-mono mb-3">
                          <span className={`font-bold ${homeVal >= awayVal ? 'text-kw-primary' : 'text-kw-outline'}`}>{homeVal}</span>
                          <span className="text-kw-outline-variant text-[10px] uppercase tracking-widest absolute left-1/2 -translate-x-1/2 top-0 bg-kw-surface px-3 py-1 no-round z-10 border border-kw-surface-variant">{stat.label}</span>
                          <span className={`font-bold ${awayVal >= homeVal ? 'text-kw-secondary' : 'text-kw-outline'}`}>{awayVal}</span>
                        </div>
                        <div className="h-2 flex no-round overflow-hidden bg-kw-surface-variant relative items-center mt-4">
                          <div className="h-full bg-kw-primary absolute left-0 transition-all duration-1000 ease-out" style={{width: `${homePct}%`}}></div>
                          <div className="h-full bg-kw-secondary absolute right-0 transition-all duration-1000 ease-out" style={{width: `${awayPct}%`}}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="bg-kw-secondary/10 border-l-4 border-kw-secondary p-5 flex items-start text-sm text-kw-outline-variant font-mono">
                <Shield className="w-5 h-5 mr-3 text-kw-secondary shrink-0 mt-0.5 opacity-80" />
                <p className="leading-relaxed">
                  <strong className="text-kw-secondary glow-secondary mr-2 tracking-widest">SYSTEM NOTE:</strong> 
                  Discrete micro-timeline vectors and autonomous entity logs <em className="text-white mx-1">bound to this exact event timestamp</em> remain decoupled. Aggregated force comparisons project aggregate seasonal momentum trajectories intersecting at match convergence.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
