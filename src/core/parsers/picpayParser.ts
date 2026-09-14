/**
 * Sobra - Parser de Notificações: PicPay
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class PicPayParser implements BankNotificationParser {
  readonly id = 'picpay';
  readonly name = 'PicPay';
  readonly packageNames = ['com.picpay'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('picpay') || combined.startsWith('picpay:');
  }

  parse(title: string, text: string, packageName = 'com.picpay'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Recebeu dinheiro / Pix
    // Ex: "PicPay: Você recebeu R$ 70,00 de MARIANA COSTA via Pix. Saldo em carteira: R$ 320,00"
    const inMatch = combined.match(/(?:recebeu|recebido)(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+?)(?:\s+via\s+pix)?)?(?:$|\.)/i);
    if (inMatch) {
      const amount = parseBrlCurrency(inMatch[1]);
      if (amount && amount > 0) {
        let sender = inMatch[2] ? inMatch[2].replace(/via\s+pix/i, '').trim() : 'Transferência Recebida';
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
    // Ex: "PicPay: Pagamento de R$ 38,50 aprovado em RESTAURANTE ABC. Saldo em carteira: R$ 340,00"
    const outMatch = combined.match(/(?:pagamento(?:\s+de)?|compra(?:\s+aprovada)?)\s*R\$\s*([\d.,]+).*?(?:em|na|no|para)\s+([^.\n]+)/i);
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
