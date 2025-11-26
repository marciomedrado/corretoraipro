import React, { useState } from 'react';
import { reportPayment } from '../services/authService';

interface PaymentModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PACKAGES = [
  { credits: 100, price: 5.00, label: "Básico" }, // R$ 0,05 / crédito
  { credits: 500, price: 20.00, label: "Popular", popular: true }, // R$ 0,04 / crédito
  { credits: 1000, price: 30.00, label: "Pro" }, // R$ 0,03 / crédito
  { credits: 5000, price: 125.00, label: "Escola" }, // R$ 0,025 / crédito (ajustado para consistência de volume)
];

// --- Pix Generation Helpers ---

// CRC16-CCITT (0xFFFF) implementation
const crc16ccitt = (payload: string): string => {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    let c = payload.charCodeAt(i);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
};

// Generate Pix BR Code String
const generatePixPayload = (
  key: string,
  name: string,
  city: string,
  amount: number,
  txId: string = "***"
): string => {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };

  const amountStr = amount.toFixed(2);
  const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25);
  const cleanCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15);
  const cleanKey = key.trim();

  const payload = [
    formatField("00", "01"), // Payload Format Indicator
    formatField("26", [
      formatField("00", "br.gov.bcb.pix"),
      formatField("01", cleanKey)
    ].join("")),
    formatField("52", "0000"), // Merchant Category Code
    formatField("53", "986"), // Transaction Currency (BRL)
    formatField("54", amountStr), // Transaction Amount
    formatField("58", "BR"), // Country Code
    formatField("59", cleanName), // Merchant Name
    formatField("60", cleanCity), // Merchant City
    formatField("62", formatField("05", txId)), // Additional Data Field Template
    "6304" // CRC16 placeholder
  ].join("");

  return `${payload}${crc16ccitt(payload)}`;
};

export const PaymentModal: React.FC<PaymentModalProps> = ({ userId, onClose, onSuccess }) => {
  const [step, setStep] = useState<'select' | 'payment' | 'processing' | 'success'>('select');
  const [selectedPackage, setSelectedPackage] = useState<typeof PACKAGES[0] | null>(null);
  const [pixCode, setPixCode] = useState<string>("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  const PIX_KEY = "marciomedrado@gmail.com";
  const PIX_NAME = "CorrectorAI";
  const PIX_CITY = "Brasilia";

  const handleSelect = (pkg: typeof PACKAGES[0]) => {
    setSelectedPackage(pkg);
    
    // Generate unique transaction ID based on timestamp
    const txId = `REF${Date.now().toString().slice(-10)}`;
    const code = generatePixPayload(PIX_KEY, PIX_NAME, PIX_CITY, pkg.price, txId);
    setPixCode(code);
    
    setStep('payment');
  };

  const handlePayment = async () => {
    setStep('processing');
    
    // Simulate network delay for reporting payment
    setTimeout(async () => {
      if (selectedPackage) {
        // Just report the intent, DO NOT add credits automatically
        await reportPayment(userId, selectedPackage.credits, selectedPackage.price);
        setStep('success');
      }
    }, 1500);
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-800">
                {step === 'select' && "Comprar Créditos"}
                {step === 'payment' && "Pagamento via Pix"}
                {step === 'processing' && "Processando..."}
                {step === 'success' && "Pagamento em Análise"}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            
            {/* Step 1: Select Package */}
            {step === 'select' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PACKAGES.map((pkg, idx) => (
                        <button 
                            key={idx}
                            onClick={() => handleSelect(pkg)}
                            className={`relative border-2 rounded-xl p-4 hover:border-indigo-500 hover:shadow-md transition-all text-left group ${pkg.popular ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}
                        >
                            {pkg.popular && (
                                <span className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    Mais Vendido
                                </span>
                            )}
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-medium text-slate-500 uppercase">{pkg.label}</span>
                                <div className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    {pkg.credits} créditos
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">
                                {formatCurrency(pkg.price)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                R$ {(pkg.price / pkg.credits).toFixed(4)} / crédito
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Step 2: Payment Mock */}
            {step === 'payment' && selectedPackage && (
                <div className="space-y-6 text-center">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 inline-block w-full">
                        <p className="text-sm font-bold text-slate-800 mb-1">
                            Total a pagar: {formatCurrency(selectedPackage.price)}
                        </p>
                        <p className="text-xs text-slate-500 mb-4">
                            Pacote: {selectedPackage.credits} créditos
                        </p>

                        {/* Generated Dynamic QR Code */}
                        <div className="w-48 h-48 bg-white border border-slate-200 rounded-lg mx-auto flex items-center justify-center mb-4 relative overflow-hidden shadow-inner">
                             <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} 
                                alt="QR Pix" 
                                className="w-full h-full object-contain p-2"
                             />
                        </div>
                    </div>

                    <div className="space-y-2 text-left">
                         <label className="text-xs font-bold text-slate-500 uppercase">Pix Copia e Cola</label>
                         <div className="flex gap-2">
                             <textarea 
                                readOnly 
                                value={pixCode}
                                className="w-full text-xs p-3 bg-slate-100 rounded-lg border border-slate-200 text-slate-600 font-mono resize-none h-12 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                onClick={(e) => e.currentTarget.select()}
                             />
                             <button 
                               onClick={handleCopyPix}
                               className={`px-4 py-2 rounded-lg font-bold text-sm transition-all min-w-[100px] flex items-center justify-center ${copyFeedback ? 'bg-green-100 text-green-700' : 'bg-slate-800 hover:bg-black text-white'}`}
                             >
                                {copyFeedback ? (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                        Copiado!
                                    </>
                                ) : 'Copiar'}
                             </button>
                         </div>
                         <p className="text-[10px] text-slate-400 mt-1">
                             Use a opção "Pix Copia e Cola" no seu app de banco. O valor de <strong>{formatCurrency(selectedPackage.price)}</strong> aparecerá automaticamente.
                         </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-4">
                        <button 
                            onClick={handlePayment}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all transform active:scale-[0.98]"
                        >
                            Já fiz o pagamento
                        </button>
                        
                        <button 
                            onClick={() => setStep('select')}
                            className="mt-3 text-sm text-slate-500 hover:text-slate-800 underline"
                        >
                            Voltar e escolher outro pacote
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Processing */}
            {step === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-600 font-medium animate-pulse">Enviando aviso de pagamento...</p>
                </div>
            )}

            {/* Step 4: Success/Pending */}
            {step === 'success' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                    <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center animate-bounce-subtle">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                    </div>
                    <div>
                        <h4 className="text-2xl font-bold text-slate-800 mb-2">Pagamento em Análise</h4>
                        <p className="text-slate-600 mb-4 text-sm px-4">
                            Registramos sua solicitação. Para liberar seus <strong className="text-indigo-600">{selectedPackage?.credits} créditos</strong> imediatamente, por favor, envie o comprovante no WhatsApp abaixo.
                        </p>
                    </div>
                    
                    <div className="w-full space-y-3">
                        <a
                           href={`https://wa.me/5511970366186?text=${encodeURIComponent(`Olá! Realizei o pagamento do pacote ${selectedPackage?.label} (${selectedPackage?.credits} créditos) no valor de ${formatCurrency(selectedPackage?.price || 0)}. Segue o comprovante para liberação.`)}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            Enviar Comprovante
                        </a>
                        
                        <button 
                            onClick={() => {
                                onSuccess();
                                onClose();
                            }}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl transition-all"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};