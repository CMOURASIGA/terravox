import React, { useState, useEffect } from 'react';
import { Loader2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { checkAnswer, fetchTerritoryQuestions, SourcedQuestion } from '../lib/questionSource';

interface ExpeditionScreenProps {
  territoryId: string;
  onComplete: (success: boolean) => void;
  onCancel: () => void;
}

const FALLBACK_QUESTION: SourcedQuestion = {
  id: 'fallback-1',
  prompt: 'Erro ao carregar, pergunta de teste.',
  options: ['A', 'B', 'C', 'D'],
  correct_answer: 'A',
  explanation: 'Teste',
  source: 'ai',
};

export function ExpeditionScreen({ territoryId, onComplete, onCancel }: ExpeditionScreenProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<SourcedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      try {
        // Fonte principal: banco aprovado, filtrado pela categoria do
        // território (ex.: México → Geografia/História). IA entra só como
        // fallback quando o banco não tem perguntas suficientes.
        const loaded = await fetchTerritoryQuestions({
          territoryId,
          theme: 'Geografia, Cultura e Conhecimentos Gerais',
          difficulty: 2,
          count: 3,
        });
        setQuestions(loaded.length ? loaded : [FALLBACK_QUESTION]);
      } catch (e) {
        console.error(e);
        setQuestions([FALLBACK_QUESTION]);
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [territoryId]);

  const handleAnswer = async (option: string) => {
    if (selectedOption || showResult || checking) return;
    setSelectedOption(option);
    setChecking(true);
    const outcome = await checkAnswer(questions[currentIdx], option);
    setResult(outcome);
    if (outcome.correct) setScore((s) => s + 1);
    setChecking(false);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setShowResult(false);
      setResult(null);
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
        <p className="text-slate-400 mt-2">Buscando desafios de conhecimento</p>
      </div>
    );
  }

  const q = questions[currentIdx];
  const isCorrect = Boolean(result?.correct);

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
                if (opt === selectedOption) {
                  btnClass = isCorrect
                    ? "bg-emerald-600 text-white px-6 py-4 rounded-xl text-lg font-bold"
                    : "bg-rose-600 text-white px-6 py-4 rounded-xl text-lg font-bold opacity-80";
                } else {
                  btnClass = "bg-slate-800 opacity-50 px-6 py-4 rounded-xl text-lg";
                }
              } else if (checking && opt === selectedOption) {
                btnClass = "bg-slate-600 text-left px-6 py-4 rounded-xl text-lg font-medium opacity-70";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  disabled={showResult || checking}
                  className={btnClass}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {checking && !showResult && (
            <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Verificando resposta...
            </div>
          )}

          {showResult && (
            <div className={`mt-8 p-6 rounded-2xl ${isCorrect ? 'bg-emerald-900/50' : 'bg-rose-900/50'}`}>
              <div className="flex items-center gap-3 mb-2">
                {isCorrect ? <CheckCircle2 className="text-emerald-400 w-8 h-8"/> : <XCircle className="text-rose-400 w-8 h-8"/>}
                <h4 className={`text-xl font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}
                </h4>
              </div>
              {result?.explanation && <p className="text-slate-300 mb-6">{result.explanation}</p>}

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
