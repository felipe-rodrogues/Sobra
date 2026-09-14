/**
 * Sobra - Motor de Categorização Inteligente Local (100% On-Device)
 * 
 * Processamento local sem IA em nuvem.
 * Prioridade:
 * 1. Regras aprendidas e correções manuais do usuário (CategoryRule)
 * 2. Mapeamento heurístico de palavras-chave locais
 */

import { Category, CategoryRule } from '../types';

export interface KeywordCategoryMapping {
  keywords: string[];
  categoryMatch: string;
}

export class CategorizationEngine {
  private defaultRules: KeywordCategoryMapping[] = [
    {
      keywords: ['uber', '99', 'posto', 'shell', 'ipiranga', 'gasolina', 'combustivel', 'pedagio', 'estacionamento', 'sem parar', 'veloe', 'mobil', 'auto posto'],
      categoryMatch: 'transporte',
    },
    {
      keywords: ['ifood', 'rappi', 'restaurante', 'padaria', 'pizzaria', 'mercado', 'supermercado', 'pao de acucar', 'carrefour', 'atacadao', 'acougue', 'mcdonalds', 'burger', 'bar', 'lanchonete', 'habibs', 'subway', 'starbucks', 'hortifruti', 'cafeteria', 'bistro'],
      categoryMatch: 'alimentação',
    },
    {
      keywords: ['farmacia', 'drogaria', 'panvel', 'raia', 'drogasil', 'hospital', 'consulta', 'laboratorio', 'medico', 'saude', 'dentista', 'otica', 'clinica', 'farm'],
      categoryMatch: 'saúde',
    },
    {
      keywords: ['netflix', 'spotify', 'cinema', 'steam', 'playstation', 'xbox', 'disney', 'prime video', 'show', 'ingresso', 'sympla', 'livraria', 'cultura', 'deezer', 'hbo', 'max', 'paramount', 'crunchyroll', 'apple tv'],
      categoryMatch: 'lazer',
    },
    {
      keywords: ['luz', 'enel', 'cpfl', 'agua', 'sabesp', 'internet', 'vivo', 'claro', 'tim', 'aluguel', 'condominio', 'eletricidade', 'gas', 'comgas', 'energia'],
      categoryMatch: 'moradia',
    },
    {
      keywords: ['salario', 'empresa', 'pagamento', 'ted recebida', 'rendimento', 'pro-labore', 'remuneracao', 'folha'],
      categoryMatch: 'salário',
    },
    {
      keywords: ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'coursera', 'alura', 'idiomas', 'colegio'],
      categoryMatch: 'educação',
    },
    {
      keywords: ['amazon', 'mercado livre', 'shopee', 'shein', 'magalu', 'magazine luiza', 'zara', 'renner', 'riachuelo', 'c&a', 'loja', 'vestuario', 'aliexpress'],
      categoryMatch: 'compras',
    },
  ];

  /**
   * Normaliza o nome do estabelecimento para comparação insensível a acentos, maiúsculas e símbolos
   */
  normalize(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[*#.,\-_/\\()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sugere a categoria mais adequada para um estabelecimento
   */
  suggestCategory(
    merchantName: string, 
    categories: Category[], 
    userRules: CategoryRule[] = []
  ): Category | undefined {
    if (!merchantName || categories.length === 0) return undefined;

    const normalizedMerchant = this.normalize(merchantName);
    if (!normalizedMerchant) return undefined;

    // 1. PRIORIDADE MÁXIMA: Regras aprendidas com correções do usuário
    // Ordenar por tamanho decrescente do padrão para dar preferência a termos mais específicos
    const sortedUserRules = [...userRules].sort(
      (a, b) => b.merchantPattern.length - a.merchantPattern.length
    );

    for (const rule of sortedUserRules) {
      const normalizedRulePattern = this.normalize(rule.merchantPattern);
      if (!normalizedRulePattern) continue;

      // Correspondência exata ou contenção mútua
      if (
        normalizedMerchant === normalizedRulePattern ||
        normalizedMerchant.includes(normalizedRulePattern) ||
        normalizedRulePattern.includes(normalizedMerchant)
      ) {
        const found = categories.find(c => c.id === rule.categoryId);
        if (found) return found;
      }
    }

    // 2. SEGUNDA PRIORIDADE: Mapeamento padrão de palavras-chave
    for (const rule of this.defaultRules) {
      const match = rule.keywords.some(keyword => {
        const normKeyword = this.normalize(keyword);
        if (!normKeyword) return false;
        // Se a palavra-chave for curta (ex: '99', 'c&a') ou numérica, exigir palavra isolada para evitar falsos positivos
        if (normKeyword.length <= 2 || /^\d+$/.test(normKeyword)) {
          const words = normalizedMerchant.split(' ');
          return words.includes(normKeyword);
        }
        return normalizedMerchant.includes(normKeyword);
      });

      if (match) {
        const found = categories.find(c => {
          const normCat = this.normalize(c.name);
          const normMatch = this.normalize(rule.categoryMatch);
          return normCat.includes(normMatch) || normMatch.includes(normCat);
        });
        if (found) return found;
      }
    }

    return undefined;
  }

  /**
   * Cria uma regra aprendida a partir da escolha do usuário
   */
  createRule(merchantName: string, categoryId: string): CategoryRule {
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      merchantPattern: this.normalize(merchantName),
      categoryId,
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const categorizationEngine = new CategorizationEngine();
