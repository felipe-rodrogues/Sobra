/**
 * Sobra - Parser de Notificações: Mercado Pago
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class MercadoPagoParser implements BankNotificationParser {
  readonly id = 'mercadopago';
  readonly name = 'Mercado Pago';
  readonly packageNames = ['com.mercadopago.wallet'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('mercado pago') || combined.includes('mercadopago');
  }

  parse(title: string, text: string, packageName = 'com.mercadopago.wallet'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Recebeu dinheiro / Pix
    const inMatch = combined.match(/(?:recebeu|recebido)(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+(?:de|via\s+pix\s+de)\s+([^.\n]+))?/i);
    if (inMatch) {
      const amount = parseBrlCurrency(inMatch[1]);
      if (amount && amount > 0) {
        let sender = inMatch[2] ? inMatch[2].trim() : 'Dinheiro Recebido';
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

    // 2. Pagamento efetuado / Compra
    // Ex: "Mercado Pago: Você pagou R$ 45,00 em PADARIA CENTRAL. Saldo disponível: R$ 560,00"
    const outMatch = combined.match(/(?:pagou|compra\s+aprovada)(?:\s+de)?\s*R\$\s*([\d.,]+).*?(?:em|na|no|para)\s+([^.\n]+)/i);
    if (outMatch) {
      const amount = parseBrlCurrency(outMatch[1]);
      if (amount && amount > 0) {
        let merchant = outMatch[2].replace(/\.?\s*saldo.*$/i, '').trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
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
