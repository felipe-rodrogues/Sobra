/**
 * Sobra - Parser Inteligente de Extrato Bancário e Faturas em CSV
 * Suporta formatos de bancos brasileiros e internacionais:
 * Nubank, Itaú, Bradesco, Inter, Santander, BB, Caixa, C6, etc.
 * Compatível com RFC 4180 (aspas, vírgulas decimais, quebras e delimitadores dinâmicos).
 */

import { parseBrlCurrency } from './currencyHelper';
import { PaymentMethod } from '../types';
import { merchantCleaner } from '../categorization/merchantCleaner';

export interface ParsedCsvRow {
  date: string; // ISO YYYY-MM-DD
  description: string;
  cleanDescription: string;
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: PaymentMethod;
  raw: string;
  isInstallment?: boolean;
  installmentNumber?: number;
  installmentTotal?: number;
  isInvoicePayment?: boolean;
  isRefund?: boolean;
  bankCategory?: string;
}

export interface CsvParseResult {
  success: boolean;
  rows: ParsedCsvRow[];
  totalRows: number;
  errors: string[];
}

/**
 * Tokenizer RFC 4180 que respeita campos entre aspas contendo delimitadores ou vírgulas decimais
 */
export function parseCsvLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ''));
  return result;
}

/**
 * Extrai informações de parcelamento embutidas na descrição
 * Ex: "Obramax - Parcela 1/3" -> { isInstallment: true, installmentNumber: 1, installmentTotal: 3, cleanDescription: "Obramax" }
 */
export function extractInstallmentFromDescription(text: string): {
  isInstallment: boolean;
  installmentNumber?: number;
  installmentTotal?: number;
  cleanDescription: string;
} {
  if (!text) return { isInstallment: false, cleanDescription: text };

  // Padrões como:
  // " - Parcela 1/3", " Parcela 1/3", " (1/3)", " 1/3", " - 1/3", " Parcela 1 de 3"
  const match = text.match(/(?:[-–—\s]+)?(?:\(?\s*parcela\s+)?(\d{1,2})\s*(?:\/|\s+de\s+)(\d{1,2})\s*(?:[xX]|\)?)/i);
  if (match) {
    const cur = parseInt(match[1], 10);
    const tot = parseInt(match[2], 10);
    if (tot >= 2 && tot <= 48 && cur >= 1 && cur <= tot) {
      const cleaned = text.replace(/(?:[-–—\s]+)?(?:\(?\s*parcela\s+)?\d{1,2}\s*(?:\/|\s+de\s+)\d{1,2}\s*(?:[xX]|\)?)/i, '').trim();
      return {
        isInstallment: true,
        installmentNumber: cur,
        installmentTotal: tot,
        cleanDescription: cleaned || text,
      };
    }
  }

  return { isInstallment: false, cleanDescription: text };
}

/**
 * Identifica se a linha é um pagamento de fatura anterior (ex: "Pagamento recebido" no Nubank)
 */
export function isInvoicePaymentDescription(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('pagamento recebido') ||
    lower.includes('pagamento de fatura') ||
    lower.includes('pgto fatura') ||
    lower.includes('pgto recebido') ||
    lower.includes('pagamento efetuado') ||
    lower.includes('pagamento fatura') ||
    lower.includes('pagamento debito automatico') ||
    lower.includes('pagamento boleto fatura') ||
    (lower.includes('pagamento') && lower.includes('fatura'))
  );
}

/**
 * Identifica se a linha é um estorno / reembolso / cashback
 */
export function isRefundDescription(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('estorno') ||
    lower.includes('reembolso') ||
    lower.includes('cancelamento de compra') ||
    lower.includes('cancelamento') ||
    lower.includes('devolução') ||
    lower.includes('devolucao') ||
    lower.includes('cashback')
  );
}

/**
 * Analisa o conteúdo CSV do extrato bancário ou fatura de cartão
 */
export function parseBankCsv(csvContent: string): CsvParseResult {
  const errors: string[] = [];
  const rows: ParsedCsvRow[] = [];

  if (!csvContent || csvContent.trim().length === 0) {
    return { success: false, rows: [], totalRows: 0, errors: ['Arquivo CSV vazio'] };
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    return { success: false, rows: [], totalRows: 0, errors: ['O arquivo deve conter cabeçalho e ao menos uma linha de dados'] };
  }

  // Procurar a linha de cabeçalho nos primeiros 15 registros (alguns bancos como BB/Caixa colocam metadados antes)
  let headerLineIndex = -1;
  let separator = ';';
  let dateIdx = -1;
  let amountIdx = -1;
  let creditIdx = -1;
  let debitIdx = -1;
  let descIdx = -1;
  let catIdx = -1;
  let headers: string[] = [];

  for (let idx = 0; idx < Math.min(lines.length, 15); idx++) {
    const candidateLine = lines[idx];
    const candidateSep = (candidateLine.match(/;/g) || []).length >= (candidateLine.match(/,/g) || []).length ? ';' : ',';
    const candidateHeaders = parseCsvLine(candidateLine, candidateSep).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    const dIdx = candidateHeaders.findIndex(h => 
      h.includes('data') || h.includes('date') || h === 'dt'
    );
    const aIdx = candidateHeaders.findIndex(h => 
      h.includes('valor') || h.includes('amount') || h.includes('quantia') || h.includes('value')
    );
    const cIdx = candidateHeaders.findIndex(h => 
      h.includes('crédito') || h.includes('credito') || h.includes('credit')
    );
    const debIdx = candidateHeaders.findIndex(h => 
      h.includes('débito') || h.includes('debito') || h.includes('debit')
    );

    if (dIdx !== -1 && (aIdx !== -1 || (cIdx !== -1 && debIdx !== -1))) {
      headerLineIndex = idx;
      separator = candidateSep;
      headers = candidateHeaders;
      dateIdx = dIdx;
      amountIdx = aIdx;
      creditIdx = cIdx;
      debitIdx = debIdx;
      
      descIdx = candidateHeaders.findIndex(h => 
        h.includes('title') ||
        h.includes('título') || 
        h.includes('titulo') || 
        h.includes('desc') || 
        h.includes('merchant') ||
        h.includes('estabelecimento') ||
        h.includes('nome') ||
        h.includes('name') ||
        h.includes('payee') ||
        h.includes('favorecido') ||
        h.includes('beneficiario') ||
        h.includes('beneficiário') ||
        h.includes('identificador') || 
        h.includes('hist') || 
        h.includes('lança') || 
        h.includes('lanca') || 
        h.includes('detalhe') ||
        h.includes('memo') ||
        h.includes('origem') ||
        h.includes('transacao') ||
        h.includes('transação') ||
        h.includes('summary')
      );

      catIdx = candidateHeaders.findIndex(h => 
        h.includes('cat') || h.includes('categoria') || h.includes('category')
      );

      // Fallback inteligente: se não encontrou descrição nomeada explicitamente,
      // usa a primeira coluna que não seja data, valor, crédito, débito ou categoria
      if (descIdx === -1) {
        descIdx = candidateHeaders.findIndex((_, colI) => 
          colI !== dIdx && colI !== aIdx && colI !== cIdx && colI !== debIdx && colI !== catIdx
        );
      }

      break;
    }
  }

  if (headerLineIndex === -1 || dateIdx === -1) {
    return {
      success: false,
      rows: [],
      totalRows: lines.length - 1,
      errors: ['Não foi possível identificar as colunas de Data e/ou Valor no cabeçalho.'],
    };
  }

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    
    // Tratamento de aspas duplas no split via parser RFC 4180
    const columns = parseCsvLine(rawLine, separator);
    if (columns.length <= dateIdx) {
      continue;
    }

    const rawDate = columns[dateIdx];
    let rawAmount = amountIdx !== -1 ? (columns[amountIdx] || '') : '';
    let isCredit = false;
    let isDebit = false;

    // Se o banco separa em coluna de Crédito e Débito (ex: Bradesco)
    if (amountIdx === -1 && creditIdx !== -1 && debitIdx !== -1) {
      const creditVal = columns[creditIdx] || '';
      const debitVal = columns[debitIdx] || '';
      if (creditVal && creditVal !== '0' && creditVal !== '0,00') {
        rawAmount = creditVal;
        isCredit = true;
      } else if (debitVal && debitVal !== '0' && debitVal !== '0,00') {
        rawAmount = debitVal;
        isDebit = true;
      }
    }

    if (!rawAmount) continue;

    const rawDesc = descIdx !== -1 && columns[descIdx] ? columns[descIdx].trim() : `Transação #${i}`;
    const bankCategory = catIdx !== -1 && columns[catIdx] ? columns[catIdx].trim() : undefined;

    // Normalizar data (DD/MM/YYYY para YYYY-MM-DD ou já ISO)
    let parsedDate = '';
    const brDateMatch = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (brDateMatch) {
      const day = brDateMatch[1].padStart(2, '0');
      const month = brDateMatch[2].padStart(2, '0');
      const year = brDateMatch[3];
      parsedDate = `${year}-${month}-${day}`;
    } else if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      parsedDate = rawDate.substring(0, 10);
    } else {
      parsedDate = new Date().toISOString().substring(0, 10);
    }

    // Normalizar valor e sinal
    const numericAmount = parseBrlCurrency(rawAmount);
    if (numericAmount === null || numericAmount === 0) {
      continue;
    }

    const isRawNegative = numericAmount < 0;
    const absAmount = Math.abs(numericAmount);

    const isInvoicePayment = isInvoicePaymentDescription(rawDesc);
    const isRefund = isRefundDescription(rawDesc);

    // Detecção e extração de parcelas
    const installmentData = extractInstallmentFromDescription(rawDesc);
    const cleanedDesc = merchantCleaner.stripBankNoise(installmentData.cleanDescription);

    const lowerDesc = rawDesc.toLowerCase();
    const isKnownIncome = lowerDesc.includes('salário') || 
                          lowerDesc.includes('salario') ||
                          lowerDesc.includes('pix recebido') || 
                          lowerDesc.includes('ted recebida') ||
                          lowerDesc.includes('doc recebido') ||
                          lowerDesc.includes('depósito') ||
                          lowerDesc.includes('deposito') ||
                          lowerDesc.includes('rendimento');

    let type: 'income' | 'expense' = 'expense';
    if (isDebit) {
      type = 'expense';
    } else if (isCredit) {
      type = 'income';
    } else if (isRefund || isInvoicePayment || isKnownIncome) {
      type = 'income';
    } else if (isRawNegative) {
      type = 'expense';
    } else if (headers.includes('tipo') || rawAmount.startsWith('+')) {
      type = 'income';
    }

    rows.push({
      date: parsedDate,
      description: rawDesc,
      cleanDescription: cleanedDesc || rawDesc,
      amount: absAmount,
      type,
      paymentMethod: lowerDesc.includes('pix') ? 'pix' : 'other',
      raw: rawLine,
      isInstallment: installmentData.isInstallment,
      installmentNumber: installmentData.installmentNumber,
      installmentTotal: installmentData.installmentTotal,
      isInvoicePayment,
      isRefund,
      bankCategory,
    });
  }

  return {
    success: rows.length > 0,
    rows,
    totalRows: lines.length - (headerLineIndex + 1),
    errors,
  };
}
