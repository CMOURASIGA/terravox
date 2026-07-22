import React from 'react';
import { PlayerProfile } from '../types';
import { Map, Lock, Unlock, Compass } from 'lucide-react';

interface MapScreenProps {
  profile: PlayerProfile;
  onSelectTerritory: (territoryId: string) => void;
  onOpenPassport: () => void;
}

const TERRITORIES = [
  { id: 'brasil', name: 'Brasil', isBase: true, position: { top: '50%', left: '30%' } },
  { id: 'mexico', name: 'México', isBase: false, position: { top: '35%', left: '20%' } },
  { id: 'egito', name: 'Egito', isBase: false, position: { top: '40%', left: '55%' } },
];

export function MapScreen({ profile, onSelectTerritory, onOpenPassport }: MapScreenProps) {
  return (
    <div className="relative w-full h-full min-h-screen bg-sky-100 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-xl">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{profile.name}</h1>
            <p className="text-indigo-300 text-sm font-medium">Nível {profile.level} • {profile.xp} XP</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="bg-slate-700 px-4 py-1.5 rounded-full flex gap-2 items-center text-amber-400 font-bold">
             <span className="w-4 h-4 bg-amber-400 rounded-full inline-block"></span>
             {profile.coins}
          </div>
          <button 
            onClick={onOpenPassport}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
          >
            <Compass size={24} />
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Simple mock map background */}
        <div className="absolute inset-0 bg-blue-300 opacity-20"></div>
        
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Mapa Mundial</h2>
          <p className="text-slate-600">Selecione um território para explorar.</p>
        </div>

        {/* Territories */}
        <div className="relative w-full h-[60vh] max-w-4xl mx-auto border-4 border-slate-300 rounded-3xl bg-blue-100 overflow-hidden shadow-inner mt-4">
           {TERRITORIES.map(t => {
             const isUnlocked = t.isBase || profile.unlockedTerritories.includes(t.id);
             return (
               <button
                 key={t.id}
                 onClick={() => onSelectTerritory(t.id)}
                 className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-transform hover:scale-110`}
                 style={{ top: t.position.top, left: t.position.left }}
               >
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-2 ${
                   isUnlocked ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-slate-200'
                 }`}>
                   {isUnlocked ? <Unlock size={32} /> : <Lock size={32} />}
                 </div>
                 <span className={`font-bold px-3 py-1 rounded-full text-sm shadow-sm ${
                   isUnlocked ? 'bg-white text-slate-800' : 'bg-slate-200 text-slate-500'
                 }`}>
                   {t.name}
                 </span>
               </button>
             )
           })}
        </div>
      </div>
    </div>
  );
}
