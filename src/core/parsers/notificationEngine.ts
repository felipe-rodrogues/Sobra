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

export function isPromotionalOrMarketing(title: string, text: string): boolean {
  const combined = `${title} ${text}`.toLowerCase();
  return (
    combined.includes('te espera') ||
    combined.includes('pré-aprovad') ||
    combined.includes('pre-aprovad') ||
    combined.includes('sem mexer no seu saldo') ||
    combined.includes('aumento de limite') ||
    combined.includes('aumentar seu limite') ||
    combined.includes('novo limite dispon') ||
    combined.includes('limite aumentado') ||
    combined.includes('empréstimo dispon') ||
    combined.includes('emprestimo dispon') ||
    combined.includes('empréstimo pré-aprovado') ||
    combined.includes('emprestimo pre-aprovado') ||
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
    combined.includes('nova versao disponivel')
  );
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

    // Ignora mensagens de marketing, promoções ou avisos informativos dos bancos
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

    // 3. Detecção Inteligente de Compras Parceladas
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

    // 4. Identificação de Notificação de SMS Bancário
    if (packageName && SMS_PACKAGES.includes(packageName)) {
      result.isFromSms = true;
    }

    // 5. Extração genérica de últimos 4 dígitos do cartão (se não preenchido pelo parser específico)
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
