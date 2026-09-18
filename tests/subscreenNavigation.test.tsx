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
});
