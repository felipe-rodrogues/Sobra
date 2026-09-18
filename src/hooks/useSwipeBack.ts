import { useEffect, useRef, useState } from 'react';

interface UseSwipeBackOptions {
  onBack?: () => void;
  enabled?: boolean;
  edgeThreshold?: number; // Distância da borda para iniciar o gesto (padrão: 35px)
  triggerDistance?: number; // Distância necessária para acionar a volta (padrão: 70px)
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
  triggerDistance = 70
): SwipeCalculation {
  let edge: 'left' | 'right' | null = null;
  if (startX <= edgeThreshold) {
    edge = 'left';
  } else if (startX >= screenWidth - edgeThreshold) {
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
  const isTriggered = !isVerticalScroll && progress >= 0.95;

  return {
    isEligibleEdge: true,
    edge,
    isVerticalScroll,
    effectiveDistance,
    progress,
    isTriggered,
  };
}

// Pilha de instâncias ativas em ordem de abertura (a última adicionada é a do topo)
let activeSwipeStack: string[] = [];
let nextSwipeId = 1;

export function getActiveSwipeStack(): string[] {
  return [...activeSwipeStack];
}

export function resetSwipeStackForTests(): void {
  activeSwipeStack = [];
  nextSwipeId = 1;
}

export function useSwipeBack({
  onBack,
  enabled = true,
  edgeThreshold = 35,
  triggerDistance = 70,
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

  const startRef = useRef<{
    x: number;
    y: number;
    edge: 'left' | 'right';
    isScrolling?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      activeSwipeStack = activeSwipeStack.filter(id => id !== instanceId);
      updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
      return;
    }

    // Registra como o listener mais recente / topo da pilha ativa
    activeSwipeStack = activeSwipeStack.filter(id => id !== instanceId);
    activeSwipeStack.push(instanceId);

    const isTopmost = () => activeSwipeStack[activeSwipeStack.length - 1] === instanceId;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isTopmost()) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      const x = touch.clientX;
      const y = touch.clientY;

      let edge: 'left' | 'right' | null = null;
      if (x <= edgeThreshold) {
        edge = 'left';
      } else if (x >= screenWidth - edgeThreshold) {
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
        triggerDistance
      );

      // Se ainda não determinou se é scroll vertical ou swipe horizontal
      if (startRef.current.isScrolling === undefined) {
        const absX = Math.abs(touch.clientX - startRef.current.x);
        const absY = Math.abs(touch.clientY - startRef.current.y);

        if (absX > 8 || absY > 8) {
          if (absY > absX) {
            startRef.current.isScrolling = true; // Usuário está rolando verticalmente
            updateSwipeState({ isSwiping: false, edge: null, progress: 0, touchY: 0 });
            return;
          } else {
            startRef.current.isScrolling = false; // Confirmado gesto horizontal de voltar
          }
        } else {
          return;
        }
      }

      if (startRef.current.isScrolling) return;

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
      const shouldTrigger = current.isSwiping && current.progress >= 0.95;

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
      activeSwipeStack = activeSwipeStack.filter(id => id !== instanceId);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, edgeThreshold, triggerDistance, instanceId]);

  return swipeState;
}
