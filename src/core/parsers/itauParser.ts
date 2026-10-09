/**
 * Sobra - Parser de Notificações: Itaú
 * Suporte a Cartão de Crédito, TED, Pix e Detecção de Saldo
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class ItauParser implements BankNotificationParser {
  readonly id = 'itau';
  readonly name = 'Banco Itaú';
  readonly packageNames = ['com.itau', 'com.itau.personnalite', 'com.itau.cartoes'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('itaú') || combined.includes('itau');
  }

  parse(title: string, text: string, packageName = 'com.itau'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. TED / Pix Recebido (Receita)
    // Ex: "Itaú: TED recebida no valor de R$ 1.500,00 de EMPRESA LTDA"
    // Ex: "Itaú: Você recebeu um Pix de R$ 75,00 de Lucas"
    const inMatch =
      combined.match(/(?:ted|pix|transfer[êe]ncia)\s+recebida?(?:\s+no\s+valor)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i) ||
      combined.match(/(?:recebeu\s+(?:um\s+)?pix|pix\s+recebido)(?:\s+no\s+valor)?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i) ||
      combined.match(/recebeu\s+R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);

    if (inMatch) {
      const amount = parseBrlCurrency(inMatch[1]);
      if (amount && amount > 0) {
        let sender = inMatch[2] ? inMatch[2].trim() : 'Transferência Recebida';
        sender = sender.replace(/\.?\s*saldo.*$/i, '').trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: sender,
          type: 'income',
          paymentMethod: combined.toLowerCase().includes('pix') ? 'pix' : 'transfer',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 2. Pix Realizado (Despesa)
    // Ex: "Itaú: Pix de R$ 45,00 realizado para SUPERMERCADO ABC"
    // Ex: "Itaú: Você enviou um Pix de R$ 50,00 para João"
    const pixOutMatch =
      combined.match(/pix(?:\s+no\s+valor)?\s+de\s*R\$\s*([\d.,]+)\s+realizado\s+para\s+([^.\n]+)/i) ||
      combined.match(/(?:transferiu|pix\s+enviado|fez\s+um\s+pix|enviou\s+um\s+pix)(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+para\s+([^.\n]+))?/i);

    if (pixOutMatch) {
      const amount = parseBrlCurrency(pixOutMatch[1]);
      if (amount && amount > 0) {
        let merchant = (pixOutMatch[2] || 'Pix Enviado').replace(/\.?\s*saldo.*$/i, '').trim();
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

    // 3. Compra aprovada no cartão
    // Ex: "Itaú: Compra aprovada no cartão final 1234 valor R$ 89,90 no RESTAURANTE SABOR"
    const isReceiving = /(?:recebeu|recebido|creditado)/i.test(combined);
    const textWithoutInst = combined
      .replace(/(?:em|parcelad[oa]\s+em)?\s*\d{1,2}\s*[xX](?:\s+de\s*R\$\s*[\d.,]+)?/gi, ' ')
      .replace(/(?:parcela\s+)?\d{1,2}\s*(?:\/|\s+de\s+)\d{1,2}\s*[xX]?/gi, ' ');
    const cartaoMatch = !isReceiving && textWithoutInst.match(/compra\s+aprovada.*?(?:valor|de)\s*R\$\s*([\d.,]+).*?(?:no|em|na)\s+([^.\n]+)/i);
    if (cartaoMatch) {
      const amount = parseBrlCurrency(cartaoMatch[1]);
      if (amount && amount > 0) {
        let merchant = cartaoMatch[2].trim();
        merchant = merchant.replace(/^cartão\s+final\s+\d+\s+(?:no|em|na)\s+/i, '');
        if (merchant.toLowerCase().includes(' em ')) merchant = merchant.split(/\s+em\s+/i).pop() || merchant;
        if (merchant.toLowerCase().includes(' no ')) merchant = merchant.split(/\s+no\s+/i).pop() || merchant;
        if (merchant.toLowerCase().includes(' na ')) merchant = merchant.split(/\s+na\s+/i).pop() || merchant;
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

    return null;
  }
}
