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

  // Remove "R$", espaços e caracteres não numéricos exceto vírgula e ponto
  let clean = valueStr.replace(/R\$\s*/gi, '').trim();

  // Caso tenha ponto de milhar e vírgula de centavos: "1.250,50"
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } 
  // Caso tenha apenas vírgula: "45,90"
  else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
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
