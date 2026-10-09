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
    /^(?:pag\*|pagamento\*|pagarme\*|pagar\.me\*|pagseguro\*|pag\s*\*|pagamento\s*\*|pagseguro\s*\*|pg\s*\*|pg\*|pagseguro\s+|pag\s+)/i,
    /^(?:mp\*|mercadopago\*|mp\s*\*|mercadopago\s*\*|mp\s+)(?!$)/i,
    /^(?:paypal\*|paypal\s*\*|paypal\s+)/i,
    /^(?:ebanx\*|ebanx\s*\*|ebanx\s+)/i,
    /^(?:dlocal\*|dlocal\s*\*|dlocal\s+)/i,
    /^(?:iugu\*|iugu\s*\*|iugu\s+)/i,
    /^(?:asaas\*|asaas\s*\*|asaas\s+)/i,
    /^(?:ec\s*\*|ec\*|ec\s+)/i, // E-commerce Cielo / Adquirente (ex: Ec *Ticketmaster)
    /^(?:ig\s*\*|ig\*|ig\s+)/i, // Ingenico / Adquirente (ex: Ig*Ballunodome)
    /^(?:cielo\*|cielo\s*\*|cielo\s+|rede\*|rede\s*\*|rede\s+|getnet\*|getnet\s*\*|getnet\s+|stone\*|stone\s*\*|stone\s+|ton\*|ton\s*\*|ton\s+|safrapay\*|safrapay\s*\*|safrapay\s+|sumup\*|sumup\s*\*|sumup\s+)/i,
    /^(?:dm\*|dm\s*\*|dl\*|dl\s*\*|sq\*|sq\s*\*|iz\*|iz\s*\*)/i,
    /^(?:zp\*|zp\s*\*|zp\s+)/i, // ZP adquirente (ex: ZP OLX)
    /^(?:ifd\*|ifd\s*\*|ifd\s+)/i, // iFood adquirente
    /^(?:mlp\*|mlp\s*\*|mlp\s+)/i, // Mercado Livre parceiro
    /^(?:cp\s+parc\*|cp\s+parc\s+)/i, // Inter Shopping parcelamento
    /^(?:pix\s*(?:transferencia|enviado|recebido)?\*?)/i,
    /^(?:compra\s*(?:elo|visa|mastercard|debito|credito)?\*?)/i,
    /^(?:cartao\*?)/i,
    /^(?:ted\*?|doc\*?)/i,
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

  // Nomes canônicos e elegantes de marcas conhecidas
  private canonicalBrands: Record<string, string> = {
    'steam': 'Steam',
    'steam games': 'Steam Games',
    'uber': 'Uber',
    'uber trip': 'Uber Trip',
    'uber rides': 'Uber Rides',
    'uber eats': 'Uber Eats',
    'ifood': 'iFood',
    'ifood clube': 'iFood Clube',
    '99': '99',
    '99 ride': '99 Ride',
    '99 pop': '99 Pop',
    '99 taxi': '99 Taxi',
    '99pay': '99Pay',
    'shein': 'Shein',
    'shopee': 'Shopee',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'amazon': 'Amazon',
    'amazon prime': 'Amazon Prime',
    'prime video': 'Prime Video',
    'claro': 'Claro',
    'claro flex': 'Claro Flex',
    'vivo': 'Vivo',
    'tim': 'TIM',
    'disney': 'Disney+',
    'disney+': 'Disney+',
    'disney plus': 'Disney+',
    'max': 'Max',
    'hbo max': 'Max',
    'apple': 'Apple',
    'google': 'Google',
    'google play': 'Google Play',
    'youtube': 'YouTube',
    'youtube premium': 'YouTube Premium',
    'chatgpt': 'ChatGPT',
    'openai': 'OpenAI',
    'playstation': 'PlayStation',
    'xbox': 'Xbox',
    'game pass': 'Game Pass',
    'gamepass': 'Game Pass',
    'nuuvem': 'Nuuvem',
    'nuuve': 'Nuuvem',
    'kabum': 'KaBuM',
    'olx': 'OLX',
    'smart fit': 'Smart Fit',
    'smartfit': 'Smart Fit',
    'life fit': 'Life Fit',
    'lifefit': 'Life Fit',
    'bluefit': 'Bluefit',
    'ticketmaster': 'Ticketmaster',
    'sympla': 'Sympla',
    'deezer': 'Deezer',
    'canva': 'Canva',
    'airbnb': 'Airbnb',
    'booking': 'Booking.com',
    'decolar': 'Decolar',
  };

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

    // 1. Casos conhecidos diretos com identificadores de vendedor
    if (/^mercadolivre\*/i.test(cleaned)) {
      return 'Mercado Livre';
    }
    if (/^shein\s*\*/i.test(cleaned)) {
      return 'Shein';
    }

    // 2. Limpeza de notificações bancárias inteiras vazadas (ex: "crédito aprovada Compra de R$ 32,00 APROVADA em PAIVA HORTIFRUTI...")
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

    // 3. Remove resíduos de parcelamento vazados no início do nome da loja
    // Ex: "3x em Pag*steam" -> "Pag*steam", "em 3x em Steam" -> "Steam", "parcelado em 5x na Loja" -> "Loja"
    cleaned = cleaned
      .replace(/^(?:(?:em|parcelad[oa]\s+em)\s+)?\d{1,2}\s*[xX](?:\s+de\s*R\$\s*[\d.,]+)?(?:\s+(?:em|na|no|para|ao|a|de))?\s+/i, '')
      .replace(/^(?:parcela\s+)?\d{1,2}\s*(?:\/|\s+de\s+)\d{1,2}\s*[xX]?(?:\s+(?:em|na|no|para|ao|a|de))?\s+/i, '')
      .replace(/^\d{1,2}\s*[xX]\s+(?:em|na|no|para|ao|a|de)\s+/i, '')
      .replace(/^\d{1,2}\s*[xX]\s+/i, '');

    // 4. Remove pontuações residuais ou preposições soltas no início
    cleaned = cleaned
      .replace(/^[*#.,\-_/\\()|:;]+\s*/, '')
      .replace(/^(?:em|na|no|para|ao|a|de)\s+/i, '');

    // 5. Remove prefixos de gateways, maquininhas e adquirentes (com * ou espaço ou colados)
    // Aplica em loop para suportar múltiplos prefixos (ex: "PAYPAL PAYPAL NUUVE", "PG *99 RIDE", "Pag*steam")
    let prevCleaned = '';
    while (prevCleaned !== cleaned) {
      prevCleaned = cleaned;
      for (const prefix of this.commonNoisePrefixes) {
        cleaned = cleaned.replace(prefix, '');
      }
      cleaned = cleaned
        .replace(/^[*#.,\-_/\\()|:;]+\s*/, '')
        .replace(/^(?:em|na|no|para|ao|a|de)\s+/i, '');
    }

    // 6. Deduplica palavras repetidas de intermediadores (ex: "KaBuM-KaBuM" -> "KaBuM", "PAYPAL PAYPAL" -> "PAYPAL")
    cleaned = cleaned.replace(/\b([A-Za-zÀ-ÿ]{3,})[-–—]\1\b/gi, '$1');
    cleaned = cleaned.replace(/\b(paypal|pagseguro|mercadopago|google)\s+\1\b/gi, '$1');

    // 7. Remove sufixos de maquininhas/ruído/status bancário
    for (const suffix of this.commonNoiseSuffixes) {
      cleaned = cleaned.replace(suffix, '');
    }

    // Remove resíduos de parcelas vazados no fim
    cleaned = cleaned
      .replace(/(?:[-–—\s]+)?(?:parcela\s+)?\d{1,2}\s*(?:\/|\s+de\s+)\d{1,2}\s*[xX]?$/i, '')
      .replace(/(?:[-–—\s]+)?(?:em|parcelad[oa]\s+em)?\s*\d{1,2}\s*[xX](?:\s+de\s*R\$\s*[\d.,]+)?$/i, '');

    // 8. Limpa asteriscos soltos, pontuações finais soltas e espaços extras
    cleaned = cleaned.replace(/[*|_]/g, ' ').replace(/[.,;:!\-]+$/, '').replace(/\s+/g, ' ').trim();

    // 9. Se ficou vazio após a limpeza, devolve o original
    if (!cleaned) return raw.trim();

    // 10. Padronização Inteligente de Marca e Capitalização
    const norm = this.normalize(cleaned);
    if (this.canonicalBrands[norm]) {
      return this.canonicalBrands[norm];
    }

    // Se o texto resultante estiver totalmente em minúsculas (ex: "steam", "loja doce sabor"),
    // converte para Title Case elegante
    if (cleaned === cleaned.toLowerCase()) {
      cleaned = cleaned
        .split(' ')
        .map(w => w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : '')
        .join(' ');
    }

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

