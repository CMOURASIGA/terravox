import { useState, useEffect } from 'react';
import { GameState, PlayerProfile } from './types';
import { MapScreen } from './components/MapScreen';
import { ExpeditionScreen } from './components/ExpeditionScreen';
import { BattleScreen } from './components/BattleScreen';
import { PassportScreen } from './components/PassportScreen';
import { Play } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState | 'LOGIN'>('LOGIN');
  const [activeTerritory, setActiveTerritory] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>({
    name: '',
    xp: 0,
    coins: 10,
    level: 1,
    unlockedTerritories: ['brasil'], // Base territory
    completedMissions: []
  });

  const [inputName, setInputName] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      setProfile(prev => ({ ...prev, name: inputName.trim() }));
      setGameState('MAP');
    }
  };

  const handleSelectTerritory = (territoryId: string) => {
    setActiveTerritory(territoryId);
    if (profile.unlockedTerritories.includes(territoryId)) {
      setGameState('BATTLE');
    } else {
      setGameState('EXPEDITION');
    }
  };

  const handleExpeditionComplete = (success: boolean) => {
    if (success && activeTerritory) {
      setProfile(prev => ({
        ...prev,
        xp: prev.xp + 100,
        coins: prev.coins + 50,
        unlockedTerritories: [...prev.unlockedTerritories, activeTerritory]
      }));
      setGameState('MAP');
    } else {
      setGameState('MAP');
    }
    setActiveTerritory(null);
  };

  const handleBattleWin = (xp: number, coins: number) => {
    setProfile(prev => {
      const newXp = prev.xp + xp;
      return {
        ...prev,
        xp: newXp,
        coins: prev.coins + coins,
        level: Math.floor(newXp / 200) + 1
      };
    });
    setGameState('MAP');
    setActiveTerritory(null);
  };

  if (gameState === 'LOGIN') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl border border-slate-700 text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center transform rotate-12">
            <span className="text-4xl font-black italic -rotate-12">T</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Terravox</h1>
          <p className="text-slate-400 mb-8">Conhecimento abre caminhos.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Nome do Jogador"
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              Entrar no Mundo <Play size={18}/>
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (gameState === 'MAP') {
    return (
      <MapScreen 
        profile={profile} 
        onSelectTerritory={handleSelectTerritory} 
        onOpenPassport={() => setGameState('PASSPORT')}
      />
    );
  }

  if (gameState === 'EXPEDITION' && activeTerritory) {
    return (
      <ExpeditionScreen 
        territoryId={activeTerritory} 
        onComplete={handleExpeditionComplete}
        onCancel={() => {
          setGameState('MAP');
          setActiveTerritory(null);
        }}
      />
    );
  }

  if (gameState === 'BATTLE' && activeTerritory) {
    return (
      <BattleScreen 
        territoryId={activeTerritory} 
        profile={profile}
        onWin={handleBattleWin}
        onLeave={() => {
          setGameState('MAP');
          setActiveTerritory(null);
        }}
      />
    );
  }

  if (gameState === 'PASSPORT') {
    return <PassportScreen profile={profile} onBack={() => setGameState('MAP')} />;
  }

  return null;
}
