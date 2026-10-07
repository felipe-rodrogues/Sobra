/**
 * Sobra - Reconhecedor Inteligente de Faturas e Extratos (Texto Livre e PDF)
 * Processa texto colado, digitado manualmente ou extraído de faturas PDF
 * (Nubank, Itaú, Bradesco, Santander, Inter, C6, etc.).
 */

import { ParsedCsvRow, extractInstallmentFromDescription, isInvoicePaymentDescription, isRefundDescription } from './csvParser';
import { parseBrlCurrency } from './currencyHelper';
import { merchantCleaner } from '../categorization/merchantCleaner';

const PT_MONTHS: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
  outubro: '10', novembro: '11', dezembro: '12'
};

// Linhas de cabeçalho, rodapé ou resumo que devem ser ignoradas
const NOISE_LINE_PATTERNS = [
  /^total\s+(da\s+)?fatura/i,
  /^total\s+a\s+pagar/i,
  /^total\s*:/i,
  /^total\s+r\$/i,
  /^total\s+(?:cart[ãa]o|do\s+cart[ãa]o)/i,
  /^subtotal\s+(?:dos\s+lan[çc]amentos)?/i,
  /^total\s+geral\s+dos\s+lan[çc]amentos/i,
  /^(?:cart[ãa]o\s+)?\d{4}\*{2,}\d{4}/i, // número de cartão mascarado em cabeçalhos (ex: 2306****2462 10/10/2026 R$ 1.354,65)
  /^despesas\s+da\s+fatura/i,
  /^data\s+movimenta[çc][ãa]o/i,
  /^data\s+estabelecimento/i,
  /^data\s+descri[çc][ãa]o/i,
  /^transa[çc][õo]es\s+(?:nacionais|internacionais)/i,
  /^picpay\s+card/i,
  /^fatura\s+atual/i,
  /^fatura\s+anterior/i,
  /^resumo\s*-\s*m[eê]s/i,
  /^limite\s+(total|utilizado|dispon[ií]vel|de\s+cr[eé]dito)/i,
  /^saque\s+(total|utilizado|dispon[ií]vel)/i,
  /^saques\b/i,
  /^tarifa\s+de\s+saque/i,
  /^vencimento/i,
  /^data\s+de\s+vencimento/i,
  /^fechamento/i,
  /^melhor\s+data/i,
  /^p[aá]gina\s+\d+/i,
  /^resumo\s+da\s+fatura/i,
  /^demonstrativo/i,
  /^saldo\s+(anterior|atual)/i,
  /^central\s+de\s+atendimento/i,
  /^ouvidoria/i,
  /^canal\s+de\s+libras/i,
  /^sac\b/i,
  /^cnpj/i,
  /^fatura\s+fechada/i,
  /^compras\s+e\s+lan[çc]amentos/i,
  /^movimenta[çc][õo]es/i,
  /^lan[çc]amentos\s+nacionais/i,
  /^lan[çc]amentos\s+internacionais/i,
  /^\d{4}\s+\d{4}\s+\d{4}/, // número de cartão
  /^banco\s+/i,
  /^consumos\s+de\s+\d{1,2}[/-]\d{1,2}\s+a\s+\d{1,2}[/-]\d{1,2}/i, // Resumo de período da fatura
  /^pagamentos\s+e\s+cr[eé]ditos\s+devolvidos/i,
  /^pagamento\s+m[ií]nimo/i,
  /^juros\s+(do\s+rotativo|de\s+mora|do\s+parcelamento|do\s+m[eê]s)/i,
  /^cet\s*\(/i,
  /^iof\b/i,
  /^multa(\s+por\s+atraso)?/i,
  /^compras\s+parceladas/i,
  /^fatura\s+parcelada/i,
  /^(?:at[eé]\s+)?1\s*\+\s*\[?\d+\]?x/i, // Simulações de parcelamento de fatura
  /^pague\s+sua\s+fatura/i,
  /^parcele\s+a\s+fatura/i,
  /^parcele\s+ou\s+pague/i,
  /^declara[çc][ãa]o\s+anual/i,
  /^taxas?\s+de\s+convers[ãa]o/i,
  /^teto\s+de\s+juros/i,
  /^datas\s+importantes/i,
  /^melhor\s+dia\s+de\s+compra/i,
  /^fechamento\s+da\s+fatura/i,
  /^pr[oó]ximo\s+fechamento/i,
  /^lan[çc]amentos\s+futuros/i,
  /^op[çc][õo]es\s+de\s+pagamento/i,
  /^seu\s+cart[ãa]o\s+de\s+cr[eé]dito/i,
  /^informa[çc][õo]es\s+complementares/i,
  /^o\s+valor\s+m[ií]nimo\s+que\s+voc[eê]/i,
  /^no\s+valor\s+de\s+r\$/i,
  /^pagando\s+o\s+valor\s+m[ií]nimo/i,
  /^pagando\s+a\s+primeira\s+parcela/i,
  /^voc[eê]\s+fica\s+em\s+atraso/i,
  /^encontre\s+estes\s+e\s+outros/i,
  /^saque\s+dinheiro\s+no\s+caixa/i,
  /^observe\s+que\s+a\s+rede/i,
  /^acrescimo\s+\d+%/i,
  /^acr[eé]scimo\s+\d+%/i,
];

/**
 * Detecta cabeçalhos de cartão específico (titular, adicional ou virtual) para vincular as compras
 */
function extractCardLastDigitsFromLine(line: string): string | null {
  const match = line.match(/(?:final|cart[ãa]o)[^\d]*(\d{4})\b/i) ||
                line.match(/\*{2,}(\d{4})\b/) ||
                line.match(/\[\*{2,}(\d{4})\]/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Extrai universalmente a seção real de compras e movimentações da fatura de qualquer banco
 * brasileiro (PicPay, Inter, Mercado Pago, Nubank, Itaú, Bradesco, Santander, C6, etc.).
 * Descarta automaticamente a capa de resumo (limites, faturas anteriores, simulações de rotativo)
 * e o rodapé/páginas finais (projeções futuras de parcelas consolidadas, encargos e boleto).
 */
export function extractUniversalTransactionsSection(text: string): string {
  // Marcadores de início de transações em faturas bancárias
  const startRegex = /(?:Transa[çc][õo]es\s+(?:Nacionais|Internacionais)|Despesas\s+da\s+fatura|Detalhes\s+de\s+consumo|Movimenta[çc][õo]es\s+na\s+fatura|Lançamentos\s+(?:no\s+Brasil|no\s+Exterior|da\s+fatura|nacionais|internacionais)|Picpay\s+Card|Cart[ãa]o\s+[^\n]+\[\*{4,}\d{4}\]|Data\s+Estabelecimento\s+Valor|Data\s+Descri[çc][ãa]o\s+Valor|Data\s+Movimenta[çc][ãa]o|Compras\s+e\s+lan[çc]amentos)/i;
  const startMatch = text.search(startRegex);
  const fromStart = startMatch !== -1 ? text.substring(startMatch) : text;

  // Marcadores de encerramento da tabela de lançamentos reais
  const endRegex = /(?:Total\s+parcelado\s*-\s*pr[oó]ximas\s+faturas|Pr[oó]xima\s+fatura|Encargos\s+pr[oó]ximos\s+per[ií]odos|Encargos\s+financeiros|1\.\s+Pagamento\s+total|Saiba\s+quais\s+s[ãa]o\s+as\s+modalidades|Informa[çc][õo]es\s+complementares|Fale\s+com\s+a\s+gente|Central\s+de\s+[Aa]juda|Boleto\s+de\s+pagamento|Autentica[çc][ãa]o\s+mec[âa]nica|07790\.\d{5}|34191\.\d{5}|23793\.\d{5}|03399\.\d{5})/i;
  const endMatch = fromStart.search(endRegex);
  return endMatch !== -1 ? fromStart.substring(0, endMatch) : fromStart;
}

/**
 * Tenta extrair a data de uma linha de texto.
 * Formatos suportados: DD/MM/AAAA, DD/MM/AA, DD/MM, DD-MM-AAAA, DD de Mês, DD MMM
 */
function extractDateFromLine(
  line: string, 
  defaultYear = new Date().getFullYear(),
  defaultMonth?: number
): { date: string; remainingText: string } | null {
  // 1. Formato DD/MM/AAAA ou DD/MM/AA ou DD-MM-AAAA ou DD/MM
  const numericDateMatch = line.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numericDateMatch) {
    const d = numericDateMatch[1].padStart(2, '0');
    const m = numericDateMatch[2].padStart(2, '0');
    let y = defaultYear.toString();
    if (numericDateMatch[3]) {
      y = numericDateMatch[3].length === 2 ? `20${numericDateMatch[3]}` : numericDateMatch[3];
    } else if (defaultMonth) {
      const monthNum = parseInt(m, 10);
      // Se a fatura é de janeiro (mês 1) e a compra foi em dezembro (mês 12)
      if (defaultMonth === 1 && monthNum === 12) {
        y = (defaultYear - 1).toString();
      }
    }
    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      const remaining = line.replace(numericDateMatch[0], '').trim();
      return { date: `${y}-${m}-${d}`, remainingText: remaining };
    }
  }

  // 2. Formato por extenso ou abreviado: 12 OUT, 12 de Outubro ou 10 de set. 2026
  const textualDateMatch = line.match(/\b(\d{1,2})(?:\s+de)?\s+([A-Za-zçÇ]{3,9})\.?(?:\s+(?:de\s+)?(\d{2,4}))?\b/i);
  if (textualDateMatch) {
    const d = textualDateMatch[1].padStart(2, '0');
    const monthStr = textualDateMatch[2].toLowerCase();
    const m = PT_MONTHS[monthStr] || PT_MONTHS[monthStr.substring(0, 3)];
    if (m) {
      let y = defaultYear.toString();
      if (textualDateMatch[3]) {
        y = textualDateMatch[3].length === 2 ? `20${textualDateMatch[3]}` : textualDateMatch[3];
      }
      const dayNum = parseInt(d, 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const remaining = line.replace(textualDateMatch[0], '').trim();
        return { date: `${y}-${m}-${d}`, remainingText: remaining };
      }
    }
  }

  // 3. Formato apenas com dia se houver defaultMonth fornecido (ex: "Dia 14 Padaria" ou "14 iFood")
  if (defaultMonth) {
    const dayOnlyMatch = line.match(/^(?:dia\s+)?(\d{1,2})\s+(?=[A-Za-zÀ-ÿ])/i);
    if (dayOnlyMatch) {
      const dayNum = parseInt(dayOnlyMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const d = dayOnlyMatch[1].padStart(2, '0');
        const m = String(defaultMonth).padStart(2, '0');
        const remaining = line.replace(dayOnlyMatch[0], '').trim();
        return { date: `${defaultYear}-${m}-${d}`, remainingText: remaining };
      }
    }
  }

  return null;
}

/**
 * Tenta extrair o valor monetário de uma linha.
 * Suporta: R$ 1.234,56 / 1234,56 / 45,90 / 45.90 / R$ 150
 */
function extractAmountFromLine(line: string): { amount: number; isNegative: boolean; remainingText: string } | null {
  // Ignora porcentagens e taxas (ex: "14% a.m.", "381,80% a.a.", "276,45% a.a.") para nunca confundi-las com dinheiro
  const cleanLine = line.replace(/[+-]?\d+(?:[.,]\d+)?\s*%\s*(?:a\.[am]\.?)?/gi, '').trim();
  if (!cleanLine) return null;

  // Padrão 1: Valores com R$ explícito (ex: R$ 120,50 ou R$ -45,00)
  const currencyMatch = cleanLine.match(/(?:R\$\s*)([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:\.\d{2})|[+-]?\s*\d+,\d{2}|[+-]?\s*\d+)/i);
  if (currencyMatch) {
    const rawVal = currencyMatch[1].replace(/\s+/g, '');
    const num = parseBrlCurrency(rawVal);
    if (num !== null && num !== 0) {
      const remaining = cleanLine.replace(currencyMatch[0], '').trim();
      return { amount: Math.abs(num), isNegative: num < 0 || cleanLine.includes('-' + currencyMatch[0]), remainingText: remaining };
    }
  }

  // Padrão 2: Valor no fim da linha ou isolado com vírgula ou ponto decimal
  // Ex: "Paiva Hortifruti 28,00" ou "Obramax 85,46"
  const endAmountMatch = cleanLine.match(/([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:\.\d{2})|[+-]?\s*\d+,\d{2})\s*$/);
  if (endAmountMatch) {
    const rawVal = endAmountMatch[1].replace(/\s+/g, '');
    const num = parseBrlCurrency(rawVal);
    if (num !== null && num !== 0) {
      const remaining = cleanLine.substring(0, cleanLine.lastIndexOf(endAmountMatch[0])).trim();
      return { amount: Math.abs(num), isNegative: num < 0, remainingText: remaining };
    }
  }

  // Padrão 3: Qualquer valor decimal restante na linha
  const anyAmountMatch = cleanLine.match(/\b([+-]?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+,\d{2}|[+-]?\d+\.\d{2})\b/);
  if (anyAmountMatch) {
    const rawVal = anyAmountMatch[1];
    const num = parseBrlCurrency(rawVal);
    if (num !== null && num !== 0) {
      const remaining = cleanLine.replace(anyAmountMatch[0], '').trim();
      return { amount: Math.abs(num), isNegative: num < 0, remainingText: remaining };
    }
  }

  return null;
}

/**
 * Interpreta texto livre de faturas (digitado, colado ou extraído de PDF)
 */
export function parseSmartInvoiceText(text: string, defaultDate?: string): ParsedCsvRow[] {
  if (!text || text.trim().length === 0) return [];

  // Tenta detectar ano e mês de referência da fatura no cabeçalho geral (ex: "Vencimento: 10/10/2026" ou "01/10/2026")
  let detectedYear: number | undefined;
  let detectedMonth: number | undefined;
  const dueOrCloseMatch = text.match(/\b(?:vencimento|fechamento|emitida\s+em)[:\s]*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/i);
  if (dueOrCloseMatch) {
    detectedMonth = parseInt(dueOrCloseMatch[2], 10);
    detectedYear = parseInt(dueOrCloseMatch[3], 10);
  }

  // Filtra universalmente para a seção real de transações
  const sanitizedText = extractUniversalTransactionsSection(text);
  const rawLines = sanitizedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows: ParsedCsvRow[] = [];
  const todayIso = new Date().toISOString().substring(0, 10);
  const fallbackDate = defaultDate || (detectedYear && detectedMonth ? `${detectedYear}-${String(detectedMonth).padStart(2, '0')}-01` : todayIso);
  const defaultYear = detectedYear || (defaultDate ? parseInt(defaultDate.substring(0, 4), 10) : new Date().getFullYear());
  const defaultMonth = detectedMonth || (defaultDate ? parseInt(defaultDate.substring(5, 7), 10) : undefined);

  // Verifica se o texto possui linhas com datas explícitas (típico de faturas de cartão e extratos)
  const hasDatedLines = rawLines.some(line => {
    if (NOISE_LINE_PATTERNS.some(p => p.test(line))) return false;
    if (/\b(?:vencimento|fechamento|melhor\s+data|dia\s+do\s+corte)\s*:/i.test(line)) return false;
    return extractDateFromLine(line, defaultYear, defaultMonth) !== null;
  });

  let currentCardLastDigits: string | undefined = undefined;

  for (const originalLine of rawLines) {
    // Acompanha mudanças de cartão dentro da fatura (ex: titular vs adicional)
    const cardDigitsMatch = extractCardLastDigitsFromLine(originalLine);
    if (cardDigitsMatch) {
      currentCardLastDigits = cardDigitsMatch;
    } else if (/picpay\s+card\b/i.test(originalLine) && !/final\s*\d{4}/i.test(originalLine)) {
      currentCardLastDigits = undefined; // Cartão virtual sem final especificado
    }

    // 1. Ignora linhas que são ruído evidente de cabeçalho/resumo
    if (NOISE_LINE_PATTERNS.some(p => p.test(originalLine))) {
      continue;
    }

    // Ignora linhas informativas com data de vencimento/fechamento/corte
    if (/\b(?:vencimento|fechamento|melhor\s+data|dia\s+do\s+corte)\s*:/i.test(originalLine)) {
      continue;
    }

    // 2. Extrai valor monetário
    const amountResult = extractAmountFromLine(originalLine);
    if (!amountResult) {
      // Se a linha não tem valor monetário, não é um lançamento
      continue;
    }

    let lineWithoutAmount = amountResult.remainingText;

    // 3. Extrai data
    const dateResult = extractDateFromLine(lineWithoutAmount, defaultYear, defaultMonth);

    // REGRA DE OURO DAS FATURAS BANCÁRIAS:
    // Em faturas de cartão de crédito e extratos com datas identificadas,
    // TODA compra real possui uma data associada (ex: 10/09, 03/09, 10 OUT).
    // Linhas sem data são subtotais, limites, taxas rotativas ou rodapés e DEVEM ser ignoradas.
    if (hasDatedLines && !dateResult) {
      continue;
    }

    let transactionDate = fallbackDate;
    let descCandidate = lineWithoutAmount;

    if (dateResult) {
      transactionDate = dateResult.date;
      descCandidate = dateResult.remainingText;
    }

    // 4. Limpa caracteres residuais como hífens, traços ou separadores
    let rawDesc = descCandidate
      .replace(/^[-–—:•*|,]+\s*/, '')
      .replace(/\s*[-–—:•*|,]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!rawDesc || rawDesc.length < 2) {
      rawDesc = 'Compra no Cartão';
    }

    // 5. Detecção de parcelas
    let isInstallment = false;
    let installmentNumber: number | undefined;
    let installmentTotal: number | undefined;

    // Verifica padrão "PARC04/05" (PicPay, etc.)
    const parcMatch = rawDesc.match(/PARC\s*(\d{1,2})\s*\/\s*(\d{1,2})/i);
    if (parcMatch) {
      const cur = parseInt(parcMatch[1], 10);
      const tot = parseInt(parcMatch[2], 10);
      if (tot >= 2 && tot <= 48 && cur <= tot) {
        isInstallment = true;
        installmentNumber = cur;
        installmentTotal = tot;
        rawDesc = rawDesc.replace(parcMatch[0], '').trim();
      }
    }

    if (!isInstallment) {
      // Verifica padrão "10x de 45,00" ou "3x"
      const xPatternMatch = rawDesc.match(/\b(\d{1,2})\s*[xX]\s*(?:de\s*)?/);
      if (xPatternMatch) {
        const total = parseInt(xPatternMatch[1], 10);
        if (total >= 2 && total <= 48) {
          isInstallment = true;
          installmentNumber = 1;
          installmentTotal = total;
          rawDesc = rawDesc.replace(xPatternMatch[0], '').trim();
        }
      }
    }

    if (!isInstallment) {
      // Verifica padrão tradicional "(1/3)" ou "Parcela 2/5"
      const traditionalInstallment = extractInstallmentFromDescription(rawDesc);
      if (traditionalInstallment.isInstallment) {
        isInstallment = true;
        installmentNumber = traditionalInstallment.installmentNumber;
        installmentTotal = traditionalInstallment.installmentTotal;
        rawDesc = traditionalInstallment.cleanDescription;
      }
    }

    // 6. Detecção de quitação de fatura ou reembolso
    const isInvoicePayment = isInvoicePaymentDescription(rawDesc);
    const isRefund = !isInvoicePayment && (isRefundDescription(rawDesc) || amountResult.isNegative);

    // 7. Limpeza profissional do nome do estabelecimento
    const cleanDescription = merchantCleaner.stripBankNoise(rawDesc) || rawDesc;

    // 8. Define tipo
    let type: 'income' | 'expense' = 'expense';
    if (isInvoicePayment || isRefund) {
      type = 'income';
    }

    rows.push({
      date: transactionDate,
      description: rawDesc,
      cleanDescription,
      amount: amountResult.amount,
      type,
      paymentMethod: 'credit',
      raw: originalLine,
      isInstallment,
      installmentNumber,
      installmentTotal,
      isInvoicePayment,
      isRefund,
      cardLastDigits: currentCardLastDigits,
    });
  }

  // 9. Alinhamento de ciclo da fatura para compras parceladas anteriores:
  // Se a fatura contém compras parceladas que trazem a data original da compra no banco (ex: "10/06 FELIPECELL Parcela 4 de 18"),
  // mas o lançamento está sendo cobrado no ciclo atual da fatura (ex: compras de setembro/outubro),
  // ajustamos a data do lançamento para o mês do ciclo da fatura, preservando a data de compra original em originalPurchaseDate.
  const nonInstallmentRows = rows.filter(r => !r.isInstallment && !r.isInvoicePayment);
  let dominantYearMonth: string | null = null;

  if (nonInstallmentRows.length >= 3) {
    const ymCount = new Map<string, number>();
    for (const r of nonInstallmentRows) {
      const ym = r.date.substring(0, 7); // YYYY-MM
      ymCount.set(ym, (ymCount.get(ym) || 0) + 1);
    }
    let maxC = 0;
    for (const [ym, count] of ymCount.entries()) {
      if (count > maxC) {
        maxC = count;
        dominantYearMonth = ym;
      }
    }
  } else if (defaultDate) {
    dominantYearMonth = defaultDate.substring(0, 7);
  }

  if (dominantYearMonth) {
    for (const r of rows) {
      if (r.isInstallment && r.date.substring(0, 7) < dominantYearMonth) {
        const day = r.date.substring(8, 10);
        r.originalPurchaseDate = r.date;
        r.date = `${dominantYearMonth}-${day}`;
      }
    }
  }

  return rows;
}

/**
 * Lê um arquivo PDF de fatura bancária e retorna as compras identificadas
 */
export async function parseInvoicePdf(arrayBuffer: ArrayBuffer, defaultDate?: string): Promise<ParsedCsvRow[]> {
  try {
    const { extractTextFromPdf } = await import('./pdfInvoiceParser');
    const rawPdfText = await extractTextFromPdf(arrayBuffer);
    return parseSmartInvoiceText(rawPdfText, defaultDate);
  } catch (err) {
    console.error('[SmartInvoiceParser] Erro ao processar PDF:', err);
    throw new Error('Não foi possível ler o arquivo PDF. Verifique se o arquivo não está protegido por senha.');
  }
}
