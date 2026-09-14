/**
 * Sobra - Parser de Notificações Heurístico Genérico
 * Usado como fallback extensível para qualquer banco
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class GenericBankParser implements BankNotificationParser {
  readonly id = 'generic';
  readonly name = 'Outro Banco';
  readonly packageNames = [];

  canHandle(): boolean {
    return true; // Fallback genérico
  }

  parse(title: string, text: string, packageName = 'generic'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // Procurar por padrão de moeda brasileira
    const currencyMatch = combined.match(/R\$\s*([\d.,]+)/i);
    if (!currencyMatch) return null;

    const amount = parseBrlCurrency(currencyMatch[1]);
    if (!amount || amount <= 0) return null;

    // Detectar tipo: receita vs despesa
    const lower = combined.toLowerCase();
    const isIncome = lower.includes('recebido') || 
                     lower.includes('recebeu') || 
                     lower.includes('depósito') || 
                     lower.includes('salário') ||
                     lower.includes('ted recebida');

    // Detectar método de pagamento
    let paymentMethod: 'credit' | 'debit' | 'pix' | 'other' = 'credit';
    if (lower.includes('pix')) {
      paymentMethod = 'pix';
    } else if (lower.includes('débito') || lower.includes('debito')) {
      paymentMethod = 'debit';
    }

    // Tentar extrair estabelecimento / destinatário com heurísticas comuns
    let merchant = 'Estabelecimento Desconhecido';
    const merchantMatch = combined.match(/(?:em|na|no|para|de)\s+([A-Z0-9\s.,'&-]{3,35})(?:$|\.|\s-\s)/i);
    if (merchantMatch) {
      merchant = merchantMatch[1].replace(/\.?\s*saldo.*$/i, '').trim();
    } else if (title && title.length > 2 && !title.toLowerCase().includes('banco')) {
      merchant = title.trim();
    }

    return {
      bankId: this.id,
      bankName: this.name,
      amount,
      merchant,
      type: isIncome ? 'income' : 'expense',
      paymentMethod,
      detectedBalance,
      confidence: 0.7,
      rawTitle: title,
      rawText: text,
      timestamp: new Date().toISOString(),
    };
  }
}
