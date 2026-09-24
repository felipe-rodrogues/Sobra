import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do PDF.js para ambiente web / Vite
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    // Usamos o CDN oficial do cdnjs/unpkg como fallback confiável sem falhas de chunk no Vite/Capacitor
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('[PDF.js] Erro ao configurar worker:', e);
  }
}

/**
 * Extrai todo o texto de um arquivo PDF preservando a ordem das linhas e colunas
 */
export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
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
