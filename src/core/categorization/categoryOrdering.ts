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

  // DESPESAS: Alimentação & Consumo Diário (Maior frequência no mês)
  'cat-alim': 1000,           // Alimentação Geral / Refeições
  'cat-mercado': 980,         // Supermercado & Feira
  'cat-restaurantes': 950,    // Restaurantes & Delivery

  // DESPESAS: Transporte & Deslocamento diário
  'cat-transp': 920,          // Transporte & Combustível
  'cat-mobilidade': 900,      // Mobilidade Urbana (Uber, 99, Ônibus, Metrô)

  // DESPESAS: Saúde & Compras Frequentes
  'cat-farmacia': 850,        // Farmácia & Remédios
  'cat-compras': 820,         // Compras & Vestuário

  // DESPESAS: Moradia & Contas Fixas Mensais
  'cat-contas': 780,          // Contas Residenciais (Luz, Água, Gás, Internet)
  'cat-moradia': 760,         // Moradia & Aluguel / Condomínio

  // DESPESAS: Estilo de Vida & Lazer
  'cat-streaming': 720,       // Assinaturas & Streaming (Netflix, Spotify, etc.)
  'cat-saude': 700,           // Saúde & Consultas
  'cat-lazer': 680,           // Lazer & Entretenimento
  'cat-cuidados': 640,        // Cuidados & Beleza
  'cat-pets': 620,            // Pets & Animais
  'cat-games': 580,           // Games & Hobbies

  // DESPESAS: Desenvolvimento, Compromissos & Manutenção
  'cat-educ': 520,            // Educação & Cursos
  'cat-presentes': 480,       // Presentes & Doações
  'cat-manutencao': 440,      // Casa & Manutenção
  'cat-dividas': 400,         // Dívidas & Financiamentos

  // DESPESAS: Metas de Futuro & Aportes
  'cat-reserva': 350,         // Reserva de Emergência
  'cat-invest-futuro': 320,   // Investimentos & Renda Fixa

  // DESPESAS: Fallback / Menos usada (Sempre rodapé absoluto)
  'cat-outros-desp': 1,       // Outras Despesas
};

/**
 * Sinônimos e termos de busca rápida para cada categoria
 */
const CATEGORY_SEARCH_SYNONYMS: Record<string, string[]> = {
  'cat-alim': ['almoco', 'jantar', 'lanche', 'refeicao', 'comida', 'padaria', 'cafe', 'alimentacao'],
  'cat-mercado': ['supermercado', 'mercado', 'feira', 'hortifruti', 'sacolao', 'acougue', 'compras do mes', 'dispensa'],
  'cat-restaurantes': ['ifood', '99food', 'delivery', 'restaurante', 'bar', 'pizzaria', 'hamburgueria', 'sushi', 'choperia', 'boteco'],
  'cat-transp': ['combustivel', 'gasolina', 'etanol', 'alcool', 'posto', 'shell', 'ipiranga', 'pedagio', 'estacionamento', 'carro'],
  'cat-mobilidade': ['uber', '99', 'taxi', 'onibus', 'metro', 'cptm', 'passagem', 'bilhete unico', 'top', 'corrida'],
  'cat-farmacia': ['drogaria', 'farmacia', 'remedio', 'medicamento', 'panvel', 'drogasil', 'raia', 'pacheco'],
  'cat-saude': ['medico', 'consulta', 'exame', 'dentista', 'hospital', 'clinica', 'terapia', 'psicologo', 'plano de saude'],
  'cat-moradia': ['aluguel', 'condominio', 'iptu', 'casa', 'apartamento', 'quinto andar', 'loft'],
  'cat-contas': ['luz', 'agua', 'energia', 'gas', 'internet', 'fibra', 'sabesp', 'enel', 'cpfl', 'vivo', 'claro', 'tim', 'telefone'],
  'cat-streaming': ['netflix', 'spotify', 'prime video', 'disney', 'hbo', 'max', 'deezer', 'youtube', 'chatgpt', 'icloud', 'assinatura'],
  'cat-compras': ['roupa', 'vestuario', 'calcados', 'tenis', 'shopee', 'amazon', 'mercado livre', 'shein', 'zara', 'renner', 'loja'],
  'cat-lazer': ['cinema', 'show', 'viagem', 'hotel', 'passeio', 'teatro', 'ingresso', 'parque', 'airbnb', 'praia'],
  'cat-cuidados': ['salao', 'barbearia', 'cabelo', 'unha', 'estetica', 'perfumaria', 'cosmeticos', 'boticario', 'natura'],
  'cat-pets': ['pet', 'cachorro', 'gato', 'racao', 'veterinario', 'pet shop', 'petz', 'cobasi', 'banho e tosa'],
  'cat-games': ['steam', 'playstation', 'ps5', 'xbox', 'nintendo', 'gamepass', 'jogo', 'jogos', 'riot'],
  'cat-educ': ['faculdade', 'escola', 'colegio', 'curso', 'livro', 'mensalidade', 'alura', 'udemy', 'ingles', 'idiomas'],
  'cat-dividas': ['emprestimo', 'financiamento', 'divida', 'parcelamento', 'renegociacao', 'acordo', 'juros', 'banco'],
  'cat-manutencao': ['reforma', 'obra', 'leroy merlin', 'construcao', 'encanador', 'eletricista', 'pintura', 'conserto'],
  'cat-presentes': ['presente', 'aniversario', 'doacao', 'lembrancinha', 'casamento'],
  'cat-reserva': ['reserva', 'emergencia', 'colchao', 'poupanca', 'seguranca'],
  'cat-invest-futuro': ['investimento', 'cdb', 'tesouro direto', 'acoes', 'fiis', 'renda fixa', 'previdencia'],
  'cat-salario': ['salario', 'holerite', 'pro-labore', 'pagamento', 'empresa', 'folha', 'trabalho', 'renda'],
  'cat-freelas': ['freela', 'freelancer', 'bico', 'extra', 'venda', 'consultoria'],
  'cat-invest': ['dividendos', 'juros', 'rendimento', 'lucro', 'cdi', 'aluguel recebido'],
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
 * Verifica se a categoria é considerada "Outras" / genérica de rodapé
 */
export function isFallbackCategory(category: Pick<Category, 'id' | 'name'>): boolean {
  if (category.id === 'cat-outros-desp' || category.id === 'cat-outras-rec') {
    return true;
  }
  const norm = normalizeCategoryText(category.name);
  return norm.includes('outras despesas') || 
         norm.includes('outras receitas') || 
         norm === 'outros' || 
         norm === 'outras' ||
         norm === 'diversos';
}

/**
 * Retorna a pontuação base de prioridade da categoria (0 a 1000)
 */
export function getCategoryBasePriority(category: Category): number {
  if (isFallbackCategory(category)) {
    return 1;
  }

  // 1. Checagem por ID oficial
  if (category.id && CATEGORY_BASE_PRIORITY[category.id] !== undefined) {
    return CATEGORY_BASE_PRIORITY[category.id];
  }

  // 2. Heurística pelo nome normalizado (para categorias legadas ou customizadas)
  const norm = normalizeCategoryText(category.name);

  if (category.type === 'income') {
    if (norm.includes('salario') || norm.includes('renda')) return 1000;
    if (norm.includes('freela') || norm.includes('extra') || norm.includes('bico')) return 850;
    if (norm.includes('rendimento') || norm.includes('invest') || norm.includes('dividendo')) return 700;
    return category.isCustom ? 750 : 500;
  }

  // Despesa
  if (norm.includes('alimen') || norm.includes('comida') || norm.includes('refeic')) return 1000;
  if (norm.includes('mercado') || norm.includes('feira')) return 980;
  if (norm.includes('restauran') || norm.includes('delivery') || norm.includes('ifood')) return 950;
  if (norm.includes('transp') || norm.includes('combust') || norm.includes('posto') || norm.includes('gasolina')) return 920;
  if (norm.includes('mobil') || norm.includes('uber') || norm.includes('onibus') || norm.includes('metro')) return 900;
  if (norm.includes('farmac') || norm.includes('remedio') || norm.includes('drogar')) return 850;
  if (norm.includes('compra') || norm.includes('vestuar') || norm.includes('roupa')) return 820;
  if (norm.includes('conta') || norm.includes('luz') || norm.includes('agua') || norm.includes('energia')) return 780;
  if (norm.includes('morad') || norm.includes('aluguel') || norm.includes('condomin')) return 760;
  if (norm.includes('stream') || norm.includes('assinat')) return 720;
  if (norm.includes('saude') || norm.includes('medic') || norm.includes('consul')) return 700;
  if (norm.includes('lazer') || norm.includes('cinema') || norm.includes('viag')) return 680;
  if (norm.includes('cuidado') || norm.includes('beleza') || norm.includes('salao')) return 640;
  if (norm.includes('pet') || norm.includes('animal')) return 620;
  if (norm.includes('game') || norm.includes('jogo')) return 580;
  if (norm.includes('educ') || norm.includes('curso') || norm.includes('escola')) return 520;
  if (norm.includes('present') || norm.includes('doac')) return 480;
  if (norm.includes('manuten') || norm.includes('casa') || norm.includes('obra')) return 440;
  if (norm.includes('divida') || norm.includes('financ') || norm.includes('emprest')) return 400;
  if (norm.includes('reserva')) return 350;
  if (norm.includes('invest')) return 320;

  // Categoria personalizada criada pelo usuário ganha prioridade destacada
  return category.isCustom ? 750 : 500;
}

/**
 * Cria um mapa de contagem de lançamentos por categoria a partir do histórico de transações
 */
export function getCategoryUsageMap(transactions: Transaction[] = []): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.categoryId) {
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + 1);
    }
  }
  return map;
}

/**
 * Organiza as categorias de forma inteligente:
 * 1. Prioriza categorias com maior frequência de uso real (mais transações no app).
 * 2. Em caso de empate de uso (ou zero lançamentos), aplica a prioridade comportamental do cotidiano.
 * 3. Categorias "Outras Despesas" / "Outras Receitas" são mantidas de forma consistente no rodapé.
 */
export function sortCategoriesIntelligently(
  categories: Category[],
  transactions?: Transaction[]
): Category[] {
  if (!categories || categories.length <= 1) return categories || [];

  const usageMap = transactions ? getCategoryUsageMap(transactions) : new Map<string, number>();

  return [...categories].sort((a, b) => {
    const isFallbackA = isFallbackCategory(a);
    const isFallbackB = isFallbackCategory(b);

    // Fallbacks ("Outras Despesas", "Outras Receitas") sempre vão para o final
    if (isFallbackA && !isFallbackB) return 1;
    if (!isFallbackA && isFallbackB) return -1;

    const countA = usageMap.get(a.id) || 0;
    const countB = usageMap.get(b.id) || 0;

    // 1. Mais usadas primeiro (por número de transações no histórico)
    if (countA !== countB) {
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
 * Filtra categorias de forma inteligente com pesquisa fonética e semântica por sinônimos
 */
export function filterCategoriesBySearch(
  categories: Category[],
  query: string
): Category[] {
  const normQuery = normalizeCategoryText(query);
  if (!normQuery) return categories;

  return categories.filter(cat => {
    const normName = normalizeCategoryText(cat.name);
    // 1. Match direto no nome
    if (normName.includes(normQuery)) return true;

    // 2. Match em sinônimos conhecidos
    const synonyms = CATEGORY_SEARCH_SYNONYMS[cat.id] || [];
    for (let i = 0; i < synonyms.length; i++) {
      const synNorm = normalizeCategoryText(synonyms[i]);
      if (synNorm.includes(normQuery) || normQuery.includes(synNorm)) {
        return true;
      }
    }

    return false;
  });
}
