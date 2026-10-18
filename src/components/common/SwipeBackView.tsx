import React from 'react';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from './SwipeBackIndicator';
import { BACK_PRIORITY } from '../../core/navigation/backNavigation';

interface SwipeBackViewProps {
  onBack?: () => void;
  enabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  priority?: number;
}

export const SwipeBackView: React.FC<SwipeBackViewProps> = ({
  onBack,
  enabled = true,
  children,
  style,
  className,
  priority = BACK_PRIORITY.SCREEN,
}) => {
  const swipeState = useSwipeBack({ onBack, enabled, priority });

  return (
    <div 
      className={className}
      style={{ 
        width: '100%', 
        minHeight: '100%', 
        position: 'relative',
        ...style 
      }}
    >
      <SwipeBackIndicator swipeState={swipeState} />
      {children}
    </div>
  );
};
