import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'income' | 'expense' | 'warning' | 'neutral';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  style = {}
}) => {
  const { colors } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'income':
        return {
          backgroundColor: colors.incomeBg,
          color: colors.income,
          border: `1px solid rgba(16, 185, 129, 0.25)`,
        };
      case 'expense':
        return {
          backgroundColor: colors.expenseBg,
          color: colors.expense,
          border: `1px solid rgba(244, 63, 94, 0.25)`,
        };
      case 'warning':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          color: colors.budgetWarning,
          border: `1px solid rgba(245, 158, 11, 0.25)`,
        };
      case 'primary':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: colors.primaryLight,
          border: `1px solid rgba(16, 185, 129, 0.3)`,
        };
      default:
        return {
          backgroundColor: colors.surfaceElevated,
          color: colors.textSecondary,
          border: `1px solid ${colors.border}`,
        };
    }
  };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: '9999px',
        fontSize: size === 'sm' ? '0.72rem' : '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        ...getVariantStyles(),
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
};
