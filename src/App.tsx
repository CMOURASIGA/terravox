import { ChangeEvent, Dispatch, SetStateAction, useEffect, useState } from 'react';
import { GameState, PlayerProfile } from './types';
import { MapScreen } from './components/MapScreen';
import { ExpeditionScreen } from './components/ExpeditionScreen';
import { BattleScreen } from './components/BattleScreen';
import { PassportScreen } from './components/PassportScreen';
import { Camera, Check, Play, UserRound } from 'lucide-react';

const AVATARS = ['🦊', '🐯', '🐼', '🦁', '🦉', '🐸', '🧙', '🧭'];
const FIRST_LEVEL_TERRITORIES = ['brasil', 'mexico', 'egito', 'japao'];
const SECOND_LEVEL_TERRITORIES = ['andes', 'oceano', 'savana', 'espaco'];
const emptyProfile = (): PlayerProfile => ({ name: '', avatar: '🦊', xp: 0, coins: 10, level: 1, unlockedTerritories: FIRST_LEVEL_TERRITORIES, completedMissions: [], adventureXp: {} });

function normalizeProfile(value: Partial<PlayerProfile>): PlayerProfile {
  const base = emptyProfile();
  const completedMissions = value.completedMissions || [];
  const unlockedSecondLevel = FIRST_LEVEL_TERRITORIES.every((id) => completedMissions.includes(id));
  return { ...base, ...value, avatar: value.avatar || base.avatar, level: unlockedSecondLevel ? 2 : 1, completedMissions, unlockedTerritories: unlockedSecondLevel ? [...new Set([...(value.unlockedTerritories || base.unlockedTerritories), ...SECOND_LEVEL_TERRITORIES])] : (value.unlockedTerritories?.length ? value.unlockedTerritories : base.unlockedTerritories), adventureXp: value.adventureXp || {} };
}

export function Avatar({ value, className = '' }: { value: string; className?: string }) {
  return <div className={`grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-violet-600 font-black text-white ${className}`}>{value.startsWith('data:image') ? <img src={value} alt="Avatar do jogador" className="h-full w-full object-cover" /> : <span>{value}</span>}</div>;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState | 'LOGIN' | 'PROFILE'>('LOGIN');
  const [activeTerritory, setActiveTerritory] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(emptyProfile());
  const [inputName, setInputName] = useState('');
  const [inputAvatar, setInputAvatar] = useState('🦊');

  useEffect(() => {
    const lastPlayer = localStorage.getItem('terravox.last-player');
    if (!lastPlayer) return;
    try { setProfile(normalizeProfile(JSON.parse(lastPlayer))); setGameState('MAP'); } catch { localStorage.removeItem('terravox.last-player'); }
  }, []);

  useEffect(() => {
    if (!profile.name) return;
    const saved = JSON.stringify(profile);
    localStorage.setItem(`terravox.profile.${profile.name.trim().toLowerCase()}`, saved);
    localStorage.setItem('terravox.last-player', saved);
  }, [profile]);

  const readAvatar = (event: ChangeEvent<HTMLInputElement>, setter = setInputAvatar) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = inputName.trim();
    if (!name) return;
    const stored = localStorage.getItem(`terravox.profile.${name.toLowerCase()}`);
    const next = stored ? normalizeProfile(JSON.parse(stored)) : { ...emptyProfile(), name, avatar: inputAvatar };
    setProfile(next); setGameState('MAP');
  };

  const handleSelectTerritory = (territoryId: string) => { setActiveTerritory(territoryId); setGameState(profile.unlockedTerritories.includes(territoryId) ? 'BATTLE' : 'EXPEDITION'); };
  const handleExpeditionComplete = (success: boolean) => {
    if (success && activeTerritory) setProfile(prev => ({ ...prev, unlockedTerritories: [...new Set([...prev.unlockedTerritories, activeTerritory]) ] }));
    setGameState('MAP'); setActiveTerritory(null);
  };
  const handleBattleWin = (territory: string, xp: number, coins: number) => {
    setProfile(prev => {
      const alreadyEarned = prev.completedMissions.includes(territory);
      const earnedXp = alreadyEarned ? 0 : xp;
      const newXp = prev.xp + earnedXp;
      const completedMissions = alreadyEarned ? prev.completedMissions : [...prev.completedMissions, territory];
      const unlockedSecondLevel = FIRST_LEVEL_TERRITORIES.every((id) => completedMissions.includes(id));
      return { ...prev, xp: newXp, coins: prev.coins + (alreadyEarned ? 0 : coins), level: unlockedSecondLevel ? 2 : 1, unlockedTerritories: unlockedSecondLevel ? [...new Set([...prev.unlockedTerritories, ...SECOND_LEVEL_TERRITORIES])] : prev.unlockedTerritories, completedMissions, adventureXp: { ...prev.adventureXp, [territory]: (prev.adventureXp[territory] || 0) + earnedXp } };
    });
    setGameState('MAP'); setActiveTerritory(null);
  };
  const logout = () => { localStorage.removeItem('terravox.last-player'); setProfile(emptyProfile()); setInputName(''); setInputAvatar('🦊'); setActiveTerritory(null); setGameState('LOGIN'); };

  if (gameState === 'LOGIN') return <LoginScreen name={inputName} avatar={inputAvatar} onName={setInputName} onAvatar={setInputAvatar} onUpload={readAvatar} onSubmit={handleLogin} />;
  if (gameState === 'PROFILE') return <ProfileEditor profile={profile} onSave={(next) => { setProfile(next); setGameState('MAP'); }} onCancel={() => setGameState('MAP')} onUpload={readAvatar} />;
  if (gameState === 'MAP') return <MapScreen profile={profile} onSelectTerritory={handleSelectTerritory} onOpenPassport={() => setGameState('PASSPORT')} onEditProfile={() => setGameState('PROFILE')} onLogout={logout} />;
  if (gameState === 'EXPEDITION' && activeTerritory) return <ExpeditionScreen territoryId={activeTerritory} onComplete={handleExpeditionComplete} onCancel={() => { setGameState('MAP'); setActiveTerritory(null); }} />;
  if (gameState === 'BATTLE' && activeTerritory) return <BattleScreen territoryId={activeTerritory} profile={profile} onWin={handleBattleWin} onLeave={() => { setGameState('MAP'); setActiveTerritory(null); }} />;
  if (gameState === 'PASSPORT') return <PassportScreen profile={profile} onBack={() => setGameState('MAP')} onEditProfile={() => setGameState('PROFILE')} />;
  return null;
}

function LoginScreen({ name, avatar, onName, onAvatar, onUpload, onSubmit }: { name: string; avatar: string; onName: (value: string) => void; onAvatar: (value: string) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#223a6b,#071528_55%)] p-5 text-white"><main className="mx-auto flex min-h-[100dvh] max-w-md items-center"><section className="w-full rounded-[2rem] border border-white/15 bg-slate-950/55 p-6 text-center shadow-2xl backdrop-blur sm:p-8"><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-indigo-600 text-4xl font-black shadow-lg">T</div><h1 className="text-3xl font-black">Terravox</h1><p className="mt-2 text-slate-300">Escolha seu explorador. Seu caminho ficará salvo neste aparelho.</p><form onSubmit={onSubmit} className="mt-6 space-y-4 text-left"><label className="text-xs font-black text-cyan-200">SEU NOME<input value={name} onChange={e => onName(e.target.value)} placeholder="Nome do Jogador" className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-cyan-300" required /></label><div><p className="text-xs font-black text-cyan-200">ESCOLHA SEU AVATAR</p><div className="mt-2 flex flex-wrap gap-2">{AVATARS.map(item => <button key={item} type="button" onClick={() => onAvatar(item)} className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${avatar === item ? 'bg-cyan-400 ring-2 ring-white' : 'bg-white/10'}`}>{item}</button>)}<label className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-white/10"><Camera className="h-5 w-5"/><input type="file" accept="image/*" onChange={onUpload} className="hidden" /></label></div></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><Avatar value={avatar} className="h-12 w-12 rounded-xl text-2xl" /><span className="text-sm font-bold">Este será seu símbolo no mapa.</span></div><button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-600 py-3 font-black shadow-lg"><Play className="h-5 w-5 fill-white" />ENTRAR NO MUNDO</button></form></section></main></div>;
}

function ProfileEditor({ profile, onSave, onCancel, onUpload }: { profile: PlayerProfile; onSave: (profile: PlayerProfile) => void; onCancel: () => void; onUpload: (event: ChangeEvent<HTMLInputElement>, setter?: Dispatch<SetStateAction<string>>) => void }) {
  const [name, setName] = useState(profile.name); const [avatar, setAvatar] = useState(profile.avatar);
  const upload = (event: ChangeEvent<HTMLInputElement>) => onUpload(event, setAvatar);
  return <div className="min-h-screen bg-[#071528] p-5 text-white"><main className="mx-auto max-w-lg pt-8"><button onClick={onCancel} className="text-sm font-bold text-cyan-200">← Voltar ao mapa</button><section className="mt-5 rounded-[2rem] border border-white/15 bg-slate-900/80 p-6 shadow-2xl"><div className="flex items-center gap-3"><Avatar value={avatar} className="h-16 w-16 rounded-2xl text-3xl"/><div><p className="text-xs font-black tracking-[.2em] text-cyan-200">PERFIL DO EXPLORADOR</p><h1 className="text-2xl font-black">Personalize seu jogo</h1></div></div><label className="mt-6 block text-xs font-black text-cyan-200">NOME DO JOGADOR<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-white" /></label><p className="mt-5 text-xs font-black text-cyan-200">AVATAR</p><div className="mt-2 flex flex-wrap gap-2">{AVATARS.map(item => <button key={item} onClick={() => setAvatar(item)} className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${avatar === item ? 'bg-cyan-400 ring-2 ring-white' : 'bg-white/10'}`}>{item}</button>)}<label className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-white/10"><Camera className="h-5 w-5"/><input type="file" accept="image/*" onChange={upload} className="hidden" /></label></div><button onClick={() => name.trim() && onSave({ ...profile, name: name.trim(), avatar })} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 font-black text-slate-950"><Check className="h-5 w-5"/>SALVAR PERFIL</button></section></main></div>;
}
