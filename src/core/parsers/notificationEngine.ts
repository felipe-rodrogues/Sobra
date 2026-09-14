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
import { categorizationEngine } from '../categorization/categorizationEngine';

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

    // 1. Tentar parser especializado pelo package name ou palavras-chave
    for (const parser of this.parsers) {
      if (parser.canHandle(packageName, title, text)) {
        const result = parser.parse(title, text, packageName);
        if (result) return result;
      }
    }

    // 2. Fallback heurístico genérico
    return this.genericParser.parse(title, text, packageName);
  }

  /**
   * Sugere automaticamente a categoria com base no motor inteligente unificado
   */
  suggestCategory(merchantName: string, categories: Category[], userRules: CategoryRule[] = []): Category | undefined {
    return categorizationEngine.suggestCategory(merchantName, categories, userRules);
  }
}

export const notificationEngine = new NotificationEngine();
