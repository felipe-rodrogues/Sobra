/**
 * Sobra - Parser de Notificações: Nubank
 * Suporte a Crédito, Débito, Pix e Detecção de Saldo
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class NubankParser implements BankNotificationParser {
  readonly id = 'nubank';
  readonly name = 'Nubank';
  readonly packageNames = ['com.nu.production', 'com.nubank'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('nubank') || (combined.includes('nu') && combined.includes('compra'));
  }

  parse(title: string, text: string, packageName = 'com.nu.production'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Pix Recebido (Receita)
    // Ex: "Você recebeu uma transferência Pix de R$ 300,00 de Maria Souza"
    const pixInMatch = combined.match(/(?:recebeu\s+(?:uma\s+transferência\s+)?(?:pix\s+)?de|pix\s+recebido(?:\s+de)?)\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);
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

    // 2. Pix Enviado (Despesa)
    // Ex: "Você transferiu R$ 150,00 para João da Silva pelo Pix"
    const pixOutMatch = combined.match(/(?:transferiu|pix\s+enviado(?:\s+de)?)\s*R\$\s*([\d.,]+)(?:\s+para\s+([^.\n]+?)(?:\s+pelo\s+pix)?)?(?:$|\.)/i);
    if (pixOutMatch) {
      const amount = parseBrlCurrency(pixOutMatch[1]);
      if (amount && amount > 0) {
        let recipient = pixOutMatch[2] ? pixOutMatch[2].replace(/pelo\s+pix/i, '').trim() : 'Pix Enviado';
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

    // 3. Compra Débito
    // Ex: "Compra no débito de R$ 32,00 aprovada em PADARIA"
    const debitMatch = combined.match(/compra\s+(?:no\s+)?d[ée]bito(?:\s+de)?\s*R\$\s*([\d.,]+)\s+aprovada\s+em\s+([^.\n]+)/i);
    if (debitMatch) {
      const amount = parseBrlCurrency(debitMatch[1]);
      if (amount && amount > 0) {
        let merchant = debitMatch[2].replace(/\.?\s*saldo.*$/i, '').trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'expense',
          paymentMethod: 'debit',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 4. Compra Crédito (ou genérica do cartão Nubank)
    // Ex: "Compra de R$ 45,90 aprovada em PADARIA ESTRELA"
    // Ex: "Compra aprovada no seu Nubank de R$ 45,90 em PADARIA ESTRELA"
    const creditMatch = combined.match(/compra(?:\s+aprovada)?(?:\s+no\s+seu\s+nubank)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+aprovada)?\s+em\s+([^.\n]+)/i);
    if (creditMatch) {
      const amount = parseBrlCurrency(creditMatch[1]);
      if (amount && amount > 0) {
        let merchant = creditMatch[2].replace(/\.?\s*saldo.*$/i, '').trim();
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
