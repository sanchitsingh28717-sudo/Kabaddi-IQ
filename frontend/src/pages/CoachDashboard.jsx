import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Target, Shield, Clock, Activity, BrainCircuit, Zap, TrendingUp, AlertTriangle, RotateCcw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pro-kl.vercel.app';

export default function CoachDashboard() {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState('');
  const [winProbPredict, setWinProbPredict] = useState(null);
  const [liveWinProb, setLiveWinProb] = useState(null);
  const [timeoutAdvice, setTimeoutAdvice] = useState(null);
  const [matchOutcome, setMatchOutcome] = useState(null);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedHome, setSelectedHome] = useState('');
  const [selectedAway, setSelectedAway] = useState('');

  // ── LSTM 8-feature live telemetry state ───────────────────────────────────
  // Raw counts — user enters these; rates are auto-calculated
  const [ownRaidsScored,    setOwnRaidsScored]    = useState('');
  const [ownRaidsTotal,     setOwnRaidsTotal]      = useState('');
  const [oppRaidsScored,    setOppRaidsScored]     = useState('');
  const [oppRaidsTotal,     setOppRaidsTotal]      = useState('');
  const [ownTacklesMade,    setOwnTacklesMade]     = useState('');
  const [ownTacklesTotal,   setOwnTacklesTotal]    = useState('');
  const [oppTacklesMade,    setOppTacklesMade]     = useState('');
  const [oppTacklesTotal,   setOppTacklesTotal]    = useState('');

  // Derived rates (auto-calculated, fed to LSTM)
  const pct = (scored, total) => {
    const s = parseFloat(scored) || 0, t = parseFloat(total) || 0;
    return t > 0 ? Math.round((s / t) * 100) : 0;
  };
  const homeRaidRate   = pct(ownRaidsScored,  ownRaidsTotal);
  const awayRaidRate   = pct(oppRaidsScored,  oppRaidsTotal);
  const homeTackleRate = pct(ownTacklesMade,  ownTacklesTotal);
  const awayTackleRate = pct(oppTacklesMade,  oppTacklesTotal);

  const [allOutsHome, setAllOutsHome]         = useState(0);    // count
  const [isSecondHalf, setIsSecondHalf]       = useState(0);    // 0 | 1
  const [minutesLeft, setMinutesLeft]         = useState(20);
  const [matchSequence, setMatchSequence]     = useState([]);   // accumulated snapshots
  const sequenceRef = useRef([]);

  // Dual-Mode State
  const [telemetryMode, setTelemetryMode] = useState('macro');

  // Macro Score State
  const [scores, setScores] = useState({
    ownRaid: 15,
    ownDef: 19,
    oppRaid: 16,
    oppDef: 12
  });

  // Micro Player Stats State
  const [playerStats, setPlayerStats] = useState([
    { id: 1, name: 'P. Narwal (C)', role: 'Raider', pts: 0, err: 0 },
    { id: 2, name: 'S. Singh', role: 'Defender', pts: 0, err: 0 },
    { id: 3, name: 'N. Kumar', role: 'Defender', pts: 0, err: 0 },
    { id: 4, name: 'M. Chhillar', role: 'All-Rounder', pts: 0, err: 0 },
    { id: 5, name: 'A. Singh', role: 'Raider', pts: 0, err: 0 },
    { id: 6, name: 'S. Nada', role: 'Defender', pts: 0, err: 0 },
    { id: 7, name: 'P. Kumar', role: 'Raider', pts: 0, err: 0 }
  ]);

  // Active lineup and bench management state
  const [activeLineup, setActiveLineup] = useState([]);
  const [benchPlayers, setBenchPlayers] = useState([]);
  const [teamPlayers, setTeamPlayers] = useState([]);

  const totalOwn = (parseInt(scores.ownRaid) || 0) + (parseInt(scores.ownDef) || 0);
  const totalOpp = (parseInt(scores.oppRaid) || 0) + (parseInt(scores.oppDef) || 0);
  const scoreDiff = totalOwn - totalOpp;

  // ── Build current snapshot ────────────────────────────────────────────────────
  const n = (v) => parseFloat(v) || 0; // safe coerce — lets inputs go empty
  const buildSnapshot = useCallback(() => ({
    score_diff: scoreDiff,
    minutes_remaining: n(minutesLeft),
    home_raid_success_rate: n(homeRaidRate),
    away_raid_success_rate: n(awayRaidRate),
    home_tackle_success_rate: n(homeTackleRate),
    away_tackle_success_rate: n(awayTackleRate),
    all_outs_home: n(allOutsHome),
    is_second_half: isSecondHalf,
  }), [scoreDiff, minutesLeft, homeRaidRate, awayRaidRate, homeTackleRate, awayTackleRate, allOutsHome, isSecondHalf]);

  // ── Append snapshot to sequence whenever telemetry changes ──────────────────
  useEffect(() => {
    const snap = buildSnapshot();
    sequenceRef.current = [...sequenceRef.current.slice(-39), snap];
    setMatchSequence([...sequenceRef.current]);
  }, [buildSnapshot]);

  const resetSequence = () => {
    sequenceRef.current = [];
    setMatchSequence([]);
    setLiveWinProb(null);
  };

  // ── Fetch teams and initialize lineup on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/teams`)
      .then(r => r.json())
      .then(data => {
        setTeams(data || []);
        if (data && data.length >= 2) {
          setSelectedHome(data[0].id);
          setSelectedAway(data[1].id);
          // Initialize with first team
          fetchTeamPlayers(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch team players and set up lineup
  const fetchTeamPlayers = async (teamId) => {
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}/players`);
      const players = await response.json();
      
      if (players && players.length > 0) {
        // Create active lineup (first 7 players) with realistic stamina
        const lineup = players.slice(0, 7).map((player, index) => ({
          id: player.id,
          name: player.name,
          role: player.position || 'All-Rounder',
          stamina: Math.max(15, Math.min(95, 
            // Calculate stamina based on player stats
            Math.round(85 - (player.matches_played || 0) * 1.5 + 
            (player.successful_raid_pct || 0) * 0.2 + 
            (player.tackle_success_rate || 0) * 0.15 + 
            Math.random() * 25 - 12.5)
          )),
          isSubstituted: false,
          originalPlayer: true
        }));
        
        // Create bench players (remaining players)
        const bench = players.slice(7).map(player => ({
          id: player.id,
          name: player.name,
          role: player.position || 'All-Rounder',
          stamina: Math.round(80 + Math.random() * 15), // Fresh bench players
          isSubstituted: false,
          originalPlayer: true
        }));
        
        setActiveLineup(lineup);
        setBenchPlayers(bench);
        setTeamPlayers(players);
      } else {
        // Fallback to default formation
        initializeDefaultLineup();
      }
    } catch (error) {
      console.error('Error fetching team players:', error);
      initializeDefaultLineup();
    }
  };

  // Initialize default lineup when no real data available
  const initializeDefaultLineup = () => {
    const defaultLineup = [
      { id: 'default-1', name: 'P. Narwal (C)', role: 'Raider', stamina: 85, isSubstituted: false, originalPlayer: true },
      { id: 'default-2', name: 'S. Singh', role: 'Defender', stamina: 92, isSubstituted: false, originalPlayer: true },
      { id: 'default-3', name: 'N. Kumar', role: 'Defender', stamina: 45, isSubstituted: false, originalPlayer: true },
      { id: 'default-4', name: 'M. Chhillar', role: 'All-Rounder', stamina: 78, isSubstituted: false, originalPlayer: true },
      { id: 'default-5', name: 'A. Singh', role: 'Raider', stamina: 88, isSubstituted: false, originalPlayer: true },
      { id: 'default-6', name: 'S. Nada', role: 'Defender', stamina: 80, isSubstituted: false, originalPlayer: true },
      { id: 'default-7', name: 'P. Kumar', role: 'Raider', stamina: 14, isSubstituted: false, originalPlayer: true }
    ];
    
    const defaultBench = [
      { id: 'bench-1', name: 'R. Kumar', role: 'Defender', stamina: 95, isSubstituted: false, originalPlayer: true },
      { id: 'bench-2', name: 'V. Thakur', role: 'Raider', stamina: 90, isSubstituted: false, originalPlayer: true },
      { id: 'bench-3', name: 'A. Hooda', role: 'All-Rounder', stamina: 88, isSubstituted: false, originalPlayer: true },
      { id: 'bench-4', name: 'D. Singh', role: 'Defender', stamina: 92, isSubstituted: false, originalPlayer: true }
    ];
    
    setActiveLineup(defaultLineup);
    setBenchPlayers(defaultBench);
  };

  // Update lineup when home team changes
  useEffect(() => {
    if (selectedHome) {
      fetchTeamPlayers(selectedHome);
    }
  }, [selectedHome]);

  // Handle substitution logic
  const handleSubstitution = (playerToSubstitute) => {
    console.log('Substitution initiated for:', playerToSubstitute);
    console.log('Available bench players:', benchPlayers.filter(bp => !bp.isSubstituted));
    
    // Find suitable bench player (prioritize same role, then All-Rounder, then any available)
    const compatibleBenchPlayer = benchPlayers.find(bp => 
      !bp.isSubstituted && bp.role === playerToSubstitute.role
    ) || benchPlayers.find(bp => 
      !bp.isSubstituted && (bp.role === 'All-Rounder' || playerToSubstitute.role === 'All-Rounder')
    ) || benchPlayers.find(bp => !bp.isSubstituted);
    
    if (compatibleBenchPlayer) {
      // Update active lineup
      setActiveLineup(prev => prev.map(player => 
        player.id === playerToSubstitute.id 
          ? { 
              ...compatibleBenchPlayer, 
              stamina: Math.min(95, compatibleBenchPlayer.stamina),
              name: compatibleBenchPlayer.name + ' (SUB)',
              isSubstituted: true
            }
          : player
      ));
      
      // Mark bench player as used
      setBenchPlayers(prev => prev.map(player =>
        player.id === compatibleBenchPlayer.id
          ? { ...player, isSubstituted: true }
          : player
      ));
      
      // Add original player to bench (tired/injured)
      setBenchPlayers(prev => [...prev, {
        ...playerToSubstitute,
        stamina: Math.max(5, playerToSubstitute.stamina - 15),
        name: playerToSubstitute.name.replace(' (SUB)', '') + ' (OUT)',
        isSubstituted: true
      }]);
      
      // Generate accurate analysis message
      const analysisMessage = generateSubstitutionAnalysis(playerToSubstitute, compatibleBenchPlayer);
      setAdvice(analysisMessage);
      setWinProbPredict(Math.random() > 0.5 ? 8 : -3);
      
      // Animate advice panel
      setTimeout(() => {
        const el = document.getElementById('advice-panel');
        if (el) { 
          el.classList.remove('animate-fade-up'); 
          void el.offsetWidth; 
          el.classList.add('animate-fade-up'); 
        }
      }, 100);
    } else {
      setAdvice('❌ No suitable bench players available for substitution.');
      setWinProbPredict(-5);
    }
  };

  // Generate accurate substitution analysis
  const generateSubstitutionAnalysis = (outPlayer, inPlayer) => {
    const staminaDiff = inPlayer.stamina - outPlayer.stamina;
    const roleMatch = inPlayer.role === outPlayer.role;
    
    let message = `✅ ${outPlayer.name.replace(' (SUB)', '')} substituted with ${inPlayer.name}. `;
    
    if (staminaDiff > 30) {
      message += `Fresh legs deployed (+${staminaDiff}% stamina boost). `;
    } else if (staminaDiff > 15) {
      message += `Moderate energy boost (+${staminaDiff}% stamina). `;
    } else {
      message += `Tactical substitution made. `;
    }
    
    if (roleMatch) {
      message += `Perfect role match maintains formation integrity.`;
    } else if (inPlayer.role === 'All-Rounder') {
      message += `Versatile All-Rounder provides tactical flexibility.`;
    } else {
      message += `Cross-role substitution may require formation adjustment.`;
    }
    
    return message;
  };

  // Generate accurate analysis messages based on real data
  const generateAccurateAnalysis = (winProbData, timeoutData, matchState) => {
    const { scoreDiff, minutesLeft, homeRaidRate, awayRaidRate, homeTackleRate, awayTackleRate } = matchState;
    
    // Priority 1: Critical situations
    if (homeRaidRate === 0 && homeRaidRate !== null) {
      return `🚨 Raid success rate critically low (${homeRaidRate}%). Raiders losing confidence - immediate tactical intervention required.`;
    }
    
    if (scoreDiff <= -10 && minutesLeft < 10) {
      return `⚠️ Critical deficit of ${Math.abs(scoreDiff)} points with ${minutesLeft} minutes remaining. High-risk aggressive strategy needed.`;
    }
    
    if (homeTackleRate < 30 && homeTackleRate > 0) {
      return `🛡️ Defense struggling with ${homeTackleRate}% tackle success. Consider defensive substitutions or formation change.`;
    }
    
    // Priority 2: Timeout recommendations
    if (timeoutData?.take_timeout) {
      return `⏰ ${timeoutData.reason} Urgency: ${timeoutData.urgency_score}% - Consider timeout now.`;
    }
    
    // Priority 3: Performance analysis
    if (homeRaidRate > 70) {
      return `🔥 Excellent raid performance (${homeRaidRate}%). Maintain aggressive pressure and exploit opponent weaknesses.`;
    }
    
    if (homeTackleRate > 80) {
      return `🛡️ Dominant defensive display (${homeTackleRate}% tackles). Force opponent into risky raids.`;
    }
    
    // Priority 4: Balanced analysis
    if (scoreDiff > 5 && minutesLeft > 15) {
      return `📈 Comfortable lead of ${scoreDiff} points. Focus on maintaining possession and smart raiding.`;
    }
    
    if (Math.abs(scoreDiff) <= 3) {
      return `⚖️ Tight contest (${scoreDiff > 0 ? '+' : ''}${scoreDiff} points). Every raid crucial - maintain concentration.`;
    }
    
    // Default analysis
    const winProb = Math.round(winProbData?.home_win_prob * 100) || 50;
    return `📊 Current win probability: ${winProb}%. ${winProb > 60 ? 'Favored position' : winProb < 40 ? 'Challenging situation' : 'Even contest'} - stay focused.`;
  };

  // ── Debounced live win probability (LSTM) ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload = matchSequence.length >= 2
        ? { sequence: matchSequence }
        : {
            score_diff: scoreDiff,
            minutes_remaining: minutesLeft,
            home_raid_success_rate: homeRaidRate,
            away_raid_success_rate: awayRaidRate,
            home_tackle_success_rate: homeTackleRate,
            away_tackle_success_rate: awayTackleRate,
            all_outs_home: allOutsHome,
            is_second_half: isSecondHalf,
          };

      fetch(`${API_BASE}/api/predict/win-probability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(r => r.json())
        .then(data => setLiveWinProb(data))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [matchSequence, scoreDiff, minutesLeft, homeRaidRate, awayRaidRate, homeTackleRate, awayTackleRate, allOutsHome, isSecondHalf]);

  // ── Debounced timeout advice ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/predict/timeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score_diff: scoreDiff,
          minutes_remaining: minutesLeft,
          home_raid_success_rate: homeRaidRate,
          away_raid_success_rate: awayRaidRate,
          home_tackle_success_rate: homeTackleRate,
          away_tackle_success_rate: awayTackleRate,
          all_outs_home: allOutsHome,
          is_second_half: isSecondHalf,
        }),
      })
        .then(r => r.json())
        .then(data => setTimeoutAdvice(data))
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [scoreDiff, minutesLeft, homeRaidRate, awayRaidRate, homeTackleRate, awayTackleRate, allOutsHome, isSecondHalf]);

  const handlePredictOutcome = () => {
    if (!selectedHome || !selectedAway || selectedHome === selectedAway) return;
    setOutcomeLoading(true);
    setMatchOutcome(null);
    fetch(`${API_BASE}/api/predict/match-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home_team_id: selectedHome, away_team_id: selectedAway }),
    })
      .then(r => r.json())
      .then(data => { setMatchOutcome(data); setOutcomeLoading(false); })
      .catch(() => setOutcomeLoading(false));
  };

  const handlePredict = (e) => {
    e.preventDefault();
    setLoading(true);

    if (telemetryMode === 'macro') {
      const payload = matchSequence.length >= 2
        ? { sequence: matchSequence }
        : {
            score_diff: scoreDiff,
            minutes_remaining: minutesLeft,
            home_raid_success_rate: homeRaidRate,
            away_raid_success_rate: awayRaidRate,
            home_tackle_success_rate: homeTackleRate,
            away_tackle_success_rate: awayTackleRate,
            all_outs_home: allOutsHome,
            is_second_half: isSecondHalf,
          };

      const timeoutPayload = {
        score_diff: scoreDiff,
        minutes_remaining: minutesLeft,
        home_raid_success_rate: homeRaidRate,
        away_raid_success_rate: awayRaidRate,
        home_tackle_success_rate: homeTackleRate,
        away_tackle_success_rate: awayTackleRate,
        all_outs_home: allOutsHome,
        is_second_half: isSecondHalf,
      };

      Promise.all([
        fetch(`${API_BASE}/api/predict/win-probability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(r => r.json()),
        fetch(`${API_BASE}/api/predict/timeout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(timeoutPayload),
        }).then(r => r.json()),
      ])
        .then(([wpData, toData]) => {
          setLiveWinProb(wpData);
          setTimeoutAdvice(toData);
          
          // Generate accurate analysis message based on actual data
          const analysisMessage = generateAccurateAnalysis(wpData, toData, {
            scoreDiff,
            minutesLeft,
            homeRaidRate,
            awayRaidRate,
            homeTackleRate,
            awayTackleRate
          });
          
          setAdvice(analysisMessage);
          const shift = Math.round((wpData.home_win_prob - 0.5) * 100);
          setWinProbPredict(shift);
          setLoading(false);
          const el = document.getElementById('advice-panel');
          if (el) { el.classList.remove('animate-fade-up'); void el.offsetWidth; el.classList.add('animate-fade-up'); }
        })
        .catch(() => {
          setAdvice('Could not reach prediction API. Check backend is running.');
          setLoading(false);
        });
    } else {
      // MICRO MODE — local logic
      let highestPts = -1, mvp = null, highestErr = -1, weakestLink = null;
      playerStats.forEach(p => {
        const pPts = parseInt(p.pts) || 0, pErr = parseInt(p.err) || 0;
        if (pPts > highestPts) { highestPts = pPts; mvp = p; }
        if (pErr > highestErr) { highestErr = pErr; weakestLink = p; }
      });
      let generatedAdvice = 'Squad operating at even efficiency. Continue staggered rotations.';
      let shift = 3;
      if (highestPts === 0 && highestErr === 0) { generatedAdvice = 'Awaiting micro-telemetry data.'; shift = 0; }
      else if (highestErr > highestPts && weakestLink) { generatedAdvice = `Critical weakness in ${weakestLink.name} (${highestErr} errors). Pull to bench immediately.`; shift = 14; }
      else if (highestPts >= 5 && mvp) { generatedAdvice = `${mvp.name} dominating with ${highestPts} strikes. Funnel all actions through them.`; shift = 8; }
      else if (weakestLink && highestErr >= 3) { generatedAdvice = `${weakestLink.name} showing fatigue (${highestErr} errors). Consider substitution.`; shift = 11; }
      setAdvice(generatedAdvice);
      setWinProbPredict(shift);
      setLoading(false);
      const el = document.getElementById('advice-panel');
      if (el) { el.classList.remove('animate-fade-up'); void el.offsetWidth; el.classList.add('animate-fade-up'); }
    }
  };

  const handleScoreChange = (type, value) => {
    setScores(prev => ({ ...prev, [type]: value }));
    setAdvice(''); 
    setWinProbPredict(null);
  };

  const handlePlayerStatsChange = (id, field, value) => {
      setPlayerStats(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
      setAdvice('');
      setWinProbPredict(null);
  };



  return (
    <div className="space-y-12 animate-fade-up">
      {/* Hero: Real-time Match Widget */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-7 xl:col-span-8 silk-card rounded-2xl p-8 relative overflow-hidden flex flex-col justify-between h-full">
          <div className="absolute top-0 right-0 p-4">
            <span className="flex items-center gap-2 bg-error/10 text-error px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest silk-inset border border-error/10 animate-[pulseGlow_2s_infinite]">
              <span className="w-2 h-2 bg-error rounded-full animate-pulse"></span> Live: Phase 2
            </span>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8 mt-6">
            <div className="text-center md:text-left flex-1">
              <h2 className="font-headline text-5xl md:text-5xl lg:text-4xl xl:text-5xl font-black text-white mb-1 tracking-tight">OWN SQUAD</h2>
              <p className="font-body text-primary font-bold tracking-[0.2em] text-[10px] uppercase">Home Arena</p>
            </div>
            
            <div className="flex items-center gap-4 md:gap-8 shrink-0">
              <span className="font-headline text-7xl md:text-8xl lg:text-6xl xl:text-[8rem] font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] leading-none transition-all duration-500">
                  {totalOwn}
              </span>
              <div className="h-16 md:h-24 lg:h-20 xl:h-24 w-[2px] bg-white/10 rotate-[15deg]"></div>
              <span className="font-headline text-7xl md:text-8xl lg:text-6xl xl:text-[8rem] font-black tracking-tighter text-neutral-600 leading-none transition-all duration-500">
                  {totalOpp}
              </span>
            </div>
            
            <div className="text-center md:text-right flex-1">
              <h2 className="font-headline text-5xl md:text-5xl lg:text-4xl xl:text-5xl font-black text-neutral-500 mb-1 tracking-tight">OPPONENT</h2>
              <p className="font-body text-neutral-500 font-bold tracking-[0.2em] text-[10px] uppercase">Challengers</p>
            </div>
          </div>
          
          {/* Win Probability Graph */}
          {(() => {
            const winPct = liveWinProb
              ? Math.round(liveWinProb.home_win_prob * 100)
              : (totalOwn > totalOpp ? Math.min(99, 50 + ((totalOwn - totalOpp) * 3)) : Math.max(1, 50 + ((totalOwn - totalOpp) * 3)));
            const winColor = winPct > 55 ? 'text-green-400' : winPct < 45 ? 'text-red-400' : 'text-yellow-400';
            const winGlow  = winPct > 55 ? 'shadow-[0_0_30px_rgba(34,197,94,0.35)]' : winPct < 45 ? 'shadow-[0_0_30px_rgba(239,68,68,0.35)]' : 'shadow-[0_0_30px_rgba(234,179,8,0.35)]';
            const barColor = winPct > 55 ? 'bg-green-500' : winPct < 45 ? 'bg-red-500' : 'bg-yellow-500';
            const model    = liveWinProb?.model === 'lstm' ? 'LSTM AI' : 'Formula';
            return (
              <div className={`h-40 xl:h-52 w-full mt-auto silk-inset rounded-xl overflow-hidden flex flex-col ${winGlow} transition-all duration-1000`}>
                {/* Bar chart */}
                <div className="flex items-end gap-1 px-3 pt-3 flex-1">
                  {[40, 45, 55, 50, 70, 65, 75, 60, 50, 45, 55, 85].map((height, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all duration-1000 ease-out ${i === 4 || i === 11 ? 'bg-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-primary/20 hover:bg-primary/40'}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                {/* Big number strip */}
                <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-t border-white/5">
                  <div className="flex flex-col">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-primary" /> Win Probability
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[7px] font-black uppercase tracking-widest">{model}</span>
                    </p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`font-headline text-5xl xl:text-6xl font-black tracking-tighter leading-none transition-all duration-700 ${winColor}`}>
                        {winPct}
                      </span>
                      <span className="font-headline text-xl font-black text-white/60">%</span>
                      {liveWinProb?.trend !== null && liveWinProb?.trend !== undefined && (
                        <span className={`text-sm font-black ml-1 ${liveWinProb.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {liveWinProb.trend >= 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress arc bar */}
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest">Win Chance</p>
                    <div className="w-28 xl:w-36 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${barColor} shadow-lg`}
                        style={{ width: `${winPct}%` }}
                      />
                    </div>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${winColor}`}>
                      {winPct > 55 ? 'FAVOURED' : winPct < 45 ? 'TRAILING' : 'EVEN'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Live Match Telemetry Input */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          <div className="silk-inset rounded-2xl p-5 flex flex-col border border-white/5 relative group">
            {/* Watermark – clipped independently */}
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] overflow-hidden w-32 h-32 pointer-events-none">
              <BrainCircuit className="w-48 h-48 text-primary" />
            </div>
            
            <div className="flex justify-between items-center z-10 mb-3">
                <p className="text-white font-headline text-base font-black uppercase tracking-tight flex items-center gap-2">
                    Live Telemetry <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
                </p>
            </div>

          {/* Live Controls: Raids + Tackles as raw counts → auto % */}
          <div className="space-y-3 mb-3 z-10">

            {/* OWN TEAM row */}
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-2">Own Team</p>
              <div className="grid grid-cols-2 gap-2">
                {/* Raids */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Raids Scored / Total</label>
                    <span className="text-[8px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">{homeRaidRate}%</span>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" min="0" placeholder="Scored" value={ownRaidsScored}
                      onChange={e => setOwnRaidsScored(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-white font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                    <input type="number" min="0" placeholder="Total" value={ownRaidsTotal}
                      onChange={e => setOwnRaidsTotal(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-white font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                  </div>
                </div>
                {/* Tackles */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Tackles Success / Total</label>
                    <span className="text-[8px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">{homeTackleRate}%</span>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" min="0" placeholder="Success" value={ownTacklesMade}
                      onChange={e => setOwnTacklesMade(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-white font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                    <input type="number" min="0" placeholder="Total" value={ownTacklesTotal}
                      onChange={e => setOwnTacklesTotal(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-white font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* OPPONENT row */}
            <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-2">Opponent</p>
              <div className="grid grid-cols-2 gap-2">
                {/* Raids */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Raids Scored / Total</label>
                    <span className="text-[8px] font-black text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded">{awayRaidRate}%</span>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" min="0" placeholder="Scored" value={oppRaidsScored}
                      onChange={e => setOppRaidsScored(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-neutral-300 font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                    <input type="number" min="0" placeholder="Total" value={oppRaidsTotal}
                      onChange={e => setOppRaidsTotal(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-neutral-300 font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                  </div>
                </div>
                {/* Tackles */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[8px] text-neutral-500 font-black uppercase tracking-widest">Tackles Success / Total</label>
                    <span className="text-[8px] font-black text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded">{awayTackleRate}%</span>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" min="0" placeholder="Success" value={oppTacklesMade}
                      onChange={e => setOppTacklesMade(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-neutral-300 font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                    <input type="number" min="0" placeholder="Total" value={oppTacklesTotal}
                      onChange={e => setOppTacklesTotal(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg p-2 text-neutral-300 font-headline text-center text-xs focus:border-primary outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* All-Outs + Minutes */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block mb-1">All-Outs (Own Team)</label>
                <input type="number" min="0" max="10" value={allOutsHome}
                  onChange={e => setAllOutsHome(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-lg p-2 text-white font-headline text-center focus:border-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block mb-1">Minutes Left</label>
                <input type="number" min="0" max="40" value={minutesLeft}
                  onChange={e => setMinutesLeft(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-lg p-2 text-white font-headline text-center focus:border-primary outline-none transition-colors" />
              </div>
            </div>

          </div>

          {/* Half Toggle */}
          <div className="flex gap-2 mb-3 z-10">
            <button
              type="button"
              onClick={() => setIsSecondHalf(0)}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded transition-all ${
                isSecondHalf === 0 ? 'bg-primary/20 border border-primary/50 text-primary' : 'bg-surface border border-white/5 text-neutral-500 hover:text-white'
              }`}>
              1st Half
            </button>
            <button
              type="button"
              onClick={() => setIsSecondHalf(1)}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded transition-all ${
                isSecondHalf === 1 ? 'bg-primary/20 border border-primary/50 text-primary' : 'bg-surface border border-white/5 text-neutral-500 hover:text-white'
              }`}>
              2nd Half
            </button>
          </div>

          {/* Sequence + Model Badge */}
          <div className="flex items-center justify-between mb-2 z-10">
            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
              matchSequence.length >= 2
                ? 'bg-green-500/10 border-green-500/40 text-green-400'
                : 'bg-surface border-white/10 text-neutral-500'
            }`}>
              {matchSequence.length >= 2 ? `⚡ LSTM · ${matchSequence.length} steps` : `Formula · ${matchSequence.length} step`}
            </span>
            <button
              type="button"
              onClick={resetSequence}
              title="Reset match sequence"
              className="text-[8px] text-neutral-500 hover:text-error flex items-center gap-1 transition-colors">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Timeout Advisor Live Badge */}
          {timeoutAdvice && (
            <div className={`z-10 mb-3 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
              timeoutAdvice.take_timeout
                ? 'bg-error/10 border-error/40 text-error'
                : 'bg-primary/10 border-primary/20 text-primary'
            }`}>
              {timeoutAdvice.take_timeout ? <AlertTriangle className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {timeoutAdvice.advice} — Urgency: {timeoutAdvice.urgency_score}%
            </div>
          )}

          {/* Mode Switcher */}
            <div className="flex gap-2 mb-3 z-10 bg-surface/50 p-1 rounded-lg border border-white/5">
              <button 
                  onClick={() => { setTelemetryMode('macro'); setAdvice(''); }} 
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded transition-all ${telemetryMode === 'macro' ? 'bg-primary text-[#0e0e0e] shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-transparent text-neutral-500 hover:text-white'}`}>
                  MACRO SQUAD
              </button>
              <button 
                  onClick={() => { setTelemetryMode('micro'); setAdvice(''); }} 
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded transition-all ${telemetryMode === 'micro' ? 'bg-primary text-[#0e0e0e] shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-transparent text-neutral-500 hover:text-white'}`}>
                  MICRO PLAYER
              </button>
            </div>
            
            <form onSubmit={handlePredict} className="z-10 w-full relative flex flex-col">
                {telemetryMode === 'macro' ? (
                  <div className="grid grid-cols-2 gap-4 mb-2">
                      <div className="space-y-3">
                          <p className="text-[9px] font-black uppercase text-primary tracking-widest border-b border-primary/20 pb-1">Our Squad</p>
                          <div>
                              <label className="text-[10px] uppercase text-neutral-400 font-bold block mb-1">Raid Pts</label>
                              <input type="number" min="0" value={scores.ownRaid} onChange={(e) => handleScoreChange('ownRaid', e.target.value)} className="w-full bg-surface-container-high border border-white/10 rounded-lg p-2 text-white font-headline focus:border-primary text-center appearance-none" />
                          </div>
                          <div>
                              <label className="text-[10px] uppercase text-neutral-400 font-bold block mb-1">Defense Pts</label>
                              <input type="number" min="0" value={scores.ownDef} onChange={(e) => handleScoreChange('ownDef', e.target.value)} className="w-full bg-surface-container-high border border-white/10 rounded-lg p-2 text-white font-headline focus:border-primary text-center appearance-none" />
                          </div>
                      </div>
                      <div className="space-y-3">
                          <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest border-b border-white/10 pb-1">Opponent</p>
                          <div>
                              <label className="text-[10px] uppercase text-neutral-400 font-bold block mb-1">Raid Pts</label>
                              <input type="number" min="0" value={scores.oppRaid} onChange={(e) => handleScoreChange('oppRaid', e.target.value)} className="w-full bg-surface border border-white/5 rounded-lg p-2 text-neutral-300 font-headline focus:border-primary text-center appearance-none" />
                          </div>
                          <div>
                              <label className="text-[10px] uppercase text-neutral-400 font-bold block mb-1">Defense Pts</label>
                              <input type="number" min="0" value={scores.oppDef} onChange={(e) => handleScoreChange('oppDef', e.target.value)} className="w-full bg-surface border border-white/5 rounded-lg p-2 text-neutral-300 font-headline focus:border-primary text-center appearance-none" />
                          </div>
                      </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-2 custom-scrollbar">
                     <div className="flex justify-end gap-5 px-3 mb-1">
                        <span className="text-[8px] font-black uppercase text-primary tracking-widest">Points</span>
                        <span className="text-[8px] font-black uppercase text-error tracking-widest mr-1">Errors</span>
                     </div>
                     {playerStats.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-surface border border-white/5 p-2 px-3 rounded-lg hover:border-white/20 transition-colors">
                           <div className="flex-1">
                              <p className="text-xs font-black text-white uppercase truncate">{p.name}</p>
                              <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest -mt-0.5">{p.role}</p>
                           </div>
                           <div className="flex gap-2">
                              <input type="number" min="0" placeholder="0" value={p.pts || ''} onChange={e => handlePlayerStatsChange(p.id, 'pts', e.target.value)} className="w-10 bg-surface-container-high text-center text-xs font-headline font-black text-primary border border-white/5 rounded py-1 focus:border-primary focus:bg-surface outline-none transition-all placeholder:text-primary/30" />
                              <input type="number" min="0" placeholder="0" value={p.err || ''} onChange={e => handlePlayerStatsChange(p.id, 'err', e.target.value)} className="w-10 bg-error/5 text-center text-xs font-headline font-black text-error border border-error/10 rounded py-1 focus:border-error focus:bg-surface outline-none transition-all placeholder:text-error/30" />
                           </div>
                        </div>
                     ))}
                  </div>
                )}

                <div className="mt-auto pt-4 bg-surface-container/90 backdrop-blur pb-1">
                  {advice ? (
                    <div id="advice-panel" className="space-y-4 border-t border-white/10 pt-2">
                       <p className={`font-body text-sm leading-relaxed font-bold border-l-2 pl-3 py-2 pr-2 ${telemetryMode === 'micro' ? 'border-primary bg-primary/5 text-white' : 'border-primary bg-primary/5 text-white'}`}>"{advice}"</p>
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] text-primary font-black uppercase tracking-widest">Calculated Tactical Shift: <span className="text-white bg-primary/20 border border-primary/30 px-1.5 py-0.5 rounded ml-1 animate-pulse">{winProbPredict >= 0 ? '+' : ''}{winProbPredict}%</span></span>
                       </div>
                    </div>
                  ) : (
                    <button type="submit" className="w-full relative overflow-hidden group py-5 bg-gradient-to-br from-primary to-indigo-600 text-[#0e0e0e] font-black text-xs md:text-sm tracking-[0.2em] rounded-xl transform transition-all duration-500 hover:scale-[1.05] hover:-translate-y-2 hover:rotate-[1deg] hover:shadow-[0_20px_40px_-5px_rgba(99,102,241,0.6)] shadow-[0_8px_20px_rgba(99,102,241,0.3)] flex items-center justify-center gap-3 border-t border-white/20">
                        {/* 3D internal highlight */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute inset-0 scale-150 rotate-12 opacity-0 group-hover:opacity-20 group-hover:animate-pulse transition-all duration-700 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent"></div>
                        
                        {loading ? <Activity className="w-5 h-5 animate-spin relative z-10 text-white" /> : <BrainCircuit className="w-5 h-5 relative z-10 group-hover:-rotate-12 group-hover:scale-125 transition-transform duration-500 text-black group-hover:text-white" />}
                        <span className="relative z-10 drop-shadow-sm group-hover:text-white transition-colors duration-500">{loading ? 'ANALYZING MATRIX...' : 'RUN TACTICAL CALCULATION'}</span>
                    </button>
                  )}
                </div>
            </form>
          </div>
        </div>
      </section>

      {/* Bento Grid: Performance & Analytics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

        {/* RF Match Outcome Predictor */}
        <div className="md:col-span-2 lg:col-span-4 silk-card rounded-2xl p-6 border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><TrendingUp className="w-48 h-48 text-primary" /></div>
          <div className="flex flex-col md:flex-row md:items-center gap-6 z-10 relative">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-headline text-lg font-black text-white tracking-tight uppercase">RF Match Outcome Predictor</h3>
                <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 text-primary text-[8px] font-black uppercase rounded tracking-widest">Random Forest AI</span>
              </div>
              <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Select two teams to get a Win / Loss / Tie prediction</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="group">
                <label className="text-[9px] text-primary font-black uppercase tracking-widest block mb-1">Home Team</label>
                <div className="relative">
                  <select value={selectedHome} onChange={e => setSelectedHome(e.target.value)}
                    className="bg-surface-container-high border border-white/10 text-white text-xs font-bold rounded-xl px-4 py-3 outline-none transition-all duration-300 min-w-[180px] cursor-pointer appearance-none pr-8
                    hover:border-primary/60 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] focus:border-primary focus:shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                  >
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary opacity-60 group-hover:opacity-100 transition-opacity">▾</div>
                </div>
              </div>

              <div className="hidden sm:flex items-center pb-3">
                <span className="text-neutral-600 font-black text-lg tracking-widest border border-white/5 px-3 py-1 rounded-lg bg-surface">VS</span>
              </div>

              <div className="group">
                <label className="text-[9px] text-neutral-500 font-black uppercase tracking-widest block mb-1">Away Team</label>
                <div className="relative">
                  <select value={selectedAway} onChange={e => setSelectedAway(e.target.value)}
                    className="bg-surface border border-white/5 text-neutral-300 text-xs font-bold rounded-xl px-4 py-3 outline-none transition-all duration-300 min-w-[180px] cursor-pointer appearance-none pr-8
                    hover:border-primary/60 hover:text-white hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] focus:border-primary focus:shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                  >
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors">▾</div>
                </div>
              </div>

              <button
                onClick={handlePredictOutcome}
                disabled={outcomeLoading || !selectedHome || !selectedAway || selectedHome === selectedAway}
                className="relative overflow-hidden group px-8 py-3 bg-gradient-to-br from-primary to-indigo-600 text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl
                  transform transition-all duration-500
                  hover:scale-[1.06] hover:-translate-y-1 hover:rotate-[0.5deg]
                  hover:shadow-[0_15px_35px_-5px_rgba(99,102,241,0.6)]
                  shadow-[0_6px_16px_rgba(99,102,241,0.3)]
                  border-t border-white/20
                  disabled:opacity-40 disabled:pointer-events-none
                  flex items-center gap-2 whitespace-nowrap"
              >
                {/* 3D internal highlight */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {/* Radial glow sweep */}
                <div className="absolute inset-0 scale-150 rotate-12 opacity-0 group-hover:opacity-20 group-hover:animate-pulse transition-all duration-700 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent" />

                {outcomeLoading
                  ? <Activity className="w-4 h-4 animate-spin relative z-10 text-white" />
                  : <BrainCircuit className="w-4 h-4 relative z-10 group-hover:-rotate-12 group-hover:scale-125 transition-transform duration-500 text-black group-hover:text-white" />
                }
                <span className="relative z-10 drop-shadow-sm group-hover:text-white transition-colors duration-500">
                  {outcomeLoading ? 'Predicting...' : 'Predict Outcome'}
                </span>
              </button>
            </div>
          </div>

          {matchOutcome && (
            <div className="mt-6 pt-5 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 z-10 relative">
              {/* Verdict */}
              <div className="md:col-span-1 silk-inset rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mb-2">Predicted Winner</p>
                <p className={`font-headline text-2xl font-black uppercase tracking-tighter ${matchOutcome.predicted_outcome === 'Tie' ? 'text-yellow-400' : 'text-white'}`}>
                  {matchOutcome.predicted_winner}
                </p>
                <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">
                  Confidence: <span className="text-primary font-black">{Math.round(matchOutcome.confidence * 100)}%</span>
                </p>
                <span className="mt-2 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-surface border border-white/5 text-neutral-500">
                  {matchOutcome.model === 'random_forest' ? '🤖 Random Forest' : '📐 Formula'}
                </span>
              </div>

              {/* Probability Bars */}
              <div className="md:col-span-2 space-y-3">
                {[
                  { label: 'Win (Home)', key: 'Win', color: 'bg-green-500' },
                  { label: 'Loss (Away Wins)', key: 'Loss', color: 'bg-red-500' },
                  { label: 'Tie / Draw', key: 'Tie', color: 'bg-yellow-400' },
                ].map(({ label, key, color }) => {
                  const pct = Math.round((matchOutcome.probabilities?.[key] || 0) * 100);
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">{label}</span>
                        <span className="text-[10px] text-white font-black">{pct}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>


        {/* ── Team Synergy (proper formula) ──────────────────────── */}
        <div className="silk-card rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-[0.04]">
            <BrainCircuit className="w-36 h-36 text-primary" />
          </div>
          <div>
            <h3 className="font-headline text-sm font-black text-white mb-0.5 tracking-tight uppercase">Team Synergy</h3>
            <p className="text-[9px] text-neutral-500 font-black tracking-widest uppercase">√(Raid% × Tackle%) — Combined Efficiency</p>
          </div>
          {(() => {
            const synergy = Math.round(Math.sqrt(homeRaidRate * homeTackleRate));
            const grade =
              synergy >= 75 ? { label: 'Elite',    color: 'text-green-400',  border: 'border-green-500/40',  bg: 'bg-green-500/10' } :
              synergy >= 55 ? { label: 'Good',     color: 'text-primary',    border: 'border-primary/40',    bg: 'bg-primary/10'   } :
              synergy >= 35 ? { label: 'Average',  color: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10'} :
                              { label: 'Critical', color: 'text-error',      border: 'border-error/40',      bg: 'bg-error/10'     };
            return (
              <>
                <div className="flex items-baseline gap-1 py-3 justify-center">
                  <span className={`font-headline text-8xl font-black tracking-tighter drop-shadow-sm transition-all duration-700 ${grade.color}`}>
                    {synergy}
                  </span>
                  <span className="font-headline text-2xl font-black text-white">%</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${grade.bg} ${grade.border} ${grade.color}`}>
                    {grade.label}
                  </span>
                  <span className="text-[9px] text-neutral-500 font-bold">
                    R:{homeRaidRate}% × T:{homeTackleRate}%
                  </span>
                </div>
                <div className="w-full h-1.5 silk-inset rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      synergy >= 75 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
                      synergy >= 55 ? 'bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]' :
                      synergy >= 35 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' :
                                      'bg-error shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                    }`}
                    style={{ width: `${synergy}%` }}
                  />
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Raid Success ──────────────────────────────────── */}
        <div className="silk-card rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-[0.04]">
            <Zap className="w-36 h-36 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-headline text-sm font-black text-white mb-0.5 tracking-tight uppercase">Own Squad — Raid</h3>
            <p className="text-[9px] text-neutral-500 font-black tracking-widest uppercase">Home Raid Success Rate</p>
          </div>
          {(() => {
            const val = homeRaidRate;
            const color = val >= 65 ? 'text-green-400' : val >= 45 ? 'text-primary' : val >= 30 ? 'text-yellow-400' : 'text-error';
            const barColor = val >= 65 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : val >= 45 ? 'bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]' : val >= 30 ? 'bg-yellow-500' : 'bg-error shadow-[0_0_10px_rgba(239,68,68,0.5)]';
            return (
              <>
                <div className="flex items-baseline gap-1 py-3 justify-center">
                  <span className={`font-headline text-8xl font-black tracking-tighter drop-shadow-sm transition-all duration-700 ${color}`}>
                    {val}
                  </span>
                  <span className="font-headline text-2xl font-black text-white">%</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] text-neutral-500 font-bold">Raids scored vs attempted</span>
                  <span className={`text-[9px] font-black uppercase ${color}`}>
                    {val >= 65 ? 'Dominant' : val >= 45 ? 'Stable' : val >= 30 ? 'Struggling' : 'Critical'}
                  </span>
                </div>
                <div className="w-full h-1.5 silk-inset rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${val}%` }} />
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Defence Success ───────────────────────────────── */}
        <div className="silk-card rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-[0.04]">
            <Shield className="w-36 h-36 text-blue-400" />
          </div>
          <div>
            <h3 className="font-headline text-sm font-black text-white mb-0.5 tracking-tight uppercase">Own Squad — Defence</h3>
            <p className="text-[9px] text-neutral-500 font-black tracking-widest uppercase">Home Tackle Success Rate</p>
          </div>
          {(() => {
            const val = homeTackleRate;
            const color = val >= 70 ? 'text-green-400' : val >= 50 ? 'text-primary' : val >= 35 ? 'text-yellow-400' : 'text-error';
            const barColor = val >= 70 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : val >= 50 ? 'bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]' : val >= 35 ? 'bg-yellow-500' : 'bg-error shadow-[0_0_10px_rgba(239,68,68,0.5)]';
            return (
              <>
                <div className="flex items-baseline gap-1 py-3 justify-center">
                  <span className={`font-headline text-8xl font-black tracking-tighter drop-shadow-sm transition-all duration-700 ${color}`}>
                    {val}
                  </span>
                  <span className="font-headline text-2xl font-black text-white">%</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] text-neutral-500 font-bold">Tackles succeeded vs attempted</span>
                  <span className={`text-[9px] font-black uppercase ${color}`}>
                    {val >= 70 ? 'Ironclad' : val >= 50 ? 'Solid' : val >= 35 ? 'Leaking' : 'Exposed'}
                  </span>
                </div>
                <div className="w-full h-1.5 silk-inset rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${val}%` }} />
                </div>
              </>
            );
          })()}
        </div>

        {/* Stamina Alert Critical Task */}
        {/* Stamina Alert Critical Task */}
        {(() => {
          const lowStaminaPlayer = activeLineup.find(p => p.stamina < 30) || activeLineup.find(p => p.stamina < 50) || activeLineup[activeLineup.length - 1];
          if (!lowStaminaPlayer || activeLineup.length === 0) return null;
          
          const availableBench = benchPlayers.filter(bp => !bp.isSubstituted);
          
          return (
            <div className="bg-error/10 border border-error/50 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.1)]">
              <div className="absolute -right-4 -top-4 opacity-[0.05]">
                 <Clock className="w-40 h-40 text-error" />
              </div>
              <div>
                <h3 className="font-headline text-sm font-black text-error mb-1 uppercase flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-pulse" /> Stamina Override
                </h3>
                <p className="text-[9px] text-error/80 font-black tracking-widest uppercase">
                  {lowStaminaPlayer.stamina < 30 ? 'Critical Depletion Detected' : 'Low Energy Warning'}
                </p>
              </div>
              <div className="my-6 z-10 bg-[#0e0e0e]/50 backdrop-blur rounded-xl p-4 border border-error/20">
                <p className="font-black font-headline text-white text-2xl uppercase tracking-tighter">
                  {lowStaminaPlayer.name.replace(' (SUB)', '').replace(' (OUT)', '')}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-error font-bold uppercase tracking-widest">Remaining:</span>
                  <span className="text-error font-black text-xl leading-none">{lowStaminaPlayer.stamina}%</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest">Available:</span>
                  <span className="text-neutral-300 font-black text-sm">{availableBench.length} bench</span>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  handleSubstitution(lowStaminaPlayer);
                }}
                disabled={availableBench.length === 0}
                className={`w-full py-4 font-headline text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform border-none hover:scale-[1.03] hover:brightness-110 flex justify-center z-10 ${
                  availableBench.length === 0 
                    ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed' 
                    : 'bg-error text-white shadow-error/20 cursor-pointer'
                }`}
              >
                {availableBench.length === 0 ? 'NO BENCH AVAILABLE' : 'INITIATE SUBSTITUTION'}
              </button>
            </div>
          );
        })()}

        {/* New Module: Live Formation Set */}
        <div className="md:col-span-1 lg:col-span-2 silk-card rounded-2xl p-6 flex flex-col h-full border border-white/5">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
            <h3 className="font-headline text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Active Formation
            </h3>
            <span className="px-3 py-1 bg-surface-container-high border border-white/10 text-primary text-[9px] font-black uppercase rounded-lg tracking-widest">
              {activeLineup.length} Active • {benchPlayers.filter(p => !p.isSubstituted).length} Available
            </span>
          </div>
          
          <div className="flex-1 space-y-3 px-2">
              {activeLineup.map((player, i) => (
                 <div key={player.id || i} className="flex justify-between items-center p-3 silk-inset rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
                     <div className="flex flex-col">
                         <span className={`text-sm font-black uppercase font-headline tracking-wide ${
                           player.isSubstituted ? 'text-green-400' : 'text-white'
                         }`}>
                           {player.name}
                           {player.isSubstituted && (
                             <span className="ml-2 text-[8px] bg-green-500/20 border border-green-500/40 px-1.5 py-0.5 rounded text-green-400">
                               SUB
                             </span>
                           )}
                         </span>
                         <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-[0.2em]">{player.role}</span>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                         <div className="flex gap-1 bg-[#0e0e0e] p-1 rounded">
                             <div className={`h-2 w-6 rounded-[2px] ${
                               player.stamina < 30 
                                 ? 'bg-error shadow-[0_0_5px_rgba(239,68,68,0.8)]' 
                                 : player.isSubstituted 
                                   ? 'bg-green-500' 
                                   : 'bg-primary'
                             }`}></div>
                             <div className={`h-2 w-6 rounded-[2px] ${
                               player.stamina < 30 
                                 ? 'bg-error/30' 
                                 : (player.stamina < 60 
                                   ? (player.isSubstituted ? 'bg-green-500/70' : 'bg-primary/50') 
                                   : (player.isSubstituted ? 'bg-green-500' : 'bg-primary'))
                             }`}></div>
                             <div className={`h-2 w-6 rounded-[2px] ${
                               player.stamina < 80 
                                 ? 'bg-surface-container-high' 
                                 : (player.isSubstituted ? 'bg-green-500' : 'bg-primary')
                             }`}></div>
                         </div>
                         <span className={`text-[8px] font-black uppercase ${
                           player.stamina < 30 
                             ? 'text-error animate-pulse' 
                             : player.isSubstituted 
                               ? 'text-green-400' 
                               : 'text-neutral-500'
                         }`}>
                           Trc: {player.stamina}%
                         </span>
                     </div>
                 </div>
              ))}
          </div>
        </div>

        {/* Improved Strategic Graph */}
        <div className="md:col-span-1 lg:col-span-2 silk-card rounded-2xl p-6 flex flex-col h-full border border-white/5 overflow-hidden relative">
          <div className="absolute -bottom-10 -right-10 opacity-[0.03] rotate-12">
              <Activity className="w-64 h-64 text-white" />
          </div>
          <div className="flex-1 z-10 flex flex-col justify-end">
            <h3 className="font-headline text-2xl font-black mb-2 text-white tracking-tighter uppercase relative z-10">Real-Time Vectors</h3>
            <p className="text-neutral-400 font-body text-xs mb-8 leading-relaxed max-w-sm relative z-10">
               Live analysis of team formation efficacy telemetry. Current delta shift indicates a heavy opponent right-side bias demanding an aggressive left-corner counter protocol.
            </p>
            <div className="flex gap-4 relative z-10 mt-auto">
              <div className="px-5 py-4 silk-inset rounded-xl border border-white/5 flex-1 relative overflow-hidden">
                <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mb-1">Engaged Protocol</p>
                <p className="font-black font-headline text-2xl text-white uppercase tracking-tighter">5-1 Split</p>
              </div>
              <div className="px-5 py-4 silk-inset rounded-xl border border-primary/20 bg-primary/5 flex-1 relative overflow-hidden">
                <p className="text-[9px] text-primary/80 font-black uppercase tracking-widest mb-1">Efficiency Delta</p>
                <p className="font-black font-headline text-2xl text-primary uppercase tracking-tighter">+14.2%</p>
              </div>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
