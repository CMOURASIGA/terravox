import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { ShieldAlert, Loader2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

interface ExpeditionScreenProps {
  territoryId: string;
  onComplete: (success: boolean) => void;
  onCancel: () => void;
}

export function ExpeditionScreen({ territoryId, onComplete, onCancel }: ExpeditionScreenProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const theme = territoryId.charAt(0).toUpperCase() + territoryId.slice(1);
        const res = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            territory: theme,
            theme: 'Geografia, Cultura e Conhecimentos Gerais',
            difficulty: 2,
            count: 3
          })
        });
        
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          // Fallback if API fails
          setQuestions([
            { id: '1', prompt: 'Erro ao carregar, pergunta de teste.', options: ['A', 'B', 'C', 'D'], correct_answer: 'A', explanation: 'Teste' }
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [territoryId]);

  const handleAnswer = (option: string) => {
    if (selectedOption || showResult) return;
    setSelectedOption(option);
    
    const isCorrect = option === questions[currentIdx].correct_answer;
    if (isCorrect) setScore(s => s + 1);
    
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      // Finished expedition
      onComplete(score >= 2); // needs 2/3 to unlock
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold">Iniciando expedição em {territoryId}...</h2>
        <p className="text-slate-400 mt-2">Gerando desafios de conhecimento</p>
      </div>
    );
  }

  const q = questions[currentIdx];
  const isCorrect = selectedOption === q.correct_answer;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 text-white">
      <div className="w-full max-w-2xl mt-12">
        
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-2xl font-bold text-emerald-400">Expedição: {territoryId.toUpperCase()}</h2>
           <div className="text-slate-400 font-medium">
             Desafio {currentIdx + 1} / {questions.length}
           </div>
        </div>

        <div className="bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700">
          <h3 className="text-xl md:text-2xl font-medium leading-relaxed mb-8">
            {q.prompt}
          </h3>

          <div className="flex flex-col gap-4">
            {q.options.map((opt, i) => {
              let btnClass = "bg-slate-700 hover:bg-slate-600 text-left px-6 py-4 rounded-xl text-lg font-medium transition";
              if (showResult) {
                if (opt === q.correct_answer) {
                  btnClass = "bg-emerald-600 text-white px-6 py-4 rounded-xl text-lg font-bold";
                } else if (opt === selectedOption) {
                  btnClass = "bg-rose-600 text-white px-6 py-4 rounded-xl text-lg font-bold opacity-80";
                } else {
                  btnClass = "bg-slate-800 opacity-50 px-6 py-4 rounded-xl text-lg";
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
            <div className={`mt-8 p-6 rounded-2xl ${isCorrect ? 'bg-emerald-900/50' : 'bg-rose-900/50'}`}>
              <div className="flex items-center gap-3 mb-2">
                {isCorrect ? <CheckCircle2 className="text-emerald-400 w-8 h-8"/> : <XCircle className="text-rose-400 w-8 h-8"/>}
                <h4 className={`text-xl font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}
                </h4>
              </div>
              <p className="text-slate-300 mb-6">{q.explanation}</p>
              
              <button 
                onClick={handleNext}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition"
              >
                {currentIdx < questions.length - 1 ? 'Próximo Desafio' : 'Concluir Expedição'}
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
        
        {!showResult && (
           <div className="mt-8 text-center">
             <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 underline font-medium">
               Abortar expedição
             </button>
           </div>
        )}
      </div>
    </div>
  );
}
