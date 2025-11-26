import React, { useState, useRef, useEffect } from 'react';
import { analyzeExam } from '../services/geminiService';
import { consumeCredit, changeOwnPassword, reloadUser } from '../services/authService';
import { CorrectionResult, User } from '../types';
import { Spinner } from './Spinner';
import ResultsView from './ResultsView';
import { PaymentModal } from './PaymentModal';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
  onNavigateToAdmin?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onUserUpdate, onNavigateToAdmin }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [context, setContext] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  // Password change state
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refresh user data on mount to ensure credits are up to date
  useEffect(() => {
    const fetchUser = async () => {
      const updated = await reloadUser();
      if (updated) onUserUpdate(updated);
    };
    fetchUser();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type.startsWith('image/')) {
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
        setResult(null);
        setError(null);
      } else {
        setError("Por favor, envie apenas arquivos de imagem.");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    if (user.role !== 'admin' && user.credits <= 0) {
      setError("Você não possui créditos suficientes. Contate o administrador.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // 1. Consume Credit First (Optimistic or wait for success? Let's do pessimistic)
      // Actually, typically you consume credit only if success, BUT to prevent abuse we often reserve.
      // Here we will try to analyze first.
      
      const correction = await analyzeExam(file, context);
      
      // 2. Consume Credit
      const creditConsumed = await consumeCredit(user.id);
      if (creditConsumed || user.role === 'admin') {
         const updatedUser = await reloadUser();
         if (updatedUser) onUserUpdate(updatedUser);
         setResult(correction);
      } else {
         setError("Erro ao debitar crédito. A análise não foi exibida.");
      }

    } catch (err) {
      setError("Ocorreu um erro ao corrigir a prova. Verifique sua chave de API ou tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setContext("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) {
      setPassMsg({ type: 'error', text: 'As novas senhas não coincidem.' });
      return;
    }
    try {
      await changeOwnPassword(user.id, passData.current, passData.new);
      setPassMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setPassData({ current: '', new: '', confirm: '' });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.toString() });
    }
  };

  const handlePaymentSuccess = async () => {
      const updatedUser = await reloadUser();
      if (updatedUser) onUserUpdate(updatedUser);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
               <div className="bg-indigo-600 p-1.5 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
               </div>
               <span className="font-bold text-xl text-slate-800 tracking-tight">CorrectorAI</span>
            </div>
            <div className="flex items-center gap-4">
              {onNavigateToAdmin && (
                <button 
                  onClick={onNavigateToAdmin}
                  className="hidden md:block text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors font-medium border border-slate-200"
                >
                  Painel Admin
                </button>
              )}

              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-medium text-slate-700">{user.name}</span>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Créditos:</span>
                        <span className={`text-xs font-bold ${user.credits > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {user.role === 'admin' ? '∞' : user.credits}
                        </span>
                   </div>
                   {user.role !== 'admin' && (
                       <button 
                         onClick={() => setShowPaymentModal(true)}
                         className="text-[10px] bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-bold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                           <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                         </svg>
                         Comprar
                       </button>
                   )}
                </div>
              </div>
              
              <div className="relative">
                 <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center focus:outline-none"
                 >
                    <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-100 transition-all" />
                 </button>
                 
                 {isUserMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-20">
                            {onNavigateToAdmin && (
                                <button 
                                    onClick={() => {
                                        onNavigateToAdmin();
                                        setIsUserMenuOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 md:hidden"
                                >
                                    Painel Admin
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    setShowPasswordModal(true);
                                    setIsUserMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                Alterar Senha
                            </button>
                            <button 
                                onClick={() => {
                                    onLogout();
                                    setIsUserMenuOpen(false);
                                }} 
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
                            >
                                Sair
                            </button>
                        </div>
                    </>
                 )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Payment Modal */}
      {showPaymentModal && (
          <PaymentModal 
            userId={user.id}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handlePaymentSuccess}
          />
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Alterar Senha</h3>
              {passMsg.text && (
                <div className={`text-sm p-2 rounded mb-3 ${passMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                   {passMsg.text}
                </div>
              )}
              <form onSubmit={handleChangePassword} className="space-y-3">
                 <input 
                   type="password" 
                   placeholder="Nova Senha" 
                   className="w-full border border-slate-300 rounded p-2 text-sm"
                   value={passData.new}
                   onChange={e => setPassData({...passData, new: e.target.value})}
                   required
                 />
                 <input 
                   type="password" 
                   placeholder="Confirmar Nova Senha" 
                   className="w-full border border-slate-300 rounded p-2 text-sm"
                   value={passData.confirm}
                   onChange={e => setPassData({...passData, confirm: e.target.value})}
                   required
                 />
                 <div className="text-xs text-gray-500 mt-2">
                    Nota: Ao alterar sua senha, você poderá ser desconectado.
                 </div>
                 <div className="flex gap-2 mt-4 pt-2">
                    <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded">Cancelar</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">Salvar</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {!result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Upload Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">Upload da Prova</h2>
                    {user.role !== 'admin' && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold">
                            Custo: 1 Crédito
                        </span>
                    )}
                </div>
                
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                    file ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    id="exam-upload"
                  />
                  
                  {previewUrl ? (
                    <div className="relative inline-block">
                      <img src={previewUrl} alt="Preview" className="max-h-64 rounded-lg shadow-md object-contain mx-auto" />
                      <button 
                        onClick={(e) => {
                           e.preventDefault();
                           handleReset();
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="exam-upload" className="cursor-pointer flex flex-col items-center justify-center gap-3">
                       <div className="bg-indigo-50 p-4 rounded-full text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                       </div>
                       <div>
                         <p className="text-base font-medium text-slate-700">Clique para upload ou arraste a imagem</p>
                         <p className="text-sm text-slate-400 mt-1">PNG, JPG ou JPEG (Max. 10MB)</p>
                       </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration & Action Section */}
            <div className="space-y-6">
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Gabarito / Contexto</h2>
                  <p className="text-sm text-slate-500 mb-3">
                    Cole aqui o gabarito das questões ou descreva o que deve ser avaliado para ajudar a IA.
                  </p>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Ex: Questão 1: A resposta deve mencionar a Revolução Francesa... Questão 2: O resultado de 2+2 é 4..."
                    className="w-full h-48 p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none outline-none transition-shadow"
                  ></textarea>
                  
                  {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleAnalyze}
                    disabled={!file || loading}
                    className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm ${
                      !file || loading 
                      ? 'bg-slate-300 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md transform active:scale-[0.98]'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        <span className="ml-2">Analisando Prova...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19.28 13.408l.72-2.608.72 2.608a1.125 1.125 0 00.8.8l2.608.72-2.608.72a1.125 1.125 0 00-.8.8l-.72 2.608-.72-2.608a1.125 1.125 0 00-.8-.8l-2.608-.72 2.608-.72a1.125 1.125 0 00.8-.8z" />
                        </svg>
                        Corrigir com IA
                      </>
                    )}
                  </button>
               </div>
            </div>
          </div>
        )}

        {result && (
           <ResultsView 
             result={result} 
             examImage={previewUrl || ""} 
             context={context}
             onReset={handleReset} 
           />
        )}
      </main>
    </div>
  );
};

export default Dashboard;