import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  style = {}, 
  onClick,
  hoverable = false 
}) => {
  const { colors } = useTheme();

  return (
    <div
      onClick={onClick}
      className={`glass animate-fade-in ${className}`}
      style={{
        backgroundColor: colors.surfaceGlass,
        border: `1px solid ${colors.border}`,
        borderRadius: '16px',
        padding: '18px',
        boxShadow: colors.cardShadow,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={e => {
        if (hoverable || onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = colors.borderFocus;
        }
      }}
      onMouseLeave={e => {
        if (hoverable || onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = colors.border;
        }
      }}
    >
      {children}
    </div>
  );
};
