/**
 * Sobra - Parser de Notificações: PicPay
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

export class PicPayParser implements BankNotificationParser {
  readonly id = 'picpay';
  readonly name = 'PicPay';
  readonly packageNames = ['com.picpay', 'com.picpay.wallet', 'com.picpay.business'];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (this.packageNames.includes(packageName)) return true;
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('picpay') || combined.startsWith('picpay:');
  }

  parse(title: string, text: string, packageName = 'com.picpay'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // 1. Notificação de Cashback (ex: "Você ganhou R$ 12,50 de cashback da sua compra.")
    const cashbackMatch = combined.match(/(?:ganhou|recebeu)(?:\s+de)?\s*R\$\s*([\d.,]+)\s+de\s+cashback/i) ||
                          combined.match(/cashback.*?R\$\s*([\d.,]+)/i);
    if (cashbackMatch) {
      const amount = parseBrlCurrency(cashbackMatch[1]);
      if (amount && amount > 0) {
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: 'PicPay (Cashback)',
          type: 'income',
          paymentMethod: 'other',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 2. Recebeu dinheiro / Pix
    // Ex: "PicPay: Você recebeu R$ 70,00 de MARIANA COSTA via Pix. Saldo em carteira: R$ 320,00"
    // Ex: "Você recebeu um Pix de R$ 250,00 de Carlos Silva"
    const inMatch = combined.match(/(?:recebeu|recebido)(?:\s+(?:um\s+)?(?:pix|transfer[êe]ncia))?(?:\s+de)?\s*R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+?)(?:\s+via\s+pix)?)?(?:$|\.)/i);
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

    // 3. Pagamento efetuado / Compra aprovada
    // Ex: "PicPay: Pagamento de R$ 38,50 aprovado em RESTAURANTE ABC."
    // Ex: "Você garantiu 1,3% de cashback!: Compra de R$ 32,50 em Mega Pet House APROVADA."
    // Ex: "PicPay Card: Compra de R$ 94,50 aprovada no seu PicPay Card de crédito em LOJA TESTE"
    const outMatch = combined.match(/(?:pagamento(?:\s+de)?|compra(?:\s+aprovada)?)\s*(?:de\s*)?R\$\s*([\d.,]+)/i);
    if (outMatch) {
      const amount = parseBrlCurrency(outMatch[1]);
      if (amount && amount > 0) {
        // Limpar menções a "no seu PicPay Card..." antes de extrair o merchant
        const cleanedText = combined
          .replace(/no\s+seu\s+picpay(?:\s+card)?(?:\s+de\s+(?:cr[ée]dito|d[ée]bito))?/i, '')
          .replace(/no\s+cart[ãa]o(?:\s+final\s+\d+)?(?:\s+de\s+(?:cr[ée]dito|d[ée]bito))?/i, '');

        let merchant = 'Estabelecimento';
        const merchantMatch = cleanedText.match(/(?:em|na|no|para)\s+([^.\n]+)/i);
        if (merchantMatch) {
          merchant = merchantMatch[1]
            .replace(/\.?\s*saldo.*$/i, '')
            .replace(/\s+(?:aprovad[ao]|autorizad[ao]|confirmad[ao])\.?$/i, '')
            .trim();
        }

        // Determina a forma de pagamento: se fala em cashback, cartão ou crédito -> credit
        let paymentMethod: 'credit' | 'debit' | 'pix' = 'credit';
        if (/via\s+pix|pelo\s+pix/i.test(combined)) {
          paymentMethod = 'pix';
        } else if (/no\s+d[ée]bito|saldo\s+em\s+carteira/i.test(combined) && !/cart[ãa]o|cr[ée]dito|cashback/i.test(combined)) {
          paymentMethod = 'debit';
        }

        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'expense',
          paymentMethod,
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
