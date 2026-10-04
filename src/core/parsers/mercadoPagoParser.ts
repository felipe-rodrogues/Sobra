/**
 * Sobra - Parser de Notificações: Mercado Pago
 *
 * Cobre:
 *  1. Cashback recebido           → notificationKind: 'cashback'
 *  2. Reembolso / estorno         → notificationKind: 'refund'
 *  3. Pix / dinheiro recebido     → notificationKind: 'income'
 *  4. Pagamento efetuado ("pagou em / a / para") → notificationKind: 'expense'
 *  5. Compra aprovada             → notificationKind: 'expense'
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
    const combinedLower = combined.toLowerCase();
    const detectedBalance = extractDetectedBalance(combined);

    // ── 0. Bloqueio interno: crédito informativo / boletos a vencer / promoções / agendamentos ──
    if (
      combinedLower.includes('toque para simular') ||
      combinedLower.includes('toque aqui para simular') ||
      (combinedLower.includes('crédito') && combinedLower.includes('disponível') && !combinedLower.includes('pagou')) ||
      (combinedLower.includes('credito') && combinedLower.includes('disponivel') && !combinedLower.includes('pagou')) ||
      combinedLower.includes('empréstimo foi aprovado') ||
      combinedLower.includes('emprestimo foi aprovado') ||
      combinedLower.includes('chegou 1 boleto') ||
      combinedLower.includes('chegou um boleto') ||
      combinedLower.includes('chegou boleto') ||
      combinedLower.includes('chegaram boletos') ||
      combinedLower.includes('novo boleto') ||
      combinedLower.includes('novos boletos') ||
      combinedLower.includes('boleto emitido') ||
      combinedLower.includes('boleto que vence') ||
      combinedLower.includes('boleto a vencer') ||
      (combinedLower.includes('boleto') && combinedLower.includes('vence')) ||
      combinedLower.includes('já pode agendar') ||
      combinedLower.includes('ja pode agendar') ||
      combinedLower.includes('agendar ou fazer o pagamento') ||
      combinedLower.includes('agendar ou pagar') ||
      combinedLower.includes('pode agendar') ||
      combinedLower.includes('cupom') ||
      combinedLower.includes('garanta') ||
      combinedLower.includes('expira') ||
      combinedLower.includes('válido até') ||
      combinedLower.includes('valido ate')
    ) {
      return null;
    }

    // ── 1. Cashback recebido (apenas se não for compra/pagamento) ──
    // Ex: "Você ganhou R$ 0,02 de cashback - Continue usando seu Cartão de Crédito Mercado Pago"
    const isPurchase = /(?:compra|pagamento|pagou).*?(?:aprovad|autorizad|confirmad)/i.test(combined) ||
                       /(?:compra|pagamento)\s+(?:de\s+)?R\$/i.test(combined);
    const cashbackMatch = !isPurchase && (
      combined.match(/(?:ganhou|recebeu)\s*R\$\s*([\d.,]+)\s+de\s+cashback/i) ||
      combined.match(/(?:cashback|dinheiro de volta)\s*(?:recebido|creditado|dispon[íi]vel)?(?:\s*:\s*|\s+de\s+)R\$\s*([\d.,]+)/i)
    );
    if (cashbackMatch) {
      const amount = parseBrlCurrency(cashbackMatch[1]);
      if (amount && amount > 0) {
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: 'Mercado Pago (Cashback)',
          type: 'income',
          notificationKind: 'cashback',
          paymentMethod: 'other',
          detectedBalance,
          confidence: 0.97,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // ── 2. Reembolso / Estorno ──
    // Ex: "Mercado Pago: Reembolso de R$ 45,00 creditado em sua conta."
    const refundMatch = combined.match(/(?:estorno|reembolso|cancelamento|devolução|devolucao)\s+(?:de\s+)?R\$\s*([\d.,]+)/i);
    if (refundMatch) {
      const amount = parseBrlCurrency(refundMatch[1]);
      if (amount && amount > 0) {
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: 'Mercado Pago (Reembolso)',
          type: 'income',
          notificationKind: 'refund',
          paymentMethod: 'other',
          detectedBalance,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // ── 3. Recebeu dinheiro / Pix ──
    // Ex: "Você recebeu R$ 150,00 de João Silva via Pix"
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

    // ── 4. Pagamento efetuado / Compra ──
    // Suporta variações:
    //   "Você pagou R$ 45,00 em PADARIA CENTRAL"         → preposição "em"
    //   "Você pagou R$ 3,40 a PG *99 RIDE"               → preposição "a"
    //   "Você pagou R$ 3,40 para João"                   → preposição "para"
    //   "Compra aprovada de R$ 45,00 em PADARIA CENTRAL" → "compra aprovada"
    const outMatch =
      // "pagou R$ X em/a/para NOME"
      combined.match(/(?:pagou|pago)\s+(?:de\s+)?R\$\s*([\d.,]+)\s+(?:em|a|para|ao|na|no)\s+([^.\n]+)/i) ||
      // "compra aprovada de R$ X em NOME"
      combined.match(/compra\s+aprovada(?:\s+de)?\s*R\$\s*([\d.,]+).*?(?:em|na|no|para)\s+([^.\n]+)/i) ||
      // "pagamento de boleto ... no valor de R$ X" / "boleto pago"
      combined.match(/(?:pagamento(?:\s+de\s+boleto)?|boleto\s+pago).*?R\$\s*([\d.,]+)(?:.*?(?:para|a)\s+([^.\n]+))?/i);

    if (outMatch) {
      const amount = parseBrlCurrency(outMatch[1]);
      if (amount && amount > 0) {
        let merchant = outMatch[2] ? outMatch[2].replace(/\.?\s*saldo.*$/i, '').trim() : 'Pagamento de Boleto';
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'expense',
          notificationKind: 'expense',
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
