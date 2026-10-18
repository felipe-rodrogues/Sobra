import { useEffect, useRef, useState } from 'react';
import { useBackHandler, BACK_PRIORITY } from '../core/navigation/backNavigation';

interface UseSwipeBackOptions {
  onBack?: () => void;
  enabled?: boolean;
  edgeThreshold?: number; // Distância da borda para iniciar o gesto (padrão: 35px)
  triggerDistance?: number; // Distância necessária para acionar a volta (padrão: 70px)
  allowedEdges?: ('left' | 'right')[]; // Bordas permitidas (padrão: ['left', 'right'])
  priority?: number; // Prioridade no gerenciador universal de volta (padrão: 20 para modais)
}

export interface SwipeBackState {
  isSwiping: boolean;
  edge: 'left' | 'right' | null;
  progress: number; // 0 a 1
  touchY: number;
}

export interface SwipeCalculation {
  isEligibleEdge: boolean;
  edge: 'left' | 'right' | null;
  isVerticalScroll: boolean;
  effectiveDistance: number;
  progress: number;
  isTriggered: boolean;
}

export function calculateSwipeProgress(
  startX: number,
  currentX: number,
  startY: number,
  currentY: number,
  screenWidth: number,
  edgeThreshold = 35,
  triggerDistance = 70,
  allowedEdges: ('left' | 'right')[] = ['left', 'right']
): SwipeCalculation {
  let edge: 'left' | 'right' | null = null;
  if (allowedEdges.includes('left') && startX <= edgeThreshold) {
    edge = 'left';
  } else if (allowedEdges.includes('right') && startX >= screenWidth - edgeThreshold) {
    edge = 'right';
  }

  if (!edge) {
    return {
      isEligibleEdge: false,
      edge: null,
      isVerticalScroll: false,
      effectiveDistance: 0,
      progress: 0,
      isTriggered: false,
    };
  }

  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  const isVerticalScroll = (absX > 8 || absY > 8) && absY > absX;

  let effectiveDistance = 0;
  if (edge === 'left') {
    effectiveDistance = Math.max(0, deltaX);
  } else if (edge === 'right') {
    effectiveDistance = Math.max(0, -deltaX);
  }

  const progress = isVerticalScroll ? 0 : Math.min(1, effectiveDistance / triggerDistance);
  const isTriggered = !isVerticalScroll && progress >= 0.88;

  return {
    isEligibleEdge: true,
    edge,
    isVerticalScroll,
    effectiveDistance,
    progress,
    isTriggered,
  };
}

interface SwipeStackItem {
  id: string;
  priority: number;
  timestamp: number;
}

// Pilha de instâncias ativas ordenadas por prioridade decrescente e recência (LIFO)
let activeSwipeStack: SwipeStackItem[] = [];
let nextSwipeId = 1;

export function getActiveSwipeStack(): string[] {
  return activeSwipeStack.map(item => item.id);
}

export function resetSwipeStackForTests(): void {
  activeSwipeStack = [];
  nextSwipeId = 1;
}

export function useSwipeBack({
  onBack,
  enabled = true,
  edgeThreshold = 38,
  triggerDistance = 65,
  allowedEdges = ['left', 'right'],
  priority = BACK_PRIORITY.MODAL,
}: UseSwipeBackOptions) {
  const instanceIdRef = useRef<string>('');
  if (!instanceIdRef.current) {
    instanceIdRef.current = `swipe_${nextSwipeId++}`;
  }
  const instanceId = instanceIdRef.current;

  const [swipeState, setSwipeState] = useState<SwipeBackState>({
    isSwiping: false,
    edge: null,
    progress: 0,
    touchY: 0,
  });

  const swipeStateRef = useRef<SwipeBackState>({
    isSwiping: false,
    edge: null,
    progress: 0,
    touchY: 0,
  });

  const updateSwipeState = (newState: SwipeBackState) => {
    swipeStateRef.current = newState;
    setSwipeState(newState);
  };

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Integração com o gerenciador universal de botão voltar (Android/Escape/Hardware)
  useBackHandler({
    id: instanceId,
    onBack: () => {
      if (onBackRef.current) {
        onBackRef.current();
        return true;
      }
      return false;
    },
    enabled: Boolean(enabled && onBack),
    priority,
  });

  const startRef = useRef<{
    x: number;
    y: number;
    edge: 'left' | 'right';
    isScrolling?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      activeSwipeStack = activeSwipeStack.filter(item => item.id !== instanceId);
      updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
      return;
    }

    // Registra como o listener na pilha ativa e reordena por prioridade decrescente e recência (LIFO)
    activeSwipeStack = activeSwipeStack.filter(item => item.id !== instanceId);
    activeSwipeStack.push({
      id: instanceId,
      priority,
      timestamp: Date.now() + (nextSwipeId % 1000) * 0.001,
    });
    activeSwipeStack.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.timestamp - a.timestamp;
    });

    const isTopmost = () => activeSwipeStack.length > 0 && activeSwipeStack[0].id === instanceId;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isTopmost()) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      const x = touch.clientX;
      const y = touch.clientY;

      let edge: 'left' | 'right' | null = null;
      if (allowedEdges.includes('left') && x <= edgeThreshold) {
        edge = 'left';
      } else if (allowedEdges.includes('right') && x >= screenWidth - edgeThreshold) {
        edge = 'right';
      }

      if (edge) {
        startRef.current = {
          x,
          y,
          edge,
          isScrolling: undefined,
        };
      } else {
        startRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTopmost()) {
        if (swipeStateRef.current.isSwiping) {
          updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
          startRef.current = null;
        }
        return;
      }
      if (!startRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      const calc = calculateSwipeProgress(
        startRef.current.x,
        touch.clientX,
        startRef.current.y,
        touch.clientY,
        screenWidth,
        edgeThreshold,
        triggerDistance,
        allowedEdges
      );

      // Se ainda não determinou se é scroll vertical ou swipe horizontal
      if (startRef.current.isScrolling === undefined) {
        const absX = Math.abs(touch.clientX - startRef.current.x);
        const absY = Math.abs(touch.clientY - startRef.current.y);

        if (absX >= 6 || absY >= 14) {
          // Só classifica como scroll vertical se o movimento vertical for fortemente dominante logo no início
          if (absY >= 14 && absY > absX * 1.4) {
            startRef.current.isScrolling = true; // Usuário está rolando verticalmente
            updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
            return;
          } else if (absX >= 6) {
            startRef.current.isScrolling = false; // Confirmado gesto horizontal de voltar
          }
        } else {
          return;
        }
      }

      if (startRef.current.isScrolling) return;

      // Não cancela o swipe por desvio natural em arco do polegar se o usuário já tiver puxado a borda
      const currentAbsX = Math.abs(touch.clientX - startRef.current.x);
      const currentAbsY = Math.abs(touch.clientY - startRef.current.y);
      if (calc.effectiveDistance < 15 && currentAbsY > 75 && currentAbsY > currentAbsX * 2.5) {
        startRef.current.isScrolling = true;
        updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
        return;
      }

      updateSwipeState({
        isSwiping: calc.effectiveDistance > 5,
        edge: calc.edge,
        progress: calc.progress,
        touchY: touch.clientY,
      });
    };

    const handleTouchEnd = () => {
      if (!isTopmost()) {
        if (swipeStateRef.current.isSwiping) {
          updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
          startRef.current = null;
        }
        return;
      }

      if (!startRef.current || startRef.current.isScrolling) {
        startRef.current = null;
        updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
        return;
      }

      const current = swipeStateRef.current;
      const shouldTrigger = current.isSwiping && current.progress >= 0.88;

      updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
      startRef.current = null;

      if (shouldTrigger && onBackRef.current) {
        try {
          onBackRef.current();
        } catch (err) {
          console.error('Erro ao executar onBack via gesto:', err);
        }
      }
    };

    const handleTouchCancel = () => {
      startRef.current = null;
      updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      activeSwipeStack = activeSwipeStack.filter(item => item.id !== instanceId);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, edgeThreshold, triggerDistance, instanceId, priority]);

  return swipeState;
}
