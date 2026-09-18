/**
 * Sobra - Detector Inteligente de Compras Parceladas em Notificações Bancárias
 * 
 * Extrai número de parcelas, parcela atual, valor unitário e total
 * a partir de padrões como "em 10x de R$ 120,00", "em 3x", "parcelado em 5x", "1/10", etc.
 */

import { parseBrlCurrency } from './currencyHelper';

export interface DetectedInstallmentInfo {
  isInstallment: boolean;
  installmentCount: number;
  installmentNumber?: number;
  installmentAmount?: number;
  totalAmount?: number;
}

export function detectInstallments(rawText: string, baseAmount = 0): DetectedInstallmentInfo | null {
  if (!rawText) return null;

  const text = rawText.trim();

  // 1. Padrão "em 10x de R$ 120,00" ou "10x de 120,00" ou "parcelado em 5x de R$ 45,90"
  const countWithValMatch = text.match(/(?:em|de|parcelad[oa]\s+em)?\s*(\d{1,2})\s*[xX]\s*(?:de\s*)?R\$\s*([\d.,]+)/i);
  if (countWithValMatch) {
    const count = parseInt(countWithValMatch[1], 10);
    const parsedParcelVal = parseBrlCurrency(countWithValMatch[2]);

    if (count >= 2 && count <= 36 && parsedParcelVal && parsedParcelVal > 0) {
      const total = Math.round(parsedParcelVal * count * 100) / 100;
      return {
        isInstallment: true,
        installmentCount: count,
        installmentNumber: 1,
        installmentAmount: parsedParcelVal,
        totalAmount: baseAmount > parsedParcelVal ? baseAmount : total,
      };
    }
  }

  // 2. Padrão "parcela 1/10" ou "1/10x" ou "1 de 10"
  const fractionMatch = text.match(/(?:parcela\s+)?(\d{1,2})\s*(?:\/|\s+de\s+)(\d{1,2})\s*[xX]?/i);
  if (fractionMatch) {
    const current = parseInt(fractionMatch[1], 10);
    const totalParcels = parseInt(fractionMatch[2], 10);
    if (totalParcels >= 2 && totalParcels <= 36 && current >= 1 && current <= totalParcels) {
      const parcelVal = baseAmount > 0 ? baseAmount : undefined;
      const total = parcelVal ? Math.round(parcelVal * totalParcels * 100) / 100 : undefined;
      return {
        isInstallment: true,
        installmentCount: totalParcels,
        installmentNumber: current,
        installmentAmount: parcelVal,
        totalAmount: total,
      };
    }
  }

  // 3. Padrão "em 6x" ou "parcelado em 10x" ou "10x no cartão"
  const simpleCountMatch = text.match(/(?:em|parcelad[oa]\s+em|em\s+at[ée])\s*(\d{1,2})\s*[xX](?:\s+(?:no|no\s+cart[ãa]o|sem\s+juros))?/i);
  if (simpleCountMatch) {
    const count = parseInt(simpleCountMatch[1], 10);
    if (count >= 2 && count <= 36) {
      const parcelVal = baseAmount > 0 ? Math.round((baseAmount / count) * 100) / 100 : undefined;
      return {
        isInstallment: true,
        installmentCount: count,
        installmentNumber: 1,
        installmentAmount: parcelVal,
        totalAmount: baseAmount > 0 ? baseAmount : undefined,
      };
    }
  }

  // 4. Padrão "em 10 parcelas" ou "10 vezes" ou "parcelado em 3 vezes"
  const wordMatch = text.match(/(?:em|parcelad[oa]\s+em)?\s*(\d{1,2})\s*(?:parcelas|vezes)(?:\s+de\s*R\$\s*([\d.,]+))?/i);
  if (wordMatch) {
    const count = parseInt(wordMatch[1], 10);
    const parcelValStr = wordMatch[2];
    const parsedParcelVal = parcelValStr ? parseBrlCurrency(parcelValStr) : undefined;

    if (count >= 2 && count <= 36) {
      const parcelAmount = parsedParcelVal || (baseAmount > 0 ? Math.round((baseAmount / count) * 100) / 100 : undefined);
      const total = parsedParcelVal ? Math.round(parsedParcelVal * count * 100) / 100 : (baseAmount > 0 ? baseAmount : undefined);

      return {
        isInstallment: true,
        installmentCount: count,
        installmentNumber: 1,
        installmentAmount: parcelAmount,
        totalAmount: total,
      };
    }
  }

  return null;
}
