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

    // Bloqueio de cupons promocionais, campanhas e boletos a vencer/DDA
    if (/(?:cupom|garanta|acima de|expira|v[áa]lido|chegou\s+(?:1\s+|um\s+)?boleto|novo\s+boleto|boleto\s+(?:que\s+)?vence|boleto\s+a\s+vencer|agendar\s+ou|pode\s+agendar)/i.test(combined)) {
      return null;
    }

    // 1. Pagamento efetuado / Compra aprovada
    // IMPORTANTE: Deve vir antes de cashback, pois compras no PicPay Card costumam ter no título:
    // "Você garantiu 1,3% de cashback!: Compra de R$ 39,48 em Servi Supermercados Lt APROVADA."
    // O valor monetário principal é a compra (despesa), e o cashback percentual é apenas um benefício/perk do cartão.
    const outMatch = combined.match(/(?:pagamento(?:\s+de)?|compra(?:\s+aprovada)?)\s*(?:de\s*)?R\$\s*([\d.,]+)/i) ||
                     combined.match(/compra.*?de\s*R\$\s*([\d.,]+).*?(?:aprovad[ao]|autorizad[ao]|confirmad[ao])/i);
    if (outMatch) {
      const amount = parseBrlCurrency(outMatch[1]);
      if (amount && amount > 0) {
        // Limpar menções a "no seu PicPay Card..." antes de extrair o merchant
        const cleanedText = combined
          .replace(/(?:no\s+seu|no|pelo)\s+picpay(?:\s+card)?(?:\s+de\s+(?:cr[ée]dito|d[ée]bito))?/i, '')
          .replace(/no\s+cart[ãa]o(?:\s+final\s+\d+)?(?:\s+de\s+(?:cr[ée]dito|d[ée]bito))?/i, '');

        let merchant = 'Estabelecimento';
        // Procura primeiro pelo merchant logo após o valor / compra (ex: "Compra de R$ 39,48 em LOJA")
        const matchIndex = cleanedText.indexOf(outMatch[0]);
        const textAfterMatch = matchIndex !== -1 ? cleanedText.slice(matchIndex + outMatch[0].length) : cleanedText;

        const merchantMatch = textAfterMatch.match(/(?:em|na|no|para)\s+([^.\n]+)/i) ||
                              cleanedText.match(/(?:em|na|no|para)\s+([^.\n]+)/i);
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
          notificationKind: 'expense',
          paymentMethod,
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
          notificationKind: 'income',
          paymentMethod: 'pix',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 3. Notificação de Cashback genuíno (crédito em dinheiro de cashback na conta)
    // Ex: "Você ganhou R$ 12,50 de cashback da sua compra."
    // Ex: "Cashback recebido: R$ 5,00"
    // NOTA: Ignora títulos/textos com percentual como "1,3% de cashback"
    const cashbackMatch = combined.match(/(?:ganhou|recebeu)(?:\s+de)?\s*R\$\s*([\d.,]+)\s+de\s+cashback/i) ||
                          combined.match(/(?:cashback|dinheiro de volta)\s*(?:recebido|creditado|dispon[íi]vel)?(?:\s*:\s*|\s+de\s+)R\$\s*([\d.,]+)/i);
    if (cashbackMatch) {
      const amount = parseBrlCurrency(cashbackMatch[1]);
      if (amount && amount > 0) {
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: 'PicPay (Cashback)',
          type: 'income',
          notificationKind: 'cashback',
          paymentMethod: 'other',
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
