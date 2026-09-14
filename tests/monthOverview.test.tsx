import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { 
  MonthOverviewCard, 
  resolveCategoryVisual, 
  MOCKUP_PALETTE 
} from '../src/components/dashboard/MonthOverviewCard';

describe('MonthOverviewCard - Testes visuais e de paleta fiel ao mockup', () => {
  it('deve mapear corretamente as cores oficiais e nomes encurtados do mockup', () => {
    // Moradia deve ser verde suave (#78BC71)
    const moradia = resolveCategoryVisual({
      categoryId: 'cat-moradia',
      categoryName: 'Moradia & Contas',
      color: '#6366F1', // cor antiga deve ser substituída pela oficial
    });
    expect(moradia.color).toBe('#78BC71');
    expect(moradia.name).toBe('Moradia');

    // Alimentação deve ser laranja quente (#E79F52)
    const alim = resolveCategoryVisual({
      categoryId: 'cat-alim',
      categoryName: 'Alimentação',
    });
    expect(alim.color).toBe('#E79F52');
    expect(alim.name).toBe('Alimentação');

    // Transporte deve ser azul periwinkle (#5F72CE)
    const transp = resolveCategoryVisual({
      categoryId: 'cat-transp',
      categoryName: 'Transporte',
    });
    expect(transp.color).toBe('#5F72CE');
    expect(transp.name).toBe('Transporte');

    // Lazer deve ser lavanda (#AA84E1)
    const lazer = resolveCategoryVisual({
      categoryId: 'cat-lazer',
      categoryName: 'Lazer & Entretenimento',
    });
    expect(lazer.color).toBe('#AA84E1');
    expect(lazer.name).toBe('Lazer');

    // Outros deve ser cinza slate (#9EA3A9)
    const outros = resolveCategoryVisual({
      categoryId: 'cat-outros-desp',
      categoryName: 'Outras Despesas',
    });
    expect(outros.color).toBe('#9EA3A9');
    expect(outros.name).toBe('Outros');
  });

  it('deve renderizar o card com percentuais inteiros e nomes limpos sem truncamento no HTML', () => {
    const categories = [
      {
        categoryId: 'cat-alim',
        categoryName: 'Alimentação',
        color: '#E79F52',
        amount: 211.70,
        percentage: 51.4,
      },
      {
        categoryId: 'cat-moradia',
        categoryName: 'Moradia & Contas',
        color: '#6366F1',
        amount: 200.20,
        percentage: 48.6,
      },
    ];

    const html = renderToString(
      <MonthOverviewCard
        selectedMonth={9}
        selectedYear={2026}
        onSelectMonth={() => {}}
        totalExpense={411.90}
        categories={categories}
        maskValue={(v) => v}
      />
    );

    // Deve conter título "Visão do mês" e mês "Setembro"
    expect(html).toContain('Visão do mês');
    expect(html).toContain('Setembro');

    // Deve conter nomes limpos do mockup
    expect(html).toContain('Moradia');
    expect(html).toContain('Alimentação');
    expect(html).not.toContain('Moradia &amp; Contas');

    // Percentuais inteiros (sem decimais feios como 51.4%)
    expect(html).toContain('51%');
    expect(html).toContain('49%');
    expect(html).not.toContain('51.4%');
    expect(html).not.toContain('48.6%');

    // Cores do mockup no HTML
    expect(html).toContain('#78BC71'); // Verde Moradia
    expect(html).toContain('#E79F52'); // Laranja Alimentação

    // Valor e subtítulo
    expect(html).toContain('gastos');
    expect(html).toContain('R$');

    // SVG donut com stroke-linecap butt para fatias limpas com gaps
    expect(html).toContain('stroke-linecap="butt"');
  });

  it('não deve cortar ou truncar valores monetários de 4 dígitos como R$ 1.411,90 no centro do donut', () => {
    const categories = [
      { categoryId: 'cat-compras', categoryName: 'Compras', color: '#F97316', amount: 1000.00, percentage: 71 },
      { categoryId: 'cat-alim', categoryName: 'Alimentação', color: '#E79F52', amount: 211.70, percentage: 15 },
      { categoryId: 'cat-moradia', categoryName: 'Moradia', color: '#78BC71', amount: 200.20, percentage: 14 },
    ];

    const html = renderToString(
      <MonthOverviewCard
        selectedMonth={9}
        selectedYear={2026}
        onSelectMonth={() => {}}
        totalExpense={1411.90}
        categories={categories}
        maskValue={(v) => v}
      />
    );

    // O valor completo deve estar presente sem reticências (...)
    expect(html).not.toContain('R$ 1.411,...');
    expect(html).not.toContain('1.411,...');
    // Deve conter a formatação monetária brasileira completa
    expect(html).toMatch(/1\.411,90/);
    expect(html).toContain('Compras');
    expect(html).toContain('71%');
    expect(html).toContain('15%');
    expect(html).toContain('14%');
  });
});
