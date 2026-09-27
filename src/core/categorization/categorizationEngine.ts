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
  fallbackMatch?: string;
}

export class CategorizationEngine {
  private defaultRules: KeywordCategoryMapping[] = [
    // 1. Delivery & Restaurantes (Estilo de Vida)
    {
      keywords: ['ifood', '99 food', '99food', 'rappi', 'restaurante', 'pizzaria', 'mcdonalds', 'burger', 'bar', 'lanchonete', 'habibs', 'subway', 'starbucks', 'cafeteria', 'bistro', 'kfc', 'choperia', 'boteco', 'hamburgueria', 'sorveteria', 'doceria', 'sushi'],
      categoryMatch: 'restaurantes',
      fallbackMatch: 'alimentação',
    },
    // 2. Supermercado & Feira (Essenciais)
    {
      keywords: ['mercado', 'supermercado', 'supermercados', 'pao de acucar', 'carrefour', 'atacadao', 'atacadista', 'atacado', 'assai', 'acougue', 'hortifruti', 'sacolao', 'padaria', 'emporio', 'dia supermercado', 'sonda', 'hipermercado', 'mercadinho'],
      categoryMatch: 'supermercado',
      fallbackMatch: 'alimentação',
    },
    // 3. Mobilidade Urbana (Essenciais)
    {
      keywords: ['uber', '99', '99app', 'app99', '99 pop', '99pop', '99 corrida', '99 corridas', '99 taxi', 'metro', 'onibus', 'cptm', 'sptrans', 'bilhete unico', 'top transporte', 'urba'],
      categoryMatch: 'mobilidade',
      fallbackMatch: 'transporte',
    },
    // 4. Transporte & Combustível (Essenciais)
    {
      keywords: ['posto', 'shell', 'ipiranga', 'gasolina', 'combustivel', 'pedagio', 'estacionamento', 'estapar', 'sem parar', 'veloe', 'mobil', 'auto posto', 'br mania', 'ipiranga ampm'],
      categoryMatch: 'transporte',
    },
    // 5. Farmácia & Remédios (Essenciais)
    {
      keywords: ['farmacia', 'drogaria', 'panvel', 'raia', 'drogasil', 'pacheco', 'ultrafarma', 'bifarma', 'farm', 'remedio', 'medicamento'],
      categoryMatch: 'farmácia',
      fallbackMatch: 'saúde',
    },
    // 6. Saúde & Consultas (Essenciais)
    {
      keywords: ['hospital', 'consulta', 'laboratorio', 'medico', 'saude', 'dentista', 'otica', 'clinica', 'terapia', 'psicologo', 'fisioterapia', 'fleury', 'lavoisier', 'dasa', 'unimed', 'bradesco saude', 'amil', 'notredame', 'prevent senior', 'hapvida'],
      categoryMatch: 'saúde',
    },
    // 7. Assinaturas & Streaming (Estilo de Vida)
    {
      keywords: ['netflix', 'spotify', 'prime video', 'amazon prime', 'disney', 'disney plus', 'disney+', 'max', 'hbo', 'paramount', 'crunchyroll', 'apple tv', 'deezer', 'youtube premium', 'youtube music', 'chatgpt', 'openai', 'icloud', 'google one', 'globo play', 'globoplay'],
      categoryMatch: 'streaming',
      fallbackMatch: 'lazer',
    },
    // 8. Games & Hobbies (Estilo de Vida)
    {
      keywords: ['steam', 'playstation', 'xbox', 'nintendo', 'epic games', 'gamepass', 'game pass', 'ps plus', 'ps+', 'play 5', 'ps5', 'blizzard', 'riot games'],
      categoryMatch: 'games',
      fallbackMatch: 'lazer',
    },
    // 9. Lazer & Entretenimento (Estilo de Vida)
    {
      keywords: ['cinema', 'cinemark', 'uci', 'ingresso', 'ticketmaster', 'eventim', 'sympla', 'ballunodome', 'show', 'teatro', 'parque', 'circo', 'museu', 'livraria', 'cultura', 'viagem', 'hospedagem', 'hotel', 'airbnb', 'decolar', 'booking'],
      categoryMatch: 'lazer',
    },
    // 10. Contas Residenciais (Essenciais)
    {
      keywords: ['luz', 'enel', 'cpfl', 'agua', 'sabesp', 'internet', 'fibra', 'nio fibra', 'vivo', 'claro', 'tim', 'eletricidade', 'gas', 'comgas', 'energia', 'sanepar', 'copasa', 'neoenergia'],
      categoryMatch: 'contas',
      fallbackMatch: 'moradia',
    },
    // 11. Moradia & Aluguel (Essenciais)
    {
      keywords: ['aluguel', 'condominio', 'iptu', 'quinto andar', 'quintoandar', 'loft', 'imobiliaria'],
      categoryMatch: 'moradia',
    },
    // 12. Casa & Manutenção (Essenciais)
    {
      keywords: ['obramax', 'leroy', 'leroy merlin', 'telhanorte', 'construcao', 'reforma', 'tintas', 'c&c', 'madeira', 'eletrica', 'hidraulica', 'marcenaria'],
      categoryMatch: 'manutenção',
      fallbackMatch: 'moradia',
    },
    // 13. Pets & Animais (Estilo de Vida)
    {
      keywords: ['pet', 'pet shop', 'petz', 'cobasi', 'veterinario', 'veterinaria', 'agropecuaria', 'pet house', 'banho e tosa', 'racao'],
      categoryMatch: 'pets',
      fallbackMatch: 'outras despesas',
    },
    // 14. Cuidados & Beleza (Estilo de Vida)
    {
      keywords: ['salao', 'barbearia', 'barbeiro', 'cabeleireiro', 'manicure', 'estetica', 'boticario', 'o boticario', 'natura', 'sephora', 'beleza na web', 'perfumaria'],
      categoryMatch: 'cuidados',
      fallbackMatch: 'compras',
    },
    // 15. Dívidas & Financiamentos (Essenciais)
    {
      keywords: ['consignado', 'emprestimo', 'financiamento', 'renegociacao', 'acordo', 'serasa', 'divida', 'parcelamento fatura'],
      categoryMatch: 'dívidas',
      fallbackMatch: 'outras despesas',
    },
    // 16. Educação & Cursos (Essenciais)
    {
      keywords: ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'coursera', 'alura', 'idiomas', 'colegio', 'pos graduacao', 'mba'],
      categoryMatch: 'educação',
    },
    // 17. Compras & Vestuário (Estilo de Vida)
    {
      keywords: ['amazon', 'mercado livre', 'mercadolivre', 'mercado pago', 'mercadopago', 'melimais', 'meli', 'shopee', 'shoppe', 'shein', 'magalu', 'magazine luiza', 'zara', 'renner', 'riachuelo', 'c&a', 'loja', 'vestuario', 'bijuteria', 'bijouteria', 'moda', 'aliexpress', 'centauro', 'netshoes', 'nike', 'adidas'],
      categoryMatch: 'compras',
    },
    // 18. Salário & Renda (Income)
    {
      keywords: ['salario', 'empresa', 'pagamento', 'ted recebida', 'rendimento', 'pro-labore', 'remuneracao', 'folha'],
      categoryMatch: 'salário',
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

        // Exceção importante: "mercado livre" não deve casar com o genérico "mercado" de supermercados
        if (normKeyword === 'mercado' && normalizedMerchant.includes('mercado livre')) {
          return false;
        }

        // Exceção: "99 food" não deve casar com o genérico "99" de transporte
        if (normKeyword === '99' && (normalizedMerchant.includes('food') || normalizedMerchant.includes('99food'))) {
          return false;
        }

        // Se a palavra-chave for curta (ex: 'max', 'bar', 'tim', '99', 'c&a') ou numérica, exigir palavra isolada
        if (normKeyword.length <= 3 || /^\d+$/.test(normKeyword)) {
          const words = normalizedMerchant.split(' ');
          return words.includes(normKeyword);
        }
        return normalizedMerchant.includes(normKeyword);
      });

      if (match) {
        let found = categories.find(c => {
          const normCat = this.normalize(c.name);
          const normMatch = this.normalize(rule.categoryMatch);
          return normCat.includes(normMatch) || normMatch.includes(normCat);
        });

        if (!found && rule.fallbackMatch) {
          found = categories.find(c => {
            const normCat = this.normalize(c.name);
            const normFallback = this.normalize(rule.fallbackMatch!);
            return normCat.includes(normFallback) || normFallback.includes(normCat);
          });
        }

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
