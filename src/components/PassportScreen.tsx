import React from 'react';
import { PlayerProfile } from '../types';
import { ArrowLeft, MapPin, Award, Zap } from 'lucide-react';

interface PassportScreenProps {
  profile: PlayerProfile;
  onBack: () => void;
}

export function PassportScreen({ profile, onBack }: PassportScreenProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center p-6">
      <div className="w-full max-w-2xl mt-4">
        
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-8">
          <ArrowLeft size={20} /> Voltar ao Mapa
        </button>

        <h2 className="text-3xl font-bold text-white mb-6">Passaporte Terravox</h2>
        
        <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl mb-8">
          <div className="flex items-center gap-6 mb-8 border-b border-slate-700 pb-8">
            <div className="w-20 h-20 bg-indigo-500 rounded-2xl flex items-center justify-center font-bold text-4xl text-white shadow-lg">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">{profile.name}</h3>
              <div className="flex gap-4 text-sm font-medium">
                <span className="flex items-center gap-1 text-emerald-400"><Award size={16}/> Nível {profile.level}</span>
                <span className="flex items-center gap-1 text-indigo-400"><Zap size={16}/> {profile.xp} XP</span>
                <span className="flex items-center gap-1 text-amber-400">
                   <span className="w-3 h-3 bg-amber-400 rounded-full inline-block"></span>
                   {profile.coins}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-rose-400" />
              Territórios Desbloqueados ({profile.unlockedTerritories.length})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {profile.unlockedTerritories.map(t => (
                <div key={t} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 flex items-center justify-center">
                  <span className="font-bold text-slate-200 capitalize">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
