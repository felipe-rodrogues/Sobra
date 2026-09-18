import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SwipeBackState } from '../../hooks/useSwipeBack';

interface SwipeBackIndicatorProps {
  swipeState: SwipeBackState;
}

export const SwipeBackIndicator: React.FC<SwipeBackIndicatorProps> = ({ swipeState }) => {
  const { isSwiping, edge, progress, touchY } = swipeState;

  if (!isSwiping || !edge || progress <= 0.05) return null;

  const isReady = progress >= 0.95;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const clampedY = Math.max(80, Math.min(screenHeight - 80, touchY || screenHeight / 2));

  // Distância projetada para fora da borda (máximo ~45px)
  const offsetDistance = Math.min(progress * 42, 42);
  const scale = 0.8 + progress * 0.3;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${clampedY}px`,
        left: edge === 'left' ? `${offsetDistance - 18}px` : undefined,
        right: edge === 'right' ? `${offsetDistance - 18}px` : undefined,
        transform: 'translateY(-50%)',
        zIndex: 99999,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: isReady ? '#4ADE80' : 'rgba(24, 32, 27, 0.92)',
          border: isReady ? '2px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: isReady 
            ? '0 0 16px rgba(74, 222, 128, 0.6), 0 4px 12px rgba(0,0,0,0.5)' 
            : '0 4px 14px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          transition: 'transform 0.05s ease-out',
        }}
      >
        <ChevronLeft 
          size={22} 
          color={isReady ? '#000000' : '#FFFFFF'} 
          strokeWidth={isReady ? 3 : 2.5}
          style={{ 
            transform: edge === 'right' ? 'rotate(180deg) translateX(-1px)' : 'translateX(-1px)',
            transition: 'transform 0.15s ease',
          }}
        />
      </div>
    </div>
  );
};
