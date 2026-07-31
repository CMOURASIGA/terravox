import React from 'react';
import { PlayerProfile } from '../types';
import { Compass, Crown, Lock, MapPin, Play, Sparkles } from 'lucide-react';
import brazilWorld from '../assets/brazil-adventure-world.png';

interface MapScreenProps { profile: PlayerProfile; onSelectTerritory: (territoryId: string) => void; onOpenPassport: () => void; }

const TERRITORIES = [
  { id: 'brasil', name: 'Floresta do Brasil', subtitle: 'Capítulo 1 · Ruínas do Saber', emoji: '🌿', level: 'Nível 2', position: 'left-[8%] top-[56%] sm:left-[15%] sm:top-[54%]' },
  { id: 'mexico', name: 'Vale do México', subtitle: 'Em breve', emoji: '🌵', level: 'Nível 4', position: 'right-[7%] top-[22%] sm:right-[18%] sm:top-[25%]' },
  { id: 'egito', name: 'Areias do Egito', subtitle: 'Em breve', emoji: '🏺', level: 'Nível 7', position: 'right-[8%] top-[67%] sm:right-[22%] sm:top-[64%]' },
];

export function MapScreen({ profile, onSelectTerritory, onOpenPassport }: MapScreenProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#071528] text-white">
      <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-[#071528]/90 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-600 font-black shadow-lg shadow-cyan-500/20">{profile.name.charAt(0).toUpperCase()}</div><div className="min-w-0"><h1 className="truncate font-black">{profile.name}</h1><p className="text-sm font-bold text-cyan-300">Nível {profile.level} · {profile.xp} XP</p></div></div>
        <div className="flex items-center gap-2"><div className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-yellow-300"><span className="mr-1">●</span>{profile.coins}</div><button onClick={onOpenPassport} aria-label="Abrir passaporte" className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 hover:bg-violet-500"><Compass className="h-5 w-5" /></button></div>
      </header>
      <section className="relative min-h-[calc(100vh-68px)] overflow-hidden" style={{ backgroundImage: `linear-gradient(180deg, rgba(2,10,23,.25), rgba(2,10,23,.72)), url(${brazilWorld})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(3,12,29,.55)_100%)]" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 pt-7 sm:px-8 sm:pt-10"><p className="text-xs font-black tracking-[.25em] text-cyan-200">MAPA DE AVENTURA</p><h2 className="mt-1 text-3xl font-black sm:text-5xl">Escolha seu próximo território</h2><p className="mt-2 max-w-md text-sm font-medium text-slate-200 sm:text-base">Cada lugar é uma aventura com missões, inimigos e descobertas que liberam sua passagem.</p></div>
        {TERRITORIES.map((territory) => {
          const unlocked = profile.unlockedTerritories.includes(territory.id);
          return <button key={territory.id} disabled={!unlocked} onClick={() => onSelectTerritory(territory.id)} className={`absolute z-10 w-[min(68vw,280px)] text-left transition duration-300 ${territory.position} ${unlocked ? 'group hover:-translate-y-2' : 'cursor-not-allowed opacity-70'}`}>
            <div className={`relative overflow-hidden rounded-2xl border p-3 shadow-2xl backdrop-blur-md sm:p-4 ${unlocked ? 'border-cyan-200/70 bg-[#071b35]/85 shadow-cyan-950/60' : 'border-white/20 bg-slate-950/80 grayscale'}`}>
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300 to-violet-500" />
              <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl">{unlocked ? territory.emoji : <Lock className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-base font-black">{territory.name}</p><p className="truncate text-xs font-bold text-cyan-200">{territory.subtitle}</p></div>{unlocked ? <Play className="h-7 w-7 shrink-0 fill-yellow-300 text-yellow-300" /> : <span className="text-xs font-black text-slate-300">{territory.level}</span>}</div>
              {unlocked && <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] font-black text-yellow-200"><span><Crown className="mr-1 inline h-3.5 w-3.5" />MISSÃO DISPONÍVEL</span><span className="group-hover:text-cyan-200">JOGAR</span></div>}
            </div>
          </button>;
        })}
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-[#071528]/80 px-4 py-2 text-xs font-bold text-slate-200 backdrop-blur"><Sparkles className="h-4 w-4 text-yellow-300" /> Encontre portais e responda aos desafios para avançar</div>
      </section>
    </main>
  );
}
