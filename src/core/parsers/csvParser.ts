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

  // Detectar separador: vírgula ou ponto-e-vírgula
  const headerLine = lines[0];
  const separator = (headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length ? ';' : ',';

  // Analisar cabeçalhos
  const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

  // Identificar índices das colunas essenciais
  const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
  const amountIdx = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('quantia'));
  const descIdx = headers.findIndex(h => 
    h.includes('desc') || 
    h.includes('identificador') || 
    h.includes('título') || 
    h.includes('titulo') || 
    h.includes('estabelecimento') ||
    h.includes('memo')
  );

  if (dateIdx === -1 || amountIdx === -1) {
    return {
      success: false,
      rows: [],
      totalRows: lines.length - 1,
      errors: ['Não foi possível identificar as colunas de Data e/ou Valor no cabeçalho.'],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    
    // Tratamento de aspas duplas no split
    const columns = rawLine.split(separator).map(col => col.trim().replace(/^"|"$/g, ''));
    if (columns.length <= Math.max(dateIdx, amountIdx)) {
      continue;
    }

    const rawDate = columns[dateIdx];
    const rawAmount = columns[amountIdx];
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
    // Em alguns CSVs (ex: Nubank Cartão), compras vêm com valor positivo, mas a descrição ou tipo define
    const lowerDesc = rawDesc.toLowerCase();
    const isKnownIncome = lowerDesc.includes('salário') || 
                          lowerDesc.includes('pix recebido') || 
                          lowerDesc.includes('ted recebida') ||
                          lowerDesc.includes('rendimento');

    let type: 'income' | 'expense' = 'expense';
    if (isExplicitNegative) {
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
    totalRows: lines.length - 1,
    errors,
  };
}
