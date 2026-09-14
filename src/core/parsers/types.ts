/**
 * Sobra - Tipos e Interfaces para Parsers de Notificação Bancária
 */

import { ParsedBankNotification } from '../types';

export interface BankNotificationParser {
  /**
   * Identificador único do parser (ex: 'nubank', 'itau', 'bradesco')
   */
  readonly id: string;

  /**
   * Nome de exibição do banco
   */
  readonly name: string;

  /**
   * Package names associados no Android (ex: 'com.nu.production')
   */
  readonly packageNames: string[];

  /**
   * Verifica se este parser tem capacidade de processar a notificação informada
   */
  canHandle(packageName: string, title: string, text: string): boolean;

  /**
   * Extrai valor, estabelecimento, tipo e método de pagamento da notificação
   */
  parse(title: string, text: string, packageName?: string): ParsedBankNotification | null;
}
