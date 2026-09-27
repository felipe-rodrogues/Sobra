import { describe, it, expect } from 'vitest';
import { categorizationEngine } from '../src/core/categorization/categorizationEngine';
import { Category, CategoryRule } from '../src/core/types';
import { INITIAL_CATEGORIES } from '../src/database/schema';

describe('CategorizationEngine (100% Local & On-Device)', () => {
  const categories: Category[] = INITIAL_CATEGORIES.map(c => ({
    ...c,
    createdAt: new Date().toISOString(),
  }));

  it('deve sugerir categorias corretas a partir de palavras-chave padrão pré-mapeadas', () => {
    // Ifood -> Restaurantes & Delivery (Mais preciso que Alimentação genérica)
    const ifoodCat = categorizationEngine.suggestCategory('IFOOD *RESTAURANTE', categories);
    expect(ifoodCat).toBeDefined();
    expect(ifoodCat?.id).toBe('cat-restaurantes');

    // Uber / 99 -> Mobilidade Urbana (Mais preciso que Transporte genérico)
    const uberCat = categorizationEngine.suggestCategory('Uber *Viagem Sp', categories);
    expect(uberCat).toBeDefined();
    expect(uberCat?.id).toBe('cat-mobilidade');

    const noventaCat = categorizationEngine.suggestCategory('99*CORRIDA SAO PAULO', categories);
    expect(noventaCat).toBeDefined();
    expect(noventaCat?.id).toBe('cat-mobilidade');

    const noventaFoodCat = categorizationEngine.suggestCategory('99 FOOD *LANCHES', categories);
    expect(noventaFoodCat).toBeDefined();
    expect(noventaFoodCat?.id).toBe('cat-restaurantes');

    // Drogasil -> Farmácia & Remédios (Mais preciso que Saúde genérica)
    const farmaciaCat = categorizationEngine.suggestCategory('Drogasil 123 Farmacia', categories);
    expect(farmaciaCat).toBeDefined();
    expect(farmaciaCat?.id).toBe('cat-farmacia');

    // Netflix -> Assinaturas & Streaming (Mais preciso que Lazer genérico)
    const netflixCat = categorizationEngine.suggestCategory('Netflix Mensalidade', categories);
    expect(netflixCat).toBeDefined();
    expect(netflixCat?.id).toBe('cat-streaming');

    // Sabesp -> Contas Residenciais
    const contasCat = categorizationEngine.suggestCategory('Sabesp Saneamento', categories);
    expect(contasCat).toBeDefined();
    expect(contasCat?.id).toBe('cat-contas');

    // Salário -> Salário & Renda
    const salarioCat = categorizationEngine.suggestCategory('TED Recebida - Salario Empresa', categories);
    expect(salarioCat).toBeDefined();
    expect(salarioCat?.id).toBe('cat-salario');
  });

  it('deve normalizar acentos, maiúsculas/minúsculas e pontuação bancária', () => {
    const norm1 = categorizationEngine.normalize('PÃO DE AÇÚCAR #402');
    expect(norm1).toBe('pao de acucar 402');

    const norm2 = categorizationEngine.normalize('UBER* TRIP *HELP.UBER.COM');
    expect(norm2).toBe('uber trip help uber com');

    const matchPao = categorizationEngine.suggestCategory('PÃO DE AÇÚCAR LOJA 10', categories);
    expect(matchPao?.id).toBe('cat-mercado');
  });

  it('deve priorizar regras aprendidas com correções manuais do usuário sobre o mapeamento padrão', () => {
    // Cenário: "Padaria do Bairro" normalmente seria Supermercado & Feira
    const initialSuggestion = categorizationEngine.suggestCategory('Padaria do Bairro', categories);
    expect(initialSuggestion?.id).toBe('cat-mercado');

    // O usuário reclassifica para "Lazer & Entretenimento" (cat-lazer)
    const learnedRule: CategoryRule = categorizationEngine.createRule('Padaria do Bairro', 'cat-lazer');
    expect(learnedRule.merchantPattern).toBe('padaria do bairro');
    expect(learnedRule.categoryId).toBe('cat-lazer');

    // Na próxima sugestão para esse estabelecimento, deve sugerir Lazer prioritariamente!
    const updatedSuggestion = categorizationEngine.suggestCategory(
      'Padaria do Bairro',
      categories,
      [learnedRule]
    );

    expect(updatedSuggestion).toBeDefined();
    expect(updatedSuggestion?.id).toBe('cat-lazer');
    expect(updatedSuggestion?.name).toBe('Lazer & Entretenimento');
  });

  it('deve aprender novos estabelecimentos desconhecidos que não possuem palavras-chave prévias', () => {
    // Estabelecimento sem palavra-chave conhecida
    const unknownMerchant = 'TechSolutions Informática Ltda';
    const beforeLearning = categorizationEngine.suggestCategory(unknownMerchant, categories);
    expect(beforeLearning).toBeUndefined();

    // Usuário categoriza como Educação
    const newRule = categorizationEngine.createRule(unknownMerchant, 'cat-educ');

    // Agora o sistema aprendeu e sugere Educação
    const afterLearning = categorizationEngine.suggestCategory(
      'TechSolutions Informatica',
      categories,
      [newRule]
    );
    expect(afterLearning).toBeDefined();
    expect(afterLearning?.id).toBe('cat-educ');
  });

  it('deve retornar undefined quando não há correspondência e nenhuma regra aprendida', () => {
    const result = categorizationEngine.suggestCategory('Xyz123Inexistente999', categories);
    expect(result).toBeUndefined();
  });
});
