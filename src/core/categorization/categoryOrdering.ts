/**
 * Sobra - Ordenação e Pesquisa Inteligente de Categorias
 * 
 * Organiza as categorias por frequência de uso real (transações)
 * e prioridade comportamental do cotidiano financeiro brasileiro.
 * Categorias mais usadas ficam no topo; "Outras Despesas" fica no rodapé.
 */

import { Category, Transaction } from '../types';

/**
 * Mapeamento de prioridades padrão baseado no cotidiano financeiro (0 a 1000)
 */
export const CATEGORY_BASE_PRIORITY: Record<string, number> = {
  // RECEITAS
  'cat-salario': 1000,        // Salário & Renda (Receita principal)
  'cat-freelas': 850,         // Freelas & Renda Extra
  'cat-invest': 700,          // Rendimentos & Investimentos
  'cat-outras-rec': 1,        // Outras Receitas (Sempre rodapé)

  // DESPESAS: Alimentação & Cozinha vs Comer fora
  'cat-mercado': 1000,        // Supermercado & Feira (Maior frequência no mês)
  'cat-restaurantes': 980,    // Restaurantes & Delivery

  // DESPESAS: Transporte & Deslocamento diário
  'cat-transp': 920,          // Transporte & Mobilidade (Uber, 99, Ônibus, Combustível)

  // DESPESAS: Moradia & Contas Fixas
  'cat-moradia': 880,         // Moradia (Aluguel, Condomínio, IPTU, Reforma/Manutenção)
  'cat-contas': 850,          // Contas Residenciais (Luz, Água, Gás, Internet, Telefone)

  // DESPESAS: Saúde & Farmácia
  'cat-farmacia': 800,        // Farmácia & Remédios
  'cat-saude': 760,           // Saúde & Consultas

  // DESPESAS: Estilo de Vida, Assinaturas & Lazer
  'cat-compras': 720,         // Compras & Vestuário
  'cat-streaming': 680,       // Assinaturas & Streaming (Netflix, Spotify, Google, etc.)
  'cat-lazer': 640,           // Lazer & Games (Cinema, Jogos, Steam, Shows, Viagens)
  'cat-cuidados': 600,        // Cuidados & Beleza
  'cat-pets': 580,            // Pets (Ração, Veterinário, Pet Shop)

  // DESPESAS: Educação, Dívidas & Presentes
  'cat-educ': 520,            // Educação (Faculdade, Cursos, Escola)
  'cat-dividas': 460,         // Dívidas & Financiamentos
  'cat-presentes': 400,       // Presentes & Doações

  // DESPESAS: Metas de Futuro & Aportes
  'cat-invest-futuro': 350,   // Investimentos & Reserva (Aportes, Caixinha, Poupança)

  // DESPESAS: Fallback / Menos usada (Sempre rodapé absoluto)
  'cat-outros-desp': 1,       // Outras Despesas
};

/**
 * Sinônimos e termos de busca rápida para cada categoria
 */
const CATEGORY_SEARCH_SYNONYMS: Record<string, string[]> = {
  'cat-mercado': ['supermercado', 'mercado', 'feira', 'hortifruti', 'sacolao', 'acougue', 'padaria', 'alimentacao', 'comida', 'dispensa', 'compras do mes'],
  'cat-restaurantes': ['ifood', '99food', 'delivery', 'restaurante', 'bar', 'pizzaria', 'hamburgueria', 'sushi', 'choperia', 'boteco', 'lanche', 'refeicao', 'almoco', 'jantar', 'cafe', 'alimentacao', 'comida'],
  'cat-transp': ['combustivel', 'gasolina', 'etanol', 'alcool', 'posto', 'shell', 'ipiranga', 'pedagio', 'estacionamento', 'carro', 'uber', '99', 'taxi', 'onibus', 'metro', 'cptm', 'passagem', 'bilhete unico', 'top', 'corrida', 'transporte', 'mobilidade'],
  'cat-farmacia': ['drogaria', 'farmacia', 'remedio', 'medicamento', 'panvel', 'drogasil', 'raia', 'pacheco'],
  'cat-saude': ['medico', 'consulta', 'exame', 'dentista', 'hospital', 'clinica', 'terapia', 'psicologo', 'plano de saude'],
  'cat-moradia': ['aluguel', 'condominio', 'iptu', 'casa', 'apartamento', 'quinto andar', 'loft', 'reforma', 'obra', 'leroy merlin', 'construcao', 'encanador', 'eletricista', 'pintura', 'conserto', 'manutencao', 'moradia'],
  'cat-contas': ['luz', 'agua', 'energia', 'gas', 'internet', 'fibra', 'sabesp', 'enel', 'cpfl', 'vivo', 'claro', 'tim', 'telefone', 'contas'],
  'cat-streaming': ['netflix', 'spotify', 'prime video', 'disney', 'hbo', 'max', 'deezer', 'youtube', 'chatgpt', 'icloud', 'google', 'google play', 'google one', 'assinatura'],
  'cat-compras': ['roupa', 'vestuario', 'calcados', 'tenis', 'shopee', 'amazon', 'mercado livre', 'shein', 'zara', 'renner', 'loja', 'compras'],
  'cat-lazer': ['cinema', 'show', 'viagem', 'hotel', 'passeio', 'teatro', 'ingresso', 'parque', 'airbnb', 'praia', 'steam', 'playstation', 'ps5', 'xbox', 'nintendo', 'gamepass', 'jogo', 'jogos', 'riot', 'games', 'game', 'lazer', 'entretenimento'],
  'cat-cuidados': ['salao', 'barbearia', 'cabelo', 'unha', 'estetica', 'perfumaria', 'cosmeticos', 'boticario', 'natura', 'beleza'],
  'cat-pets': ['pet', 'pets', 'animal', 'animais', 'cachorro', 'gato', 'racao', 'veterinario', 'pet shop', 'petz', 'cobasi', 'banho e tosa'],
  'cat-educ': ['faculdade', 'escola', 'colegio', 'curso', 'cursos', 'livro', 'mensalidade', 'alura', 'udemy', 'ingles', 'idiomas', 'educacao'],
  'cat-dividas': ['emprestimo', 'financiamento', 'divida', 'parcelamento', 'renegociacao', 'acordo', 'juros', 'banco', 'dividas'],
  'cat-presentes': ['presente', 'aniversario', 'doacao', 'lembrancinha', 'casamento', 'presentes'],
  'cat-invest-futuro': ['investimento', 'investimentos', 'reserva', 'emergencia', 'colchao', 'poupanca', 'seguranca', 'caixinha', 'cofrinho', 'cdb', 'tesouro direto', 'acoes', 'fiis', 'renda fixa', 'previdencia'],
  'cat-salario': ['salario', 'holerite', 'pro-labore', 'pagamento', 'empresa', 'folha', 'trabalho', 'renda'],
  'cat-freelas': ['freela', 'freelancer', 'bico', 'extra', 'venda', 'consultoria'],
  'cat-invest': ['dividendos', 'juros', 'rendimento', 'lucro', 'cdi', 'aluguel recebido'],
  'cat-outras-rec': ['reembolso', 'devolucao', 'cashback', 'premio', 'sorteio', 'estorno'],
};

/**
 * Normaliza um texto para busca (minúsculas, sem acentos, sem pontuação extra)
 */
export function normalizeCategoryText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[*#.,\-_/\\()&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula a distância de Levenshtein entre duas strings para tolerância a erros de digitação (typos)
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Verifica se duas palavras são similares (tolerância a typos e aproximações fonéticas)
 */
export function isFuzzyMatchWord(queryWord: string, targetWord: string): boolean {
  if (queryWord === targetWord) return true;
  if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) return true;

  const maxLen = Math.max(queryWord.length, targetWord.length);
  if (maxLen <= 3) return false;

  const maxDistance = maxLen <= 5 ? 1 : 2;
  return levenshteinDistance(queryWord, targetWord) <= maxDistance;
}

/**
 * Calcula a pontuação de prioridade de uma categoria
 */
export function getCategoryBasePriority(category: Category): number {
  return CATEGORY_BASE_PRIORITY[category.id] ?? (category.isCustom ? 500 : 100);
}

/**
 * Retorna um mapa de contagem de uso de cada categoria nas transações
 */
export function getCategoryUsageMap(transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!transactions) return map;
  transactions.forEach(t => {
    if (t.categoryId) {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + 1);
    }
  });
  return map;
}

/**
 * Verifica se uma categoria é a de fallback ("Outras Despesas")
 */
export function isFallbackCategory(category: Category): boolean {
  return category.id === 'cat-outros-desp' || category.id === 'cat-outras-rec';
}

/**
 * Ordena as categorias de forma inteligente com base no uso real e prioridade comportamental
 */
export function sortCategoriesIntelligently(
  categories: Category[],
  transactions: Transaction[]
): Category[] {
  if (!categories || categories.length === 0) return [];

  // Mapear frequência de uso de cada categoria nas transações
  const usageCountMap = getCategoryUsageMap(transactions);

  return [...categories].sort((a, b) => {
    // 0. Fallbacks (Outras Despesas / Outras Receitas) SEMPRE no rodapé absoluto
    const aIsFallback = isFallbackCategory(a);
    const bIsFallback = isFallbackCategory(b);
    if (aIsFallback && !bIsFallback) return 1;
    if (!aIsFallback && bIsFallback) return -1;

    // 1. Frequência de uso real
    const countA = usageCountMap.get(a.id) || 0;
    const countB = usageCountMap.get(b.id) || 0;
    if (countB !== countA) {
      return countB - countA;
    }

    // 2. Prioridade base do dia a dia
    const prioA = getCategoryBasePriority(a);
    const prioB = getCategoryBasePriority(b);
    if (prioB !== prioA) {
      return prioB - prioA;
    }

    // 3. Desempate alfabético
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Filtra categorias de forma inteligente com pesquisa fonética, tolerância a typos e sinônimos semânticos
 */
export function filterCategoriesBySearch(
  categories: Category[],
  query: string
): Category[] {
  const normQuery = normalizeCategoryText(query);
  if (!normQuery) return categories;

  const queryWords = normQuery.split(' ').filter(w => w.length > 0);

  return categories.filter(cat => {
    const normName = normalizeCategoryText(cat.name);
    const nameWords = normName.split(' ');

    // 1. Match direto no nome completo
    if (normName.includes(normQuery)) return true;

    // 2. Match por palavras aproximadas no nome (tolerância a typos como 'trasporte', 'supermecado')
    const nameFuzzy = queryWords.every(qw => 
      nameWords.some(nw => isFuzzyMatchWord(qw, nw))
    );
    if (nameFuzzy) return true;

    // 3. Match em sinônimos conhecidos e aproximações fonéticas
    const synonyms = CATEGORY_SEARCH_SYNONYMS[cat.id] || [];
    for (let i = 0; i < synonyms.length; i++) {
      const synNorm = normalizeCategoryText(synonyms[i]);
      if (synNorm.includes(normQuery) || normQuery.includes(synNorm)) {
        return true;
      }

      const synWords = synNorm.split(' ');
      const synFuzzy = queryWords.every(qw => 
        synWords.some(sw => isFuzzyMatchWord(qw, sw))
      );
      if (synFuzzy) return true;
    }

    return false;
  });
}
