import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import { ArrowLeft, Zap, Shield, Target, Activity, Award, TrendingUp, Star } from 'lucide-react';

import { playerService } from '../services/playerService';

const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1200&auto=format&fit=crop";

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('radar');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    playerService.getPlayerById(id)
      .then(data => { setPlayer(data); setLoading(false); })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-headline text-xs uppercase tracking-widest">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center flex-col gap-4">
        <p className="text-neutral-400 font-headline text-xl uppercase">Player not found</p>
        <button onClick={() => navigate(-1)} className="text-primary font-bold uppercase text-xs tracking-widest hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const p = player;
  const pdr = Math.round((p.successful_raid_pct * 0.6) + (p.tackle_success_rate * 0.4) + (p.points / 10));

  const radarData = [
    { subject: 'Raid %',     A: p.successful_raid_pct || 0,                    fullMark: 100 },
    { subject: 'Tackle %',   A: p.tackle_success_rate || 0,                    fullMark: 100 },
    { subject: 'Super Raids',A: Math.min((p.super_raids || 0) * 10, 100),      fullMark: 100 },
    { subject: 'Super 10s',  A: Math.min((p.super_10s || 0) * 10, 100),        fullMark: 100 },
    { subject: 'High 5s',    A: Math.min((p.high_5s || 0) * 20, 100),          fullMark: 100 },
    { subject: 'Not Out %',  A: p.not_out_pct || 0,                            fullMark: 100 },
  ];

  const statCards = [
    { label: 'Total Points',      value: p.points || 0,                   icon: Zap,       color: 'text-primary',   glow: 'shadow-[0_0_20px_rgba(99,102,241,0.2)]' },
    { label: 'Matches Played',    value: p.matches_played || 0,           icon: Activity,  color: 'text-blue-400',  glow: '' },
    { label: 'Raid Points',       value: p.total_raid_points || 0,        icon: Target,    color: 'text-yellow-400',glow: 'shadow-[0_0_20px_rgba(250,204,21,0.1)]' },
    { label: 'Tackle Success',    value: `${p.tackle_success_rate || 0}%`,icon: Shield,    color: 'text-green-400', glow: '' },
    { label: 'Super Raids',       value: p.super_raids || 0,              icon: Star,      color: 'text-orange-400',glow: '' },
    { label: 'Career Best',       value: p.career_best_points || 0,       icon: Award,     color: 'text-primary',   glow: '' },
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Back Bar */}
      <div className="sticky top-0 z-50 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors duration-200"
        >
          <div className="w-8 h-8 rounded-lg border border-white/10 group-hover:border-primary/50 group-hover:bg-primary/10 flex items-center justify-center transition-all duration-300">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="font-headline text-xs uppercase tracking-widest">Player Roster</span>
        </button>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-neutral-600 font-headline text-xs uppercase tracking-widest">Profile</span>
        <span className="text-neutral-500 font-headline text-xs">/</span>
        <span className="text-white font-headline text-xs uppercase tracking-widest">{p.name}</span>
      </div>

      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[420px] overflow-hidden group/hero bg-[#0e0e0e]">
        {/* Ambient blurred full-bleed background layer to prevent empty black bars on the sides */}
        <img
          src={p.photo_url || DEFAULT_PHOTO}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-2xl brightness-[0.18] scale-105"
        />
        {/* Focused player portrait layer (focuses on face at scale-1.5, zooms out to scale-[1.0] to show body and cover full area on hover) */}
        <img
          src={p.photo_url || DEFAULT_PHOTO}
          alt={p.name}
          className="absolute inset-0 w-full h-full object-cover object-top scale-[1.5] group-hover/hero:scale-[1.0] transition-all duration-[1200ms] ease-out blur-[1px] brightness-[0.35] group-hover/hero:blur-none group-hover/hero:brightness-[0.8]"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e]/80 via-transparent to-transparent" />

        {/* Giant background name */}
        <div className="absolute bottom-0 right-0 text-[12rem] font-black text-white/[0.025] font-headline leading-none select-none uppercase overflow-hidden whitespace-nowrap pointer-events-none">
          {p.name?.split(' ')[0]}
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 flex flex-col md:flex-row items-end gap-8">
          {/* Player image */}
          <div className="hidden md:block w-52 h-64 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/80 relative group">
            <img
              src={p.photo_url || DEFAULT_PHOTO}
              alt={p.name}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          {/* Name / info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {p.team?.name && (
                <span className="bg-primary/20 border border-primary/40 text-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full">
                  {p.team.name}
                </span>
              )}
              <span className="bg-white/5 border border-white/10 text-neutral-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full">
                {p.position || 'Unknown'}
              </span>
              {pdr > 0 && (
                <span className="bg-primary text-black px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/30">
                  {pdr} PDR
                </span>
              )}
            </div>

            <h1 className="text-5xl md:text-7xl font-black font-headline tracking-tighter uppercase leading-none text-white mb-2">
              {p.name?.split(' ').map((n, i) => (
                <span key={i} className={i > 0 ? 'text-primary' : ''}>{n} </span>
              ))}
            </h1>

            <div className="flex flex-wrap gap-6 mt-4">
              {p.nationality && (
                <div>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Nationality</p>
                  <p className="text-sm font-bold text-white">{p.nationality}</p>
                </div>
              )}
              {p.height && (
                <div>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Height</p>
                  <p className="text-sm font-bold text-white">{p.height.toLowerCase().includes('ft') ? p.height : `${p.height} cm`}</p>
                </div>
              )}
              {p.weight && (
                <div>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">Weight</p>
                  <p className="text-sm font-bold text-white">{p.weight} kg</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-8 md:px-12 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((s, i) => (
            <div
              key={i}
              className={`bg-surface-container border border-white/5 rounded-xl p-4 flex flex-col gap-2 hover:border-primary/50 hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5 cursor-pointer transition-all duration-300 ${s.glow}`}
            >
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className={`text-2xl font-black font-headline ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-surface-container p-1 rounded-xl border border-white/5 w-fit">
          {[
            { id: 'overview', label: 'Performance' },
            { id: 'raids', label: 'Raid Stats' },
            { id: 'defence', label: 'Defence Stats' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 font-headline text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-primary text-black shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-16">
          {/* Chart */}
          <div className="bg-surface-container border border-white/5 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline text-sm font-black uppercase tracking-tight text-white">Performance Analysis</h3>
              <div className="flex gap-1 bg-surface p-1 rounded-lg border border-white/5">
                {['radar', 'bar', 'line'].map(type => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-3 py-1 font-headline text-[9px] font-black uppercase tracking-widest transition-all rounded ${
                      chartType === type ? 'bg-primary text-black' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'radar' ? (
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#262626" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff' }} />
                    <Radar name={p.name} dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                  </RadarChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={radarData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="subject" type="category" tick={{ fill: '#adaaaa', fontSize: 10 }} width={85} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff' }} />
                    <Bar dataKey="A" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                ) : (
                  <LineChart data={radarData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="subject" tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="number" domain={[0, 100]} tick={{ fill: '#adaaaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1a1919', borderColor: '#262626', color: '#fff' }} />
                    <Line type="monotone" dataKey="A" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, stroke: '#fff' }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed stats based on tab */}
          <div className="bg-surface-container border border-white/5 rounded-2xl p-6">
            <h3 className="font-headline text-sm font-black uppercase tracking-tight text-white mb-6">
              {activeTab === 'overview' ? 'Key Metrics' : activeTab === 'raids' ? 'Raid Breakdown' : 'Defence Breakdown'}
            </h3>

            <div className="space-y-5">
              {(activeTab === 'overview' ? [
                { label: 'Raid Success Rate',    value: p.successful_raid_pct || 0, max: 100, unit: '%', color: 'bg-yellow-400' },
                { label: 'Tackle Success Rate',  value: p.tackle_success_rate || 0, max: 100, unit: '%', color: 'bg-green-400' },
                { label: 'Not Out Percentage',   value: p.not_out_pct || 0,         max: 100, unit: '%', color: 'bg-primary' },
                { label: 'Tackles Per Match',    value: p.tackles_per_match || 0,   max: 5,   unit: '',  color: 'bg-blue-400' },
              ] : activeTab === 'raids' ? [
                { label: 'Total Raids',          value: p.raids || 0,               max: Math.max(p.raids || 1, 200), unit: '', color: 'bg-yellow-400' },
                { label: 'Successful Raids',     value: p.successful_raids || 0,    max: Math.max(p.raids || 1, 200), unit: '', color: 'bg-green-400' },
                { label: 'Super Raids',          value: p.super_raids || 0,         max: 20,  unit: '', color: 'bg-orange-400' },
                { label: 'Empty Raids',          value: p.empty_raids || 0,         max: Math.max(p.raids || 1, 200), unit: '', color: 'bg-red-400' },
              ] : [
                { label: 'Total Tackles',        value: p.tackles || 0,             max: Math.max(p.tackles || 1, 100), unit: '', color: 'bg-blue-400' },
                { label: 'Successful Tackles',   value: p.successful_tackles || 0,  max: Math.max(p.tackles || 1, 100), unit: '', color: 'bg-green-400' },
                { label: 'Super Tackles',        value: p.super_tackles || 0,       max: 20,  unit: '', color: 'bg-primary' },
                { label: 'High 5s',              value: p.high_5s || 0,             max: 10,  unit: '', color: 'bg-yellow-400' },
              ]).map((stat, i) => {
                const pct = Math.min(100, (stat.value / stat.max) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">{stat.label}</span>
                      <span className="text-sm font-black text-white font-headline">{stat.value}{stat.unit}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stat.color} rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PDR Score explainer */}
            <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-xl hover:scale-[1.03] hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 cursor-pointer transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-[10px] text-primary font-black uppercase tracking-widest">PDR Score</span>
                </div>
                <span className="font-headline text-3xl font-black text-primary">{pdr}</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-bold leading-relaxed">
                Performance Dominance Rating — composite metric from raid %, tackle %, and total points.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
