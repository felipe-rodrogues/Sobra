import { describe, it, expect } from 'vitest';
import { 
  analyzeMicroExpenses, 
  isMicroExpense, 
  classifyMicroExpense 
} from '../src/core/microExpenses/microExpensesHelper';
import { Transaction, Category } from '../src/core/types';

describe('MicroExpensesHelper - Radar de Microgastos', () => {
  const mockCategories: Category[] = [
    { id: 'cat-restaurantes', name: 'Restaurantes & Delivery', type: 'expense', icon: 'Utensils', color: '#F97316', isCustom: false, bucket: 'lifestyle', createdAt: '' },
    { id: 'cat-alim', name: 'Alimentação Geral', type: 'expense', icon: 'Utensils', color: '#E79F52', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-moradia', name: 'Moradia & Aluguel', type: 'expense', icon: 'Home', color: '#78BC71', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-farmacia', name: 'Farmácia & Remédios', type: 'expense', icon: 'Pill', color: '#EF4444', isCustom: false, bucket: 'essentials', createdAt: '' },
    { id: 'cat-outros', name: 'Outras Despesas', type: 'expense', icon: 'MoreHorizontal', color: '#9EA3A9', isCustom: false, bucket: 'lifestyle', createdAt: '' },
  ];

  const categoryMap = new Map<string, Category>(mockCategories.map(c => [c.id, c]));

  it('deve identificar microgastos de conveniência e ignorar essenciais', () => {
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

    expect(isMicroExpense(txCafe, categoryMap, 30)).toBe(true);
    expect(isMicroExpense(txAluguel, categoryMap, 30)).toBe(false);
    expect(isMicroExpense(txRemedio, categoryMap, 30)).toBe(false);
  });

  it('deve classificar os sub-hábitos corretamente', () => {
    expect(classifyMicroExpense({ description: 'Café Starbucks' } as Transaction)).toBe('cafes_bakeries');
    expect(classifyMicroExpense({ description: 'Pão de Queijo Panificadora' } as Transaction)).toBe('cafes_bakeries');
    expect(classifyMicroExpense({ description: 'iFood Pedido Lanche' } as Transaction)).toBe('delivery_snacks');
    expect(classifyMicroExpense({ description: 'Tarifa mensalidade de conta' } as Transaction)).toBe('fees_others');
    expect(classifyMicroExpense({ description: 'Banca de Jornal Revistas' } as Transaction)).toBe('convenience_retail');
  });

  it('deve calcular métricas e projeções com sensibilidade e sem julgamento', () => {
    const txs: Transaction[] = [];
    const dateStr = '2026-09-15T14:00:00Z';

    // 10 cafés de R$ 15,00 = R$ 150,00
    for (let i = 0; i < 10; i++) {
      txs.push({
        id: `tx-cafe-${i}`,
        accountId: 'acc-1',
        categoryId: 'cat-restaurantes',
        amount: 15.00,
        type: 'expense',
        description: `Café da Tarde Padaria ${i}`,
        date: dateStr,
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'notification',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
      });
    }

    // 5 lanches ifood de R$ 24,00 = R$ 120,00
    for (let i = 0; i < 5; i++) {
      txs.push({
        id: `tx-food-${i}`,
        accountId: 'acc-1',
        categoryId: 'cat-restaurantes',
        amount: 24.00,
        type: 'expense',
        description: `iFood Açaí Snack ${i}`,
        date: dateStr,
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'notification',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-15',
      });
    }

    const refDate = new Date('2026-09-15T15:00:00Z');
    const result = analyzeMicroExpenses(txs, mockCategories, refDate);

    expect(result.eligible).toBe(true);
    expect(result.totalCount).toBe(15);
    expect(result.totalAmount).toBe(270);
    expect(result.averageAmount).toBe(18);
    expect(result.projectedAnnualTotal).toBe(270 * 12);
    expect(result.suggestedSavingsCount).toBeGreaterThanOrEqual(3);
    expect(result.suggestedSavingsAmount).toBe(result.suggestedSavingsCount * 18);
    expect(result.groups.length).toBe(2);
    expect(result.groups[0].label).toBe('Padarias & Cafés');
    expect(result.groups[1].label).toBe('Lanches & Apps');
  });
});
