/**
 * Sobra - Utilitário de Moeda Brasileira (BRL)
 */

/**
 * Converte string com valor monetário no formato brasileiro para número flutuante.
 * Suporta formatos:
 * - "R$ 45,90" -> 45.90
 * - "R$ 1.250,50" -> 1250.50
 * - "45,90" -> 45.90
 * - "1250.50" -> 1250.50
 */
export function parseBrlCurrency(valueStr: string): number | null {
  if (!valueStr) return null;

  // Remove "R$", espaços invisíveis e trim
  let clean = valueStr.replace(/R\$\s*/gi, '').replace(/\s+/g, '').trim();
  if (!clean) return null;

  // Verifica sinal negativo (pode ser "-", "- " ou entre parênteses "(1.250,00)")
  const isNegative = clean.includes('-') || (clean.startsWith('(') && clean.endsWith(')'));
  clean = clean.replace(/[-()]/g, '');

  // Caso tenha ponto de milhar e vírgula de centavos: "1.250,50"
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } 
  // Caso tenha apenas vírgula: "45,90"
  else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  const rounded = Math.round(num * 100) / 100;
  return isNegative ? -rounded : rounded;
}

/**
 * Extrai o saldo da conta mencionado no texto da notificação (se houver)
 * Exemplos: "Saldo disponível: R$ 1.250,00", "Saldo em conta: R$ 800,00", "Seu saldo é R$ 450,00"
 */
export function extractDetectedBalance(text: string): number | null {
  if (!text) return null;

  // Regex para capturar padrões de saldo
  const balanceMatch = text.match(/(?:saldo(?:\s+atual|\s+dispon[ií]vel|\s+em\s+conta|\s+da\s+conta|\s+em\s+carteira)?(?:\s+(?:[eé]|de))?|seu\s+saldo\s+(?:[eé]|de)?)\s*:?\s*R\$\s*([\d.,]+)/i);

  if (balanceMatch) {
    return parseBrlCurrency(balanceMatch[1]);
  }

  return null;
}

/**
 * Formata um número para moeda brasileira (R$ 1.234,56).
 */
export function formatBrlCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

/**
 * Formata um valor de entrada para moeda brasileira (BRL) de forma inteligente e dinâmica.
 * Conforme o usuário adiciona números, os pontos e vírgulas surgem automaticamente (estilo ATM / maquininha):
 * - Vazio -> ""
 * - Digita "3" -> "0,03"
 * - Digita "2" -> "0,32"
 * - Digita "0" -> "3,20"
 * - Digita "0" -> "32,00"
 * - Digita "0" -> "320,00"
 * - Digita "0" -> "3.200,00"
 * 
 * Suporta também números decimais/flutuantes diretos para carregamento inicial de edição (ex: 3.2 -> "3,20").
 * Suporta backspace inteligente mesmo que o usuário apague um separador de milhares ou vírgula.
 */
export function formatCurrencyInput(val: string | number | undefined | null, prevVal?: string): string {
  if (val === undefined || val === null || val === '') return '';

  if (typeof val === 'number') {
    if (isNaN(val) || val === 0) return '';
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const strVal = String(val).trim();
  if (!strVal) return '';

  let cleanDigits = strVal.replace(/\D/g, '');

  if (prevVal) {
    const prevDigits = String(prevVal).replace(/\D/g, '');
    if (strVal.length < String(prevVal).length && cleanDigits === prevDigits && cleanDigits.length > 0) {
      cleanDigits = cleanDigits.slice(0, -1);
    }
  }

  cleanDigits = cleanDigits.replace(/^0+/, '');

  if (!cleanDigits) return '';

  if (cleanDigits.length > 13) {
    cleanDigits = cleanDigits.slice(0, 13);
  }

  const cents = parseInt(cleanDigits, 10);
  if (isNaN(cents) || cents === 0) return '';

  const num = cents / 100;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
