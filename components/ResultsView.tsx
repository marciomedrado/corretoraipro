import React, { useState, useEffect, useRef } from 'react';
import { CorrectionResult, QuestionResult } from '../types';
import { reevaluateQuestion, regenerateSummary } from '../services/geminiService';
import { exportToPDF, exportToDOCX } from '../services/exportService';

interface ResultsViewProps {
  result: CorrectionResult;
  examImage: string;
  context: string;
  onReset: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ result: initialResult, examImage, context, onReset }) => {
  // Local state to handle edits
  const [data, setData] = useState<CorrectionResult>(initialResult);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isUpdatingSummary, setIsUpdatingSummary] = useState(false);
  
  // Ref to track initial render to avoid unnecessary summary generation on load
  const firstRender = useRef(true);

  useEffect(() => {
    setData(initialResult);
  }, [initialResult]);

  // Effect to automatically regenerate summary when questions or score change
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setIsUpdatingSummary(true);
      try {
        const newSummary = await regenerateSummary(data);
        if (newSummary) {
             setData(prev => ({ ...prev, summary: newSummary }));
        }
      } catch (error) {
        console.error("Failed to auto-update summary", error);
      } finally {
        setIsUpdatingSummary(false);
      }
    }, 2000); // Wait 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [data.questions, data.totalScore]); // Dependency array: trigger on question or score changes

  // Handlers for header updates
  const handleHeaderChange = (field: keyof CorrectionResult, value: string | number) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // Handler for question updates
  const handleQuestionChange = (index: number, field: keyof QuestionResult, value: any) => {
    const updatedQuestions = [...data.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    
    // Auto-recalculate total score if a question score changes
    // Only consider items that are actual questions with scores
    let newTotalScore = data.totalScore;
    let newMaxTotalScore = data.maxTotalScore;

    if (updatedQuestions[index].type !== 'context') {
        if (field === 'score') {
            const scoreValue = parseFloat(value) || 0;
            updatedQuestions[index].score = scoreValue; 
            
            newTotalScore = updatedQuestions.reduce((acc, q) => {
                if (q.type === 'context') return acc;
                return acc + (q.score || 0);
            }, 0);
            
            // Round to 2 decimal places
            newTotalScore = Math.round(newTotalScore * 100) / 100;
        }

        if (field === 'maxScore') {
            const maxScoreValue = parseFloat(value) || 0;
            updatedQuestions[index].maxScore = maxScoreValue;
            
            newMaxTotalScore = updatedQuestions.reduce((acc, q) => {
                 if (q.type === 'context') return acc;
                 return acc + (q.maxScore || 0);
            }, 0);
             newMaxTotalScore = Math.round(newMaxTotalScore * 100) / 100;
        }
    }

    setData(prev => ({
        ...prev,
        questions: updatedQuestions,
        totalScore: field === 'score' ? newTotalScore : prev.totalScore,
        maxTotalScore: field === 'maxScore' ? newMaxTotalScore : prev.maxTotalScore
    }));
  };

  const handleQuestionBulkUpdate = (index: number, updates: Partial<QuestionResult>) => {
      const updatedQuestions = [...data.questions];
      updatedQuestions[index] = { ...updatedQuestions[index], ...updates };

      let newTotalScore = data.totalScore;
      if (updates.score !== undefined) {
         newTotalScore = updatedQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
         newTotalScore = Math.round(newTotalScore * 100) / 100;
      }

      setData(prev => ({
          ...prev,
          questions: updatedQuestions,
          totalScore: updates.score !== undefined ? newTotalScore : prev.totalScore
      }));
  };

  // Handler for updating specific alternatives
  const handleAlternativeChange = (qIndex: number, altIndex: number, value: string) => {
      const updatedQuestions = [...data.questions];
      if (updatedQuestions[qIndex].alternatives) {
          const updatedAlternatives = [...(updatedQuestions[qIndex].alternatives as string[])];
          updatedAlternatives[altIndex] = value;
          updatedQuestions[qIndex] = { ...updatedQuestions[qIndex], alternatives: updatedAlternatives };
          setData(prev => ({ ...prev, questions: updatedQuestions }));
      }
  };

  // Calculate percentage for color coding score
  const percentage = (data.totalScore / data.maxTotalScore) * 100;
  let scoreColor = "text-red-600";
  if (percentage >= 70) scoreColor = "text-green-600";
  else if (percentage >= 50) scoreColor = "text-yellow-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      
      {/* Left Column: Image Reference */}
      <div className="lg:col-span-1">
        <div className="sticky top-24 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 overflow-hidden">
             <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Imagem Original</h3>
                <button 
                  onClick={() => setIsImageZoomed(true)}
                  className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg transition-colors"
                  title="Expandir imagem"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </button>
             </div>
             <div className="relative group cursor-pointer" onClick={() => setIsImageZoomed(true)}>
                <img src={examImage} alt="Exam Original" className="w-full rounded-lg border border-slate-100" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 bg-white/90 p-2 rounded-full shadow-sm transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                    </svg>
                  </div>
                </div>
             </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Exportar Resultado</h3>
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => exportToPDF(data)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors border border-red-200 text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    PDF
                </button>
                <button 
                    onClick={() => exportToDOCX(data)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors border border-blue-200 text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3-3m0 0l3 3m-3-3v6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    DOCX
                </button>
            </div>
          </div>

          <button
            onClick={onReset}
            className="w-full py-3 px-4 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Corrigir Outra Prova
          </button>
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Header Card (Editable) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
          
          <div className="relative z-10">
            {/* Header Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Aluno</label>
                    <input 
                        type="text" 
                        value={data.studentName} 
                        onChange={(e) => handleHeaderChange('studentName', e.target.value)}
                        className="w-full text-2xl font-bold text-slate-900 border-b border-slate-300 focus:border-indigo-600 outline-none bg-transparent py-1 placeholder-slate-300"
                        placeholder="Nome do Aluno"
                    />
                </div>

                <div>
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Escola</label>
                    <input 
                        type="text" 
                        value={data.schoolName || ''} 
                        onChange={(e) => handleHeaderChange('schoolName', e.target.value)}
                        className="w-full text-slate-700 border-b border-slate-200 focus:border-indigo-600 outline-none bg-transparent py-1 text-sm"
                        placeholder="Nome da Escola"
                    />
                </div>

                <div>
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Turma</label>
                    <input 
                        type="text" 
                        value={data.className || ''} 
                        onChange={(e) => handleHeaderChange('className', e.target.value)}
                        className="w-full text-slate-700 border-b border-slate-200 focus:border-indigo-600 outline-none bg-transparent py-1 text-sm"
                        placeholder="Turma"
                    />
                </div>

                 <div>
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Professor</label>
                    <input 
                        type="text" 
                        value={data.teacherName || ''} 
                        onChange={(e) => handleHeaderChange('teacherName', e.target.value)}
                        className="w-full text-slate-700 border-b border-slate-200 focus:border-indigo-600 outline-none bg-transparent py-1 text-sm"
                        placeholder="Nome do Professor"
                    />
                </div>

                <div>
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block mb-1">Data</label>
                    <input 
                        type="text" 
                        value={data.examDate || ''} 
                        onChange={(e) => handleHeaderChange('examDate', e.target.value)}
                        className="w-full text-slate-700 border-b border-slate-200 focus:border-indigo-600 outline-none bg-transparent py-1 text-sm"
                        placeholder="Data da Prova"
                    />
                </div>
            </div>

            {/* Score Display */}
            <div className="flex items-end justify-end border-t border-slate-100 pt-4">
               <div className="text-right">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Nota Final</span>
                    <div className="flex items-baseline justify-end gap-2">
                        <input 
                            type="number"
                            value={data.totalScore}
                            readOnly
                            className={`text-5xl font-bold ${scoreColor} bg-transparent outline-none text-right w-32`}
                        />
                        <span className="text-2xl text-slate-400 font-medium">/ {data.maxTotalScore}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">*Calculada automaticamente</p>
               </div>
            </div>
          </div>
        </div>

        {/* Summary (Editable + AutoUpdate) */}
        <div className={`bg-white rounded-xl shadow-sm border transition-all duration-300 p-6 ${isUpdatingSummary ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-indigo-500 ${isUpdatingSummary ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    {isUpdatingSummary ? (
                         <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    ) : (
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    )}
                  </svg>
                  Resumo da Análise
                  {isUpdatingSummary && <span className="text-xs font-normal text-indigo-500 ml-2 animate-pulse">Atualizando...</span>}
                </h3>
            </div>
            <textarea
                value={data.summary}
                onChange={(e) => handleHeaderChange('summary', e.target.value)}
                className="w-full text-slate-600 text-sm leading-relaxed border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-y min-h-[80px]"
            />
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 px-1">Detalhamento das Questões</h2>
          
          {data.questions.map((q, idx) => {
             if (q.type === 'context') {
               return (
                 <ContextCard 
                    key={idx} 
                    question={q} 
                    index={idx} 
                    onUpdate={handleQuestionChange} 
                 />
               );
             }
             return (
               <EditableQuestionCard 
                  key={idx} 
                  question={q} 
                  index={idx} 
                  context={context}
                  onUpdate={handleQuestionChange}
                  onBulkUpdate={handleQuestionBulkUpdate}
                  onAlternativeUpdate={handleAlternativeChange}
               />
             );
          })}
        </div>
      </div>

      {/* Image Modal */}
      {isImageZoomed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsImageZoomed(false)}>
           <div className="absolute top-4 right-4 flex gap-2">
             <button 
                onClick={() => setIsImageZoomed(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
           </div>
           <img 
              src={examImage} 
              alt="Proval Original Zoomed" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
           />
        </div>
      )}
    </div>
  );
};

interface QuestionProps {
    question: QuestionResult;
    index: number;
    onUpdate: (index: number, field: keyof QuestionResult, value: any) => void;
}

interface EditableQuestionCardProps extends QuestionProps {
    context: string;
    onAlternativeUpdate: (qIndex: number, altIndex: number, value: string) => void;
    onBulkUpdate: (index: number, updates: Partial<QuestionResult>) => void;
}

// New Component for Context/Instruction Cards
const ContextCard: React.FC<QuestionProps> = ({ question, index, onUpdate }) => {
  return (
    <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        {question.questionNumber && (
          <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
            {question.questionNumber}
          </span>
        )}
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
          Texto de Apoio / Contexto
        </h4>
      </div>
      <textarea
          value={question.questionText}
          onChange={(e) => onUpdate(index, 'questionText', e.target.value)}
          rows={Math.max(3, question.questionText.length / 100)}
          className="w-full bg-white border border-slate-200 rounded-lg p-4 text-slate-700 text-base font-serif leading-relaxed shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-y"
          placeholder="Texto de contexto..."
      />
    </div>
  );
};

const EditableQuestionCard: React.FC<EditableQuestionCardProps> = ({ question, index, context, onUpdate, onBulkUpdate, onAlternativeUpdate }) => {
  const statusColor = question.isCorrect 
    ? "border-l-green-500 bg-green-50/30" 
    : (question.score || 0) > 0 
      ? "border-l-yellow-500 bg-yellow-50/30"
      : "border-l-red-500 bg-red-50/30";

  const [isReevaluating, setIsReevaluating] = useState(false);

  const handleReevaluate = async () => {
    setIsReevaluating(true);
    try {
        // Pass the CURRENT state of the question (with any user edits) to the AI
        const updates = await reevaluateQuestion(question, context);
        
        // Update parent state with new analysis
        onBulkUpdate(index, updates);
        
    } catch (err) {
        console.error("Failed to re-evaluate question", err);
        alert("Erro ao reavaliar questão. Verifique a chave de API.");
    } finally {
        setIsReevaluating(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 p-6 transition-all hover:shadow-md ${statusColor}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
           {/* Question Number Box */}
           <div className="h-12 min-w-[3rem] w-auto px-3 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-md whitespace-nowrap shrink-0">
             {question.questionNumber}
           </div>
           
           <div className="flex items-center gap-2 flex-1 sm:flex-initial">
             <select 
               value={question.isCorrect ? 'correct' : (question.score || 0) > 0 ? 'partial' : 'incorrect'}
               onChange={(e) => {
                   const val = e.target.value;
                   onUpdate(index, 'isCorrect', val === 'correct');
               }}
               className="text-sm font-bold uppercase tracking-wide bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 hover:border-indigo-300 transition-colors cursor-pointer shadow-sm w-full sm:w-auto min-w-[100px]"
             >
                 <option value="correct">Correta</option>
                 <option value="partial">Parcial</option>
                 <option value="incorrect">Incorreta</option>
             </select>

             {/* Re-evaluation Button */}
             <button 
                onClick={handleReevaluate}
                disabled={isReevaluating}
                className="p-2 text-indigo-600 bg-white border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                title="Reavaliar questão por IA (considera edições feitas)"
             >
                {isReevaluating ? (
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                )}
             </button>
           </div>
        </div>
        
        <div className="flex items-center gap-2 whitespace-nowrap self-end sm:self-auto">
            <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 shadow-sm">
                <input 
                    type="number" 
                    step="0.1"
                    value={question.score || 0} 
                    onChange={(e) => onUpdate(index, 'score', e.target.value)}
                    className="font-mono font-bold text-lg text-slate-700 w-16 text-right py-2 pl-2 bg-white outline-none appearance-none"
                    placeholder="0"
                />
                <div className="bg-slate-100 border-l border-r border-slate-200 py-2 px-2 text-slate-400 text-sm font-bold">/</div>
                <input 
                    type="number" 
                    step="0.1"
                    value={question.maxScore || 0} 
                    onChange={(e) => onUpdate(index, 'maxScore', e.target.value)}
                    className="font-mono font-bold text-lg text-slate-500 w-16 text-left py-2 pr-2 bg-slate-50 outline-none appearance-none"
                    placeholder="0"
                />
            </div>
            <span className="text-slate-500 font-bold text-sm hidden sm:inline">pts</span>
            <span className="text-slate-500 font-bold text-sm sm:hidden">pts</span>
        </div>
      </div>

      {/* Question Text (Editable) */}
      <div className="mb-4">
        <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          Enunciado
        </p>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
            <textarea
                value={question.questionText}
                onChange={(e) => onUpdate(index, 'questionText', e.target.value)}
                rows={2}
                className="w-full bg-transparent text-slate-700 text-sm font-medium leading-relaxed resize-y outline-none border-b border-transparent focus:border-indigo-300 transition-colors"
                placeholder="Texto da questão..."
            />

            {question.alternatives && question.alternatives.length > 0 && (
                <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alternativas</p>
                <div className="space-y-2">
                    {question.alternatives.map((alt, i) => (
                    <div key={i} className="flex items-center gap-2">
                         <span className="text-xs text-slate-400 font-mono">{String.fromCharCode(65+i)})</span>
                         <input 
                            type="text"
                            value={alt}
                            onChange={(e) => onAlternativeUpdate(index, i, e.target.value)}
                            className="w-full p-2 bg-white rounded border border-slate-200 text-slate-600 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                         />
                    </div>
                    ))}
                </div>
                </div>
            )}
        </div>
      </div>

      {/* Student Answer (Editable) */}
      <div className="mb-4">
        <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Resposta do Aluno
        </p>
        <textarea
            value={question.studentAnswer || ''}
            onChange={(e) => onUpdate(index, 'studentAnswer', e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-800 font-medium italic shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-y"
            placeholder="Resposta identificada..."
        />
      </div>

      {/* Feedback (Editable) */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Feedback da IA</p>
        <textarea
            value={question.feedback || ''}
            onChange={(e) => onUpdate(index, 'feedback', e.target.value)}
            rows={3}
            className="w-full text-slate-600 text-sm leading-relaxed bg-transparent border border-slate-200 rounded p-2 focus:border-indigo-500 outline-none resize-y"
            placeholder="Feedback..."
        />
      </div>
    </div>
  );
};

export default ResultsView;