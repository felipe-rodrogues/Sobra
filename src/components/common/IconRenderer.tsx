import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconRendererProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ 
  name, 
  size = 20, 
  color = 'currentColor',
  className = ''
}) => {
  // Converte nome simples (ex: 'Wallet', 'Utensils') para o ícone Lucide correspondente
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.CircleHelp;
  return <IconComponent size={size} color={color} className={className} />;
};
