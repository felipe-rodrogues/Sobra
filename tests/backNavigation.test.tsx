import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  backNavigationManager, 
  BACK_PRIORITY,
  BackHandler
} from '../src/core/navigation/backNavigation';

describe('Universal Back Navigation System (backNavigationManager)', () => {
  beforeEach(() => {
    backNavigationManager.clear();
  });

  it('registra e desregistra handlers corretamente', () => {
    const unregister = backNavigationManager.register('test_modal', () => true, BACK_PRIORITY.MODAL);
    expect(backNavigationManager.getActiveHandlers()).toHaveLength(1);
    expect(backNavigationManager.getActiveHandlers()[0].id).toBe('test_modal');

    unregister();
    expect(backNavigationManager.getActiveHandlers()).toHaveLength(0);
  });

  it('ordena handlers por prioridade decrescente (DIALOG > SUB_MODAL > MODAL > SCREEN)', () => {
    backNavigationManager.register('screen_tab', () => true, BACK_PRIORITY.SCREEN); // 0
    backNavigationManager.register('dialog_confirm', () => true, BACK_PRIORITY.DIALOG); // 100
    backNavigationManager.register('root_modal', () => true, BACK_PRIORITY.MODAL); // 20
    backNavigationManager.register('sub_modal_tx', () => true, BACK_PRIORITY.SUB_MODAL); // 50

    const active = backNavigationManager.getActiveHandlers();
    expect(active.map(h => h.id)).toEqual([
      'dialog_confirm',
      'sub_modal_tx',
      'root_modal',
      'screen_tab',
    ]);
  });

  it('ordena handlers com mesma prioridade por recência (LIFO)', () => {
    backNavigationManager.register('first_modal', () => true, BACK_PRIORITY.MODAL);
    backNavigationManager.register('second_modal', () => true, BACK_PRIORITY.MODAL);

    const active = backNavigationManager.getActiveHandlers();
    expect(active[0].id).toBe('second_modal');
    expect(active[1].id).toBe('first_modal');
  });

  it('executa apenas o handler do topo (maior prioridade) e consome o evento', () => {
    const closeDialog = vi.fn();
    const closeSubModal = vi.fn();
    const closeRootModal = vi.fn();

    backNavigationManager.register('root_card_invoice', () => { closeRootModal(); return true; }, BACK_PRIORITY.MODAL);
    backNavigationManager.register('sub_transaction', () => { closeSubModal(); return true; }, BACK_PRIORITY.SUB_MODAL);
    backNavigationManager.register('dialog_confirm', () => { closeDialog(); return true; }, BACK_PRIORITY.DIALOG);

    // 1º Voltar: deve fechar apenas o diálogo de confirmação
    const handled1 = backNavigationManager.triggerBack();
    expect(handled1).toBe(true);
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeSubModal).not.toHaveBeenCalled();
    expect(closeRootModal).not.toHaveBeenCalled();

    // Simula desmontagem do diálogo
    backNavigationManager.unregister('dialog_confirm');

    // 2º Voltar: deve fechar a edição da transação (sub_modal)
    const handled2 = backNavigationManager.triggerBack();
    expect(handled2).toBe(true);
    expect(closeSubModal).toHaveBeenCalledTimes(1);
    expect(closeRootModal).not.toHaveBeenCalled();

    // Simula desmontagem do sub_modal de transação
    backNavigationManager.unregister('sub_transaction');

    // 3º Voltar: deve fechar a fatura do cartão (root_modal)
    const handled3 = backNavigationManager.triggerBack();
    expect(handled3).toBe(true);
    expect(closeRootModal).toHaveBeenCalledTimes(1);
  });

  it('permite que o handler retorne false para passar para o próximo se não puder tratar', () => {
    const ignoredHandler = vi.fn(() => false);
    const validHandler = vi.fn(() => true);

    backNavigationManager.register('ignored', ignoredHandler, BACK_PRIORITY.DIALOG);
    backNavigationManager.register('valid', validHandler, BACK_PRIORITY.MODAL);

    const handled = backNavigationManager.triggerBack();
    expect(handled).toBe(true);
    expect(ignoredHandler).toHaveBeenCalledTimes(1);
    expect(validHandler).toHaveBeenCalledTimes(1);
  });

  it('retorna false quando não há nenhum handler registrado para permitir navegação de telas', () => {
    const handled = backNavigationManager.triggerBack();
    expect(handled).toBe(false);
  });

  it('garante o fluxo completo descrito pelo usuário: Fatura -> Edição de Despesa -> Voltar', () => {
    // Cenário:
    // 1. Usuário entra na fatura do cartão: detailCardId = 'card-1'
    let detailCardId: string | null = 'card-1';
    let isInvoiceModalOpen = true;
    let editingTx: any = null;

    // Registra handler da fatura
    const unregisterInvoice = backNavigationManager.register('card_invoice_modal', () => {
      if (editingTx) {
        editingTx = null;
        return true;
      }
      if (detailCardId) {
        detailCardId = null;
        return true;
      }
      isInvoiceModalOpen = false;
      return true;
    }, BACK_PRIORITY.MODAL);

    // 2. Usuário clica em uma despesa para editar -> abre TransactionModal
    editingTx = { id: 'tx-123', amount: 50 };
    const unregisterTx = backNavigationManager.register('transaction_modal', () => {
      editingTx = null;
      return true;
    }, BACK_PRIORITY.SUB_MODAL);

    // 3. Usuário faz gesto de voltar:
    // DEVE fechar APENAS a edição da despesa! A fatura deve continuar aberta e no cartão selecionado!
    backNavigationManager.triggerBack();
    expect(editingTx).toBeNull();
    expect(isInvoiceModalOpen).toBe(true);
    expect(detailCardId).toBe('card-1');

    // Desmonta TransactionModal
    unregisterTx();

    // 4. Usuário faz gesto de voltar novamente:
    // DEVE voltar do detalhe do cartão para a lista geral de faturas
    backNavigationManager.triggerBack();
    expect(detailCardId).toBeNull();
    expect(isInvoiceModalOpen).toBe(true);

    // 5. Usuário faz gesto de voltar novamente:
    // DEVE fechar o modal de faturas e voltar para a tela anterior
    backNavigationManager.triggerBack();
    expect(isInvoiceModalOpen).toBe(false);

    unregisterInvoice();
  });
});
