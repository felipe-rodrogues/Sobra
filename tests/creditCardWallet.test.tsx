import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CreditCardWalletHero } from '../src/components/dashboard/CreditCardWalletHero';
import { Account, Transaction } from '../src/core/types';

describe('CreditCardWalletHero - Design de Carteira Estilo Pierre', () => {
  const mockCards: Account[] = [
    {
      id: 'card-1',
      name: 'Inter Gold',
      type: 'credit_card',
      bankId: 'inter',
      balance: 428.80,
      invoiceAmount: 428.80,
      creditLimit: 5000,
      color: '#FF7A00',
      currency: 'BRL',
      icon: 'CreditCard',
      lastDigits: '2462', // 4 dígitos informados
      closingDay: 1,
      dueDay: 10,
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'card-2',
      name: 'PicPay Card',
      type: 'credit_card',
      bankId: 'picpay',
      balance: 1200.00,
      invoiceAmount: 1200.00,
      creditLimit: 4000,
      color: '#11C76F',
      currency: 'BRL',
      icon: 'CreditCard',
      lastDigits: '9028',
      closingDay: 15,
      dueDay: 22,
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'card-3',
      name: 'Nubank Ultravioleta',
      type: 'credit_card',
      bankId: 'nubank',
      balance: 8028.00,
      invoiceAmount: 8028.00,
      creditLimit: 15000,
      color: '#820AD1',
      currency: 'BRL',
      icon: 'CreditCard',
      // Sem lastDigits (usuário optou por não preencher)
      closingDay: 20,
      dueDay: 27,
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  it('deve renderizar o estado de convite quando o usuário não tiver cartões de crédito cadastrados', () => {
    const html = renderToString(
      <CreditCardWalletHero
        cards={[]}
        transactions={[]}
        isPrivacyMode={false}
        maskValue={(v) => v}
        onOpenInvoices={() => {}}
        onAddNewCard={() => {}}
      />
    );

    expect(html).toContain('Cadastrar Cartão de Crédito');
    expect(html).toContain('Acompanhe suas faturas e limites estilo carteira');
  });

  it('deve renderizar a carteira com cartões empilhados e exibir 4 dígitos apenas quando informados', () => {
    const html = renderToString(
      <CreditCardWalletHero
        cards={mockCards}
        transactions={[]}
        isPrivacyMode={false}
        maskValue={(v) => v}
        onOpenInvoices={() => {}}
        onAddNewCard={() => {}}
      />
    );

    // Deve exibir o total de faturas somadas (428.80 + 1200.00 + 8028.00 = 9.656,80)
    expect(html).toContain('Total em faturas');
    expect(html).toContain('9.656,80');

    // Cartão 1 tem lastDigits "2462" -> deve exibir •••• e 2462
    expect(html).toContain('2462');
    expect(html).toContain('Inter Gold');

    // Cartão 2 tem lastDigits "9028" -> deve exibir •••• e 9028
    expect(html).toContain('9028');
    expect(html).toContain('PicPay Card');

    // Cartão 3 não tem lastDigits -> exibe o nome mas não exibe números
    expect(html).toContain('Nubank');

    // Deve conter o próximo vencimento
    expect(html).toContain('Próximo vencimento:');
  });

  it('deve mascarar os valores quando o modo privacidade estiver ativado', () => {
    const html = renderToString(
      <CreditCardWalletHero
        cards={mockCards}
        transactions={[]}
        isPrivacyMode={true}
        maskValue={() => '••••••'}
        onOpenInvoices={() => {}}
        onAddNewCard={() => {}}
      />
    );

    expect(html).toContain('••••••');
    expect(html).not.toContain('9.656,80');
  });
});
