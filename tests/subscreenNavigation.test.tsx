import { describe, it, expect } from 'vitest';

describe('Subscreen navigation origin tracking', () => {
  interface NavState {
    activeTab: string;
    subscreenReturnTab: Record<string, string>;
  }

  const navigateToTab = (
    current: NavState,
    tab: string,
    fromTab?: string
  ): NavState => {
    const origin = fromTab || (['dashboard', 'transactions', 'budgets', 'more'].includes(current.activeTab) ? current.activeTab : 'dashboard');
    const nextReturnTabs = { ...current.subscreenReturnTab };
    if (['notifications', 'accounts', 'subscriptions'].includes(tab)) {
      nextReturnTabs[tab] = origin;
    }
    return {
      activeTab: tab,
      subscreenReturnTab: nextReturnTabs,
    };
  };

  const goBackFromSubscreen = (current: NavState): NavState => {
    const returnTo = current.subscreenReturnTab[current.activeTab] || 'dashboard';
    return {
      ...current,
      activeTab: returnTo,
    };
  };

  it('retorna para "dashboard" quando notificações são abertas a partir do Início', () => {
    let state: NavState = {
      activeTab: 'dashboard',
      subscreenReturnTab: {
        notifications: 'dashboard',
        accounts: 'more',
        subscriptions: 'more',
      },
    };

    // Usuário clica no sino de notificações no Dashboard
    state = navigateToTab(state, 'notifications', 'dashboard');
    expect(state.activeTab).toBe('notifications');
    expect(state.subscreenReturnTab.notifications).toBe('dashboard');

    // Usuário clica em Voltar
    state = goBackFromSubscreen(state);
    expect(state.activeTab).toBe('dashboard');
  });

  it('retorna para "more" quando notificações são abertas a partir da tela Mais', () => {
    let state: NavState = {
      activeTab: 'more',
      subscreenReturnTab: {
        notifications: 'dashboard',
        accounts: 'more',
        subscriptions: 'more',
      },
    };

    // Usuário clica no item Notificações na tela Mais
    state = navigateToTab(state, 'notifications', 'more');
    expect(state.activeTab).toBe('notifications');
    expect(state.subscreenReturnTab.notifications).toBe('more');

    // Usuário clica em Voltar
    state = goBackFromSubscreen(state);
    expect(state.activeTab).toBe('more');
  });

  it('preserva a origem individual de cada subtela independentemente', () => {
    let state: NavState = {
      activeTab: 'dashboard',
      subscreenReturnTab: {
        notifications: 'dashboard',
        accounts: 'more',
        subscriptions: 'more',
      },
    };

    // Abre contas a partir de Mais
    state = navigateToTab(state, 'accounts', 'more');
    expect(state.subscreenReturnTab.accounts).toBe('more');

    // Volta para Mais e vai para Dashboard
    state = goBackFromSubscreen(state);
    expect(state.activeTab).toBe('more');
    state.activeTab = 'dashboard';

    // Abre notificações a partir de Dashboard
    state = navigateToTab(state, 'notifications', 'dashboard');
    expect(state.subscreenReturnTab.notifications).toBe('dashboard');
    expect(state.subscreenReturnTab.accounts).toBe('more');

    // Volta de notificações -> Dashboard
    state = goBackFromSubscreen(state);
    expect(state.activeTab).toBe('dashboard');
  });

  it('permite voltar para o início ao clicar na primeira opção da barra quando dentro de "Faturas e Cartões"', () => {
    // Simula o estado do App quando o usuário está na tela Faturas e Cartões
    let activeTab = 'dashboard';
    let isDashboardModalOpen = true; // Modal Faturas e Cartões aberto
    let isInvoiceModalOpen = true;
    let selectedCardForInvoice = null;

    // Na barra inferior, Início NÃO deve ser marcado como ativo (já que o usuário está dentro de uma subtela)
    const isInicioActive = activeTab === 'dashboard' && (!isDashboardModalOpen || 'dashboard' !== 'dashboard');
    expect(isInicioActive).toBe(false);

    // Função de reset do Dashboard registrada
    const resetDashboardView = () => {
      isInvoiceModalOpen = false;
      selectedCardForInvoice = null;
      isDashboardModalOpen = false;
    };

    // Usuário clica na primeira opção da barra ("Início")
    const handleNavigateToTab = (tab: string) => {
      if (resetDashboardView) {
        resetDashboardView();
      }
      activeTab = tab;
    };

    handleNavigateToTab('dashboard');

    // Verifica que a tela de Faturas e Cartões foi devidamente fechada e voltamos ao Início limpo
    expect(isInvoiceModalOpen).toBe(false);
    expect(selectedCardForInvoice).toBe(null);
    expect(isDashboardModalOpen).toBe(false);
    expect(activeTab).toBe('dashboard');

    // Agora na tela inicial, o botão "Início" volta a ser o ativo
    const isInicioActiveAfter = activeTab === 'dashboard' && (!isDashboardModalOpen || 'dashboard' !== 'dashboard');
    expect(isInicioActiveAfter).toBe(true);
  });

  it('mantém a tela do cartão montada durante a edição para retorno imediato sem piscar a tela inicial', () => {
    // Cenário: Usuário está na tela de detalhes do cartão 'card_nubank'
    const mockAccounts = [
      { id: 'card_nubank', name: 'Nubank Roxinho', type: 'credit_card' as const },
      { id: 'acc_itau', name: 'Itaú Corrente', type: 'checking' as const },
    ];

    let activeTab = 'dashboard';
    let selectedCardForInvoice: any = mockAccounts[0];
    let isInvoiceModalOpen = true;
    let cardIdToReopen: string | null = null;
    let accountFormScreenData: any = null;

    // Usuário clica no botão "Editar Cartão" dentro da tela do cartão.
    // O modal NÃO é fechado nem desfeito; a tela de edição abre como overlay zIndex superior.
    const onEditCard = (card: any) => {
      accountFormScreenData = {
        isOpen: true,
        accountToEdit: card,
        returnTab: 'dashboard',
        returnToCardId: card.id,
      };
    };

    onEditCard(mockAccounts[0]);
    expect(accountFormScreenData?.isOpen).toBe(true);
    expect(accountFormScreenData?.returnToCardId).toBe('card_nubank');
    // CardInvoiceModal permanece montado e ativo no plano de fundo
    expect(selectedCardForInvoice).toEqual(mockAccounts[0]);
    expect(isInvoiceModalOpen).toBe(true);

    // Usuário volta (por gesto de deslizar ou seta voltar no topo)
    const onBackFromEditForm = () => {
      const returnTab = accountFormScreenData.returnTab;
      const returnToCardId = accountFormScreenData.returnToCardId;
      accountFormScreenData = null;
      activeTab = returnTab;
      if (returnToCardId) {
        cardIdToReopen = returnToCardId;
      }
    };

    onBackFromEditForm();
    // Ao fechar a tela de edição, a tela do cartão já está visível imediatamente
    expect(accountFormScreenData).toBe(null);
    expect(activeTab).toBe('dashboard');
    expect(selectedCardForInvoice).toEqual(mockAccounts[0]);
    expect(isInvoiceModalOpen).toBe(true);

    // E se initialCardForInvoiceId for disparado, detecta que já está aberto e evita re-render desnecessário
    const syncDashboardInitialCard = (reopenId: string | null) => {
      if (reopenId) {
        if (selectedCardForInvoice?.id === reopenId && isInvoiceModalOpen) {
          cardIdToReopen = null;
          return;
        }
        const target = mockAccounts.find(a => a.id === reopenId && a.type === 'credit_card');
        if (target) {
          selectedCardForInvoice = target;
          isInvoiceModalOpen = true;
        }
        cardIdToReopen = null;
      }
    };

    syncDashboardInitialCard(cardIdToReopen);
    expect(cardIdToReopen).toBe(null);
    expect(selectedCardForInvoice).toEqual(mockAccounts[0]);
    expect(isInvoiceModalOpen).toBe(true);
  });
});


