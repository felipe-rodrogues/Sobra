import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { SwipeBackState } from '../../hooks/useSwipeBack';

interface SwipeBackIndicatorProps {
  swipeState: SwipeBackState;
}

export const SwipeBackIndicator: React.FC<SwipeBackIndicatorProps> = ({ swipeState }) => {
  const { isSwiping, edge, progress, touchY } = swipeState;

  const isReady = progress >= 0.88;

  // Estado de desprendimento (quando o círculo se solta da linha ao atingir o limiar)
  const [isDetached, setIsDetached] = useState(false);
  // Profundidade da linha animada via mola elástica (durante o desprendimento ou retorno ao soltar)
  const [springDepth, setSpringDepth] = useState<number | null>(null);

  // Estado de encerramento suave ao soltar o dedo
  const [exitState, setExitState] = useState<{
    edge: 'left' | 'right';
    isReady: boolean;
    touchY: number;
    initialCircleDepth: number;
    isCancel: boolean;
  } | null>(null);

  const prevSwipingRef = useRef(isSwiping);
  const prevReadyRef = useRef(false);
  const isDetachedRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawLineDepth = Math.min(progress * 46, 46);

  // Profundidade da linha em tempo real:
  // - Se estiver rodando animação de mola (springDepth !== null): obedece à mola física
  // - Se estiver arrastando e preso: segue o dedo instantaneamente (sem atraso de useEffect)
  // - Caso contrário: 0
  const activeLineDepth = springDepth !== null
    ? springDepth
    : (isSwiping && !isDetached ? rawLineDepth : 0);

  // Posição horizontal do círculo:
  // - Se desprendido: flutua na frente (36px a 44px)
  // - Se preso: segue o cume da linha elástica
  const activeCircleDepth = isDetached
    ? 36 + Math.max(0, (progress - 0.88) * 12)
    : Math.max(12, activeLineDepth * 0.74);

  // Guarda snapshot para encerramento gracioso
  const lastStateRef = useRef({
    edge: edge || 'left',
    isReady,
    touchY: touchY || 300,
    circleDepth: activeCircleDepth,
    lineDepth: activeLineDepth,
  });

  if (isSwiping && edge) {
    lastStateRef.current = {
      edge,
      isReady,
      touchY,
      circleDepth: activeCircleDepth,
      lineDepth: activeLineDepth,
    };
  }

  // Executa mola física ininterrupta de retorno da linha para a borda (0px)
  const runSpringBack = (fromDepth: number, durationMs = 240) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const startTime = performance.now();
    const startVal = Math.max(0, fromDepth);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Damped cubic: retração rápida no início e assentamento macio no bisel
      const current = startVal * Math.pow(1 - t, 2.7);
      setSpringDepth(current);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setSpringDepth(0);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  // 1. Novo swipe iniciado: cancela animações anteriores e reseta o estado
  useEffect(() => {
    if (isSwiping && !prevSwipingRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setExitState(null);
      setIsDetached(false);
      isDetachedRef.current = false;
      prevReadyRef.current = false;
      setSpringDepth(null);
    }
  }, [isSwiping]);

  // 2. Limiar de retorno atingido (isReady):
  // O círculo descola da linha e a linha retorna fluidamente para a borda
  useEffect(() => {
    if (!isSwiping) return;

    if (isReady && !prevReadyRef.current && !isDetachedRef.current) {
      prevReadyRef.current = true;
      isDetachedRef.current = true;
      setIsDetached(true);

      // Inicia a mola elástica da linha voltando para a borda
      runSpringBack(rawLineDepth, 240);
    } else if (!isReady && prevReadyRef.current && progress < 0.65) {
      // Usuário arrastou o dedo de volta para a borda antes de soltar (desarma o gesto)
      prevReadyRef.current = false;
      isDetachedRef.current = false;
      setIsDetached(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setSpringDepth(null);
    }
  }, [isSwiping, isReady, progress, rawLineDepth]);

  // 3. Ao soltar o dedo (Confirmação ou Cancelamento)
  useEffect(() => {
    if (prevSwipingRef.current && !isSwiping) {
      const ready = lastStateRef.current.isReady;
      const lastCircleD = lastStateRef.current.circleDepth;
      const lastLineD = lastStateRef.current.lineDepth;
      const lastEdge = lastStateRef.current.edge;
      const lastY = lastStateRef.current.touchY;

      if (ready) {
        // Gesto confirmado: círculo dá um sutil avanço e desvanece
        setExitState({
          edge: lastEdge,
          isReady: true,
          touchY: lastY,
          initialCircleDepth: lastCircleD,
          isCancel: false,
        });

        const timer = setTimeout(() => {
          setExitState(null);
          setIsDetached(false);
          isDetachedRef.current = false;
          prevReadyRef.current = false;
          setSpringDepth(null);
        }, 180);
        exitTimerRef.current = timer;
      } else {
        // Gesto cancelado / solto antes da ativação:
        // A linha NÃO simplesmente some! Ela retrai fluidamente com a mola elástica até a borda
        if (lastCircleD > 4 || lastLineD > 2) {
          setExitState({
            edge: lastEdge,
            isReady: false,
            touchY: lastY,
            initialCircleDepth: lastCircleD,
            isCancel: true,
          });

          // Dispara retração elástica da linha se ela ainda estava projetada
          if (lastLineD > 0.5) {
            runSpringBack(lastLineD, 220);
          }

          const timer = setTimeout(() => {
            setExitState(null);
            setIsDetached(false);
            isDetachedRef.current = false;
            prevReadyRef.current = false;
            setSpringDepth(null);
          }, 220);
          exitTimerRef.current = timer;
        } else {
          setIsDetached(false);
          isDetachedRef.current = false;
          prevReadyRef.current = false;
          setSpringDepth(null);
        }
      }
    }
    prevSwipingRef.current = isSwiping;
  }, [isSwiping]);

  // Cleanup geral ao desmontar
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Se não está arrastando e não há animação de saída em andamento, não renderiza
  const isExiting = !isSwiping && Boolean(exitState);
  if (!isSwiping && !isExiting) {
    return null;
  }

  const currentEdge: 'left' | 'right' = isSwiping ? (edge || 'left') : exitState!.edge;
  const currentReady = isSwiping ? isReady : exitState!.isReady;
  const currentTouchY = isSwiping ? touchY : exitState!.touchY;
  const isCancelExit = Boolean(exitState?.isCancel);

  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const clampedY = Math.max(70, Math.min(screenHeight - 70, currentTouchY || screenHeight / 2));

  // Posição horizontal do círculo minimalista
  let circleDepth = isSwiping
    ? activeCircleDepth
    : (isCancelExit ? 0 : (exitState?.initialCircleDepth || 36));

  if (isExiting && currentReady && !isCancelExit) {
    // Ao confirmar, o círculo avança levemente em direção à volta
    circleDepth += 6;
  }

  const circleOffset = Math.max(12, circleDepth);
  const circleLeft = currentEdge === 'left' ? `${circleOffset - 17}px` : undefined;
  const circleRight = currentEdge === 'right' ? `${circleOffset - 17}px` : undefined;

  const circleScale = currentReady ? 1.08 : (0.88 + Math.min(progress, 1) * 0.15);
  const lineDepthToRender = activeLineDepth;

  // Parâmetros da curvatura elástica da linha SVG
  const span = 130;
  const topY = Math.max(0, clampedY - span);
  const botY = Math.min(screenHeight, clampedY + span);
  const svgWidth = 80;

  let pathD = '';
  let highlightPathD = '';

  if (lineDepthToRender > 0.5) {
    if (currentEdge === 'left') {
      const cp1X = lineDepthToRender * 0.1;
      const cp1Y = topY + (clampedY - topY) * 0.45;
      const cp2X = lineDepthToRender * 0.95;
      const cp2Y = topY + (clampedY - topY) * 0.85;

      const cp3X = lineDepthToRender * 0.95;
      const cp3Y = clampedY + (botY - clampedY) * 0.15;
      const cp4X = lineDepthToRender * 0.1;
      const cp4Y = clampedY + (botY - clampedY) * 0.55;

      pathD = `M 0,${topY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${lineDepthToRender},${clampedY} C ${cp3X},${cp3Y} ${cp4X},${cp4Y} 0,${botY} Z`;
      highlightPathD = `M 0,${topY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${lineDepthToRender},${clampedY} C ${cp3X},${cp3Y} ${cp4X},${cp4Y} 0,${botY}`;
    } else {
      const peakX = svgWidth - lineDepthToRender;
      const cp1X = svgWidth - lineDepthToRender * 0.1;
      const cp1Y = topY + (clampedY - topY) * 0.45;
      const cp2X = svgWidth - lineDepthToRender * 0.95;
      const cp2Y = topY + (clampedY - topY) * 0.85;

      const cp3X = svgWidth - lineDepthToRender * 0.95;
      const cp3Y = clampedY + (botY - clampedY) * 0.15;
      const cp4X = svgWidth - lineDepthToRender * 0.1;
      const cp4Y = clampedY + (botY - clampedY) * 0.55;

      pathD = `M ${svgWidth},${topY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${peakX},${clampedY} C ${cp3X},${cp3Y} ${cp4X},${cp4Y} ${svgWidth},${botY} Z`;
      highlightPathD = `M ${svgWidth},${topY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${peakX},${clampedY} C ${cp3X},${cp3Y} ${cp4X},${cp4Y} ${svgWidth},${botY}`;
    }
  }

  // Opacidade da linha é proporcional à sua projeção elástica (desvanece naturalmente ao encolher até a borda)
  const lineOpacity = Math.min(1, Math.max(0, lineDepthToRender / 8));
  // Opacidade do círculo
  const circleOpacity = isExiting
    ? 0
    : Math.min(1, Math.max(0, activeCircleDepth / 10));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. MEMBRANA ELÁSTICA (A LINHA QUE SE ESTICA E RETRAI FLUIDA)
         ───────────────────────────────────────────────────────────── */}
      {lineDepthToRender > 0.5 && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: currentEdge === 'left' ? 0 : undefined,
            right: currentEdge === 'right' ? 0 : undefined,
            width: `${svgWidth}px`,
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
            opacity: lineOpacity,
            transition: isDetached ? 'opacity 0.2s ease' : 'none',
          }}
          viewBox={`0 0 ${svgWidth} ${screenHeight}`}
        >
          <defs>
            <linearGradient id={`elasticEdgeGrad_${currentEdge}`} x1={currentEdge === 'left' ? '0%' : '100%'} y1="0%" x2={currentEdge === 'left' ? '100%' : '0%'} y2="0%">
              <stop offset="0%" stopColor="#0B0E0D" stopOpacity="0.88" />
              <stop offset="100%" stopColor="rgba(22, 30, 26, 0.92)" />
            </linearGradient>
          </defs>

          {/* Preenchimento elástico suave */}
          <path
            d={pathD}
            fill={`url(#elasticEdgeGrad_${currentEdge})`}
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          />

          {/* Linha elástica com realce de luz */}
          <path
            d={highlightPathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. CÍRCULO MINIMALISTA QUE DEIXA A LINHA AO FICAR PRONTO
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: `${clampedY}px`,
          left: circleLeft,
          right: circleRight,
          transform: `translateY(-50%) ${isExiting && currentReady && !isCancelExit ? (currentEdge === 'left' ? 'translateX(8px)' : 'translateX(-8px)') : ''}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: circleOpacity,
          transition: isExiting
            ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out, left 0.2s cubic-bezier(0.16, 1, 0.3, 1), right 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'opacity 0.1s ease',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: currentReady ? 'rgba(16, 28, 22, 0.94)' : 'rgba(18, 22, 20, 0.92)',
            border: currentReady ? '1.5px solid #4ADE80' : '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: currentReady
              ? '0 0 14px rgba(74, 222, 128, 0.28), 0 4px 16px rgba(0, 0, 0, 0.5)'
              : '0 4px 14px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${circleScale})`,
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <ChevronLeft
            size={18}
            color={currentReady ? '#4ADE80' : 'rgba(255, 255, 255, 0.85)'}
            strokeWidth={currentReady ? 2.8 : 2.2}
            style={{
              transform: currentEdge === 'right' ? 'rotate(180deg)' : 'none',
              transition: 'color 0.15s ease, transform 0.15s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
};
