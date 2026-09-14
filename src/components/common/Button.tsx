import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  style = {},
  disabled = false,
  className = '',
  ...props
}) => {
  const { colors } = useTheme();

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.surfaceElevated,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
        };
      case 'danger':
        return {
          backgroundColor: colors.expense,
          color: '#FFFFFF',
          border: 'none',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: colors.textSecondary,
          border: 'none',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: colors.primary,
          border: `1px solid ${colors.primary}`,
        };
      default: // primary
        return {
          backgroundColor: colors.primary,
          color: '#FFFFFF',
          border: 'none',
          boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.35)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' };
      case 'lg':
        return { padding: '14px 24px', fontSize: '1.05rem', borderRadius: '14px' };
      default:
        return { padding: '10px 18px', fontSize: '0.92rem', borderRadius: '10px' };
    }
  };

  return (
    <button
      disabled={disabled}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};
