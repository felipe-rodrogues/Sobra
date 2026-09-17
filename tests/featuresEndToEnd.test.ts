import { describe, it, expect } from 'vitest';
import { db } from '../src/database/adapter';
import { categorizationEngine } from '../src/core/categorization/categorizationEngine';
import { recurrenceDetector } from '../src/core/subscriptions/recurrenceDetector';
import { Transaction, Subscription } from '../src/core/types';

describe('Ciclo Completo: Categorização Inteligente & Aba de Assinaturas', () => {
  it('deve validar o ciclo: sugestão correta -> correção manual melhora próxima sugestão -> recorrência é detectada e confirmada', async () => {
    // 1. Inicializar banco limpo
    await db.resetAll('demo');
    const categories = await db.getCategories();
    const accounts = await db.getAccounts();

    // 2. Fluxo de Categorização Inteligente Local:
    // Passo A: Sugestão padrão para 'iFood' deve ser Alimentação
    let rules = await db.getCategoryRules();
    const initialSuggestion = categorizationEngine.suggestCategory('iFood Restaurante', categories, rules);
    expect(initialSuggestion).toBeDefined();
    expect(initialSuggestion?.id).toBe('cat-alim');
    expect(initialSuggestion?.name).toBe('Alimentação');

    // Passo B: Usuário reclassifica manualmente para 'Lazer & Entretenimento' (cat-lazer) e salva
    const manualTx: Transaction = {
      id: 'tx-test-ifood-1',
      accountId: accounts[0].id,
      categoryId: 'cat-lazer', // Usuário escolheu Lazer!
      amount: 68.00,
      type: 'expense',
      description: 'iFood Restaurante',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Salva transação e registra o aprendizado
    await db.saveTransaction(manualTx);
    const learnedRule = categorizationEngine.createRule(manualTx.description, manualTx.categoryId);
    await db.saveCategoryRule(learnedRule);

    // Passo C: Na próxima vez que o usuário digitar 'iFood' (ou chegar notificação do iFood),
    // o sistema agora sugere Lazer & Entretenimento graças ao aprendizado local!
    rules = await db.getCategoryRules();
    const updatedSuggestion = categorizationEngine.suggestCategory('iFood', categories, rules);
    expect(updatedSuggestion).toBeDefined();
    expect(updatedSuggestion?.id).toBe('cat-lazer');
    expect(updatedSuggestion?.name).toBe('Lazer & Entretenimento');

    // 3. Fluxo de Detecção de Recorrência & Aba de Assinaturas:
    // Transações no banco de dados com cobranças semelhantes a cada ~30 dias
    const currentTxs = await db.getTransactions();
    const confirmedSubs = await db.getSubscriptions();
    const dismissed = await db.getDismissedSubscriptionMerchants();

    // Executar algoritmo de detecção
    const suggestions = recurrenceDetector.detectRecurringSubscriptions(
      currentTxs,
      confirmedSubs,
      dismissed,
      categories
    );

    // Deve detectar Spotify Premium (presente nas transações recorrentes de exemplo)
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const spotifySuggestion = suggestions.find(s => s.merchantName.toLowerCase().includes('spotify'));
    expect(spotifySuggestion).toBeDefined();
    expect(spotifySuggestion?.amount).toBe(21.90);
    expect(spotifySuggestion?.cadence).toBe('monthly');
    expect(spotifySuggestion?.intervalDays).toBeGreaterThanOrEqual(28);
    expect(spotifySuggestion?.intervalDays).toBeLessThanOrEqual(32);

    // Passo D: Usuário confirma a sugestão como Assinatura
    const newSubscription: Subscription = {
      id: 'sub-spotify-confirmed',
      name: spotifySuggestion!.merchantName,
      amount: spotifySuggestion!.amount,
      categoryId: spotifySuggestion!.categoryId,
      accountId: spotifySuggestion!.accountId,
      cadence: spotifySuggestion!.cadence,
      nextBillingDate: spotifySuggestion!.nextBillingDate,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveSubscription(newSubscription);

    // Passo E: Verificar que a assinatura confirmada aparece na lista
    const allSubs = await db.getSubscriptions();
    expect(allSubs.some(s => s.id === 'sub-spotify-confirmed')).toBe(true);

    // Passo F: Card com total gasto por mês soma todas as assinaturas ativas
    // Netflix (R$ 39.90) + Spotify (R$ 21.90) = R$ 61.80
    const totalMonthly = recurrenceDetector.calculateTotalMonthlyCost(allSubs);
    expect(totalMonthly).toBe(61.80);

    // Passo G: Aviso quando há mais de uma assinatura na mesma categoria
    // Netflix e Spotify estão ambas em 'cat-lazer'
    const overlaps = recurrenceDetector.detectCategoryOverlaps(allSubs, categories);
    expect(overlaps.length).toBe(1);
    expect(overlaps[0].categoryId).toBe('cat-lazer');
    expect(overlaps[0].subscriptions.length).toBe(2);
    expect(overlaps[0].totalMonthlyAmount).toBe(61.80);

    // Passo H: Testar descarte ("Não é assinatura")
    await db.dismissSubscriptionSuggestion('Algum Servico Esporadico');
    const dismissedList = await db.getDismissedSubscriptionMerchants();
    expect(dismissedList.includes('algum servico esporadico')).toBe(true);

    // 4. Confirmação de integridade do app existente
    // Transações manuais, contas, orçamentos e metas continuam íntegros
    expect(accounts.length).toBeGreaterThan(0);
    expect(categories.length).toBeGreaterThan(0);
    const budgets = await db.getBudgets();
    expect(budgets.length).toBeGreaterThan(0);
  });

  it('deve permitir editar cobranças (valor, categoria, descrição) e convertê-las em assinaturas ativas', async () => {
    await db.resetAll('demo');
    const accounts = await db.getAccounts();
    const categories = await db.getCategories();

    // 1. Criar uma cobrança que apareceu no app (ex: originada de extrato ou notificação)
    const initialCharge: Transaction = {
      id: 'tx-cobranca-original',
      accountId: accounts[0].id,
      categoryId: 'cat-outros',
      amount: 49.90,
      type: 'expense',
      description: 'Cobrança Desconhecida #123',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(initialCharge);

    // 2. Usuário edita a cobrança:
    // - Altera a descrição para "Claude Pro AI"
    // - Altera a categoria para "Lazer & Entretenimento" (ou outra)
    // - Altera o valor para 110.00
    // - Marca a opção "Acompanhar como Assinatura Recorrente" (cadence: 'monthly')
    const updatedTx: Transaction = {
      ...initialCharge,
      description: 'Claude Pro AI',
      categoryId: 'cat-lazer',
      amount: 110.00,
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(updatedTx);

    // Salva também a assinatura decorrente da opção no modal
    const subFromCharge: Subscription = {
      id: 'sub-claude-pro',
      name: updatedTx.description,
      amount: updatedTx.amount,
      categoryId: updatedTx.categoryId,
      accountId: updatedTx.accountId,
      cadence: 'monthly',
      nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveSubscription(subFromCharge);

    // 3. Validações no banco de dados local:
    // A transação foi devidamente atualizada com todos os novos dados
    const savedTxs = await db.getTransactions();
    const foundTx = savedTxs.find(t => t.id === 'tx-cobranca-original');
    expect(foundTx).toBeDefined();
    expect(foundTx?.description).toBe('Claude Pro AI');
    expect(foundTx?.amount).toBe(110.00);
    expect(foundTx?.categoryId).toBe('cat-lazer');

    // A assinatura foi devidamente registrada
    const allSubs = await db.getSubscriptions();
    const foundSub = allSubs.find(s => s.name === 'Claude Pro AI');
    expect(foundSub).toBeDefined();
    expect(foundSub?.amount).toBe(110.00);
    expect(foundSub?.cadence).toBe('monthly');
    expect(foundSub?.categoryId).toBe('cat-lazer');

    // O cálculo do custo mensal total incorpora essa nova assinatura
    const totalCost = recurrenceDetector.calculateTotalMonthlyCost(allSubs);
    expect(totalCost).toBe(39.90 + 110.00); // Netflix inicial (39.90) + Claude Pro (110.00)
  });
});
