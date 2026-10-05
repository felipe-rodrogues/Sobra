import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configura o worker do PDF.js para ambiente web / Vite / Capacitor
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    // Usamos o CDN unpkg / cdnjs do build legacy correspondente
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/legacy/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('[PDF.js] Erro ao configurar worker:', e);
  }
}

/**
 * Extrai todo o texto de um arquivo PDF preservando a ordem das linhas e colunas
 */
export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  // Faz uma cópia rasa do buffer para evitar que o worker do PDF.js desanexe (detach) o buffer original
  const safeData = new Uint8Array(arrayBuffer.slice(0));

  const loadingTask = pdfjsLib.getDocument({
    data: safeData,
    useSystemFonts: true,
    isEvalSupported: false,
  } as any);

  const pdfDoc = await loadingTask.promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    // Agrupa itens de texto por coordenada vertical Y para manter linhas visuais juntas
    const lineMap = new Map<number, { x: number; text: string }[]>();

    for (const item of content.items as any[]) {
      if (!item.str || item.str.trim() === '') continue;
      // Normaliza variações mínimas de altura (tolerância de ~4px)
      const y = Math.round(item.transform[5] / 4) * 4;
      const x = item.transform[4];

      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push({ x, text: item.str });
    }

    // Ordena linhas de cima para baixo (Y decrescente no PDF)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const rowItems = lineMap.get(y)!;
      // Ordena elementos da mesma linha da esquerda para a direita (X crescente)
      rowItems.sort((a, b) => a.x - b.x);
      const rowText = rowItems.map(it => it.text.trim()).join(' ');
      if (rowText.length > 0) {
        lines.push(rowText);
      }
    }
  }

  return lines.join('\n');
}
