import React from 'react';

interface FluidAuraWaveProps {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const FluidAuraWave: React.FC<FluidAuraWaveProps> = ({
  height = 200,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`fluid-aura-wave-container ${className}`}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${height}px`,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
        // Máscara vertical para transição fluida e suave para o preto
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 45%, rgba(0,0,0,0.15) 80%, transparent 100%)',
        maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 45%, rgba(0,0,0,0.15) 80%, transparent 100%)',
        ...style,
      }}
    >
      {/* Camada 1: Blobs orgânicos de fumaça esmeralda com desfoque profundo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'blur(42px)',
          transform: 'translateZ(0)',
        }}
      >
        {/* Blob Esmeralda Primário - Esquerda para Centro */}
        <div
          className="fluid-smoke-1"
          style={{
            position: 'absolute',
            bottom: '-20px',
            left: '10%',
            width: '240px',
            height: '140px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.45) 0%, rgba(16, 185, 129, 0.25) 50%, transparent 80%)',
          }}
        />

        {/* Blob Menta/Neon - Direita para Centro */}
        <div
          className="fluid-smoke-2"
          style={{
            position: 'absolute',
            bottom: '-10px',
            right: '8%',
            width: '260px',
            height: '150px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(74, 222, 128, 0.38) 0%, rgba(34, 197, 94, 0.2) 60%, transparent 80%)',
          }}
        />

        {/* Blob Verde Floresta Profundo - Centro Inferior */}
        <div
          className="fluid-smoke-3"
          style={{
            position: 'absolute',
            bottom: '-30px',
            left: '30%',
            width: '280px',
            height: '160px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(5, 150, 105, 0.4) 0%, rgba(20, 83, 45, 0.25) 55%, transparent 85%)',
          }}
        />
      </div>

      {/* Camada 2: Ondas fluidas suaves (SVG Ribbons) com gradiente esmeralda */}
      <svg
        viewBox="0 0 600 160"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: '-10%',
          width: '120%',
          height: '110px',
          opacity: 0.5,
          filter: 'blur(16px)',
        }}
      >
        <defs>
          <linearGradient id="fluidWaveGradA" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#22C55E" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#4ADE80" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="fluidWaveGradB" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#34D399" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Onda A: oscilação fluida suave */}
        <path
          className="fluid-wave-ribbon-a"
          d="M0,80 C120,40 220,120 340,60 C460,10 540,90 600,60 L600,160 L0,160 Z"
          fill="url(#fluidWaveGradA)"
        />

        {/* Onda B: oscilação complementar */}
        <path
          className="fluid-wave-ribbon-b"
          d="M0,95 C100,130 200,50 320,100 C440,140 520,60 600,85 L600,160 L0,160 Z"
          fill="url(#fluidWaveGradB)"
        />
      </svg>
    </div>
  );
};
