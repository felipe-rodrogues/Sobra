/**
 * Sobra - Parser de Notificações: Banco Inter
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';
import { getBankByPackage } from '../banks/bankCatalog';

export class InterParser implements BankNotificationParser {
  readonly id = 'inter';
  readonly name = 'Banco Inter';
  readonly packageNames = [
    'br.com.intermedium',
    'com.bancointer.bancointer',
    'br.com.inter',
    'br.com.inter.empresas',
  ];

  canHandle(packageName: string, title: string, text: string): boolean {
    if (packageName) {
      const knownBank = getBankByPackage(packageName);
      if (knownBank && knownBank.id !== this.id) {
        return false;
      }
      if (this.packageNames.includes(packageName) || packageName.includes('intermedium') || packageName.includes('bancointer') || packageName.startsWith('br.com.inter')) {
        return true;
      }
    }
    const combined = `${title} ${text}`.toLowerCase();
    return /\binter\b/i.test(combined) || combined.startsWith('inter:') || combined.includes('banco inter');
  }

  parse(title: string, text: string, packageName = 'br.com.intermedium'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // Bloqueio de cupons promocionais, campanhas e boletos a vencer/DDA
    if (/(?:cupom|garanta|acima de|expira|v[áa]lido|chegou\s+(?:1\s+|um\s+)?boleto|novo\s+boleto|boleto\s+(?:que\s+)?vence|boleto\s+a\s+vencer|agendar\s+ou|pode\s+agendar)/i.test(combined)) {
      return null;
    }

    // 0. Cashback / Cel Inter Cash (apenas se não for compra/pagamento)
    // Ex: "Você ganhou R$ 2,50 de cashback Inter"
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
          merchant: 'Banco Inter (Cashback)',
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

    // 0b. Estorno / Reembolso Inter
    const refundMatch = combined.match(/(?:estorno|reembolso|devolução|devolucao)(?:\s+de)?\s*R\$\s*([\d.,]+)/i);
    if (refundMatch) {
      const amount = parseBrlCurrency(refundMatch[1]);
      if (amount && amount > 0) {
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: 'Estorno Banco Inter',
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

    // 2. Compra de Cartão Inter (Crédito ou Débito)
    // Suporta todos os formatos reais do Banco Inter mesmo quando "Inter" não for citado no texto
    const hasPurchaseIntent = /(?:compra|comprar|comprou|aprovad|autorizad|confirmad|transa[çc][ãa]o)/i.test(combined);
    const amountMatch = combined.match(/R\$\s*([\d.,]+)/i);

    if (amountMatch && hasPurchaseIntent) {
      const amount = parseBrlCurrency(amountMatch[1]);
      if (amount && amount > 0) {
        // Extrair últimos 4 dígitos do cartão se houver
        const cardDigitsMatch = combined.match(/(?:cart[ãa]o(?:\s+(?:de\s+cr[ée]dito|de\s+d[ée]bito|virtual|f[íi]sico))?\s+)?(?:com\s+o\s+|com\s+)?final\s*(\d{4})/i) ||
                                combined.match(/terminad[oa]\s+(?:em\s+)?(\d{4})/i) ||
                                combined.match(/cart[ãa]o\s+(\d{4})/i) ||
                                combined.match(/final\s*(\d{4})/i);
        const cardLastDigits = cardDigitsMatch ? cardDigitsMatch[1] : undefined;

        // Determinar débito vs crédito
        const lowerCombined = combined.toLowerCase();
        let paymentMethod: 'credit' | 'debit' = 'credit';
        if (lowerCombined.includes('débito') || lowerCombined.includes('debito')) {
          paymentMethod = 'debit';
        }

        // Limpar ruídos bancários para isolar o nome do estabelecimento
        const cleaned = combined
          .replace(/inter\s*:\s*/gi, ' ')
          .replace(/ol[áa][^.]*\.\s*/gi, ' ')
          .replace(/voc[êe]\s+(?:acaba\s+de\s+comprar|comprou|realizou\s+uma\s+compra(?:\s+no\s+valor)?(?:\s+de)?)/gi, ' ')
          .replace(/compra\s+(?:no\s+)?(?:cr[ée]dito|d[ée]bito)(?:\s+aprovada)?/gi, ' ')
          .replace(/compra\s+aprovada(?:\s+de)?/gi, ' ')
          .replace(/compra\s+autorizada(?:\s+de)?/gi, ' ')
          .replace(/transa[çc][ãa]o\s+aprovada(?:\s+de)?/gi, ' ')
          .replace(/compra(?:\s+de)?/gi, ' ')
          .replace(/no\s+(?:inter\s+mastercard|inter)/gi, ' ')
          .replace(/no\s+(?:cart[ãa]o(?:\s+de\s+cr[ée]dito|\s+de\s+d[ée]bito)?|cr[ée]dito|d[ée]bito)/gi, ' ')
          .replace(/no\s+valor(?:\s+de)?/gi, ' ')
          .replace(/R\$\s*[\d.,]+/gi, ' ')
          .replace(/\b(?:aprovad[ao]|autorizad[ao]|confirmad[ao])\b/gi, ' ')
          .replace(/\ba\s+compra\s+foi\s+no\s+(?:cr[ée]dito|d[ée]bito)\s+nacional[^.]*\./gi, ' ');

        const merchantMatch = cleaned.match(/\b(?:em|na|no)\s+([^.\n]+)/i);
        let merchant = merchantMatch ? merchantMatch[1] : cleaned;

        if (merchant.toLowerCase().includes(' em ')) {
          merchant = merchant.split(/\s+em\s+/i).pop() || merchant;
        }

        merchant = merchant
          .replace(/\.?\s*a\s+compra\s+foi.*$/i, '')
          .replace(/\.?\s*com\s+o\s+cart[ãa]o.*$/i, '')
          .replace(/\.?\s*com\s+cart[ãa]o.*$/i, '')
          .replace(/\.?\s*final\s*\d{4}.*$/i, '')
          .replace(/\.?\s*seu\s+saldo.*$/i, '')
          .replace(/\.?\s*saldo.*$/i, '')
          .replace(/^[^a-zA-Z0-9]+/, '')
          .replace(/^(?:em|na|no)\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: merchant || 'Estabelecimento',
          type: 'expense',
          notificationKind: 'expense',
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
          notificationKind: 'expense',
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
