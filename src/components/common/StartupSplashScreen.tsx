import React, { useState, useEffect, useRef } from 'react';

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
          top: 'calc(50% - 130px)',
          left: 'calc(50% - 130px)',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74, 222, 128, 0.22) 0%, rgba(34, 197, 94, 0.08) 50%, transparent 72%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
        }}
      />

      {/* 2. Container Central com Ícone e Marca */}
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
        {/* Squircle Ícone Oficial */}
        <div
          className="splash-icon-anim"
          style={{
            width: '92px',
            height: '92px',
            borderRadius: '26px',
            backgroundColor: '#0E1410',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75), 0 0 35px rgba(74, 222, 128, 0.22)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderTop: '1px solid rgba(255, 255, 255, 0.24)',
          }}
        >
          {useSvgFallback ? (
            <svg
              width="92"
              height="92"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              <defs>
                <linearGradient id="splashLeafGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#86EFAC" />
                  <stop offset="100%" stopColor="#4ADE80" />
                </linearGradient>
                <linearGradient id="splashLeafGradBot" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ADE80" />
                  <stop offset="100%" stopColor="#22C55E" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="26" fill="#0E1410" />
              {/* Folha Superior */}
              <path
                d="M 27.2 44.5 C 26.5 49.5, 28.5 53.2, 32.5 53.2 C 41.5 48.5, 53.5 38.5, 71.5 21.2 C 72.2 20.6, 71.2 20.4, 69.5 20.4 C 52 20.4, 31.5 25.5, 27.2 44.5 Z"
                fill="url(#splashLeafGradTop)"
              />
              {/* Folha Inferior rotacionada 180° */}
              <g transform="rotate(180 49.35 50)">
                <path
                  d="M 27.2 44.5 C 26.5 49.5, 28.5 53.2, 32.5 53.2 C 41.5 48.5, 53.5 38.5, 71.5 21.2 C 72.2 20.6, 71.2 20.4, 69.5 20.4 C 52 20.4, 31.5 25.5, 27.2 44.5 Z"
                  fill="url(#splashLeafGradBot)"
                />
              </g>
            </svg>
          ) : (
            <img
              src="/assets/sobra_icon.png"
              alt="Sobra"
              width={92}
              height={92}
              onError={() => setUseSvgFallback(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}

          {/* Shimmer de reflexo de luz diagonal (Apple / Linear style) */}
          <div
            className="splash-shimmer-anim"
            style={{
              position: 'absolute',
              top: '-60%',
              left: '-60%',
              width: '220%',
              height: '220%',
              background: 'linear-gradient(110deg, transparent 35%, rgba(255, 255, 255, 0.3) 50%, transparent 65%)',
              pointerEvents: 'none',
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
