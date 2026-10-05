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
    /^(ec\s*\*|ec\*)/i, // E-commerce Cielo / Adquirente (ex: Ec *Ticketmaster)
    /^(ig\s*\*|ig\*)/i, // Ingenico / Adquirente (ex: Ig*Ballunodome)
    /^(pg\s*\*|pg\*|pagseguro\*)/i, // PagSeguro (ex: Pg *Nio Fibra)
    /^(cielo\*|rede\*|getnet\*|stone\*|safrapay\*)/i,
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
    /(?:\s*-\s*nupay)$/i, // NuPay Nubank (ex: iFood - NuPay)
    /(?:[-–—\s]+)?(?:parcela\s+)?\d{1,2}\s*(?:\/|\s+de\s+)\d{1,2}\s*[xX]?$/i, // Sufixo de parcela
    /(?:[:\-–—\s]+)(?:o\s+valor\s+vai|vai\s+entrar|entra|na\s+pr[óo]xima\s+fatura|seu\s+cart[ãa]o).*$/i, // Sufixos de fatura Mercado Pago
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

    // Mercado Livre com código de vendedor
    if (/^mercadolivre\*/i.test(cleaned)) {
      return 'Mercado Livre';
    }

    // Shein com código de vendedor/fornecedor
    if (/^shein\s*\*/i.test(cleaned)) {
      return 'Shein';
    }

    // Limpeza de notificações bancárias inteiras vazadas (ex: "crédito aprovada Compra de R$ 32,00 APROVADA em PAIVA HORTIFRUTI...")
    if (/(?:cr[ée]dito|d[ée]bito)\s+aprovad|compra\s+(?:de\s+)?R\$|cart[ãa]o.*final\s*\d{4}|compra\s+no\s+(?:cr[ée]dito|d[ée]bito)/i.test(cleaned)) {
      let temp = cleaned
        .replace(/compra\s+(?:no\s+)?(?:cart[ãa]o(?:\s+de\s+)?|adicional\s+)?(?:cr[ée]dito|d[ée]bito)(?:\s+aprovada)?/gi, ' ')
        .replace(/(?:cr[ée]dito|d[ée]bito)\s+aprovad[ao]/gi, ' ')
        .replace(/compra\s+aprovada(?:\s+no\s+(?:cr[ée]dito|d[ée]bito|cart[ãa]o))?/gi, ' ')
        .replace(/compra\s+autorizada(?:\s+no\s+(?:cr[ée]dito|d[ée]bito|cart[ãa]o))?/gi, ' ')
        .replace(/compra\s+confirmada/gi, ' ')
        .replace(/voc[êe]\s+(?:comprou|pagou)/gi, ' ')
        .replace(/no\s+(?:seu\s+)?nubank/gi, ' ')
        .replace(/no\s+(?:cart[ãa]o|cr[ée]dito|d[ée]bito)/gi, ' ')
        .replace(/(?:em|parcelad[oa]\s+em)\s+\d{1,2}\s*[xX](?:\s+de\s*R\$\s*[\d.,]+)?/gi, ' ')
        .replace(/(?:compra|valor)?(?:\s+de)?\s*R\$\s*[\d.,]+/gi, ' ')
        .replace(/\b(?:aprovad[ao]|autorizad[ao]|confirmad[ao]|recusad[ao])\b/gi, ' ');

      const match = temp.match(/\b(?:em|na|no)\s+([^.\n]+)/i);
      let extracted = match ? match[1] : temp;
      extracted = extracted
        .replace(/\.?\s*saldo.*$/i, '')
        .replace(/(?:para\s+(?:o\s+)?|no\s+|com\s+(?:o\s+)?)(?:cart[ãa]o.*|final\s*\d{4}.*)$/i, '')
        .replace(/\s+(?:para|no|com)\s+(?:o\s+)?cart[ãa]o.*$/i, '')
        .replace(/\s+(?:com\s+)?final\s*\d{4}.*$/i, '')
        .replace(/\s+(?:com\s+)?nupay.*$/i, '')
        .replace(/\s+(?:aprovad[ao]|autorizad[ao]|confirmad[ao])\.?$/i, '')
        .replace(/^[^a-zA-Z0-9]+/, '')
        .replace(/^(?:em|na|no)\s+/i, '')
        .trim();

      if (extracted && extracted.length >= 2) {
        cleaned = extracted;
      }
    }

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

