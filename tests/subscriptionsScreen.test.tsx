import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SubscriptionLogo, BrandLogo } from '../src/components/subscriptions/SubscriptionLogo';
import { SubscriptionDetailView } from '../src/components/subscriptions/SubscriptionDetailView';
import { SubscriptionTransactionPickerModal } from '../src/components/subscriptions/SubscriptionTransactionPickerModal';
import { SubscriptionsScreen } from '../src/screens/SubscriptionsScreen';
import { Subscription, Category, Account, Transaction } from '../src/core/types';

// Mock contexts
const mockCategory: Category = {
  id: 'cat-faculdade',
  name: 'Universidade',
  type: 'expense',
  icon: 'GraduationCap',
  color: '#38BDF8',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockAccount: Account = {
  id: 'acc-inter',
  name: 'Inter',
  type: 'credit_card',
  balance: 1000,
  color: '#FF7A00',
  icon: 'Landmark',
  currency: 'BRL',
  bankId: 'inter',
  syncStatus: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockSubscription: Subscription = {
  id: 'sub-uva',
  name: 'UVA',
  amount: 135.26,
  categoryId: 'cat-faculdade',
  accountId: 'acc-inter',
  cadence: 'monthly',
  nextBillingDate: '2026-09-15',
  lastChargeDate: '2026-08-15',
  status: 'active',
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
};

const mockFixedPayment: Subscription = {
  id: 'sub-aluguel',
  name: 'Aluguel do Apê',
  amount: 2200.00,
  categoryId: 'cat-faculdade',
  accountId: 'acc-inter',
  cadence: 'monthly',
  recurrenceType: 'fixed_expense',
  nextBillingDate: '2026-09-10',
  lastChargeDate: '2026-08-10',
  status: 'active',
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z',
};

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    accountId: 'acc-inter',
    categoryId: 'cat-faculdade',
    amount: 135.26,
    type: 'expense',
    description: 'UVA',
    date: '2026-08-15T10:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'notification',
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
  },
  {
    id: 'tx-2',
    accountId: 'acc-inter',
    categoryId: 'cat-faculdade',
    amount: 135.26,
    type: 'expense',
    description: 'UVA',
    date: '2026-07-15T10:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'notification',
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
];

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    subscriptions: [mockSubscription, mockFixedPayment],
    subscriptionSuggestions: [],
    transactions: mockTransactions,
    categories: [mockCategory],
    accounts: [mockAccount],
    isPrivacyMode: false,
    togglePrivacyMode: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
  }),
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#FFFFFF',
      textSecondary: '#9CA3AF',
      surface: '#0A0B0D',
      surfaceElevated: '#121418',
      primary: '#A3E635',
      expense: '#EF4444',
      border: 'rgba(255, 255, 255, 0.08)',
    },
  }),
}));

describe('Redesign da Tela de Assinaturas & Recorrências', () => {
  it('SubscriptionLogo renderiza marcas reconhecidas e badge do banco', () => {
    const htmlUva = renderToString(
      <SubscriptionLogo name="UVA" category={mockCategory} bankId="inter" size={44} />
    );
    expect(htmlUva).toBeDefined();

    const htmlClaro = renderToString(
      <SubscriptionLogo name="Claro" category={mockCategory} bankId="inter" size={44} />
    );
    expect(htmlClaro).toContain("Claro");

    const htmlSteam = renderToString(
      <SubscriptionLogo name="Steam" category={mockCategory} bankId="inter" size={44} />
    );
    expect(htmlSteam).toContain('alt="Steam"');

    const htmlTikTok = renderToString(
      <SubscriptionLogo name="TikTok Shop" category={mockCategory} size={44} />
    );
    expect(htmlTikTok).toContain('alt="TikTok"');

    const htmlOutback = renderToString(
      <SubscriptionLogo name="Outback Steakhouse" category={mockCategory} size={44} />
    );
    expect(htmlOutback).toContain('alt="Outback Steakhouse"');

    const htmlYouTube = renderToString(
      <SubscriptionLogo name="YouTube Premium" category={mockCategory} size={44} />
    );
    expect(htmlYouTube).toContain('alt="YouTube"');

    // Logos oficiais integrados:
    const htmlNetflix = renderToString(
      <SubscriptionLogo name="Netflix" category={mockCategory} size={44} />
    );
    expect(htmlNetflix).toContain('alt="Netflix"');

    const htmlSpotify = renderToString(
      <SubscriptionLogo name="Spotify Premium" category={mockCategory} size={44} />
    );
    expect(htmlSpotify).toContain('alt="Spotify"');

    const htmlPrime = renderToString(
      <SubscriptionLogo name="Amazon Prime" category={mockCategory} size={44} />
    );
    expect(htmlPrime).toContain('alt="Prime Video"');

    const htmlMax = renderToString(
      <SubscriptionLogo name="Max" category={mockCategory} size={44} />
    );
    expect(htmlMax).toContain('alt="Max"');

    const htmlDisney = renderToString(
      <SubscriptionLogo name="Disney+" category={mockCategory} size={44} />
    );
    expect(htmlDisney).toContain('alt="Disney+"');

    // Xbox e variações (gamepass, game pass, xbox gamepass, xbox):
    const htmlXbox = renderToString(
      <SubscriptionLogo name="Xbox Gamepass" category={mockCategory} size={44} />
    );
    expect(htmlXbox).toContain('aria-label="Xbox"');

    const htmlGamePass = renderToString(
      <SubscriptionLogo name="PC Game Pass" category={mockCategory} size={44} />
    );
    expect(htmlGamePass).toContain('aria-label="Xbox"');

    // PlayStation e variações (play 5, playstation, ps+, PS Plus, playstation plus):
    const htmlPlaystation = renderToString(
      <SubscriptionLogo name="PlayStation Plus" category={mockCategory} size={44} />
    );
    expect(htmlPlaystation).toContain('aria-label="PlayStation"');

    const htmlPsPlus = renderToString(
      <SubscriptionLogo name="PS Plus Deluxe" category={mockCategory} size={44} />
    );
    expect(htmlPsPlus).toContain('aria-label="PlayStation"');

    const htmlPlay5 = renderToString(
      <SubscriptionLogo name="Assinatura Play 5" category={mockCategory} size={44} />
    );
    expect(htmlPlay5).toContain('aria-label="PlayStation"');

    const htmlPsPlusShort = renderToString(
      <SubscriptionLogo name="Renovação PS+" category={mockCategory} size={44} />
    );
    expect(htmlPsPlusShort).toContain('aria-label="PlayStation"');

    // Novos logos integrados (iFood, Uber, Google, ChatGPT, Canva):
    const htmlIfood = renderToString(
      <SubscriptionLogo name="iFood Clube" category={mockCategory} size={44} />
    );
    expect(htmlIfood).toContain('alt="iFood"');

    const htmlUber = renderToString(
      <SubscriptionLogo name="Uber One" category={mockCategory} size={44} />
    );
    expect(htmlUber).toContain('alt="Uber"');

    const htmlGoogle = renderToString(
      <SubscriptionLogo name="Google One" category={mockCategory} size={44} />
    );
    expect(htmlGoogle).toContain('alt="Google"');

    const htmlChatgpt = renderToString(
      <SubscriptionLogo name="ChatGPT Plus" category={mockCategory} size={44} />
    );
    expect(htmlChatgpt).toContain('alt="ChatGPT"');

    const htmlCanva = renderToString(
      <SubscriptionLogo name="Canva Pro" category={mockCategory} size={44} />
    );
    expect(htmlCanva).toContain('alt="Canva"');

    const htmlMeli = renderToString(
      <SubscriptionLogo name="Meli+" category={mockCategory} size={44} />
    );
    expect(htmlMeli).toContain('alt="Meli+"');

    // 'Meli' sozinho também deve mostrar Meli+, não Mercado Livre
    const htmlMeliAlone = renderToString(
      <SubscriptionLogo name="Meli" category={mockCategory} size={44} />
    );
    expect(htmlMeliAlone).toContain('alt="Meli+"');
    expect(htmlMeliAlone).not.toContain('alt="Mercado Livre"');

    const htmlDeezer = renderToString(
      <SubscriptionLogo name="Deezer Premium" category={mockCategory} size={44} />
    );
    expect(htmlDeezer).toContain('alt="Deezer"');

    // 99 Food e 99 (Corridas):
    const html99Food = renderToString(
      <SubscriptionLogo name="99 Food" category={mockCategory} size={44} />
    );
    expect(html99Food).toContain('alt="99 Food"');

    const html99Pop = renderToString(
      <SubscriptionLogo name="99 Pop" category={mockCategory} size={44} />
    );
    expect(html99Pop).toContain('alt="99"');

    // Transações típicas de cartão (BrandLogo alias):
    const htmlCardUber = renderToString(
      <BrandLogo name="Uber *Trip São Paulo" category={mockCategory} size={38} />
    );
    expect(htmlCardUber).toContain('alt="Uber"');

    const htmlCardIfood = renderToString(
      <BrandLogo name="iFood *Restaurante" category={mockCategory} size={38} />
    );
    expect(htmlCardIfood).toContain('alt="iFood"');

    const htmlCard99Food = renderToString(
      <BrandLogo name="99*FOOD LANCHES" category={mockCategory} size={38} />
    );
    expect(htmlCard99Food).toContain('alt="99 Food"');

    const htmlCard99Ride = renderToString(
      <BrandLogo name="99*CORRIDA SAO PAULO" category={mockCategory} size={38} />
    );
    expect(htmlCard99Ride).toContain('alt="99"');

    // Amazon: plain 'amazon' usa logo Amazon (NÃO Prime Video)
    const htmlAmazon = renderToString(
      <SubscriptionLogo name="Amazon" category={mockCategory} size={44} />
    );
    expect(htmlAmazon).toContain('alt="Amazon"');
    expect(htmlAmazon).not.toContain('alt="Prime Video"');

    // Amazon Prime Video: usa logo Prime Video
    const htmlAmazonPrimeVideo = renderToString(
      <SubscriptionLogo name="Amazon Prime Video" category={mockCategory} size={44} />
    );
    expect(htmlAmazonPrimeVideo).toContain('alt="Prime Video"');


    // Mercado Livre e Shopee
    const htmlMercadoLivre = renderToString(
      <SubscriptionLogo name="Mercado Livre" category={mockCategory} size={44} />
    );
    expect(htmlMercadoLivre).toContain('alt="Mercado Livre"');

    const htmlShopee = renderToString(
      <SubscriptionLogo name="Shopee" category={mockCategory} size={44} />
    );
    expect(htmlShopee).toContain('alt="Shopee"');
  });

  it('SubscriptionDetailView renderiza detalhes, timeline, insight e NUNCA cita Pierre', () => {
    const html = renderToString(
      <SubscriptionDetailView
        subscription={mockSubscription}
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    // Nome e valor
    expect(html).toContain('UVA');
    expect(html).toContain('135,26');

    // Frequência
    expect(html.toLowerCase()).toContain('todo dia');

    // Insight card (garante que contém gasto real, custo anual previsto e NÃO cita Pierre)
    expect(html).toContain('Insight');
    expect(html).toContain('Você já gastou');
    expect(html).toContain('custo previsto para 12 meses');
    expect(html.toLowerCase()).not.toContain('pierre');

    // Metadados do Hero e Conta
    expect(html).toContain('Universidade');
    expect(html).toContain('Inter');
  });

  it('SubscriptionTransactionPickerModal renderiza busca e botão Marcar como assinatura', () => {
    // 1. Quando fechado, não quebra regras de hooks e retorna vazio
    const htmlClosed = renderToString(
      <SubscriptionTransactionPickerModal
        isOpen={false}
        onClose={vi.fn()}
        onOpenManualSubscription={vi.fn()}
      />
    );
    expect(htmlClosed).toBe('');

    // 2. Quando aberto, renderiza normalmente com hooks preservados
    const html = renderToString(
      <SubscriptionTransactionPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onOpenManualSubscription={vi.fn()}
      />
    );

    expect(html).toContain('Assinaturas');
    expect(html).toContain('Escolha uma transação');
    expect(html).toContain('Buscar transação');
    expect(html).toContain('Marcar como assinatura');
  });

  it('SubscriptionsScreen renderiza Assinaturas e botão Adicionar', () => {
    const html = renderToString(
      <SubscriptionsScreen
        onBack={vi.fn()}
        onOpenNewSubscription={vi.fn()}
        onEditSubscription={vi.fn()}
      />
    );

    expect(html).toContain('Assinaturas');
    expect(html).toContain('Adicionar');
    expect(html).toContain('UVA');
  });

  it('SubscriptionsScreen no modo calendário renderiza grade de 7 colunas, dias da semana e Total mensal', () => {
    const html = renderToString(
      <SubscriptionsScreen
        onBack={vi.fn()}
        onOpenNewSubscription={vi.fn()}
        onEditSubscription={vi.fn()}
        initialViewMode="calendar"
      />
    );

    // Total mensal e controles de frequência
    expect(html).toContain('Total mensal');
    expect(html).toContain('Mensal');
    expect(html).toContain('Diária');

    // Dias da semana fiéis ao print (Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
    expect(html).toContain('Seg');
    expect(html).toContain('Ter');
    expect(html).toContain('Qua');
    expect(html).toContain('Qui');
    expect(html).toContain('Sex');
    expect(html).toContain('Sáb');
    expect(html).toContain('Dom');
  });

  it('SubscriptionsScreen filtra e nunca exibe receita recorrente ou salário', () => {
    const html = renderToString(
      <SubscriptionsScreen
        onBack={vi.fn()}
        onOpenNewSubscription={vi.fn()}
        onEditSubscription={vi.fn()}
      />
    );

    // Deve conter despesas normais como UVA
    expect(html).toContain('UVA');
    // Nunca deve exibir títulos ou somas de receita
    expect(html).not.toContain('em receitas');
    expect(html).not.toContain('Salário Mensal');
  });

  it('SubscriptionsScreen renderiza título Assinaturas e lista de assinaturas com layout mobile', () => {
    const html = renderToString(
      <SubscriptionsScreen
        onBack={vi.fn()}
        onOpenNewSubscription={vi.fn()}
        onEditSubscription={vi.fn()}
      />
    );

    // Título do Hero card limpo para mobile (sem overflow)
    expect(html).toContain('Assinaturas');
    // Itens de assinatura renderizados
    expect(html).toContain('UVA');
  });

  it('isSubscriptionMatchingTransaction deve identificar corretamente cobranças de cartão para assinaturas como Meli+', async () => {
    const { isSubscriptionMatchingTransaction } = await import('../src/core/subscriptions/recurrenceDetector');

    const subMeli: Subscription = {
      id: 'sub-meli-123',
      name: 'Meli+',
      amount: 65.00,
      categoryId: 'cat-stream',
      accountId: 'acc-nubank',
      cadence: 'monthly',
      dayOfMonth: 3,
      nextBillingDate: '2026-10-03',
      status: 'active',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    // 1. Descrição exata
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-1',
      description: 'Meli+',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);

    // 2. Ruído bancário comum de adquirente (MP*MELI)
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-2',
      description: 'MP*MELI',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);

    // 3. Variação sem o caractere '+' (Meli)
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-3',
      description: 'Meli',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);

    // 4. Variação em texto (Meli Plus)
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-4',
      description: 'Meli Plus',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);

    // 5. Reajuste de valor (de R$ 49,90 para R$ 65,00) deve corresponder para permitir auto-reajuste
    const subMeliOlderPrice: Subscription = {
      ...subMeli,
      amount: 49.90,
    };
    expect(isSubscriptionMatchingTransaction(subMeliOlderPrice, {
      id: 'tx-5',
      description: 'MP*MELI',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);

    // 6. Compra avulsa de carrinho (ex: R$ 181,17 no Mercado Livre / MELI) NUNCA deve casar com Meli+
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-6',
      description: 'MELI *COMPRA',
      amount: 181.17,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);

    // 7. Compra com subscriptionId indevido herdado por erro anterior mas valor desproporcional deve ser rejeitada
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-7',
      subscriptionId: subMeli.id,
      description: 'MERCADO LIVRE',
      amount: 181.17,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-10-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);

    // 8. Cobrança de Mercado Pago no valor exato da assinatura deve ser reconhecida
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-8',
      description: 'Mercado Pago',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);

    // 10. Compra parcelada (ex: 1/10) NUNCA deve ser considerada assinatura
    expect(isSubscriptionMatchingTransaction(subMeli, {
      id: 'tx-10',
      description: 'Meli+ 1/10',
      amount: 65.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);

    // 11. Amazon Prime vs Compras de Loja/Marketplace na Amazon
    const subPrime: Subscription = {
      id: 'sub-prime',
      name: 'Amazon Prime',
      amount: 19.90,
      cadence: 'monthly',
      categoryId: 'cat-stream',
      accountId: 'acc-nubank',
      nextBillingDate: '2026-10-04',
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    // Transação oficial de Prime Video -> Casa
    expect(isSubscriptionMatchingTransaction(subPrime, {
      id: 'tx-prime-1',
      description: 'Prime Video',
      amount: 19.90,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);
    // Compra avulsa na Amazon sem a palavra "Prime" -> Rejeita mesmo que o valor coincida
    expect(isSubscriptionMatchingTransaction(subPrime, {
      id: 'tx-prime-2',
      description: 'Amazon.com.br',
      amount: 19.90,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-compras',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);

    // 12. Clube iFood vs Pedido de Restaurante no iFood
    const subIfood: Subscription = {
      id: 'sub-ifood',
      name: 'Clube iFood',
      amount: 14.95,
      cadence: 'monthly',
      categoryId: 'cat-stream',
      accountId: 'acc-nubank',
      nextBillingDate: '2026-10-04',
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    // Transação do Clube -> Casa
    expect(isSubscriptionMatchingTransaction(subIfood, {
      id: 'tx-ifood-1',
      description: 'iFood Clube',
      amount: 14.95,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-stream',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);
    // Pedido de restaurante no iFood -> Rejeita
    expect(isSubscriptionMatchingTransaction(subIfood, {
      id: 'tx-ifood-2',
      description: 'iFood *Restaurante Paris',
      amount: 45.00,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-restaurantes',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);

    // 13. Uber One vs Corrida da Uber
    const subUber: Subscription = {
      id: 'sub-uber',
      name: 'Uber One',
      amount: 19.90,
      cadence: 'monthly',
      categoryId: 'cat-transp',
      accountId: 'acc-nubank',
      nextBillingDate: '2026-10-04',
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    expect(isSubscriptionMatchingTransaction(subUber, {
      id: 'tx-uber-1',
      description: 'Uber One',
      amount: 19.90,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-transp',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);
    expect(isSubscriptionMatchingTransaction(subUber, {
      id: 'tx-uber-2',
      description: 'Uber *Trip Sao Paulo',
      amount: 25.50,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-transp',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);

    // 14. Apple iCloud vs Compra de App na App Store (ambos vêm como Apple.com/bill)
    const subApple: Subscription = {
      id: 'sub-apple',
      name: 'iCloud 50GB',
      amount: 4.90,
      cadence: 'monthly',
      categoryId: 'cat-tech',
      accountId: 'acc-nubank',
      nextBillingDate: '2026-10-04',
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    expect(isSubscriptionMatchingTransaction(subApple, {
      id: 'tx-apple-1',
      description: 'Apple.com/bill',
      amount: 4.90,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-tech',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(true);
    // Compra de jogo de R$ 14,90 sob o mesmo nome Apple.com/bill -> Rejeita por valor não exato
    expect(isSubscriptionMatchingTransaction(subApple, {
      id: 'tx-apple-2',
      description: 'Apple.com/bill',
      amount: 14.90,
      type: 'expense',
      accountId: 'acc-nubank',
      categoryId: 'cat-tech',
      date: '2026-09-04',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    })).toBe(false);
  });
});


