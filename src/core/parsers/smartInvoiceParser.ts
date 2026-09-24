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
  /^limite\s+(total|dispon[ií]vel)/i,
  /^vencimento/i,
  /^data\s+de\s+vencimento/i,
  /^p[aá]gina\s+\d+/i,
  /^resumo\s+da\s+fatura/i,
  /^demonstrativo/i,
  /^saldo\s+(anterior|atual)/i,
  /^central\s+de\s+atendimento/i,
  /^ouvidoria/i,
  /^cnpj/i,
  /^fatura\s+fechada/i,
  /^compras\s+e\s+lan[çc]amentos/i,
  /^movimenta[çc][õo]es/i,
  /^lan[çc]amentos\s+nacionais/i,
  /^lan[çc]amentos\s+internacionais/i,
  /^\d{4}\s+\d{4}\s+\d{4}/, // número de cartão
  /^banco\s+/i,
];

/**
 * Tenta extrair a data de uma linha de texto.
 * Formatos suportados: DD/MM/AAAA, DD/MM/AA, DD/MM, DD-MM-AAAA, DD de Mês, DD MMM
 */
function extractDateFromLine(line: string, defaultYear = new Date().getFullYear()): { date: string; remainingText: string } | null {
  // 1. Formato DD/MM/AAAA ou DD/MM/AA ou DD-MM-AAAA
  const numericDateMatch = line.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numericDateMatch) {
    const d = numericDateMatch[1].padStart(2, '0');
    const m = numericDateMatch[2].padStart(2, '0');
    let y = defaultYear.toString();
    if (numericDateMatch[3]) {
      y = numericDateMatch[3].length === 2 ? `20${numericDateMatch[3]}` : numericDateMatch[3];
    }
    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      const remaining = line.replace(numericDateMatch[0], '').trim();
      return { date: `${y}-${m}-${d}`, remainingText: remaining };
    }
  }

  // 2. Formato por extenso ou abreviado: 12 OUT ou 12 de Outubro
  const textualDateMatch = line.match(/\b(\d{1,2})(?:\s+de)?\s+([A-Za-zçÇ]{3,9})(?:\s+(\d{2,4}))?\b/i);
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

  return null;
}

/**
 * Tenta extrair o valor monetário de uma linha.
 * Suporta: R$ 1.234,56 / 1234,56 / 45,90 / 45.90 / R$ 150
 */
function extractAmountFromLine(line: string): { amount: number; isNegative: boolean; remainingText: string } | null {
  // Padrão 1: Valores com R$ explícito (ex: R$ 120,50 ou R$ -45,00)
  const currencyMatch = line.match(/(?:R\$\s*)([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:\.\d{2})|[+-]?\s*\d+,\d{2}|[+-]?\s*\d+)/i);
  if (currencyMatch) {
    const rawVal = currencyMatch[1].replace(/\s+/g, '');
    const num = parseBrlCurrency(rawVal);
    if (num !== null && num !== 0) {
      const remaining = line.replace(currencyMatch[0], '').trim();
      return { amount: Math.abs(num), isNegative: num < 0 || line.includes('-' + currencyMatch[0]), remainingText: remaining };
    }
  }

  // Padrão 2: Valor no fim da linha ou isolado com vírgula ou ponto decimal
  // Ex: "Paiva Hortifruti 28,00" ou "Obramax 85,46"
  const endAmountMatch = line.match(/([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:\.\d{2})|[+-]?\s*\d+,\d{2})\s*$/);
  if (endAmountMatch) {
    const rawVal = endAmountMatch[1].replace(/\s+/g, '');
    const num = parseBrlCurrency(rawVal);
    if (num !== null && num !== 0) {
      const remaining = line.substring(0, line.lastIndexOf(endAmountMatch[0])).trim();
      return { amount: Math.abs(num), isNegative: num < 0, remainingText: remaining };
    }
  }

  // Padrão 3: Qualquer valor decimal restante na linha
  const anyAmountMatch = line.match(/\b([+-]?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+,\d{2}|[+-]?\d+\.\d{2})\b/);
  if (anyAmountMatch) {
    const rawVal = anyAmountMatch[1];
    const num = parseBrlCurrency(rawVal);
    if (num !== null && num !== 0) {
      const remaining = line.replace(anyAmountMatch[0], '').trim();
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

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows: ParsedCsvRow[] = [];
  const todayIso = new Date().toISOString().substring(0, 10);
  const fallbackDate = defaultDate || todayIso;
  const defaultYear = parseInt(fallbackDate.substring(0, 4), 10) || new Date().getFullYear();

  for (const originalLine of rawLines) {
    // 1. Ignora linhas que são ruído evidente de cabeçalho/resumo
    if (NOISE_LINE_PATTERNS.some(p => p.test(originalLine))) {
      continue;
    }

    // 2. Extrai valor
    const amountResult = extractAmountFromLine(originalLine);
    if (!amountResult) {
      // Se a linha não tem valor monetário, não é um lançamento
      continue;
    }

    let lineWithoutAmount = amountResult.remainingText;

    // 3. Extrai data
    let transactionDate = fallbackDate;
    const dateResult = extractDateFromLine(lineWithoutAmount, defaultYear);
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

    // Verifica padrão tradicional "(1/3)" ou "Parcela 2/5"
    const traditionalInstallment = extractInstallmentFromDescription(rawDesc);
    if (traditionalInstallment.isInstallment) {
      isInstallment = true;
      installmentNumber = traditionalInstallment.installmentNumber;
      installmentTotal = traditionalInstallment.installmentTotal;
      rawDesc = traditionalInstallment.cleanDescription;
    }

    // 6. Detecção de quitação de fatura ou reembolso
    const isInvoicePayment = isInvoicePaymentDescription(rawDesc);
    const isRefund = isRefundDescription(rawDesc);

    // 7. Limpeza profissional do nome do estabelecimento
    const cleanDescription = merchantCleaner.stripBankNoise(rawDesc) || rawDesc;

    // 8. Define tipo
    let type: 'income' | 'expense' = 'expense';
    if (isInvoicePayment || isRefund || amountResult.isNegative) {
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
    });
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
