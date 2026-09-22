import React from 'react';
import { Users } from 'lucide-react';

interface SharedBadgeProps {
  label?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const SharedBadge: React.FC<SharedBadgeProps> = ({
  label = 'Conjunto',
  size = 'sm',
  style,
}) => {
  const isMd = size === 'md';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isMd ? '5px' : '4px',
        padding: isMd ? '3px 9px' : '2px 7px',
        borderRadius: '6px',
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        border: '1px solid rgba(74, 222, 128, 0.3)',
        color: '#4ADE80',
        fontSize: isMd ? '0.75rem' : '0.68rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '0.02em',
        userSelect: 'none',
        ...style,
      }}
    >
      <Users size={isMd ? 13 : 11} />
      <span>{label}</span>
    </span>
  );
};
