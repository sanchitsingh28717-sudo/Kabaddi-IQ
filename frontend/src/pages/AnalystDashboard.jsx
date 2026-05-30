import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Activity, Target, Shield, Calendar, Search, X, ChevronRight, AlertCircle, RefreshCw, Sparkles, Users, Brain } from 'lucide-react';
import { predictionService } from '../services/predictionService';
import { teamService } from '../services/teamService';

export default function AnalystDashboard() {
  const [leagueTable, setLeagueTable] = useState([]);
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🌀 Spinning Radial Action Menu States
  const [radialMatch, setRadialMatch] = useState(null);
  const [radialCoords, setRadialCoords] = useState({ x: 0, y: 0 });
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [radialPrediction, setRadialPrediction] = useState(null);

  // 🎡 Spinning Wheel Match Selector States
  const [isSpinnerOpen, setIsSpinnerOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [spinnerMatches, setSpinnerMatches] = useState([]);
  const wheelRef = React.useRef(null);

  const handleOpenSpinner = () => {
    // Pick first 8 fixtures or available
    const topMatches = fixtures.slice(0, 8);
    setSpinnerMatches(topMatches);
    setIsSpinnerOpen(true);
    setSpinResult(null);
    setIsSpinning(false);
  };

  const handleSpinWheel = () => {
    if (isSpinning || spinnerMatches.length === 0) return;
    setIsSpinning(true);
    setSpinResult(null);

    // Pick a random target match index
    const targetIdx = Math.floor(Math.random() * spinnerMatches.length);
    const targetMatch = spinnerMatches[targetIdx];

    // SVG parameters
    const segmentCount = spinnerMatches.length;
    const segmentAngle = 360 / segmentCount;
    const extraSpins = 6 * 360; // 6 full cycles
    // Target segment angle centers the indicator
    const targetSegmentAngle = targetIdx * segmentAngle;
    const totalRotationAngle = extraSpins + (360 - targetSegmentAngle) - (segmentAngle / 2);

    if (wheelRef.current) {
      wheelRef.current.style.transition = 'transform 4.5s cubic-bezier(0.15, 0.95, 0.15, 1)';
      wheelRef.current.style.transform = `rotate(${totalRotationAngle}deg)`;
    }

    setTimeout(() => {
      setIsSpinning(false);
      setSpinResult(targetMatch);
      // Wait 1.5 seconds, then open the diagnostic scoreboard overlay modal for the selected match!
      setTimeout(() => {
        setSelectedMatch(targetMatch);
        setIsSpinnerOpen(false);
        setSpinResult(null);
      }, 1500);
    }, 4600); // Wait for the transition to complete
  };



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fixturesData, leagueTableData, teamsData] = await Promise.all([
        predictionService.getFixtureResults(),
        predictionService.getLeagueTable(),
        teamService.getTeams(),
      ]);

      setFixtures(fixturesData);
      setLeagueTable(leagueTableData);
      
      // Shape teams data for the bar chart
      setTeams(teamsData.map(t => ({
        name: t.name,
        raid_points: t.raid_points || t.avg_raid_points || 0,
        tackle_points: t.tackle_points || t.avg_tackle_points || 0,
        avg_points_scored: t.avg_points_scored || 0,
      })));
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
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={handleOpenSpinner}
                className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-black hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-300 px-4 py-2 font-mono text-xs uppercase tracking-widest font-black shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" /> TACTICAL WHEEL
              </button>
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
                        onClick={(e) => {
                          e.preventDefault();
                          setRadialCoords({ x: e.clientX, y: e.clientY });
                          setRadialMatch(match);
                          setRadialPrediction(null);
                        }}
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

      {/* 🌀 Circular Radial Spinning Menu Overlay */}
      {radialMatch && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setRadialMatch(null)}>
          <div 
            className="absolute radial-spin-menu flex items-center justify-center pointer-events-auto"
            style={{ 
              left: `${Math.min(window.innerWidth - 180, Math.max(180, radialCoords.x))}px`, 
              top: `${Math.min(window.innerHeight - 180, Math.max(180, radialCoords.y))}px` 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Outer Pulsing Glow Border Circle */}
            <div className="w-[200px] h-[200px] rounded-full border border-primary/30 radial-ring-pulse bg-[#030307e0] backdrop-blur-xl absolute flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.25)]">
              {/* Inner crosslines for tactical HUD vibe */}
              <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none"></div>
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 pointer-events-none"></div>
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 pointer-events-none"></div>
            </div>

            {/* RADIAL ITEM 1: Diagnostic Details (Top, 0 deg) */}
            <button
              onClick={() => {
                setSelectedMatch(radialMatch);
                setRadialMatch(null);
              }}
              className="radial-item-enter absolute flex flex-col items-center justify-center w-12 h-12 rounded-full border border-primary/40 bg-black/60 hover:bg-primary hover:text-[#0e0e0e] hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] text-primary transition-all duration-300 group cursor-pointer"
              style={{ 
                transform: 'translate(0px, -70px)', 
                animationDelay: '100ms'
              }}
              title="Show Detailed Match Resolution"
            >
              <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="absolute whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-neutral-400 bg-black/80 border border-white/10 px-1.5 py-0.5 rounded -top-7 group-hover:text-primary transition-colors">
                Diagnostic
              </span>
            </button>

            {/* RADIAL ITEM 2: Run AI Outcome Prediction (Bottom Left, 120 deg) */}
            <button
              onClick={async () => {
                if (predictionLoading) return;
                setPredictionLoading(true);
                try {
                  const data = await predictionService.predictMatchOutcome(
                    radialMatch.home_team_id,
                    radialMatch.away_team_id
                  );
                  setRadialPrediction(data);
                } catch (err) {
                  console.error(err);
                  alert("Prediction failed: " + err.message);
                } finally {
                  setPredictionLoading(false);
                }
              }}
              className="radial-item-enter absolute flex flex-col items-center justify-center w-12 h-12 rounded-full border border-secondary/40 bg-black/60 hover:bg-secondary hover:text-[#0e0e0e] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] text-secondary transition-all duration-300 group cursor-pointer"
              style={{ 
                transform: 'translate(-60px, 35px)', 
                animationDelay: '200ms'
              }}
              title="Simulate AI Prediction"
            >
              {predictionLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Brain className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
              <span className="absolute whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-neutral-400 bg-black/80 border border-white/10 px-1.5 py-0.5 rounded -bottom-7 group-hover:text-secondary transition-colors">
                Predict AI
              </span>
            </button>

            {/* RADIAL ITEM 3: Compare Team Rosters (Bottom Right, 240 deg) */}
            <button
              onClick={() => {
                const homeName = radialMatch.home?.name || 'Home Franchise';
                const awayName = radialMatch.away?.name || 'Visiting Franchise';
                alert(`Tactical Matchup:\n\n${homeName} (Host)\n   vs\n${awayName} (Visitor)\n\nBoth squads fully synchronized under Season 11 data registers.`);
                setRadialMatch(null);
              }}
              className="radial-item-enter absolute flex flex-col items-center justify-center w-12 h-12 rounded-full border border-tertiary/40 bg-black/60 hover:bg-tertiary hover:text-[#0e0e0e] hover:shadow-[0_0_20px_rgba(236,72,153,0.6)] text-tertiary transition-all duration-300 group cursor-pointer"
              style={{ 
                transform: 'translate(60px, 35px)', 
                animationDelay: '300ms'
              }}
              title="Compare Roster Rosters"
            >
              <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="absolute whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-neutral-400 bg-black/80 border border-white/10 px-1.5 py-0.5 rounded -bottom-7 group-hover:text-tertiary transition-colors">
                Matchup
              </span>
            </button>

            {/* Center Close Circle */}
            <button
              onClick={() => setRadialMatch(null)}
              className="absolute w-10 h-10 rounded-full border border-white/15 bg-black hover:bg-error hover:text-white hover:border-error text-neutral-400 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-inner z-10"
              title="Cancel Override"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Inline AI Prediction Result HUD Overlay inside menu */}
            {radialPrediction && (
              <div className="absolute w-[220px] bg-black/95 border border-secondary/30 rounded-xl p-3 text-center transition-all duration-500 scale-95 top-[120px] shadow-[0_15px_30px_rgba(0,0,0,0.8)] z-20 animate-in fade-in slide-in-from-top-4 duration-300">
                <p className="text-[7px] font-black text-secondary tracking-[0.25em] uppercase mb-1 flex items-center justify-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-secondary" /> AI Prediction HUD
                </p>
                <div className="flex justify-between items-center gap-2 mt-1.5 border-t border-white/5 pt-1.5">
                  <div className="text-left">
                    <p className="text-[7px] text-neutral-500 font-bold uppercase truncate max-w-[80px]">{radialMatch.home?.name}</p>
                    <p className="text-xs font-black text-white">{Math.round(radialPrediction.home_win_probability * 100)}%</p>
                  </div>
                  <div className="h-6 w-px bg-white/10"></div>
                  <div className="text-right">
                    <p className="text-[7px] text-neutral-500 font-bold uppercase truncate max-w-[80px]">{radialMatch.away?.name}</p>
                    <p className="text-xs font-black text-white">{Math.round(radialPrediction.away_win_probability * 100)}%</p>
                  </div>
                </div>
                <div className="mt-2 w-full bg-white/5 h-1 rounded-full overflow-hidden flex">
                  <div className="bg-secondary h-full" style={{ width: `${radialPrediction.home_win_probability * 100}%` }}></div>
                  <div className="bg-tertiary h-full flex-1"></div>
                </div>
                <p className="text-[7px] text-secondary font-black uppercase mt-1.5 tracking-wider">
                  Forecast: {radialPrediction.winner_forecast}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 🎡 Spinning Wheel Match Selector Modal Overlay */}
      {isSpinnerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center spinner-modal-backdrop p-4">
          <div className="solid-card-high no-round w-full max-w-lg border-t-4 border-primary relative p-6 animate-in fade-in zoom-in-95 duration-200 shadow-2xl flex flex-col items-center">
            
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between pb-4 border-b border-white/5 mb-6">
              <h3 className="text-sm font-bold font-mono text-kw-outline uppercase tracking-[0.25em] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" /> Tactical Resolution Spinner
              </h3>
              <button 
                onClick={() => setIsSpinnerOpen(false)}
                disabled={isSpinning}
                className="text-neutral-500 hover:text-error transition-colors disabled:opacity-30 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wheel Description */}
            <p className="text-center font-mono text-[10px] text-neutral-400 uppercase tracking-wider mb-6 max-w-sm">
              Spin the tactical dial to select a random completed fixture record and retrieve its diagnostic analytical report.
            </p>

            {/* Selector Pointer Arrow (Top) */}
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-error z-20 mb-[-10px] spinner-ticker"></div>

            {/* The SVG Wheel */}
            <div className="w-[320px] h-[320px] rounded-full spinner-outer-ring relative overflow-hidden flex items-center justify-center select-none shadow-[0_0_50px_rgba(99,102,241,0.15)] mb-6">
              <svg 
                ref={wheelRef}
                viewBox="0 0 200 200" 
                className="w-full h-full transform origin-center transition-transform"
                style={{ transform: 'rotate(0deg)' }}
              >
                {/* Dynamically draw segment slices */}
                {spinnerMatches.map((match, idx) => {
                  const segmentCount = spinnerMatches.length;
                  const segmentAngle = 360 / segmentCount;
                  const startAngle = idx * segmentAngle;
                  const endAngle = startAngle + segmentAngle;

                  // Math to calculate SVG arc path
                  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
                    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
                    return {
                      x: centerX + radius * Math.cos(angleInRadians),
                      y: centerY + radius * Math.sin(angleInRadians),
                    };
                  };

                  const start = polarToCartesian(100, 100, 95, startAngle);
                  const end = polarToCartesian(100, 100, 95, endAngle);
                  const largeArcFlag = segmentAngle <= 180 ? '0' : '1';

                  const d = [
                    'M', 100, 100,
                    'L', start.x, start.y,
                    'A', 95, 95, 0, largeArcFlag, 1, end.x, end.y,
                    'Z'
                  ].join(' ');

                  // Colors alternating nicely
                  const colors = [
                    'rgba(99, 102, 241, 0.12)', // Indigo
                    'rgba(6, 182, 212, 0.08)',  // Cyan
                    'rgba(236, 72, 153, 0.06)',  // Pink
                    'rgba(234, 179, 8, 0.08)',   // Yellow
                  ];
                  const fill = colors[idx % colors.length];
                  
                  // Calculate text positioning centered in segment
                  const textAngle = startAngle + segmentAngle / 2;
                  const textPos = polarToCartesian(100, 100, 65, textAngle);

                  // Short alias names for segments (e.g. BLR vs BEN)
                  const getShortName = (name) => {
                    if (!name) return 'SQD';
                    const parts = name.split(' ');
                    if (parts.length >= 2) return parts.map(p => p[0]).join('').toUpperCase();
                    return name.substring(0, 3).toUpperCase();
                  };
                  const label = `${getShortName(match.home?.name)} v ${getShortName(match.away?.name)}`;

                  return (
                    <g key={idx}>
                      <path 
                        d={d} 
                        fill={fill} 
                        stroke="rgba(255,255,255,0.06)" 
                        strokeWidth="0.7" 
                      />
                      <text
                        x={textPos.x}
                        y={textPos.y}
                        fill="rgba(255,255,255,0.7)"
                        fontSize="6"
                        fontWeight="black"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        transform={`rotate(${textAngle}, ${textPos.x}, ${textPos.y})`}
                        className="spinner-slice-text font-black uppercase text-[6px] opacity-80"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Inner decorative HUD circles */}
                <circle cx="100" cy="100" r="18" fill="#030307" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
                <circle cx="100" cy="100" r="10" fill="#09090f" />
                <circle cx="100" cy="100" r="3" fill="#ff4d4d" />
              </svg>
            </div>

            {/* Spin / Status Button */}
            <button
              onClick={handleSpinWheel}
              disabled={isSpinning || spinnerMatches.length === 0}
              className="px-8 py-3.5 bg-primary text-black font-black font-sans uppercase tracking-[0.2em] text-xs hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all w-full flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.35)]"
            >
              {isSpinning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" /> COMPUTING TACTICAL ORBITS...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black animate-pulse" /> INITIATE TACTICAL SPIN
                </>
              )}
            </button>

            {/* Spinner Result HUD Banner */}
            {spinResult && (
              <div className="mt-4 w-full text-center bg-green-500/10 border border-green-500/40 rounded-xl p-3 animate-pulse">
                <p className="text-[8px] font-black text-green-400 tracking-widest uppercase">Target Vector Confirmed</p>
                <p className="text-[11px] font-black text-white font-headline uppercase mt-1">
                  {spinResult.home?.name} VS {spinResult.away?.name}
                </p>
                <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5">
                  Resolution Loaded — Booting Report...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

