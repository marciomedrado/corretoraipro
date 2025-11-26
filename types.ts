import { Type } from "@google/genai";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'blocked';
  credits: number;
  password?: string; // Only for mock auth usage
}

export interface QuestionResult {
  type?: 'question' | 'context';
  questionNumber: string;
  questionText: string;
  alternatives?: string[];
  studentAnswer?: string; // Optional for context
  isCorrect?: boolean; // Optional for context
  score?: number; // Optional for context
  maxScore?: number; // Optional for context
  feedback?: string; // Optional for context
}

export interface CorrectionResult {
  studentName: string;
  schoolName?: string;
  teacherName?: string;
  className?: string;
  examDate?: string;
  totalScore: number;
  maxTotalScore: number;
  summary: string;
  fullTranscription: string;
  questions: QuestionResult[];
}

export enum AppState {
  LOGIN,
  DASHBOARD,
  ANALYZING,
  RESULTS
}

// Schema definitions for Gemini
export const correctionSchema = {
  type: Type.OBJECT,
  properties: {
    studentName: { type: Type.STRING, description: "Nome do aluno identificado na prova (ou 'Não identificado')" },
    schoolName: { type: Type.STRING, description: "Nome da escola ou instituição, se visível." },
    teacherName: { type: Type.STRING, description: "Nome do professor, se visível." },
    className: { type: Type.STRING, description: "Turma ou série, se visível." },
    examDate: { type: Type.STRING, description: "Data da prova, se visível." },
    totalScore: { type: Type.NUMBER, description: "Nota total obtida pelo aluno" },
    maxTotalScore: { type: Type.NUMBER, description: "Nota máxima possível da prova" },
    summary: { type: Type.STRING, description: "Um resumo geral sobre o desempenho do aluno e pontos de atenção." },
    fullTranscription: { type: Type.STRING, description: "A transcrição completa de todo o texto visível na imagem da prova, incluindo enunciados e respostas." },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { 
            type: Type.STRING, 
            enum: ["question", "context"], 
            description: "Use 'context' para textos de apoio, enunciados gerais ou instruções que antecedem questões. Use 'question' para itens que exigem resposta e nota." 
          },
          questionNumber: { type: Type.STRING, description: "Número da questão (ex: '1', '13 a') ou identificador do texto (ex: 'Texto 1')" },
          questionText: { type: Type.STRING, description: "O enunciado da questão ou o conteúdo do texto de apoio transcrito." },
          alternatives: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "Lista das alternativas de resposta, caso seja múltipla escolha." 
          },
          studentAnswer: { type: Type.STRING, description: "Texto transcrito da resposta do aluno (apenas para type='question')." },
          isCorrect: { type: Type.BOOLEAN, description: "Se a resposta está correta (apenas para type='question')." },
          score: { type: Type.NUMBER, description: "Nota dada (apenas para type='question')." },
          maxScore: { type: Type.NUMBER, description: "Valor total da questão (apenas para type='question')." },
          feedback: { type: Type.STRING, description: "Comentário explicativo (apenas para type='question')." }
        },
        required: ["type", "questionNumber", "questionText"]
      }
    }
  },
  required: ["studentName", "totalScore", "summary", "fullTranscription", "questions"]
};