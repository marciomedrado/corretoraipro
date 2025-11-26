import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import saveAs from "file-saver";
import { CorrectionResult } from "../types";

const getFileName = (studentName: string, type: string) => {
  const sanitized = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `correcao_${sanitized}_${date}.${type}`;
};

export const exportToPDF = (data: CorrectionResult) => {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - (margin * 2);

  const checkPageBreak = (heightNeeded: number) => {
    if (y + heightNeeded > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = 20;
    }
  };

  const addText = (text: string, fontSize: number = 10, fontType: string = 'normal', color: string = '#000000') => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", fontType);
    doc.setTextColor(color);
    
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * (fontSize * 0.4)); // approx line height
    doc.text(lines, margin, y);
    y += lines.length * (fontSize * 0.4) + 2;
  };

  // Header
  addText("Relatório de Correção - CorrectorAI", 18, 'bold', '#4f46e5');
  y += 5;

  addText(`Aluno: ${data.studentName}`, 12, 'bold');
  if (data.schoolName) addText(`Escola: ${data.schoolName}`, 10);
  if (data.className) addText(`Turma: ${data.className}`, 10);
  if (data.teacherName) addText(`Professor: ${data.teacherName}`, 10);
  if (data.examDate) addText(`Data: ${data.examDate}`, 10);
  
  y += 5;
  addText(`Nota Final: ${data.totalScore} / ${data.maxTotalScore}`, 14, 'bold', data.totalScore / data.maxTotalScore >= 0.7 ? '#16a34a' : '#dc2626');
  
  y += 10;

  // Summary
  checkPageBreak(30);
  addText("Resumo da Análise", 12, 'bold');
  addText(data.summary, 10, 'italic', '#475569');
  y += 10;

  // Questions
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  data.questions.forEach((q) => {
    checkPageBreak(40);

    if (q.type === 'context') {
      addText(q.questionNumber ? `Contexto: ${q.questionNumber}` : 'Texto de Apoio', 10, 'bold', '#64748b');
      addText(q.questionText, 9, 'italic', '#64748b');
      y += 5;
    } else {
      // Question Number & Score
      const scoreText = `Nota: ${q.score} / ${q.maxScore} pts`;
      const isCorrectText = q.isCorrect ? "(Correta)" : "(Incorreta/Parcial)";
      const color = q.isCorrect ? '#16a34a' : ((q.score || 0) > 0 ? '#ca8a04' : '#dc2626');

      addText(`Questão ${q.questionNumber} ${isCorrectText}`, 11, 'bold', color);
      addText(scoreText, 10, 'bold', color);
      y += 2;

      // Enunciation
      addText("Enunciado:", 9, 'bold');
      addText(q.questionText, 9);
      y += 2;

      // Student Answer
      addText("Resposta do Aluno:", 9, 'bold');
      addText(q.studentAnswer || "(Sem resposta)", 9, 'italic');
      y += 2;

      // Feedback
      addText("Feedback:", 9, 'bold');
      addText(q.feedback || "", 9, 'normal', '#334155');
      
      y += 8;
      doc.setDrawColor(230);
      checkPageBreak(2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    }
  });

  doc.save(getFileName(data.studentName, 'pdf'));
};

export const exportToDOCX = (data: CorrectionResult) => {
  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "Relatório de Correção - CorrectorAI",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );

  // Metadata Info
  const createInfoLine = (label: string, value: string) => new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
    spacing: { after: 100 }
  });

  children.push(createInfoLine("Aluno", data.studentName));
  if (data.schoolName) children.push(createInfoLine("Escola", data.schoolName));
  if (data.className) children.push(createInfoLine("Turma", data.className));
  if (data.teacherName) children.push(createInfoLine("Professor", data.teacherName));
  if (data.examDate) children.push(createInfoLine("Data", data.examDate));

  // Score
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Nota Final: ", bold: true, size: 28 }),
        new TextRun({ text: `${data.totalScore} / ${data.maxTotalScore}`, bold: true, size: 28, color: data.totalScore / data.maxTotalScore >= 0.7 ? "16a34a" : "dc2626" }),
      ],
      spacing: { before: 200, after: 200 }
    })
  );

  // Summary
  children.push(new Paragraph({ text: "Resumo da Análise", heading: HeadingLevel.HEADING_2 }));
  children.push(new Paragraph({ 
    children: [new TextRun({ text: data.summary, italics: true })],
    spacing: { after: 400 }
  }));

  // Questions
  data.questions.forEach((q) => {
    if (q.type === 'context') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: q.questionNumber ? `Contexto ${q.questionNumber}` : "Texto de Apoio", bold: true, color: "64748b" })
          ],
          spacing: { before: 200 }
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: q.questionText, italics: true, color: "64748b" })],
          spacing: { after: 200 }
        })
      );
    } else {
      const color = q.isCorrect ? "16a34a" : ((q.score || 0) > 0 ? "ca8a04" : "dc2626");
      
      // Header Q
      children.push(
        new Paragraph({
          children: [
            new TextRun({ 
              text: `Questão ${q.questionNumber} - (${q.score}/${q.maxScore} pts)`, 
              bold: true, 
              size: 24,
              color: color
            })
          ],
          spacing: { before: 300, after: 100 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, space: 10, color: "e2e8f0" } }
        })
      );

      // Enunciation
      children.push(new Paragraph({ children: [new TextRun({ text: "Enunciado:", bold: true })] }));
      children.push(new Paragraph({ text: q.questionText, spacing: { after: 100 } }));

      // Answer
      children.push(new Paragraph({ children: [new TextRun({ text: "Resposta do Aluno:", bold: true })] }));
      children.push(new Paragraph({ text: q.studentAnswer || "(Sem resposta)", italics: true, spacing: { after: 100 } }));

      // Feedback
      children.push(new Paragraph({ children: [new TextRun({ text: "Feedback:", bold: true })] }));
      children.push(new Paragraph({ text: q.feedback || "", spacing: { after: 100 } }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, getFileName(data.studentName, 'docx'));
  });
};