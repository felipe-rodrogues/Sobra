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
    subscriptions: [mockSubscription],
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
    expect(htmlSteam).toContain('<svg');

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
    expect(html).toContain('Assinatura paga todo dia');

    // Transações similares
    expect(html).toContain('Transações similares');
    expect(html).toContain('2 transações');

    // Insight card (garante que contém gasto real, custo anual previsto e NÃO cita Pierre)
    expect(html).toContain('Insight');
    expect(html).toContain('Você já gastou');
    expect(html).toContain('custo previsto para 12 meses');
    expect(html.toLowerCase()).not.toContain('pierre');

    // Metadados
    expect(html).toContain('Categoria');
    expect(html).toContain('Universidade');
    expect(html).toContain('Conta');
    expect(html).toContain('Inter');
  });

  it('SubscriptionTransactionPickerModal renderiza busca e botão Marcar como assinatura', () => {
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
});
