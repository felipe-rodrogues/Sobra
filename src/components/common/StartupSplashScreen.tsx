import React, { useState, useEffect, useRef } from 'react';
import { SOBRA_LEAF_POINTS } from './sobraIconPoints';

export interface StartupSplashScreenProps {
  /** Se os dados e autenticação do app já estão prontos */
  isReady?: boolean;
  /** Tempo mínimo de exibição da coreografia em ms (padrão 1250ms) */
  minDurationMs?: number;
  /** Tempo máximo de segurança antes de forçar a saída em ms (padrão 2800ms) */
  maxDurationMs?: number;
  /** Callback executado após a conclusão completa da transição de saída */
  onFinished?: () => void;
}

/**
 * StartupSplashScreen - Animação de Inicialização Oficial do Sobra
 * 
 * Segue à risca o workflow animacao.md:
 * - Movimento com física natural (deceleração e spring suavizado)
 * - Shimmer diagonal translúcido simulando acabamento em vidro/cristal fintech
 * - Entrada escalonada da tipografia institucional
 * - GPU-accelerated: exclusivamente animando transform e opacity
 * - Respeito automático a prefers-reduced-motion
 */
export const StartupSplashScreen: React.FC<StartupSplashScreenProps> = ({
  isReady = true,
  minDurationMs = 1250,
  maxDurationMs = 2800,
  onFinished,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const [useSvgFallback, setUseSvgFallback] = useState(false);

  const minDurationPassedRef = useRef(false);
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  // Gerencia o ciclo de vida e a sincronização com o carregamento do app
  useEffect(() => {
    let exitTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
    let finishTimeout: ReturnType<typeof setTimeout> | null = null;

    const triggerExit = () => {
      if (isExiting) return;
      setIsExiting(true);

      // Aguarda os 420ms da transição de saída antes de desmontar do DOM
      finishTimeout = setTimeout(() => {
        setIsMounted(false);
        onFinished?.();
      }, 420);
    };

    // 1. Temporizador de tempo mínimo (para apreciar a coreografia sem corte rápido)
    const minTimer = setTimeout(() => {
      minDurationPassedRef.current = true;
      if (isReadyRef.current) {
        triggerExit();
      }
    }, minDurationMs);

    // 2. Temporizador de segurança máxima (garante que nunca trave se a rede falhar)
    const maxSafetyTimer = setTimeout(() => {
      triggerExit();
    }, maxDurationMs);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxSafetyTimer);
      if (exitTriggerTimeout) clearTimeout(exitTriggerTimeout);
      if (finishTimeout) clearTimeout(finishTimeout);
    };
  }, [minDurationMs, maxDurationMs, isExiting, onFinished]);

  // Se o app ficar pronto após o tempo mínimo ter passado, aciona a saída
  useEffect(() => {
    if (isReady && minDurationPassedRef.current && !isExiting) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsMounted(false);
        onFinished?.();
      }, 420);
      return () => clearTimeout(timer);
    }
  }, [isReady, isExiting, onFinished]);

  if (!isMounted) return null;

  return (
    <div
      aria-hidden={isExiting ? 'true' : 'false'}
      role="status"
      aria-label="Carregando Sobra"
      className={isExiting ? 'splash-exit-anim' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#070A0E',
        backgroundImage: 'radial-gradient(ellipse at 50% 45%, #0d1511 0%, #070A0E 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'var(--safe-area-top, env(safe-area-inset-top, 0px))',
        paddingBottom: 'var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'var(--safe-area-left, env(safe-area-inset-left, 0px))',
        paddingRight: 'var(--safe-area-right, env(safe-area-inset-right, 0px))',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 1. Aura / Radial Glow verde esmeralda ao fundo */}
      <div
        className="splash-glow-anim"
        style={{
          position: 'absolute',
          top: 'calc(50% - 150px)',
          left: 'calc(50% - 150px)',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74, 222, 128, 0.26) 0%, rgba(34, 197, 94, 0.10) 45%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* 2. Container Central com Ícone Puro e Marca */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Ícone Oficial Puro Flutuante (Sem caixa rígida, máxima leveza e sofisticação) */}
        <div
          className="splash-icon-anim"
          style={{
            width: '104px',
            height: '104px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: 'drop-shadow(0 14px 34px rgba(74, 222, 128, 0.35)) drop-shadow(0 2px 10px rgba(0, 0, 0, 0.45))',
          }}
        >
          {useSvgFallback ? (
            <svg
              width="104"
              height="104"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              <defs>
                <linearGradient id="splashLeafGradTop" x1="15%" y1="0%" x2="95%" y2="95%">
                  <stop offset="0%" stopColor="#86EFAC" />
                  <stop offset="30%" stopColor="#4ADE80" />
                  <stop offset="75%" stopColor="#22C55E" />
                  <stop offset="100%" stopColor="#15803D" />
                </linearGradient>
                <linearGradient id="splashLeafGradBot" x1="85%" y1="5%" x2="15%" y2="100%">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="40%" stopColor="#22C55E" />
                  <stop offset="78%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <g transform="translate(50, 50) scale(1.08) translate(-50, -50)">
                <polygon points={SOBRA_LEAF_POINTS} fill="url(#splashLeafGradTop)" />
                <g transform="rotate(180 50 50)">
                  <polygon points={SOBRA_LEAF_POINTS} fill="url(#splashLeafGradBot)" />
                </g>
              </g>
            </svg>
          ) : (
            <img
              src="/assets/sobra_icon.png"
              alt="Sobra"
              width={104}
              height={104}
              onError={() => setUseSvgFallback(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          {/* Shimmer / reflexo sutil mantido para compatibilidade de animação */}
          <div
            className="splash-shimmer-anim"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0,
            }}
          />
        </div>

        {/* Tipografia da Marca com Revelação Escalonada */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '22px',
          }}
        >
          <span
            className="splash-brand-anim"
            style={{
              fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
              fontSize: '32px',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
            }}
          >
            Sobra
          </span>
          <span
            className="splash-sub-anim"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '9.5px',
              fontWeight: 600,
              color: '#A7F3D0',
              textTransform: 'uppercase',
              marginTop: '6px',
              paddingLeft: '0.32em', // compensa visualmente o tracking para alinhamento central perfeito
              opacity: 0.85,
            }}
          >
            Mais do seu amanhã
          </span>
        </div>
      </div>

      {/* 3. Rodapé Minimalista Confidente */}
      <div
        style={{
          position: 'absolute',
          bottom: 'max(28px, calc(16px + var(--safe-area-bottom, 0px)))',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isExiting ? 0 : 0.45,
          transition: 'opacity 0.25s ease',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#4ADE80',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '11px',
            fontWeight: 500,
            color: '#94A3B8',
            letterSpacing: '0.04em',
          }}
        >
          Controle Financeiro Inteligente
        </span>
      </div>
    </div>
  );
};
