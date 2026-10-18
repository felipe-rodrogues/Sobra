import { useRef, useCallback, useEffect } from 'react';

export interface UseLongPressOptions<T = any> {
  onLongPress: (item: T, rect?: DOMRect) => void;
  onClick?: (item: T) => void;
  threshold?: number;
  vibrateMs?: number | number[];
}

/**
 * Hook para detecção suave de toque longo (long press) com haptics,
 * cancelamento imediato ao rolar (scroll) e prevenção de clique acidental.
 */
export function useLongPress<T = any>({
  onLongPress,
  onClick,
  threshold = 420,
  vibrateMs = [18, 25, 20],
}: UseLongPressOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const lastTriggeredTimeRef = useRef(0);
  const activeItemRef = useRef<T | null>(null);

  // Limpa o timer de toque longo
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    targetElementRef.current = null;
  }, []);

  // Limpeza na desmontagem do componente
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(vibrateMs);
      } catch (_) {}
    }
  }, [vibrateMs]);

  const handleStart = useCallback((item: T, clientX: number, clientY: number, target: HTMLElement) => {
    clearTimer();
    isLongPressTriggeredRef.current = false;
    activeItemRef.current = item;
    targetElementRef.current = target;
    startPosRef.current = { x: clientX, y: clientY };

    timerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      lastTriggeredTimeRef.current = Date.now();
      triggerHaptic();
      const rect = targetElementRef.current?.getBoundingClientRect();
      onLongPress(item, rect);
    }, threshold);
  }, [clearTimer, threshold, triggerHaptic, onLongPress]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(clientX - startPosRef.current.x);
    const dy = Math.abs(clientY - startPosRef.current.y);

    // Se o usuário moveu mais de 8px (iniciou rolagem da lista), cancela imediatamente
    if (dx > 8 || dy > 8) {
      clearTimer();
    }
  }, [clearTimer]);

  const handleEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleClick = useCallback((item: T, e?: React.MouseEvent) => {
    // Se o toque longo acabou de ser ativado (ou nos últimos 500ms), bloqueia o clique para não abrir tela de edição
    const elapsedSinceLongPress = Date.now() - lastTriggeredTimeRef.current;
    if (isLongPressTriggeredRef.current || elapsedSinceLongPress < 500) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (onClick) {
      onClick(item);
    }
  }, [onClick]);

  const bind = useCallback((item: T) => {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        // Ignora cliques que não sejam o botão primário (botão esquerdo no mouse ou toque)
        if (e.button !== undefined && e.button !== 0) return;
        const target = e.currentTarget as HTMLElement;
        handleStart(item, e.clientX, e.clientY, target);
      },
      onPointerMove: (e: React.PointerEvent) => {
        handleMove(e.clientX, e.clientY);
      },
      onPointerUp: () => {
        handleEnd();
      },
      onPointerCancel: () => {
        clearTimer();
      },
      onClick: (e: React.MouseEvent) => {
        handleClick(item, e);
      },
      onContextMenu: (e: React.MouseEvent) => {
        // No desktop, o clique com o botão direito também abre a ação rápida
        e.preventDefault();
        e.stopPropagation();
        triggerHaptic();
        const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
        onLongPress(item, rect);
      },
    };
  }, [handleStart, handleMove, handleEnd, clearTimer, handleClick, triggerHaptic, onLongPress]);

  return {
    bind,
  };
}
