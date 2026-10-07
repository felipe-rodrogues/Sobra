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
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter(it => it.str && it.str.trim() !== '');

    // Verifica se a página possui layout em múltiplas colunas (ex: PicPay com 2 colunas de compras lado a lado)
    const dateRegex = /\b\d{1,2}[/-]\d{1,2}\b|\b\d{1,2}\s+de\s+[a-z]{3}\b/i;
    const leftDateItems = items.filter(it => it.transform[4] < 260 && dateRegex.test(it.str));
    const rightDateItems = items.filter(it => it.transform[4] >= 260 && dateRegex.test(it.str));

    const isTwoColumn = leftDateItems.length >= 3 && rightDateItems.length >= 3;

    const processItems = (colItems: any[]): string[] => {
      // Agrupa itens de texto por coordenada vertical Y para manter linhas visuais juntas
      const lineMap = new Map<number, { x: number; width: number; text: string }[]>();

      for (const item of colItems) {
        // Normaliza variações mínimas de altura (tolerância de ~4px)
        const y = Math.round(item.transform[5] / 4) * 4;
        const x = item.transform[4];
        const width = item.width || 0;

        if (!lineMap.has(y)) {
          lineMap.set(y, []);
        }
        lineMap.get(y)!.push({ x, width, text: item.str });
      }

      // Ordena linhas de cima para baixo (Y decrescente no PDF)
      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const colLines: string[] = [];
      for (const y of sortedYs) {
        const rowItems = lineMap.get(y)!;
        // Ordena elementos da mesma linha da esquerda para a direita (X crescente)
        rowItems.sort((a, b) => a.x - b.x);

        let rowText = '';
        for (let i = 0; i < rowItems.length; i++) {
          const curr = rowItems[i];
          if (i === 0) {
            rowText = curr.text.trim();
          } else {
            const prev = rowItems[i - 1];
            const prevEnd = prev.x + (prev.width || 0);
            const gap = curr.x - prevEnd;

            // Se o gap for muito pequeno (<= 2.5px), os itens pertencem à mesma palavra (kerning do PDF)
            if (gap <= 2.5) {
              rowText += curr.text.trim();
            } else {
              rowText += ' ' + curr.text.trim();
            }
          }
        }

        if (rowText.length > 0) {
          colLines.push(rowText);
        }
      }
      return colLines;
    };

    if (isTwoColumn) {
      const splitX = Math.min(...rightDateItems.map(it => it.transform[4])) - 5;
      const leftItems = items.filter(it => it.transform[4] < splitX);
      const rightItems = items.filter(it => it.transform[4] >= splitX);
      allLines.push(...processItems(leftItems));
      allLines.push(...processItems(rightItems));
    } else {
      allLines.push(...processItems(items));
    }
  }

  return allLines.join('\n');
}
