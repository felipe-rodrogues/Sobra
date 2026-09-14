/**
 * Sobra - Parser de Notificações: Santander
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class SantanderParser implements BankNotificationParser {
  readonly id = 'santander';
  readonly name = 'Banco Santander';
  readonly packageNames = ['com.santander.app', 'com.santander.way'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('santander') || combined.startsWith('santander:');
  }

  parse(title: string, text: string, packageName = 'com.santander.app'): ParsedBankNotification | null {
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

    // 2. Compra Cartão Santander (SX / Way)
    const cardMatch = combined.match(/compra\s+aprovada(?:\s+de)?\s*R\$\s*([\d.,]+).*?(?:em|na|no)\s+([^.\n]+)/i);
    if (cardMatch) {
      const amount = parseBrlCurrency(cardMatch[1]);
      if (amount && amount > 0) {
        let merchant = cardMatch[2].trim();
        // Se houver "cartao ... em LOJA", pegar apenas após o último "em"
        if (merchant.toLowerCase().includes(' em ')) {
          merchant = merchant.split(/\s+em\s+/i).pop() || merchant;
        }
        merchant = merchant.replace(/\.?\s*saldo.*$/i, '').trim();
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
    const pixOutMatch = combined.match(/pix\s+enviado(?:\s+de)?\s*R\$\s*([\d.,]+)\s+para\s+([^.\n]+)/i);
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
