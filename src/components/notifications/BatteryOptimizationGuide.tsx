import React, { useState } from 'react';
import {
  Smartphone,
  Zap,
  Shield,
  Settings,
  ExternalLink,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { notificationListenerBridge } from '../../native/notificationListener';

interface BatteryOptimizationGuideProps {
  compact?: boolean;
  onOpenSettings?: () => void;
}

type BrandType = 'xiaomi' | 'samsung' | 'motorola' | 'others';

export const BatteryOptimizationGuide: React.FC<BatteryOptimizationGuideProps> = ({
  compact = false,
  onOpenSettings,
}) => {
  const [selectedBrand, setSelectedBrand] = useState<BrandType>('xiaomi');
  const [isOpened, setIsOpened] = useState(false);

  const handleOpenAppSettings = async () => {
    setIsOpened(true);
    if (onOpenSettings) {
      onOpenSettings();
    }
    await notificationListenerBridge.openAppSettings();
  };

  const brands = [
    { id: 'xiaomi' as BrandType, label: 'Xiaomi / POCO', icon: Zap, accent: '#F97316' },
    { id: 'samsung' as BrandType, label: 'Samsung', icon: Smartphone, accent: '#3B82F6' },
    { id: 'motorola' as BrandType, label: 'Motorola', icon: Shield, accent: '#A855F7' },
    { id: 'others' as BrandType, label: 'Outros', icon: Settings, accent: '#10B981' },
  ];

  const instructions: Record<
    BrandType,
    {
      title: string;
      why: string;
      steps: { step: string; detail?: string }[];
      proTip?: string;
    }
  > = {
    xiaomi: {
      title: 'Xiaomi, POCO & Redmi (MIUI / HyperOS)',
      why: 'A Xiaomi congela processos em segundo plano por padrão se o início automático não estiver ativo.',
      steps: [
        {
          step: '1. Abra as Configurações do Sobra',
          detail: 'Toque no botão verde abaixo para ir direto à tela do app nas configurações do Android.',
        },
        {
          step: '2. Ative "Início Automático" (Autostart)',
          detail: 'Ligue a chavinha de início automático para permitir que o leitor receba avisos com o app fechado.',
        },
        {
          step: '3. Bateria: "Nenhuma Restrição"',
          detail: 'Role até Economia de Bateria e mude de "Recomendado" para "Nenhuma restrição".',
        },
      ],
      proTip: 'Dica de Ouro: Na tela de apps recentes do celular, segure o card do Sobra e toque no cadeado 🔒 para travá-lo na memória.',
    },
    samsung: {
      title: 'Samsung Galaxy (One UI)',
      why: 'A Samsung suspende aplicativos automaticamente se você passar alguns dias sem abrir a interface.',
      steps: [
        {
          step: '1. Bateria: "Sem Restrições"',
          detail: 'Toque no botão abaixo > Bateria > selecione a opção "Sem restrições" (Unrestricted).',
        },
        {
          step: '2. Configurações do Celular > Assistência do Aparelho',
          detail: 'Abra as Configurações do seu Galaxy > Assistência do aparelho (ou Bateria).',
        },
        {
          step: '3. "Apps que nunca são suspensos"',
          detail: 'Toque em Limites de uso em segundo plano > Apps que nunca são suspensos > Toque no (+) e adicione o Sobra.',
        },
      ],
      proTip: 'Isso garante que o Sobra capture 100% dos gastos no mesmo segundo em que a notificação do cartão chegar.',
    },
    motorola: {
      title: 'Motorola, Pixel & Android Puro',
      why: 'O Android padrão limita a frequência de verificação em segundo plano se mantido em "Otimizado".',
      steps: [
        {
          step: '1. Abra as Configurações do Sobra',
          detail: 'Toque no botão verde abaixo para acessar as informações do aplicativo.',
        },
        {
          step: '2. Toque em "Bateria"',
          detail: 'Procure por "Bateria" ou "Uso da bateria pelo app".',
        },
        {
          step: '3. Selecione "Sem Restrições"',
          detail: 'Mude de "Otimizado" para "Sem restrições" para leitura contínua.',
        },
      ],
      proTip: 'Certifique-se também de que as notificações do app do seu banco estão autorizadas e não estão como silenciosas.',
    },
    others: {
      title: 'Realme, Asus, Oppo & Outras Marcas',
      why: 'Customizações de fabricantes podem desligar serviços em segundo plano ao apagar a tela.',
      steps: [
        {
          step: '1. Abra as Configurações do Sobra',
          detail: 'Toque no botão verde abaixo para abrir a página de detalhes do Sobra.',
        },
        {
          step: '2. Permissão de Bateria Irrestrita',
          detail: 'Localize Gerenciamento de Bateria e permita execução irrestrita em segundo plano.',
        },
        {
          step: '3. Inicialização Automática',
          detail: 'Se o seu celular tiver gerenciador de segurança, autorize o Sobra a iniciar automaticamente.',
        },
      ],
    },
  };

  const currentInfo = instructions[selectedBrand];

  return (
    <div
      style={{
        backgroundColor: '#0D110E',
        borderRadius: compact ? '20px' : '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: compact ? '16px' : '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* Topo: Título e Explicação */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <Zap size={18} color="#F59E0B" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: compact ? '0.88rem' : '0.94rem',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              lineHeight: 1.25,
            }}
          >
            Evitar Suspensão no Celular
          </div>
          <div
            style={{
              fontSize: compact ? '0.74rem' : '0.78rem',
              color: '#94A3B8',
              marginTop: '3px',
              lineHeight: 1.4,
            }}
          >
            Selecione a marca do seu aparelho para ver o passo a passo exato e nunca mais perder uma compra:
          </div>
        </div>
      </div>

      {/* Seletor de Marcas (Pills em grade/carrossel responsivo) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          padding: '4px',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {brands.map(b => {
          const isSelected = selectedBrand === b.id;
          const Icon = b.icon;

          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBrand(b.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px 4px',
                borderRadius: '10px',
                border: isSelected ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: isSelected ? '#FFFFFF' : '#71717A',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} color={isSelected ? b.accent : '#71717A'} />
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isSelected ? 700 : 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {b.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo Instrucional da Marca Selecionada */}
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={13} color="#F59E0B" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.74rem', color: '#FCD34D', fontWeight: 600 }}>
            {currentInfo.why}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
          {currentInfo.steps.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#4ADE80',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {idx + 1}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E4E4E7', lineHeight: 1.25 }}>
                  {s.step.replace(/^\d+\.\s*/, '')}
                </div>
                {s.detail && (
                  <div style={{ fontSize: '0.72rem', color: '#8E8E93', marginTop: '2px', lineHeight: 1.35 }}>
                    {s.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {currentInfo.proTip && (
          <div
            style={{
              marginTop: '4px',
              padding: '8px 10px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.71rem',
              color: '#A1A1AA',
              lineHeight: 1.35,
            }}
          >
            <strong style={{ color: '#E4E4E7' }}>💡 {currentInfo.proTip}</strong>
          </div>
        )}
      </div>

      {/* Botão de Ação Direta para abrir Configurações do App no Android */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          onClick={handleOpenAppSettings}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: '14px',
            backgroundColor: '#22C55E',
            border: 'none',
            color: '#061309',
            fontSize: '0.84rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#16A34A';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#22C55E';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span>Abrir Configurações do Sobra no Celular</span>
          <ExternalLink size={15} strokeWidth={2.5} />
        </button>

        {isOpened && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.7rem',
              color: '#4ADE80',
              marginTop: '2px',
            }}
          >
            <CheckCircle2 size={12} />
            <span>Configurações abertas! Altere a bateria e volte para o Sobra.</span>
          </div>
        )}
      </div>
    </div>
  );
};
