import React from 'react';
import { Target, BarChart2, CreditCard } from 'lucide-react';

interface FeatureShortcutsSectionProps {
  onNavigateToMetas: () => void;
  onNavigateToRelatorios: () => void;
  onNavigateToContas: () => void;
}

export const FeatureShortcutsSection: React.FC<FeatureShortcutsSectionProps> = ({
  onNavigateToMetas,
  onNavigateToRelatorios,
  onNavigateToContas,
}) => {
  const items = [
    {
      id: 'metas',
      title: 'Metas',
      description: 'Tire seus planos do papel.',
      icon: Target,
      action: onNavigateToMetas,
    },
    {
      id: 'relatorios',
      title: 'Relatórios',
      description: 'Entenda para evoluir.',
      icon: BarChart2,
      action: onNavigateToRelatorios,
    },
    {
      id: 'contas',
      title: 'Contas',
      description: 'Tudo organizado e sob controle.',
      icon: CreditCard,
      action: onNavigateToContas,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        width: '100%',
      }}
    >
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            onClick={item.action}
            className="card-sobra"
            style={{
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              minHeight: '115px',
            }}
          >
            {/* Ícone verde característico do mockup */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ADE80',
                marginBottom: '10px',
              }}
            >
              <Icon size={17} strokeWidth={2.4} />
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  lineHeight: 1.15,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: '#94A3B8',
                  marginTop: '3px',
                  lineHeight: 1.25,
                }}
              >
                {item.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
