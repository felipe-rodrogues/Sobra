/**
 * Sobra - Motor Central de Detecção e Categorização de Notificações
 */

import { BankNotificationParser } from './types';
import { NubankParser } from './nubankParser';
import { ItauParser } from './itauParser';
import { BradescoParser } from './bradescoParser';
import { BbParser } from './bbParser';
import { CaixaParser } from './caixaParser';
import { SantanderParser } from './santanderParser';
import { InterParser } from './interParser';
import { C6Parser } from './c6Parser';
import { MercadoPagoParser } from './mercadoPagoParser';
import { PicPayParser } from './picpayParser';
import { GenericBankParser } from './genericParser';
import { ParsedBankNotification, Category, CategoryRule } from '../types';
import { detectInstallments } from './installmentDetector';
import { categorizationEngine } from '../categorization/categorizationEngine';

const SMS_PACKAGES = [
  'com.google.android.apps.messaging',
  'com.samsung.android.messaging',
  'com.android.mms',
  'com.motorola.messaging',
  'com.huawei.message',
  'com.xiaomi.mms',
];

/**
 * Detecta se a notificação é ruído sem valor contábil real.
 * Bloqueia: marketing, empréstimos informativos, faturas a vencer,
 * transações recusadas, lembretes e avisos de sistema.
 */
export function isPromotionalOrMarketing(title: string, text: string): boolean {
  const combined = `${title} ${text}`.toLowerCase();
  return (
    // ── Marketing / Promoções ──
    combined.includes('te espera') ||
    combined.includes('pré-aprovad') ||
    combined.includes('pre-aprovad') ||
    combined.includes('sem mexer no seu saldo') ||
    combined.includes('aumento de limite') ||
    combined.includes('aumentar seu limite') ||
    combined.includes('novo limite dispon') ||
    combined.includes('limite aumentado') ||
    combined.includes('simule seu empréstimo') ||
    combined.includes('simule seu emprestimo') ||
    combined.includes('oferta de empréstimo') ||
    combined.includes('oferta de emprestimo') ||
    combined.includes('contrate agora') ||
    combined.includes('contratar seguro') ||
    combined.includes('simule agora') ||
    combined.includes('conheça o novo') ||
    combined.includes('conheca o novo') ||
    combined.includes('conheça nossos') ||
    combined.includes('conheca nossos') ||
    combined.includes('conheça as vantagens') ||
    combined.includes('conheca as vantagens') ||
    combined.includes('descubra como') ||
    combined.includes('descubra as vantagens') ||
    combined.includes('descubra os benef') ||
    combined.includes('ganhe até r$') ||
    combined.includes('ganhe ate r$') ||
    combined.includes('concorra a') ||
    combined.includes('indique e ganhe') ||
    combined.includes('indique amigos') ||
    combined.includes('peça seu cartão') ||
    combined.includes('peca seu cartao') ||
    combined.includes('solicite seu cartão') ||
    combined.includes('solicite seu cartao') ||
    combined.includes('solicite já o seu') ||
    combined.includes('solicite ja o seu') ||
    combined.includes('peça já o seu') ||
    combined.includes('peca ja o seu') ||
    combined.includes('a partir de r$') ||
    combined.includes('quite sua dívida') ||
    combined.includes('quite sua divida') ||
    combined.includes('renegocie sua dívida') ||
    combined.includes('renegocie sua divida') ||
    combined.includes('acordo disponível') ||
    combined.includes('acordo disponivel') ||
    combined.includes('seguro de vida') ||
    combined.includes('seguro auto') ||
    combined.includes('seguro celular') ||
    combined.includes('plano odonto') ||
    combined.includes('informe de rendimentos') ||
    combined.includes('declaração de ir') ||
    combined.includes('declaracao de ir') ||
    combined.includes('informe de ir') ||
    combined.includes('cadastre suas chaves') ||
    combined.includes('cadastre sua chave') ||
    combined.includes('portabilidade de salário') ||
    combined.includes('portabilidade de salario') ||
    combined.includes('código de segurança') ||
    combined.includes('codigo de seguranca') ||
    combined.includes('código de verificação') ||
    combined.includes('codigo de verificacao') ||
    combined.includes('token de acesso') ||
    combined.includes('código de autorização') ||
    combined.includes('codigo de autorizacao') ||
    combined.includes('atualize seu app') ||
    combined.includes('atualize o aplicativo') ||
    combined.includes('nova versão disponível') ||
    combined.includes('nova versao disponivel') ||

    // ── Crédito/Empréstimo Informativo (NÃO é débito real) ──
    // Ex: "Seu empréstimo foi aprovado! Você tem um crédito de R$230 disponível. Toque aqui para simular."
    combined.includes('empréstimo foi aprovado') ||
    combined.includes('emprestimo foi aprovado') ||
    combined.includes('empréstimo dispon') ||
    combined.includes('emprestimo dispon') ||
    combined.includes('toque para simular') ||
    combined.includes('toque aqui para simular') ||
    (combined.includes('crédito de r$') && combined.includes('disponível')) ||
    (combined.includes('credito de r$') && combined.includes('disponivel')) ||
    (combined.includes('crédito dispon') && !combined.includes('pagou') && !combined.includes('compra')) ||
    (combined.includes('você tem um crédito') && !combined.includes('pagou')) ||
    (combined.includes('voce tem um credito') && !combined.includes('pagou')) ||

    // ── Fatura / Vencimento (o vencimento ≠ pagamento; o pagamento gera outra notificação) ──
    combined.includes('fatura fechou') ||
    combined.includes('fatura fechada') ||
    (combined.includes('fatura') && combined.includes('fechou')) ||
    (combined.includes('fatura de r$') && combined.includes('vence')) ||
    (combined.includes('fatura') && combined.includes('vencimento')) ||
    combined.includes('boleto a vencer') ||
    combined.includes('vencimento da fatura') ||

    // ── Lembretes de parcela / apps financeiros (sem movimentação real) ──
    // Ex: "Lembrete Pagaleve: Oiê! Vem fazer um pix e antecipe sua parcela."
    combined.includes('antecipe sua parcela') ||
    combined.includes('lembrete pagaleve') ||
    combined.includes('vem fazer um pix e antecipe') ||
    combined.includes('não se esqueça de pagar') ||
    combined.includes('nao se esqueca de pagar') ||

    // ── Transações Recusadas / Não Autorizadas (não houve débito real) ──
    (combined.includes('não autorizada') && combined.includes('compra')) ||
    (combined.includes('nao autorizada') && combined.includes('compra')) ||
    combined.includes('não foi aprovada') ||
    combined.includes('nao foi aprovada') ||
    (combined.includes('recusada') && combined.includes('compra')) ||
    (combined.includes('negada') && combined.includes('compra')) ||
    combined.includes('saldo insuficiente') ||
    combined.includes('transação não concluída') ||
    combined.includes('transacao nao concluida')
  );
}

/** Tipo semântico de uma notificação financeira */
type NotificationKind = 'expense' | 'income' | 'cashback' | 'refund';

/**
 * Classifica o sub-tipo semântico da notificação.
 * Retorna null se não houver verbo de ação financeira concluída
 * (notificação informativa sem valor contábil real).
 *
 * Prioridade de detecção:
 *  1. cashback / dinheiro de volta
 *  2. estorno / reembolso
 *  3. receita (Pix recebido, depósito, salário, TED creditada)
 *  4. despesa (compra aprovada, pagou, transferiu, débito)
 *  5. null → sem verbo conclusivo → ignorar
 */
export function detectNotificationKind(title: string, text: string): NotificationKind | null {
  const combined = `${title} ${text}`.toLowerCase();

  // 1. Cashback / Dinheiro de volta
  if (
    combined.includes('cashback') ||
    combined.includes('dinheiro de volta') ||
    combined.includes('ganhou de cashback') ||
    combined.includes('você ganhou') && combined.includes('cashback') ||
    combined.includes('voce ganhou') && combined.includes('cashback') ||
    combined.includes('recompensa')
  ) {
    return 'cashback';
  }

  // 2. Estorno / Reembolso / Cancelamento confirmado
  if (
    combined.includes('estorno') ||
    combined.includes('reembolso') ||
    combined.includes('cancelamento de compra') ||
    combined.includes('compra cancelada') ||
    combined.includes('devolução') ||
    combined.includes('devolucao') ||
    combined.includes('crédito em fatura') ||
    combined.includes('credito em fatura') ||
    (combined.includes('compra') && combined.includes('cancelada')) ||
    (combined.includes('compra') && combined.includes('reembolsada'))
  ) {
    return 'refund';
  }

  // 3. Receita / Entrada confirmada
  if (
    combined.includes('recebeu') ||
    combined.includes('recebido') ||
    combined.includes('creditado') ||
    combined.includes('ted recebida') ||
    combined.includes('ted creditada') ||
    combined.includes('doc recebido') ||
    combined.includes('pix recebido') ||
    combined.includes('transferência recebida') ||
    combined.includes('transferencia recebida') ||
    combined.includes('depósito realizado') ||
    combined.includes('deposito realizado') ||
    combined.includes('salário creditado') ||
    combined.includes('salario creditado') ||
    (combined.includes('pix') && combined.includes('você recebeu')) ||
    (combined.includes('pix') && combined.includes('voce recebeu')) ||
    (combined.includes('pix') && combined.includes('de ') && combined.includes('r$') && !combined.includes('pagou') && !combined.includes('enviou'))
  ) {
    return 'income';
  }

  // 4. Despesa / Saída confirmada
  if (
    combined.includes('compra aprovada') ||
    combined.includes('compra autorizada') ||
    combined.includes('compra confirmada') ||
    combined.includes('pagou') ||
    combined.includes('você pagou') ||
    combined.includes('voce pagou') ||
    combined.includes('pago em') ||
    combined.includes('transferiu') ||
    combined.includes('pix enviado') ||
    combined.includes('pix de ') && combined.includes('enviado') ||
    combined.includes('débito de') ||
    combined.includes('debito de') ||
    combined.includes('comprou') ||
    combined.includes('você comprou') ||
    combined.includes('voce comprou') ||
    combined.includes('acaba de comprar') ||
    combined.includes('fatura debitada') ||
    combined.includes('compra realizada')
  ) {
    return 'expense';
  }

  // Sem verbo conclusivo → ignorar (não assumir tipo)
  return null;
}

export class NotificationEngine {
  private parsers: BankNotificationParser[] = [];
  private genericParser: GenericBankParser;

  constructor() {
    this.parsers = [
      new NubankParser(),
      new ItauParser(),
      new BradescoParser(),
      new BbParser(),
      new CaixaParser(),
      new SantanderParser(),
      new InterParser(),
      new C6Parser(),
      new MercadoPagoParser(),
      new PicPayParser(),
    ];
    this.genericParser = new GenericBankParser();
  }

  /**
   * Registra um novo parser bancário de forma extensível
   */
  registerParser(parser: BankNotificationParser): void {
    this.parsers.unshift(parser);
  }

  /**
   * Processa título e texto de uma notificação bancária recebida localmente
   */
  processNotification(
    title: string, 
    text: string, 
    packageName = ''
  ): ParsedBankNotification | null {
    if (!title && !text) return null;

    // Ignora mensagens de marketing, promoções, avisos informativos e ruídos semânticos
    if (isPromotionalOrMarketing(title, text)) {
      return null;
    }

    let result: ParsedBankNotification | null = null;

    // 1. Tentar parser especializado pelo package name ou palavras-chave
    for (const parser of this.parsers) {
      if (parser.canHandle(packageName, title, text)) {
        result = parser.parse(title, text, packageName);
        if (result) break;
      }
    }

    // 2. Fallback heurístico genérico
    if (!result) {
      result = this.genericParser.parse(title, text, packageName);
    }

    if (!result) return null;

    // 3. Enriquecer com o notificationKind semântico (se o parser não definiu)
    if (!result.notificationKind) {
      const kind = detectNotificationKind(title, text);
      if (kind) {
        result.notificationKind = kind;
        // Garantir consistência: cashback e refund são tratados como income no campo type
        // mas distinguidos pelo notificationKind para o fluxo de UI
        if (kind === 'cashback' || kind === 'refund') {
          result.type = 'income';
        }
      } else {
        // Se o parser retornou resultado mas não há verbo conclusivo detectável,
        // só mantem se tiver alta confiança (parser especializado)
        if (result.confidence < 0.85) {
          return null;
        }
      }
    }

    // 4. Detecção Inteligente de Compras Parceladas
    const combined = `${title} ${text}`;
    const detectedInst = detectInstallments(combined, result.amount);
    if (detectedInst && detectedInst.isInstallment && detectedInst.installmentCount > 1) {
      result.isInstallment = true;
      result.installmentCount = detectedInst.installmentCount;
      result.installmentNumber = detectedInst.installmentNumber || 1;
      result.installmentAmount = detectedInst.installmentAmount;
      result.originalTotalAmount = detectedInst.totalAmount || result.amount;
      // Compras parceladas são obrigatoriamente no cartão de crédito
      if (result.type === 'expense') {
        result.paymentMethod = 'credit';
      }
    }

    // 5. Identificação de Notificação de SMS Bancário
    if (packageName && SMS_PACKAGES.includes(packageName)) {
      result.isFromSms = true;
    }

    // 6. Extração genérica de últimos 4 dígitos do cartão (se não preenchido pelo parser específico)
    if (!result.cardLastDigits) {
      const cardDigitsMatch = combined.match(/(?:cart[ãa]o\s+)?final\s*(\d{4})/i);
      if (cardDigitsMatch) {
        result.cardLastDigits = cardDigitsMatch[1];
      }
    }

    return result;
  }

  /**
   * Sugere automaticamente a categoria com base no motor inteligente unificado
   */
  suggestCategory(merchantName: string, categories: Category[], userRules: CategoryRule[] = []): Category | undefined {
    return categorizationEngine.suggestCategory(merchantName, categories, userRules);
  }
}

export const notificationEngine = new NotificationEngine();
