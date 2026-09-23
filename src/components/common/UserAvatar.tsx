import React, { useState, useEffect, useMemo } from 'react';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  border?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 42,
  border = '2px solid #4ADE80',
  backgroundColor,
  textColor = '#4ADE80',
  fontSize,
  style = {},
  className = '',
  onClick,
  title,
}) => {
  const [hasError, setHasError] = useState(false);

  // Reseta o erro caso a URL do avatar mude
  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Calcula iniciais elegantes
  const initials = useMemo(() => {
    const clean = (name || '').trim();
    if (!clean) return 'U';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const defaultFontSize = fontSize || `${Math.max(11, Math.round(size * 0.38))}px`;

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    border: border || 'none',
    boxSizing: 'border-box',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  if (src && !hasError) {
    return (
      <div style={containerStyle} className={className} onClick={onClick} title={title || name || undefined}>
        <img
          src={src}
          alt={name || 'Foto de perfil'}
          referrerPolicy="no-referrer"
          loading="eager"
          crossOrigin="anonymous"
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...containerStyle,
        backgroundColor: backgroundColor || 'rgba(74, 222, 128, 0.15)',
        color: textColor,
        fontWeight: 800,
        fontSize: defaultFontSize,
        fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
        letterSpacing: '-0.02em',
        userSelect: 'none',
      }}
      className={className}
      onClick={onClick}
      title={title || name || undefined}
    >
      {initials}
    </div>
  );
};
