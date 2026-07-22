import React, { useState, useEffect } from 'react';
import { Question, PlayerProfile } from '../types';
import { Loader2, ArrowLeft, Swords } from 'lucide-react';

interface BattleScreenProps {
  territoryId: string;
  profile: PlayerProfile;
  onWin: (xp: number, coins: number) => void;
  onLeave: () => void;
}

export function BattleScreen({ territoryId, profile, onWin, onLeave }: BattleScreenProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  
  const [bossHp, setBossHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const theme = territoryId.charAt(0).toUpperCase() + territoryId.slice(1);
        const res = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            territory: theme,
            theme: 'Batalha, Conhecimento Rápido, Matemática e Lógica',
            difficulty: 3,
            count: 5
          })
        });
        
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setCurrentQ(data.questions[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [territoryId]);

  const handleAnswer = (opt: string) => {
    if (showResult || !currentQ) return;
    
    setSelectedOption(opt);
    setShowResult(true);
    
    if (opt === currentQ.correct_answer) {
      setFeedbackMsg('Golpe Crítico! Resposta correta.');
      setBossHp(prev => Math.max(0, prev - 40));
    } else {
      setFeedbackMsg('Errou! O chefe contra-atacou.');
      setPlayerHp(prev => Math.max(0, prev - 30));
    }
  };

  const nextTurn = () => {
    if (bossHp <= 0) {
      onWin(50, 10);
      return;
    }
    if (playerHp <= 0) {
      onLeave();
      return;
    }
    
    const nextIdx = questions.indexOf(currentQ!) + 1;
    if (nextIdx < questions.length) {
      setCurrentQ(questions[nextIdx]);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      // Out of questions, just end in draw/leave
      onLeave();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-rose-500 mb-4" />
        <h2 className="text-xl font-bold">Iniciando Batalha...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="p-4 flex items-center justify-between bg-slate-800 shadow-md">
        <button onClick={onLeave} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft size={20} /> Fugir
        </button>
        <div className="flex items-center gap-2 font-bold text-rose-400">
          <Swords size={24} /> Arena {territoryId.toUpperCase()}
        </div>
        <div className="w-20"></div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center">
        
        {/* Battle Scene */}
        <div className="flex justify-between items-end mb-12">
           {/* Player */}
           <div className="flex flex-col items-center gap-4">
             <div className="w-32 bg-slate-800 h-4 rounded-full overflow-hidden border border-slate-700">
               <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${playerHp}%`}}></div>
             </div>
             <div className="text-sm font-bold">{profile.name} (HP: {playerHp})</div>
             <div className="w-24 h-24 bg-indigo-500 rounded-xl flex items-center justify-center font-bold text-4xl shadow-xl shadow-indigo-500/20">
               {profile.name.charAt(0).toUpperCase()}
             </div>
           </div>
           
           {/* Boss */}
           <div className="flex flex-col items-center gap-4">
             <div className="w-32 bg-slate-800 h-4 rounded-full overflow-hidden border border-slate-700">
               <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${bossHp}%`}}></div>
             </div>
             <div className="text-sm font-bold">Guardião (HP: {bossHp})</div>
             <div className="w-32 h-32 bg-rose-900 rounded-full flex items-center justify-center text-5xl border-4 border-rose-500 shadow-xl shadow-rose-500/30">
               👹
             </div>
           </div>
        </div>

        {/* Combat Text / Question */}
        <div className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl">
           {bossHp <= 0 ? (
             <div className="text-center py-8">
               <h2 className="text-3xl font-bold text-emerald-400 mb-4">Vitória!</h2>
               <p className="text-slate-300 mb-8">Você derrotou o guardião de {territoryId}.</p>
               <button onClick={() => onWin(50, 10)} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-lg">
                 Coletar Recompensas
               </button>
             </div>
           ) : playerHp <= 0 ? (
             <div className="text-center py-8">
               <h2 className="text-3xl font-bold text-rose-400 mb-4">Derrota...</h2>
               <p className="text-slate-300 mb-8">Sua energia acabou.</p>
               <button onClick={onLeave} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl text-lg">
                 Retornar ao Mapa
               </button>
             </div>
           ) : currentQ ? (
             <>
               <div className="text-center mb-6">
                 <span className="inline-block px-3 py-1 bg-indigo-900 text-indigo-300 font-bold text-sm rounded-full mb-4">
                   Ataque de Conhecimento
                 </span>
                 <h3 className="text-xl font-medium text-white">{currentQ.prompt}</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {currentQ.options.map((opt, i) => {
                   let btnClass = "bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-xl font-medium transition text-left";
                   if (showResult) {
                      if (opt === currentQ.correct_answer) {
                        btnClass = "bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold";
                      } else if (opt === selectedOption) {
                        btnClass = "bg-rose-600 text-white px-6 py-4 rounded-xl font-bold opacity-80";
                      } else {
                        btnClass = "bg-slate-800 opacity-50 px-6 py-4 rounded-xl";
                      }
                   }
                   
                   return (
                     <button
                       key={i}
                       onClick={() => handleAnswer(opt)}
                       disabled={showResult}
                       className={btnClass}
                     >
                       {opt}
                     </button>
                   );
                 })}
               </div>
               
               {showResult && (
                 <div className="mt-8 text-center flex flex-col items-center">
                   <p className={`text-xl font-bold mb-2 ${selectedOption === currentQ.correct_answer ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {feedbackMsg}
                   </p>
                   <p className="text-slate-400 mb-6 text-sm max-w-lg">{currentQ.explanation}</p>
                   <button 
                     onClick={nextTurn}
                     className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full transition"
                   >
                     Continuar Combate
                   </button>
                 </div>
               )}
             </>
           ) : null}
        </div>
      </div>
    </div>
  );
}
