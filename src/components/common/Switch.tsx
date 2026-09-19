import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: string;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  activeColor,
  disabled = false,
  id,
}) => {
  const { colors } = useTheme();
  const accent = activeColor || colors.primary;

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      style={{
        position: 'relative',
        width: '40px',
        height: '24px',
        borderRadius: '12px',
        backgroundColor: checked ? accent : 'rgba(255, 255, 255, 0.16)',
        border: 'none',
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
          transform: checked ? 'translateX(19px)' : 'translateX(3px)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </button>
  );
};
