import { describe, it, expect } from 'vitest';
import { 
  analyzeMicroExpenses, 
  isMicroExpense, 
  classifyMicroExpense,
  identifyWorkCommuteRides
} from '../src/core/microExpenses/microExpensesHelper';
import { Transaction, Category, Goal } from '../src/core/types';

describe('MicroExpensesHelper - Radar de Microgastos', () => {
  const mockCategories: Category[] = [
    { id: 'cat-restaurantes', name: 'Restaurantes & Delivery', type: 'expense', icon: 'Utensils', color: '#F97316', isCustom: false, bucket: 'lifestyle', createdAt: '' },
    { id: 'cat-alim', name: 'Alimentação Geral', type: 'expense', icon: 'Utensils', color: '#E79F52', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-moradia', name: 'Moradia & Aluguel', type: 'expense', icon: 'Home', color: '#78BC71', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-farmacia', name: 'Farmácia & Remédios', type: 'expense', icon: 'Pill', color: '#EF4444', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-transp', name: 'Transporte & Mobilidade', type: 'expense', icon: 'Car', color: '#5F72CE', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-outros', name: 'Outras Despesas', type: 'expense', icon: 'MoreHorizontal', color: '#9EA3A9', isCustom: false, bucket: 'lifestyle', createdAt: '' },
  ];

  const categoryMap = new Map<string, Category>(mockCategories.map(c => [c.id, c]));

  it('deve identificar microgastos de conveniência e ignorar essenciais e transporte coletivo', () => {
    const txCafe: Transaction = {
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-restaurantes',
      amount: 14.50,
      type: 'expense',
      description: 'Café Espresso Padaria Real',
      date: '2026-09-15T10:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'notification',
      createdAt: '2026-09-15',
      updatedAt: '2026-09-15',
    };

    const txAluguel: Transaction = {
      id: 'tx-2',
      accountId: 'acc-1',
      categoryId: 'cat-moradia',
      amount: 25.00,
      type: 'expense',
      description: 'Taxa condominial boleto',
      date: '2026-09-15T11:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '2026-09-15',
      updatedAt: '2026-09-15',
    };

    const txRemedio: Transaction = {
      id: 'tx-3',
      accountId: 'acc-1',
      categoryId: 'cat-farmacia',
      amount: 18.00,
      type: 'expense',
      description: 'Remédio Dorflex',
      date: '2026-09-15T12:00:00Z',
      status: 'confirmed',
      paymentMethod: 'debit',
      source: 'notification',
      createdAt: '2026-09-15',
      updatedAt: '2026-09-15',
    };

    const txOnibus: Transaction = {
      id: 'tx-4',
      accountId: 'acc-1',
      categoryId: 'cat-transp',
      amount: 5.00,
      type: 'expense',
      description: 'Recarga Bilhete Único SPTrans Ônibus',
      date: '2026-09-15T08:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'notification',
      createdAt: '2026-09-15',
      updatedAt: '2026-09-15',
    };

    const txUberMoto: Transaction = {
      id: 'tx-5',
      accountId: 'acc-1',
      categoryId: 'cat-transp',
      amount: 8.50,
      type: 'expense',
      description: 'Uber Moto corrida rápida',
      date: '2026-09-15T18:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'notification',
      createdAt: '2026-09-15',
      updatedAt: '2026-09-15',
    };

    expect(isMicroExpense(txCafe, categoryMap, 30)).toBe(true);
    expect(isMicroExpense(txAluguel, categoryMap, 30)).toBe(false);
    expect(isMicroExpense(txRemedio, categoryMap, 30)).toBe(false);
    expect(isMicroExpense(txOnibus, categoryMap, 30)).toBe(false); // Ônibus é essencial/bloqueado
    expect(isMicroExpense(txUberMoto, categoryMap, 10)).toBe(true); // Uber Moto de R$ 8,50 com teto R$ 10 é detectado
  });

  it('deve classificar os sub-hábitos corretamente (incluindo Corridas, Bets e Digitais)', () => {
    expect(classifyMicroExpense({ description: 'Café Starbucks' } as Transaction)).toBe('cafes_bakeries');
    expect(classifyMicroExpense({ description: 'Pão de Queijo Panificadora' } as Transaction)).toBe('cafes_bakeries');
    expect(classifyMicroExpense({ description: 'iFood Pedido Lanche' } as Transaction)).toBe('delivery_snacks');
    expect(classifyMicroExpense({ description: 'Uber Moto corrida' } as Transaction)).toBe('rides_mobility');
    expect(classifyMicroExpense({ description: '99Pop Corrida Centro' } as Transaction)).toBe('rides_mobility');
    expect(classifyMicroExpense({ description: 'Pix Betano Apostas' } as Transaction)).toBe('bets_gaming');
    expect(classifyMicroExpense({ description: 'Lotérica Loterias Caixa' } as Transaction)).toBe('bets_gaming');
    expect(classifyMicroExpense({ description: 'Google Play Games' } as Transaction)).toBe('digital_micro');
    expect(classifyMicroExpense({ description: 'Steam Games compra' } as Transaction)).toBe('digital_micro');
    expect(classifyMicroExpense({ description: 'Tarifa mensalidade de conta' } as Transaction)).toBe('fees_others');
    expect(classifyMicroExpense({ description: 'Banca de Jornal Revistas' } as Transaction)).toBe('convenience_retail');
  });

  it('deve respeitar a lista de exclusões manuais por ID ou estabelecimento', () => {
    const tx = {
      id: 'tx-custom-ignore',
      accountId: 'acc-1',
      description: 'Padaria do Bairro Pão Semanal',
      amount: 15.00,
      type: 'expense' as const,
      categoryId: 'cat-alim',
      date: '2026-09-15T09:00:00Z',
      status: 'confirmed' as const,
      paymentMethod: 'pix' as const,
      source: 'notification' as const,
      createdAt: '',
      updatedAt: '',
    };

    // Com options.ignoredTxIds
    expect(isMicroExpense(tx, categoryMap, 30, { ignoredTxIds: new Set(['tx-custom-ignore']) })).toBe(false);

    // Com options.ignoredMerchants
    expect(isMicroExpense(tx, categoryMap, 30, { ignoredMerchants: ['Padaria do Bairro'] })).toBe(false);
  });

  it('deve blindar transporte de trabalho habitual (comutação diária em dias úteis)', () => {
    const txs: Transaction[] = [];
    // 10 corridas de Uber Moto em dias úteis (segunda a sexta) de R$ 9,00
    // 2026-09-14 é segunda, 15 terça, 16 quarta, 17 quinta, 18 sexta
    const weekdays = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'];
    for (let i = 0; i < 10; i++) {
      const day = weekdays[i % weekdays.length];
      txs.push({
        id: `tx-commute-${i}`,
        accountId: 'acc-1',
        categoryId: 'cat-transp',
        amount: 9.00,
        type: 'expense',
        description: 'Uber Moto Ida ao Trabalho',
        date: `${day}T08:00:00Z`,
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'notification',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
      });
    }

    const commuteSet = identifyWorkCommuteRides(txs, 15);
    expect(commuteSet.size).toBe(10);
    expect(commuteSet.has('tx-commute-0')).toBe(true);

    // No analyzeMicroExpenses, essas 10 corridas devem ficar em commuteTransactions e NÃO em microTxs de corte
    const result = analyzeMicroExpenses(txs, mockCategories, new Date('2026-09-20T10:00:00Z'), {
      maxAmount: 15,
      excludeWorkCommute: true,
    });

    expect(result.commuteCount).toBe(10);
    expect(result.commuteAmount).toBe(90.00);
    expect(result.totalCount).toBe(0); // Zero supérfluos, transporte de trabalho blindado!
  });

  it('deve citar a meta ativa na equivalência sem apelos a contas de luz ou gás', () => {
    const txs: Transaction[] = [];
    for (let i = 0; i < 8; i++) {
      txs.push({
        id: `tx-cafe-${i}`,
        accountId: 'acc-1',
        categoryId: 'cat-restaurantes',
        amount: 10.00,
        type: 'expense',
        description: `Café Expresso ${i}`,
        date: '2026-09-15T10:00:00Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'notification',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
      });
    }

    const mockGoal: Goal = {
      id: 'goal-1',
      name: 'Reserva de Emergência',
      targetAmount: 5000,
      currentAmount: 1200,
      color: '#22C55E',
      icon: 'Shield',
      isCompleted: false,
      createdAt: '',
    };

    const resultWithGoal = analyzeMicroExpenses(txs, mockCategories, new Date('2026-09-15T15:00:00Z'), {
      activeGoal: mockGoal,
    });

    expect(resultWithGoal.goalName).toBe('Reserva de Emergência');
    expect(resultWithGoal.goalImpactText).toContain('Reserva de Emergência');
    expect(resultWithGoal.goalImpactText).not.toContain('luz');
    expect(resultWithGoal.goalImpactText).not.toContain('gás');

    const resultWithoutGoal = analyzeMicroExpenses(txs, mockCategories, new Date('2026-09-15T15:00:00Z'), {
      activeGoal: null,
    });
    expect(resultWithoutGoal.goalImpactText).toBe('a mais na sua reserva');
  });
});
