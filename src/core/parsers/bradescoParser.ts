/**
 * Sobra - Parser de Notificações: Bradesco
 * Suporte a Cartões, Pix e Detecção de Saldo
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class BradescoParser implements BankNotificationParser {
  readonly id = 'bradesco';
  readonly name = 'Banco Bradesco';
  readonly packageNames = ['com.bradesco', 'com.bradesco.cartoes', 'br.com.bradesco.next'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('bradesco') || combined.includes('next');
  }

  parse(title: string, text: string, packageName = 'com.bradesco'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Pix Recebido (Receita)
    const pixInMatch = combined.match(/pix\s+recebido(?:\s+no\s+valor)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);
    if (pixInMatch) {
      const amount = parseBrlCurrency(pixInMatch[1]);
      if (amount && amount > 0) {
        let sender = pixInMatch[2] ? pixInMatch[2].trim() : 'Pix Recebido';
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

    // 2. Pix Realizado (Despesa)
    const pixOutMatch = combined.match(/pix\s+realizado(?:\s+de)?\s*R\$\s*([\d.,]+)\s+para\s+([^.\n]+)/i);
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

    // 3. Compra de Cartão
    // Ex: "Bradesco Cartões: Compra de R$ 120,50 aprovada em POSTO IPIRANGA"
    const cartaoMatch = combined.match(/compra(?:\s+aprovada)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+aprovada)?\s+em\s+([^.\n]+)/i);
    if (cartaoMatch) {
      const amount = parseBrlCurrency(cartaoMatch[1]);
      if (amount && amount > 0) {
        let merchant = cartaoMatch[2].replace(/\.?\s*saldo.*$/i, '').trim();
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
