import React from 'react';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from './SwipeBackIndicator';

interface SwipeBackViewProps {
  onBack?: () => void;
  enabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const SwipeBackView: React.FC<SwipeBackViewProps> = ({
  onBack,
  enabled = true,
  children,
  style,
  className,
}) => {
  const swipeState = useSwipeBack({ onBack, enabled });

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
