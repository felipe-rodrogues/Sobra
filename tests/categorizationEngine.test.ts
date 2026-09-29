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
    // Ifood -> Restaurantes & Delivery
    const ifoodCat = categorizationEngine.suggestCategory('IFOOD *RESTAURANTE', categories);
    expect(ifoodCat).toBeDefined();
    expect(ifoodCat?.id).toBe('cat-restaurantes');

    // Uber / 99 -> Transporte & Mobilidade (Consistência entre aplicativos de carona e transporte)
    const uberCat = categorizationEngine.suggestCategory('Uber *Viagem Sp', categories);
    expect(uberCat).toBeDefined();
    expect(uberCat?.id).toBe('cat-transp');

    const noventaCat = categorizationEngine.suggestCategory('99*CORRIDA SAO PAULO', categories);
    expect(noventaCat).toBeDefined();
    expect(noventaCat?.id).toBe('cat-transp');

    const noventaFoodCat = categorizationEngine.suggestCategory('99 FOOD *LANCHES', categories);
    expect(noventaFoodCat).toBeDefined();
    expect(noventaFoodCat?.id).toBe('cat-restaurantes');

    // Drogasil -> Farmácia & Remédios
    const farmaciaCat = categorizationEngine.suggestCategory('Drogasil 123 Farmacia', categories);
    expect(farmaciaCat).toBeDefined();
    expect(farmaciaCat?.id).toBe('cat-farmacia');

    // Netflix -> Assinaturas & Streaming
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

  it('deve sugerir Google e seus serviços como Assinaturas & Streaming e NUNCA Alimentação', () => {
    // Casos Google reportados pelo usuário
    const googleOnly = categorizationEngine.suggestCategory('google', categories);
    expect(googleOnly).toBeDefined();
    expect(googleOnly?.id).toBe('cat-streaming');

    const googlePlay = categorizationEngine.suggestCategory('Google Play Games', categories);
    expect(googlePlay).toBeDefined();
    expect(googlePlay?.id).toBe('cat-streaming');

    const googleStorage = categorizationEngine.suggestCategory('Google Storage Monthly', categories);
    expect(googleStorage).toBeDefined();
    expect(googleStorage?.id).toBe('cat-streaming');

    const googleWorkspace = categorizationEngine.suggestCategory('Google Workspace GSuite', categories);
    expect(googleWorkspace).toBeDefined();
    expect(googleWorkspace?.id).toBe('cat-streaming');

    const youtube = categorizationEngine.suggestCategory('Youtube Premium', categories);
    expect(youtube).toBeDefined();
    expect(youtube?.id).toBe('cat-streaming');
  });

  it('deve garantir paridade e consistência entre Uber e 99 em Transporte & Mobilidade', () => {
    // Uber e 99 como termos puros
    const uber = categorizationEngine.suggestCategory('uber', categories);
    const noventa = categorizationEngine.suggestCategory('99', categories);
    const noventaApp = categorizationEngine.suggestCategory('99app', categories);
    const noventaPop = categorizationEngine.suggestCategory('99 pop', categories);

    expect(uber).toBeDefined();
    expect(noventa).toBeDefined();
    expect(noventaApp).toBeDefined();
    expect(noventaPop).toBeDefined();

    // Ambos devem apontar para a MESMA categoria unificada: Transporte & Mobilidade
    expect(uber?.id).toBe('cat-transp');
    expect(noventa?.id).toBe('cat-transp');
    expect(noventaApp?.id).toBe('cat-transp');
    expect(noventaPop?.id).toBe('cat-transp');

    // Serviços de alimentação devem desviar para Restaurantes & Delivery
    const uberEats = categorizationEngine.suggestCategory('Uber Eats Lanches', categories);
    const noventaFood = categorizationEngine.suggestCategory('99food Entrega', categories);
    expect(uberEats?.id).toBe('cat-restaurantes');
    expect(noventaFood?.id).toBe('cat-restaurantes');

    // Postos de combustível e pedágios também vão para Transporte & Mobilidade
    const posto = categorizationEngine.suggestCategory('Posto Ipiranga Gasolina', categories);
    const pedagio = categorizationEngine.suggestCategory('Sem Parar Pedagio', categories);
    expect(posto?.id).toBe('cat-transp');
    expect(pedagio?.id).toBe('cat-transp');
  });

  it('deve diferenciar Mercado Livre e Mercado Pago de Supermercados físicos', () => {
    const meli = categorizationEngine.suggestCategory('Mercado Livre Compras', categories);
    expect(meli?.id).toBe('cat-compras');

    const meliPago = categorizationEngine.suggestCategory('Mercado Pago', categories);
    expect(meliPago?.id).toBe('cat-compras');

    const superm = categorizationEngine.suggestCategory('Supermercado Carrefour', categories);
    expect(superm?.id).toBe('cat-mercado');
  });

  it('não deve permitir que uma regra de usuário composta capture um termo genérico curto', () => {
    // Regra aprendida específica: "google play ifood" -> cat-restaurantes
    const compoundRule: CategoryRule = {
      id: 'rule-test-1',
      merchantPattern: 'google play ifood',
      categoryId: 'cat-restaurantes',
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };

    // Ao digitar apenas "google", NÃO deve casar com "google play ifood"
    // Deve ignorar a regra mais longa e cair no padrão correto (cat-streaming)
    const suggestion = categorizationEngine.suggestCategory('google', categories, [compoundRule]);
    expect(suggestion?.id).toBe('cat-streaming');
  });

  it('deve auto-sanitizar regras contaminadas (ex: google em alimentação ou 99 em transporte legado)', () => {
    // Regra contaminada onde "google" ficou salvo em alimentação
    const poisonedGoogleRule: CategoryRule = {
      id: 'rule-poisoned-google',
      merchantPattern: 'google',
      categoryId: 'cat-alim',
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };

    // Regra legada onde "99" ou qualquer regra antiga ficou salva na categoria extinta cat-mobilidade
    const legacyMobilityRule: CategoryRule = {
      id: 'rule-legacy-99',
      merchantPattern: '99',
      categoryId: 'cat-mobilidade',
      userOverride: true,
      updatedAt: new Date().toISOString(),
    };

    // Sanitiza
    const sanitized = categorizationEngine.sanitizeUserRules(
      [poisonedGoogleRule, legacyMobilityRule],
      categories
    );

    // Google deve ter sido curado para cat-streaming
    const googleRule = sanitized.find(r => r.merchantPattern === 'google');
    expect(googleRule?.categoryId).toBe('cat-streaming');

    // 99 deve ter sido curado de cat-mobilidade para a categoria consolidada cat-transp
    const noventaRule = sanitized.find(r => r.merchantPattern === '99');
    expect(noventaRule?.categoryId).toBe('cat-transp');

    // suggestCategory com as regras em banco sugere corretamente
    const resGoogle = categorizationEngine.suggestCategory('google', categories, [poisonedGoogleRule]);
    expect(resGoogle?.id).toBe('cat-streaming');

    const res99 = categorizationEngine.suggestCategory('99', categories, [legacyMobilityRule]);
    expect(res99?.id).toBe('cat-transp');
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
    expect(updatedSuggestion?.name).toBe('Lazer');
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
