/**
 * Sobra - Parser de Notificações: Banco do Brasil (BB)
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class BbParser implements BankNotificationParser {
  readonly id = 'bb';
  readonly name = 'Banco do Brasil';
  readonly packageNames = ['br.com.bb.android'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('banco do brasil') || combined.includes('ourocard') || combined.startsWith('bb:');
  }

  parse(title: string, text: string, packageName = 'br.com.bb.android'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Pix Recebido (Receita)
    const inMatch = combined.match(/(?:pix\s+recebido|ted\s+recebida)(?:\s+no\s+valor)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);
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

    // 2. Pix / Transferência enviada
    const outMatch = combined.match(/(?:pix\s+enviado|transferência\s+realizada)(?:\s+no\s+valor)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+para\s+([^.\n]+))?/i);
    if (outMatch) {
      const amount = parseBrlCurrency(outMatch[1]);
      if (amount && amount > 0) {
        let recipient = outMatch[2] ? outMatch[2].trim() : 'Pix Enviado';
        recipient = recipient.replace(/\.?\s*saldo.*$/i, '').trim();
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

    // 3. Compra com Cartão Ourocard
    const cardMatch = combined.match(/compra.*?(?:valor\s+de|de)\s*R\$\s*([\d.,]+).*?(?:em|na|no)\s+([^.\n]+)/i);
    if (cardMatch) {
      const amount = parseBrlCurrency(cardMatch[1]);
      if (amount && amount > 0) {
        let merchant = cardMatch[2].replace(/\.?\s*saldo.*$/i, '').trim();
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

    return null;
  }
}
