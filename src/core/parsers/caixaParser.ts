/**
 * Sobra - Parser de Notificações: Caixa Econômica Federal (CAIXA)
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class CaixaParser implements BankNotificationParser {
  readonly id = 'caixa';
  readonly name = 'Caixa Econômica';
  readonly packageNames = ['br.com.gabba.Caixa'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('caixa') || combined.startsWith('caixa:');
  }

  parse(title: string, text: string, packageName = 'br.com.gabba.Caixa'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Pix Recebido (Receita)
    const inMatch = combined.match(/(?:pix\s+recebido|recebeu\s+um\s+pix)(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);
    if (inMatch) {
      const amount = parseBrlCurrency(inMatch[1]);
      if (amount && amount > 0) {
        let sender = inMatch[2] ? inMatch[2].trim() : 'Pix Recebido';
        sender = sender.replace(/\.?\s*saldo.*$/i, '').trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: sender,
          type: 'income',
          paymentMethod: 'pix',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 2. Compra de Cartão Caixa
    const cardMatch = combined.match(/compra\s+aprovada.*?(?:de|valor)?\s*R\$\s*([\d.,]+).*?(?:em|na|no)\s+([^.\n]+)/i);
    if (cardMatch) {
      const amount = parseBrlCurrency(cardMatch[1]);
      if (amount && amount > 0) {
        let merchant = cardMatch[2].replace(/\.?\s*(?:no\s+cartao.*|saldo.*)$/i, '').trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'expense',
          paymentMethod: 'credit',
          detectedBalance,
          confidence: 0.92,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 3. Pix Enviado
    const pixOutMatch = combined.match(/pix(?:\s+de)?\s*R\$\s*([\d.,]+)\s+(?:enviado|realizado)\s+para\s+([^.\n]+)/i);
    if (pixOutMatch) {
      const amount = parseBrlCurrency(pixOutMatch[1]);
      if (amount && amount > 0) {
        let recipient = pixOutMatch[2].replace(/\.?\s*saldo.*$/i, '').trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: recipient,
          type: 'expense',
          paymentMethod: 'pix',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return null;
  }
}
