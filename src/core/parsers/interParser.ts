/**
 * Sobra - Parser de Notificações: Banco Inter
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class InterParser implements BankNotificationParser {
  readonly id = 'inter';
  readonly name = 'Banco Inter';
  readonly packageNames = ['br.com.intermedium'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('inter') || combined.startsWith('inter:');
  }

  parse(title: string, text: string, packageName = 'br.com.intermedium'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Pix Recebido (Receita)
    const inMatch = combined.match(/(?:recebeu\s+um\s+pix|pix\s+recebido)(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);
    if (inMatch) {
      const amount = parseBrlCurrency(inMatch[1]);
      if (amount && amount > 0) {
        let sender = inMatch[2] ? inMatch[2].trim() : 'Pix Recebido';
        sender = sender.replace(/\.?\s*seu\s+saldo.*$/i, '').replace(/\.?\s*saldo.*$/i, '').trim();
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

    // 2. Compra de Cartão Inter
    // Ex 1: "Olá, Felipe. Você acaba de comprar R$ 4,49 em PAYPAL *STEAM GAMES. A compra foi no crédito nacional, com o cartão final 5023."
    // Ex 2: "Inter: Compra de R$ 38,90 aprovada no Inter Mastercard em IFOOD. Seu saldo é R$ 850,20"
    const cardMatch = combined.match(/(?:acaba\s+de\s+comprar|compra(?:\s+de)?|você\s+comprou)\s*R\$\s*([\d.,]+)(?:\s+aprovada)?.*?(?:em|na|no)\s+([^.\n]+)/i);
    if (cardMatch) {
      const amount = parseBrlCurrency(cardMatch[1]);
      if (amount && amount > 0) {
        let merchant = cardMatch[2].trim();
        if (merchant.toLowerCase().includes(' em ')) {
          merchant = merchant.split(/\s+em\s+/i).pop() || merchant;
        }
        merchant = merchant
          .replace(/\.?\s*a\s+compra\s+foi.*$/i, '')
          .replace(/\.?\s*com\s+o\s+cart[ãa]o.*$/i, '')
          .replace(/\.?\s*seu\s+saldo.*$/i, '')
          .replace(/\.?\s*saldo.*$/i, '')
          .trim();

        // Extrair últimos 4 dígitos do cartão se houver
        const cardDigitsMatch = combined.match(/(?:cart[ãa]o\s+)?final\s*(\d{4})/i);
        const cardLastDigits = cardDigitsMatch ? cardDigitsMatch[1] : undefined;

        // Determinar débito vs crédito
        const lowerCombined = combined.toLowerCase();
        let paymentMethod: 'credit' | 'debit' = 'credit';
        if (lowerCombined.includes('débito') || lowerCombined.includes('debito')) {
          paymentMethod = 'debit';
        }

        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'expense',
          paymentMethod,
          cardLastDigits,
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 3. Pix Enviado
    const pixOutMatch = combined.match(/pix(?:\s+enviado|\s+de)?(?:\s+de)?\s*R\$\s*([\d.,]+)\s+para\s+([^.\n]+)/i);
    if (pixOutMatch) {
      const amount = parseBrlCurrency(pixOutMatch[1]);
      if (amount && amount > 0) {
        let recipient = pixOutMatch[2].replace(/\.?\s*seu\s+saldo.*$/i, '').replace(/\.?\s*saldo.*$/i, '').trim();
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
