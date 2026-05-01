import React, { useState } from 'react';
import { Gavel, Search, Filter, Plus, X } from 'lucide-react';

export default function AuctionDashboard() {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Pawan Sehrawat', pos: 'Raider', team: 'Telugu Titans', form: 95, value: '₹2.6 Cr' },
    { id: 2, name: 'Mohammadreza Chiyaneh', pos: 'All Rounder', team: 'Puneri Paltan', form: 92, value: '₹2.3 Cr' },
    { id: 3, name: 'Fazel Atrachali', pos: 'Defender', team: 'Gujarat Fortunegiants', form: 88, value: '₹1.6 Cr' },
    { id: 4, name: 'Naveen Kumar', pos: 'Raider', team: 'Dabang Delhi K.C.', form: 87, value: '₹1.5 Cr' },
  ]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', pos: 'Raider', team: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlayer.name,
          position: newPlayer.pos,
          team_id: newPlayer.team
        })
      });
      if(res.ok) {
        setPlayers([...players, {
          id: Math.random(),
          name: newPlayer.name,
          pos: newPlayer.pos,
          team: newPlayer.team,
          form: 90,
          value: '₹1.0 Cr'
        }]);
        setIsAddModalOpen(false);
        setNewPlayer({ name: '', pos: 'Raider', team: '' });
      } else {
        const errorData = await res.json();
        alert("Failed to add player: " + (errorData.detail || errorData.error || "Check backend logs."));
      }
    } catch (e) {
      console.error(e);
      alert("Network Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-kw-surface-variant pb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tighter text-white flex items-center">
            <Gavel className="w-6 h-6 mr-3 text-kw-secondary" />
            Auction Manager Tool
          </h1>
          <p className="text-kw-outline mt-1 text-sm font-mono uppercase tracking-widest">Base Value Calculator / Active Module</p>
        </div>
        
        <div className="flex space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 border-b border-kw-surface-variant focus-within:border-kw-primary transition-colors">
             <Search className="w-4 h-4 absolute left-3 top-3.5 text-kw-outline" />
             <input type="text" placeholder="QUERY DATABASE..." className="w-full bg-kw-surface-container-low pl-10 pr-4 py-3 font-mono text-sm text-white focus:outline-none no-round placeholder-kw-outline-variant transition" />
          </div>
          <button className="bg-kw-surface border border-kw-surface-variant p-3 no-round text-kw-outline hover:text-white transition">
            <Filter className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center bg-kw-surface border border-kw-primary text-kw-primary hover:bg-kw-primary/10 px-4 py-3 no-round transition text-sm font-bold uppercase tracking-widest"
          >
            <Plus className="w-4 h-4 mr-2" /> ADD DATA
          </button>
        </div>
      </div>

      <div className="solid-card-high no-round overflow-hidden border border-kw-surface-variant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="text-xs text-kw-outline uppercase bg-kw-surface border-b border-kw-surface-variant tracking-widest">
              <tr>
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Current Team</th>
                <th className="px-6 py-4 text-center">Form (0-100)</th>
                <th className="px-6 py-4 text-right text-kw-primary">Est. Value</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-kw-surface-variant hover:bg-kw-surface transition-colors cursor-pointer text-white">
                  <td className="px-6 py-4 font-bold uppercase tracking-wide font-sans">{p.name}</td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-1 no-round font-bold border ${
                      p.pos === 'Raider' ? 'bg-kw-primary/10 text-kw-primary border-kw-primary/30' :
                      p.pos === 'Defender' ? 'bg-kw-secondary/10 text-kw-secondary border-kw-secondary/30' :
                      'bg-kw-tertiary/10 text-kw-tertiary border-kw-tertiary/30'
                    }`}>
                      {p.pos.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 uppercase tracking-wider">{p.team}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="mr-3 font-bold">{p.form}</span>
                      <div className="w-16 h-1.5 bg-kw-surface-variant no-round overflow-hidden">
                        <div className="h-full bg-kw-primary" style={{width: `${p.form}%`}}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-kw-on-surface">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="solid-card-high no-round border-t-2 border-kw-primary w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-kw-surface-variant bg-kw-surface-container-low">
              <h2 className="text-xl font-bold text-white font-sans uppercase tracking-wider">Inject Roster Data</h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-kw-outline hover:text-kw-tertiary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddPlayer} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-mono text-kw-outline-variant uppercase tracking-wider mb-2">Subject Name</label>
                <input 
                  type="text" 
                  required
                  value={newPlayer.name}
                  onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
                  className="w-full bg-kw-surface border-b-2 border-kw-surface-variant px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-kw-primary no-round transition-colors"
                  placeholder="E.g. Siddharth Desai"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-kw-outline-variant uppercase tracking-wider mb-2">Specialization</label>
                <select 
                  value={newPlayer.pos}
                  onChange={e => setNewPlayer({...newPlayer, pos: e.target.value})}
                  className="w-full bg-kw-surface border-b-2 border-kw-surface-variant px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-kw-primary appearance-none no-round text-center"
                >
                  <option value="Raider" className="bg-kw-surface text-white">RAIDER</option>
                  <option value="Defender" className="bg-kw-surface text-white">DEFENDER</option>
                  <option value="All Rounder" className="bg-kw-surface text-white">ALL ROUNDER</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-kw-outline-variant uppercase tracking-wider mb-2">Current Affiliate</label>
                <input 
                  type="text" 
                  required
                  value={newPlayer.team}
                  onChange={e => setNewPlayer({...newPlayer, team: e.target.value})}
                  className="w-full bg-kw-surface border-b-2 border-kw-surface-variant px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-kw-primary no-round transition-colors"
                  placeholder="Team Alias"
                />
              </div>
              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full kabaddi-gradient text-kw-on-primary-fixed font-bold py-4 no-round uppercase tracking-widest shadow-none hover:brightness-110 active:brightness-90 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? 'PROCESSING...' : 'INITIALIZE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
