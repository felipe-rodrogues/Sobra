import { useEffect, useRef } from 'react';

export type BackHandler = () => boolean | void;

export interface BackHandlerRegistration {
  id: string;
  handler: BackHandler;
  priority: number;
  timestamp: number;
}

/**
 * Escala de prioridades para fechamento ordenado:
 * Maior número = maior prioridade de execução no botão/gesto voltar
 */
export const BACK_PRIORITY = {
  DIALOG: 100,         // ConfirmModal, DeleteScope, alertas críticos
  SUB_MODAL: 50,       // TransactionModal dentro de CardInvoiceModal, seletores internos
  OVERLAY_SCREEN: 30,  // CardAccountFormScreen (tela dedicada sobreposta a modais e dashboard)
  MODAL: 20,           // CardInvoiceModal, CashFlowModal, BudgetModal, TransactionModal raiz
  VIEW_DETAIL: 10,     // Visualização de cartão específico na fatura, dia no fluxo de caixa
  SCREEN: 0,           // Telas e subtelas principais da aplicação
} as const;

class BackNavigationManager {
  private handlers: Map<string, BackHandlerRegistration> = new Map();
  private nextAutoId = 1;

  public register(id: string, handler: BackHandler, priority: number = BACK_PRIORITY.MODAL): () => void {
    const reg: BackHandlerRegistration = {
      id,
      handler,
      priority,
      timestamp: Date.now() + (this.nextAutoId++ % 1000) * 0.001,
    };
    this.handlers.set(id, reg);

    return () => {
      this.unregister(id);
    };
  }

  public unregister(id: string): void {
    this.handlers.delete(id);
  }

  public getActiveHandlers(): BackHandlerRegistration[] {
    const list = Array.from(this.handlers.values());
    // Ordena decrescente por prioridade, e em caso de empate, pelo mais recente (LIFO)
    list.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp - a.timestamp;
    });
    return list;
  }

  public triggerBack(): boolean {
    const active = this.getActiveHandlers();
    for (const reg of active) {
      try {
        const result = reg.handler();
        // Se o handler retornou false explicitamente, continua para o próximo handler na pilha
        if (result === false) {
          continue;
        }
        // Se retornou true ou void (não false), considera o retorno tratado e encerra
        return true;
      } catch (err) {
        console.error(`[BackNavigation] Erro no handler ${reg.id}:`, err);
        return true;
      }
    }
    return false;
  }

  public clear(): void {
    this.handlers.clear();
  }
}

export const backNavigationManager = new BackNavigationManager();

export interface UseBackHandlerOptions {
  id?: string;
  onBack: BackHandler;
  enabled?: boolean;
  priority?: number;
}

let hookIdCounter = 1;

/**
 * Hook universal para registrar qualquer componente/modal na pilha do botão voltar e gestos
 */
export function useBackHandler({
  id,
  onBack,
  enabled = true,
  priority = BACK_PRIORITY.MODAL,
}: UseBackHandlerOptions) {
  const instanceIdRef = useRef<string>(id || '');
  if (!instanceIdRef.current) {
    instanceIdRef.current = `back_handler_${hookIdCounter++}`;
  }
  const handlerId = instanceIdRef.current;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) {
      backNavigationManager.unregister(handlerId);
      return;
    }

    const unregister = backNavigationManager.register(
      handlerId,
      () => onBackRef.current(),
      priority
    );

    return () => {
      unregister();
    };
  }, [enabled, handlerId, priority]);
}
