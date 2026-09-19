/**
 * Sobra - Parser de Extrato Bancário em CSV
 * Suporta formatos comuns de bancos brasileiros (Nubank, Itaú, padrão separado por vírgula ou ponto-e-vírgula)
 */

import { parseBrlCurrency } from './currencyHelper';
import { PaymentMethod } from '../types';

export interface ParsedCsvRow {
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: PaymentMethod;
  raw: string;
}

export interface CsvParseResult {
  success: boolean;
  rows: ParsedCsvRow[];
  totalRows: number;
  errors: string[];
}

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
  let headers: string[] = [];

  for (let idx = 0; idx < Math.min(lines.length, 15); idx++) {
    const candidateLine = lines[idx];
    const candidateSep = (candidateLine.match(/;/g) || []).length >= (candidateLine.match(/,/g) || []).length ? ';' : ',';
    const candidateHeaders = candidateLine.split(candidateSep).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    const dIdx = candidateHeaders.findIndex(h => h.includes('data') || h.includes('date'));
    const aIdx = candidateHeaders.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('quantia'));
    const cIdx = candidateHeaders.findIndex(h => h.includes('crédito') || h.includes('credito') || h.includes('credit'));
    const debIdx = candidateHeaders.findIndex(h => h.includes('débito') || h.includes('debito') || h.includes('debit'));

    if (dIdx !== -1 && (aIdx !== -1 || (cIdx !== -1 && debIdx !== -1))) {
      headerLineIndex = idx;
      separator = candidateSep;
      headers = candidateHeaders;
      dateIdx = dIdx;
      amountIdx = aIdx;
      creditIdx = cIdx;
      debitIdx = debIdx;
      descIdx = candidateHeaders.findIndex(h => 
        h.includes('desc') || 
        h.includes('identificador') || 
        h.includes('hist') || 
        h.includes('lança') || 
        h.includes('lanca') || 
        h.includes('título') || 
        h.includes('titulo') || 
        h.includes('estabelecimento') ||
        h.includes('detalhe') ||
        h.includes('memo') ||
        h.includes('origem')
      );
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
    
    // Tratamento de aspas duplas no split
    const columns = rawLine.split(separator).map(col => col.trim().replace(/^"|"$/g, ''));
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

    const rawDesc = descIdx !== -1 && columns[descIdx] ? columns[descIdx] : `Transação #${i}`;

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
    const isExplicitNegative = rawAmount.includes('-');
    const numericAmount = parseBrlCurrency(rawAmount.replace('-', ''));

    if (numericAmount === null || numericAmount === 0) {
      continue;
    }

    // Regra: se o valor no extrato for negativo, é despesa; se for positivo, é receita
    const lowerDesc = rawDesc.toLowerCase();
    const isKnownIncome = lowerDesc.includes('salário') || 
                          lowerDesc.includes('salario') ||
                          lowerDesc.includes('pix recebido') || 
                          lowerDesc.includes('ted recebida') ||
                          lowerDesc.includes('doc recebido') ||
                          lowerDesc.includes('estorno') ||
                          lowerDesc.includes('depósito') ||
                          lowerDesc.includes('deposito') ||
                          lowerDesc.includes('rendimento');

    let type: 'income' | 'expense' = 'expense';
    if (isDebit) {
      type = 'expense';
    } else if (isCredit) {
      type = 'income';
    } else if (isExplicitNegative) {
      type = 'expense';
    } else if (isKnownIncome) {
      type = 'income';
    } else if (!isExplicitNegative && (headers.includes('tipo') || rawAmount.startsWith('+'))) {
      type = 'income';
    }

    rows.push({
      date: parsedDate,
      description: rawDesc,
      amount: Math.abs(numericAmount),
      type,
      paymentMethod: lowerDesc.includes('pix') ? 'pix' : 'other',
      raw: rawLine,
    });
  }

  return {
    success: rows.length > 0,
    rows,
    totalRows: lines.length - (headerLineIndex + 1),
    errors,
  };
}
