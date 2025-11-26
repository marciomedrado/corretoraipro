import { GoogleGenAI, Type } from "@google/genai";
import { CorrectionResult, correctionSchema, QuestionResult } from "../types";

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the Data-URI prefix (e.g. "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeExam = async (
  imageFile: File, 
  context: string
): Promise<CorrectionResult> => {
  
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const base64Image = await fileToBase64(imageFile);

  const prompt = `
    Você é um professor assistente especialista em correção de provas.
    Sua tarefa é analisar a imagem desta prova escolar.
    
    Contexto/Gabarito fornecido pelo professor:
    "${context}"
    
    Instruções de Análise:
    1. **Cabeçalho**: Identifique e extraia Nome do aluno, Escola, Professor, Turma e Data, se visíveis.
    2. **Transcrição Geral**: Transcreva o conteúdo textual no campo 'fullTranscription'.
    
    3. **Identificação de Itens (Questões e Contexto)**:
       Percorra a prova sequencialmente.
       - **Textos de Apoio / Enunciados Compartilhados**: Se encontrar um texto, tirinha, ou enunciado que serve de base para uma ou mais questões subsequentes (ex: "Leia o texto para responder às questões 1 a 3"), crie um item com **type: 'context'**.
         - No campo 'questionText', coloque todo o conteúdo desse texto de apoio.
         - No campo 'questionNumber', coloque algo como "Texto", "Instrução" ou deixe vazio se não houver numeração específica.
       
       - **Questões**: Para cada pergunta que exige resposta, crie um item com **type: 'question'**.
         - 'questionNumber': Identifique o número (ex: "1", "2", "13 a", "13 b").
         - 'questionText': O enunciado específico daquela questão.
    
    4. **OCR e Fidelidade (CRÍTICO)**:
       - O OCR deve ser **extremamente fiel** a todos os símbolos matemáticos, químicos e físicos.
       - **NÃO simplifique fórmulas**. Se a imagem mostra H₂O, transcreva H₂O (com subscrito Unicode), NUNCA H2O.
       - Se a imagem mostra x², transcreva x² (com sobrescrito Unicode).
       - Use caracteres Unicode para frações, integrais, setas, etc., conforme aparecem.

    5. **Correção (apenas para type='question')**:
       - Transcreva a RESPOSTA do aluno em 'studentAnswer' com a mesma fidelidade de símbolos usada no enunciado.
       - Compare com o gabarito e atribua 'score', 'isCorrect' e 'feedback'.
       - O feedback deve ser construtivo e em Português.
       - **IMPORTANTE**: Dirija-se diretamente ao aluno no feedback (use "você" em vez de "o aluno").
       - **IMPORTANTE**: Se a resposta do aluno estiver INCORRETA, o feedback DEVE indicar explicitamente qual seria a resposta correta no final.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageFile.type,
              data: base64Image
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: correctionSchema,
        temperature: 0.2,
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const result: CorrectionResult = JSON.parse(jsonText);
    return result;

  } catch (error) {
    console.error("Error analyzing exam:", error);
    throw error;
  }
};

export const reevaluateQuestion = async (
  question: QuestionResult,
  context: string
): Promise<{ isCorrect: boolean; score: number; feedback: string }> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Atue como um corretor de provas escolar.
    Você deve reavaliar uma questão específica com base nos dados atualizados (que podem ter sido editados pelo professor).

    Contexto/Gabarito Original da Prova:
    "${context}"

    Dados da Questão para Reavaliação:
    - Enunciado: "${question.questionText}"
    - Alternativas: ${JSON.stringify(question.alternatives || [])}
    - Resposta do Aluno (transcrita): "${question.studentAnswer}"
    - Nota Máxima da Questão: ${question.maxScore}

    Instruções:
    1. Analise se a 'Resposta do Aluno' está correta, considerando o Enunciado, as Alternativas e o Contexto.
    2. Determine se está correta (isCorrect), a nota a ser dada (score) e forneça um feedback explicativo (feedback).
    3. Se a resposta for parcialmente correta, ajuste a nota proporcionalmente, mas 'isCorrect' pode ser falso se não for totalmente correta, ou verdadeiro se for aceitável. Use seu julgamento pedagógico.
    4. O feedback deve justificar a nota e dirigir-se diretamente ao aluno (use "você" em vez de "o aluno").
    5. **IMPORTANTE**: Se a resposta do aluno estiver INCORRETA, o feedback DEVE indicar explicitamente qual seria a resposta correta no final.

    Responda APENAS com o JSON.
  `;

  const reevalSchema = {
    type: Type.OBJECT,
    properties: {
      isCorrect: { type: Type.BOOLEAN },
      score: { type: Type.NUMBER },
      feedback: { type: Type.STRING }
    },
    required: ["isCorrect", "score", "feedback"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { text: prompt },
      config: {
        responseMimeType: "application/json",
        responseSchema: reevalSchema,
        temperature: 0.2,
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error reevaluating question:", error);
    throw error;
  }
};

export const regenerateSummary = async (
  currentData: CorrectionResult
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Simplify questions to essential data for summary generation to save tokens/context
  const simplifiedQuestions = currentData.questions.map(q => {
      if (q.type === 'context') return null;
      return {
          number: q.questionNumber,
          text: q.questionText,
          isCorrect: q.isCorrect,
          score: q.score,
          maxScore: q.maxScore,
          feedback: q.feedback
      };
  }).filter(Boolean);

  const prompt = `
    Atue como um professor experiente corrigindo uma prova.
    
    Tarefa: Reescreva o "Resumo da Análise" com base nos dados atualizados da prova. 
    Algumas notas, respostas ou avaliações podem ter mudado. O resumo deve refletir o estado ATUAL.

    Dados do Aluno:
    - Nome: ${currentData.studentName}
    - Nota Final: ${currentData.totalScore} de ${currentData.maxTotalScore}

    Questões:
    ${JSON.stringify(simplifiedQuestions)}

    Instruções para o Resumo:
    1. Escreva um texto corrido (parágrafo único ou dois curtos).
    2. Analise o desempenho do aluno considerando os acertos e erros.
    3. Seja encorajador mas objetivo.
    4. Se a nota for alta, parabenize. Se for baixa, sugira atenção.
    5. Responda APENAS com o texto do resumo.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { text: prompt },
      config: {
        temperature: 0.3,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error regenerating summary:", error);
    return "";
  }
};
