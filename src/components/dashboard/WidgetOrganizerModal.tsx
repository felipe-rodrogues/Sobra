import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { 
  Check, 
  Wallet, 
  ArrowLeftRight, 
  TrendingUp, 
  Clock, 
  CalendarClock, 
  CreditCard, 
  Percent, 
  Sparkles,
  Gauge,
  BarChart3,
  PieChart
} from 'lucide-react';

export interface WidgetVisibilityConfig {
  sobraAI: boolean;
  balance: boolean;
  cashFlow: boolean;
  spending: boolean;
  burnRate: boolean;
  monthlyEvolution: boolean;
  categoryDistribution: boolean;
  cards: boolean;
  recentTxns: boolean;
  subscriptions: boolean;
}

export const defaultWidgetConfig: WidgetVisibilityConfig = {
  sobraAI: true,
  balance: true,
  cashFlow: true,
  spending: true,
  burnRate: true,
  monthlyEvolution: true,
  categoryDistribution: true,
  cards: true,
  recentTxns: true,
  subscriptions: true,
};

interface WidgetOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WidgetVisibilityConfig;
  onSaveConfig: (newConfig: WidgetVisibilityConfig) => void;
}

export const WidgetOrganizerModal: React.FC<WidgetOrganizerModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [localConfig, setLocalConfig] = React.useState<WidgetVisibilityConfig>(config);

  React.useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  const toggleWidget = (key: keyof WidgetVisibilityConfig) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const widgetOptions: Array<{
    key: keyof WidgetVisibilityConfig;
    label: string;
    description: string;
    icon: any;
    color: string;
  }> = [
    {
      key: 'sobraAI',
      label: 'Sobra AI • Diagnóstico & Insights',
      description: 'Health Score (0 a 100), anomalias e plano de ação estratégico',
      icon: Sparkles,
      color: '#A855F7',
    },
    {
      key: 'burnRate',
      label: 'Projeção de Sobra & Burn Rate',
      description: 'Previsão matemática para o fim do mês e ritmo diário de queima',
      icon: Gauge,
      color: '#CCFF00',
    },
    {
      key: 'monthlyEvolution',
      label: 'Evolução Mensal (6 Meses)',
      description: 'Comparativo de receitas vs despesas com indicadores de superávit',
      icon: BarChart3,
      color: '#38BDF8',
    },
    {
      key: 'categoryDistribution',
      label: 'Distribuição por Categoria',
      description: 'Gráfico Donut interativo com fatias e percentuais do mês',
      icon: PieChart,
      color: '#EC4899',
    },
    {
      key: 'balance',
      label: 'Saldo em contas',
      description: 'Total disponível somando todas as contas bancárias',
      icon: Wallet,
      color: '#10B981',
    },
    {
      key: 'cashFlow',
      label: 'Fluxo de caixa',
      description: 'Comparativo de receitas e despesas do mês corrente',
      icon: ArrowLeftRight,
      color: '#38BDF8',
    },
    {
      key: 'spending',
      label: 'Gastos do mês',
      description: 'Gráfico em onda suave dos gastos diários acumulados',
      icon: TrendingUp,
      color: '#F43F5E',
    },
    {
      key: 'cards',
      label: 'Cartões de crédito',
      description: 'Resumo de cada cartão com faturas, limites e vencimentos',
      icon: CreditCard,
      color: '#CCFF00',
    },
    {
      key: 'recentTxns',
      label: 'Transações recentes',
      description: 'Últimas movimentações financeiras com logos dos bancos',
      icon: Clock,
      color: '#A855F7',
    },
    {
      key: 'subscriptions',
      label: 'Assinaturas fixas',
      description: 'Compromissos recorrentes e serviços cadastrados',
      icon: CalendarClock,
      color: '#F59E0B',
    },
  ];

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  const handleReset = () => {
    setLocalConfig(defaultWidgetConfig);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Organizar Widgets"
      subtitle="Escolha quais blocos aparecem na sua tela principal"
      maxWidth="500px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {widgetOptions.map(opt => {
          const isSelected = localConfig[opt.key];
          const Icon = opt.icon;

          return (
            <div
              key={opt.key}
              onClick={() => toggleWidget(opt.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '16px',
                backgroundColor: isSelected ? '#1A2234' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isSelected ? 'rgba(204, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: `${opt.color}20`,
                    color: opt.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#94A3B8' }}>
                    {opt.description}
                  </div>
                </div>
              </div>

              {/* Checkbox em formato de pílula / switch */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? '#CCFF00' : '#1E293B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <Button variant="outline" onClick={handleReset} style={{ flex: 1 }}>
            Restaurar Padrão
          </Button>
          <Button variant="primary" onClick={handleSave} style={{ flex: 1.5 }}>
            Salvar Preferências
          </Button>
        </div>
      </div>
    </Modal>
  );
};
