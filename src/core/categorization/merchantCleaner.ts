/**
 * Sobra - Motor de Sanitização e Padronização de Nomes de Estabelecimentos (100% On-Device)
 * 
 * Remove ruídos bancários (PAG*, MP*, DM*, códigos de maquininhas)
 * e aplica regras de padronização com proteção contra falsos positivos via word boundaries.
 */

import { DescriptionRule } from '../types';

export class MerchantCleaner {
  // Prefixos comuns de gateways, maquininhas e adquirentes bancárias no Brasil
  private commonNoisePrefixes: RegExp[] = [
    /^(pag\*|pagamento\*|pagarme\*)/i,
    /^(mp\*|mercadopago\*)/i,
    /^(dm\*|dl\*|sq\*|iz\*)/i,
    /^(pix\s*(transferencia|enviado|recebido)?\*?)/i,
    /^(compra\s*(elo|visa|mastercard|debito|credito)?\*?)/i,
    /^(cartao\*?)/i,
    /^(ted\*?|doc\*?)/i,
  ];

  // Sufixos ou ruídos de terminal/restaurante/cidade e status de aprovação bancária
  private commonNoiseSuffixes: RegExp[] = [
    /(\*rest:.*|\*restaurante:.*|\|rest:.*|\|restaurante:.*)/i,
    /(\*br|\*brasil|\*sao paulo|\*sp|\*rj|\*mg|\*df)$/i,
    /(\*\d+|\s+#\d+|\s+loja\s+\d+|\s+ag\s+\d+)$/i,
    /\s+(?:aprovad[ao]|autorizad[ao]|confirmad[ao]|negad[ao]|recusad[ao])\.?$/i,
    /\s+(?:no\s+cr[ée]dito|no\s+d[ée]bito|via\s+pix|no\s+cart[ãa]o)\.?$/i,
    /\s+(?:final\s+\d{2,4})\.?$/i,
  ];

  /**
   * Normaliza um texto para busca insensível a acentos, pontuações e caixa alta/baixa
   */
  normalize(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[*#.,\-_/\\()|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Limpa ruídos óbvios de operadoras e maquininhas do texto bruto
   */
  stripBankNoise(raw: string): string {
    if (!raw) return '';
    let cleaned = raw.trim();

    // Remove prefixos conhecidos
    for (const prefix of this.commonNoisePrefixes) {
      cleaned = cleaned.replace(prefix, '');
    }

    // Remove sufixos de maquininhas/ruído/status
    for (const suffix of this.commonNoiseSuffixes) {
      cleaned = cleaned.replace(suffix, '');
    }

    // Limpa asteriscos soltos, pontuações finais soltas e espaços extras
    cleaned = cleaned.replace(/[*|_]/g, ' ').replace(/[.,;:!\-]+$/, '').replace(/\s+/g, ' ').trim();

    return cleaned || raw;
  }

  /**
   * Testa se um texto contém o padrão de busca como palavra inteira (Word Boundary),
   * impedindo que "apple" case com "applebee's" ou "ifood" case com "seafood".
   */
  matchesPattern(text: string, pattern: string): boolean {
    if (!text || !pattern) return false;

    const normText = this.normalize(text);
    const normPattern = this.normalize(pattern);

    if (!normText || !normPattern) return false;

    // Se o padrão for idêntico
    if (normText === normPattern) return true;

    // Se for composto por várias palavras (ex: "posto shell")
    const escapedPattern = normPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escapedPattern}(\\s|$)`, 'i');

    return regex.test(normText);
  }

  /**
   * Aplica as regras ativas de padronização na descrição da transação
   */
  applyRules(
    rawDescription: string, 
    rules: DescriptionRule[] = []
  ): { cleaned: string; matchedRule?: DescriptionRule } {
    if (!rawDescription) return { cleaned: '' };

    // Ordena regras por especificidade (padrões mais longos primeiro, ex: "posto shell" antes de "posto")
    const sortedRules = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);

    for (const rule of sortedRules) {
      if (this.matchesPattern(rawDescription, rule.pattern)) {
        return {
          cleaned: rule.replacement,
          matchedRule: rule
        };
      }
    }

    // Se nenhuma regra bater, aplica apenas limpeza leve de ruídos de maquininha
    const lightlyCleaned = this.stripBankNoise(rawDescription);
    return { cleaned: lightlyCleaned || rawDescription };
  }

  /**
   * Cria uma nova regra de padronização
   */
  createRule(pattern: string, replacement: string): DescriptionRule {
    return {
      id: `rule-desc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pattern: this.normalize(pattern),
      replacement: replacement.trim(),
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const merchantCleaner = new MerchantCleaner();

export function cleanMerchantName(rawDescription: string, rules: DescriptionRule[] = []): string {
  if (rules && rules.length > 0) {
    return merchantCleaner.applyRules(rawDescription, rules).cleaned;
  }
  return merchantCleaner.stripBankNoise(rawDescription);
}

