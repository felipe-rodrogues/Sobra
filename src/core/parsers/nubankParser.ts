/**
 * Sobra - Parser de Notificações: Nubank
 * Suporte a Crédito, Débito, Pix e Detecção de Saldo
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';
import { getBankByPackage } from '../banks/bankCatalog';

export class NubankParser implements BankNotificationParser {
  readonly id = 'nubank';
  readonly name = 'Nubank';
  readonly packageNames = [
    'com.nu.production', 
    'com.nubank', 
    'com.nu.beta', 
    'com.nu.corporate', 
    'com.nu.business', 
    'br.com.nubank'
  ];

  canHandle(packageName: string, title: string, text: string): boolean {
    // 1. Se o pacote pertence a outro banco conhecido, NUNCA tratar no Nubank
    if (packageName) {
      const knownBank = getBankByPackage(packageName);
      if (knownBank && knownBank.id !== this.id) {
        return false;
      }
      if (this.packageNames.includes(packageName) || packageName.startsWith('com.nu.') || packageName.includes('nubank')) {
        return true;
      }
    }
    const combined = `${title} ${text}`.toLowerCase();
    return combined.includes('nubank') || 
           combined.includes('nupay') ||
           /\bnu\b/i.test(combined) ||
           (combined.includes('cartão') && combined.includes('final') && (combined.includes('compra') || combined.includes('aprovad')));
  }

  parse(title: string, text: string, packageName = 'com.nu.production'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);

    // Extração dos 4 dígitos do cartão (ex: "para o cartão com final 1234", "no cartão final 1234", "para o cartão adicional com final 5882", "final 1234")
    const cardDigitsMatch = combined.match(/(?:cart[ãa]o(?:\s+(?:de\s+cr[ée]dito|de\s+d[ée]bito|virtual|f[íi]sico|adicional|titular))?\s+)?(?:com\s+)?(?:o\s+)?final\s*(\d{4})/i) ||
                            combined.match(/terminad[oa]\s+(?:em\s+)?(\d{4})/i) ||
                            combined.match(/cart[ãa]o\s+(\d{4})/i) ||
                            combined.match(/final\s*(\d{4})/i);
    const cardLastDigits = cardDigitsMatch ? cardDigitsMatch[1] : undefined;

    // Bloqueio de boletos emitidos/DDA (ex: "Novo boleto emitido no seu CPF"), avisos e cupons
    if (/(?:novo\s+boleto|chegou\s+(?:1\s+|um\s+)?boleto|boleto\s+(?:emitido|gerado|cadastrado|registrado)|emitido\s+no\s+seu\s+cpf|boleto\s+no\s+seu\s+cpf|boleto\s+(?:que\s+)?vence|boleto\s+a\s+vencer|agendar\s+ou|pode\s+agendar|cupom|garanta\s+r\$)/i.test(combined)) {
      return null;
    }

    // 0. Cashback / Recompensa Nubank (apenas se não for compra/pagamento)
    // Ex: "Você recebeu R$ 12,50 de cashback da Nubank Rewards"
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
          merchant: 'Nubank (Cashback)',
          type: 'income',
          notificationKind: 'cashback',
          paymentMethod: 'other',
          detectedBalance,
          cardLastDigits,
          confidence: 0.97,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 0b. Estorno / Reembolso Nubank
    // Ex: "Estorno de R$ 45,00 de PADARIA ESTRELA aprovado"
    const refundMatch = combined.match(/(?:estorno|reembolso|devolução|devolucao)(?:\s+de)?\s*R\$\s*([\d.,]+)/i);
    if (refundMatch) {
      const amount = parseBrlCurrency(refundMatch[1]);
      if (amount && amount > 0) {
        const merchantMatch = combined.match(/(?:de|em|na|no)\s+([A-Z][^.\n]{2,30})(?:\s+aprovado|\.)/i);
        const merchant = merchantMatch ? merchantMatch[1].trim() : 'Estorno Nubank';
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'income',
          notificationKind: 'refund',
          paymentMethod: 'other',
          detectedBalance,
          cardLastDigits,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 1. Pix Recebido (Receita)
    // Ex: "Você recebeu um Pix de R$ 50,00 de João"
    // Ex: "Você recebeu uma transferência Pix de R$ 300,00 de Maria Souza"
    // Ex: "Transferência recebida de R$ 100,00 de Lucas"
    const pixInMatch = combined.match(/(?:recebeu\s+(?:(?:um|uma)\s+)?(?:transfer[êe]ncia\s+)?(?:pix\s+)?(?:de\s+)?|pix\s+recebido(?:\s+de)?|transfer[êe]ncia\s+recebida(?:\s+de)?|(?:te\s+)?enviou\s+um\s+pix(?:\s+de)?)\s*R\$\s*([\d.,]+)(?:\s+(?:de|via\s+pix\s+de)\s+([^.\n]+))?/i) ||
                       combined.match(/(?:recebeu\s+um\s+pix|pix\s+recebido).*?R\$\s*([\d.,]+)(?:\s+de\s+([^.\n]+))?/i);
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

    // 2. Pix Enviado (Despesa)
    // Ex: "Você transferiu R$ 150,00 para João da Silva pelo Pix"
    // Ex: "Você fez um Pix de R$ 50,00 para Carlos"
    // Ex: "Você enviou um Pix de R$ 80,00 para Maria"
    const pixOutMatch = combined.match(/(?:transferiu|pix\s+enviado(?:\s+de)?|fez\s+um\s+pix(?:\s+de)?|enviou\s+um\s+pix(?:\s+de)?|transfer[êe]ncia\s+enviada(?:\s+de)?)\s*R\$\s*([\d.,]+)(?:\s+para\s+([^.\n]+?)(?:\s+pelo\s+pix)?)?(?:$|\.)/i);
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

    // 3. Compra Débito
    // Ex: "Compra no débito de R$ 32,00 aprovada em PADARIA"
    const debitMatch = combined.match(/compra\s+(?:no\s+)?d[ée]bito(?:\s+de)?\s*R\$\s*([\d.,]+)\s+aprovada\s+em\s+([^.\n]+)/i);
    if (debitMatch) {
      const amount = parseBrlCurrency(debitMatch[1]);
      if (amount && amount > 0) {
        let merchant = debitMatch[2]
          .replace(/\.?\s*saldo.*$/i, '')
          .replace(/(?:para\s+(?:o\s+)?|no\s+|com\s+(?:o\s+)?)(?:cart[ãa]o.*|final\s*\d{4}.*)$/i, '')
          .replace(/\s+(?:para|no|com)\s+(?:o\s+)?cart[ãa]o.*$/i, '')
          .replace(/\s+(?:com\s+)?final\s*\d{4}.*$/i, '')
          .replace(/^[^a-zA-Z0-9]+/, '')
          .trim();
        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant,
          type: 'expense',
          notificationKind: 'expense',
          paymentMethod: 'debit',
          detectedBalance,
          cardLastDigits,
          confidence: 0.95,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 4. Compra Crédito (ou genérica do cartão Nubank)
    // Ex: "Compra de R$ 45,90 aprovada em PADARIA ESTRELA"
    // Ex: "Compra no crédito aprovada: Compra de R$ 32,00 APROVADA em PAIVA HORTIFRUTI para o cartão adicional com final 5882."
    // Ex: "Compra no cartão de crédito aprovada: Compra de R$ 6,99 APROVADA em PROLAR para o cartão com final 1234"
    // Ex: "Compra aprovada no seu Nubank de R$ 45,90 em PADARIA ESTRELA"
    // Ex: "Compra de R$ 1.200,00 em 10x de R$ 120,00 aprovada na FAST SHOP"
    const creditAmountMatch = combined.match(/R\$\s*([\d.,]+)/i);
    const lowerComb = combined.toLowerCase();
    const isIncomeText = lowerComb.includes('recebeu') || lowerComb.includes('recebido') || lowerComb.includes('creditado');
    const hasPurchaseIntent = !isIncomeText && /(?:compra|aprovad|autorizad|confirmad|cart[ãa]o|pagou|comprou)/i.test(combined);

    if (creditAmountMatch && hasPurchaseIntent) {
      const amount = parseBrlCurrency(creditAmountMatch[1]);
      if (amount && amount > 0) {
        // 1. Remove menções a canais de compra, cartão, valores e parcelamentos para isolar o estabelecimento
        const cleaned = combined
          .replace(/compra\s+(?:no\s+)?(?:cart[ãa]o(?:\s+de\s+)?|adicional\s+)?(?:cr[ée]dito|d[ée]bito)(?:\s+aprovada)?/gi, ' ')
          .replace(/compra\s+(?:no\s+cart[ãa]o(?:\s+de\s+cr[ée]dito)?\s+)?aprovada/gi, ' ')
          .replace(/compra\s+aprovada(?:\s+no\s+(?:cr[ée]dito|d[ée]bito|cart[ãa]o))?/gi, ' ')
          .replace(/compra\s+autorizada(?:\s+no\s+(?:cr[ée]dito|d[ée]bito|cart[ãa]o))?/gi, ' ')
          .replace(/compra\s+confirmada/gi, ' ')
          .replace(/voc[êe]\s+(?:comprou|pagou)/gi, ' ')
          .replace(/no\s+(?:seu\s+)?nubank/gi, ' ')
          .replace(/no\s+(?:cart[ãa]o|cr[ée]dito|d[ée]bito)/gi, ' ')
          .replace(/no\s+valor(?:\s+de)?/gi, ' ')
          // Parcelamento: em 10x de R$ 120,00 / em 3x
          .replace(/(?:em|parcelad[oa]\s+em)\s+\d{1,2}\s*[xX](?:\s+de\s*R\$\s*[\d.,]+)?/gi, ' ')
          // Valores em R$: Compra de R$ 32,00 / R$ 32,00 / de R$ 32,00
          .replace(/(?:compra|valor)?(?:\s+de)?\s*R\$\s*[\d.,]+/gi, ' ')
          // Termos de aprovação soltos
          .replace(/\b(?:aprovad[ao]|autorizad[ao]|confirmad[ao]|recusad[ao])\b/gi, ' ');

        // 2. No Nubank, o estabelecimento sempre vem após 'em', 'na' ou 'no' (NUNCA 'para' ou 'de')
        const merchantMatch = cleaned.match(/\b(?:em|na|no)\s+([^.\n]+)/i);
        let merchant = merchantMatch ? merchantMatch[1] : cleaned;

        // Se houver múltiplos 'em' no restante, pega o último (ex: "cartao ... em LOJA")
        if (merchant.toLowerCase().includes(' em ')) {
          merchant = merchant.split(/\s+em\s+/i).pop() || merchant;
        }

        // 3. Limpa sufixos de cartão, final, pontuação e métodos de pagamento
        merchant = merchant
          .replace(/\.?\s*saldo.*$/i, '')
          .replace(/(?:para\s+(?:o\s+)?|no\s+|com\s+(?:o\s+)?)(?:cart[ãa]o.*|final\s*\d{4}.*)$/i, '')
          .replace(/\s+(?:para|no|com)\s+(?:o\s+)?cart[ãa]o.*$/i, '')
          .replace(/\s+(?:com\s+)?final\s*\d{4}.*$/i, '')
          .replace(/\s+(?:com\s+)?nupay.*$/i, '')
          .replace(/\s+(?:aprovad[ao]|autorizad[ao]|confirmad[ao])\.?$/i, '')
          .replace(/^[^a-zA-Z0-9]+/, '')
          .replace(/^(?:em|na|no)\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim();

        // 4. Sanity Check: se o merchant ainda tiver palavras de sistema bancário ("crédito aprovada", "compra de r$", etc.),
        // faz fallback buscando o trecho estritamente após o último em/na/no
        if (/(?:cr[ée]dito|d[ée]bito)\s+aprovad[ao]|compra\s+de\s+r\$|compra\s+no/i.test(merchant)) {
          const fallbackMatch = merchant.match(/\b(?:em|na|no)\s+([^.\n]+)/i);
          if (fallbackMatch) {
            merchant = fallbackMatch[1].trim();
          }
        }

        return {
          bankId: this.id,
          bankName: this.name,
          amount,
          merchant: merchant || 'Estabelecimento',
          type: 'expense',
          notificationKind: 'expense',
          paymentMethod: 'credit',
          detectedBalance,
          cardLastDigits,
          confidence: 0.94,
          rawTitle: title,
          rawText: text,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return null;
  }
}
