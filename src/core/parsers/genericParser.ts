/**
 * Sobra - Parser de Notificações Heurístico Genérico
 * Usado como fallback extensível para qualquer banco.
 *
 * IMPORTANTE: Este parser exige verbo de ação financeira conclusiva antes de
 * retornar qualquer resultado. Nunca presume tipo com base apenas na presença de R$.
 */

import { BankNotificationParser } from './types';
import { ParsedBankNotification } from '../types';
import { parseBrlCurrency, extractDetectedBalance } from './currencyHelper';

/**
 * Palavras que NUNCA podem ser nome de loja/estabelecimento.
 * Evita que verbos de call-to-action virem nomes de merchant.
 * Ex: "Toque para simular" → "simular" não é uma loja.
 */
const MERCHANT_STOPWORDS = new Set([
  'simular', 'simule', 'ver', 'conferir', 'abrir', 'detalhes',
  'acessar', 'atualizar', 'tocar', 'clicar', 'consultar',
  'cadastrar', 'verificar', 'ativar', 'selecionar', 'configurar',
  'visualizar', 'mais', 'agora', 'aqui', 'toque', 'clique',
  'solicitar', 'contratar', 'conhecer', 'descobrir',
]);

/**
 * Verbos de ação financeira conclusiva para despesa (saída de dinheiro confirmada).
 * Sem esses verbos, não há débito real.
 */
const EXPENSE_VERBS = [
  'pagou', 'você pagou', 'voce pagou', 'pago em',
  'compra aprovada', 'compra autorizada', 'compra confirmada', 'compra realizada',
  'transferiu', 'pix enviado', 'você enviou', 'voce enviou',
  'débito de', 'debito de',
  'comprou', 'você comprou', 'voce comprou', 'acaba de comprar',
  'fatura debitada',
];

/**
 * Verbos de ação financeira conclusiva para receita (entrada confirmada).
 */
const INCOME_VERBS = [
  'recebeu', 'recebido', 'creditado',
  'ted recebida', 'ted creditada', 'doc recebido',
  'pix recebido', 'você recebeu', 'voce recebeu',
  'transferência recebida', 'transferencia recebida',
  'depósito realizado', 'deposito realizado',
  'salário creditado', 'salario creditado',
];

function hasExpenseVerb(text: string): boolean {
  return EXPENSE_VERBS.some(v => text.includes(v));
}

function hasIncomeVerb(text: string): boolean {
  return INCOME_VERBS.some(v => text.includes(v));
}

function isMerchantValid(name: string): boolean {
  if (!name || name.length < 2) return false;
  const lower = name.toLowerCase().trim();
  // Rejeita se for uma stopword ou começar com verbo de ação
  if (MERCHANT_STOPWORDS.has(lower)) return false;
  // Rejeita se for só uma palavra de CTA genérica
  if (/^(toque|clique|acesse|veja|confira|saiba|simule|contratar?)(\s+|$)/i.test(lower)) return false;
  return true;
}

export class GenericBankParser implements BankNotificationParser {
  readonly id = 'generic';
  readonly name = 'Outro Banco';
  readonly packageNames = [];

  canHandle(): boolean {
    return true; // Fallback genérico
  }

  parse(title: string, text: string, packageName = 'generic'): ParsedBankNotification | null {
    const combined = `${title} ${text}`;
    const detectedBalance = extractDetectedBalance(combined);
    const lower = combined.toLowerCase();

    // Procurar por padrão de moeda brasileira
    const currencyMatch = combined.match(/R\$\s*([\d.,]+)/i);
    if (!currencyMatch) return null;

    const amount = parseBrlCurrency(currencyMatch[1]);
    if (!amount || amount <= 0) return null;

    // Exige verbo de ação conclusiva para determinar o tipo.
    // Sem verbo → não há transação real → retorna null.
    const isIncome = hasIncomeVerb(lower);
    const isExpense = !isIncome && hasExpenseVerb(lower);

    if (!isIncome && !isExpense) {
      // Nenhum verbo conclusivo encontrado → ignorar notificação
      return null;
    }

    // Detectar método de pagamento
    let paymentMethod: 'credit' | 'debit' | 'pix' | 'other' = 'credit';
    if (lower.includes('pix')) {
      paymentMethod = 'pix';
    } else if (lower.includes('débito') || lower.includes('debito')) {
      paymentMethod = 'debit';
    }

    // Tentar extrair estabelecimento / destinatário com heurísticas comuns
    let merchant = 'Estabelecimento Desconhecido';
    const merchantMatch = combined.match(/(?:em|na|no|para|de)\s+([A-Z0-9\s.,'\&-]{3,35})(?:$|\.|\ -\ )/i);
    if (merchantMatch) {
      const candidate = merchantMatch[1].replace(/\.?\s*saldo.*$/i, '').trim();
      if (isMerchantValid(candidate)) {
        merchant = candidate;
      }
    } else if (title && title.length > 2 && !title.toLowerCase().includes('banco') && isMerchantValid(title)) {
      merchant = title.trim();
    }

    return {
      bankId: this.id,
      bankName: this.name,
      amount,
      merchant,
      type: isIncome ? 'income' : 'expense',
      notificationKind: isIncome ? 'income' : 'expense',
      paymentMethod,
      detectedBalance,
      confidence: 0.7,
      rawTitle: title,
      rawText: text,
      timestamp: new Date().toISOString(),
    };
  }
}
