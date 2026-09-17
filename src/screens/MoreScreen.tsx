import React, { useState } from 'react';
import { 
  Wallet,
  CalendarClock, 
  BellRing, 
  Sparkles, 
  UploadCloud, 
  Sun, 
  Moon, 
  ChevronRight,
  ShieldCheck,
  Activity,
  Flame,
  RotateCcw
} from 'lucide-react';
import { SobraLogo } from '../components/common/SobraLogo';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { 
  SobiPersonalityId, 
  SOBI_PERSONALITIES, 
  getSobiPersonality, 
  loadSavedPersonality, 
  savePersonality 
} from '../core/ai/sobiPersonality';
import { SobiAvatar } from '../components/common/SobiAvatar';

interface MoreScreenProps {
  onNavigateToTab: (tab: string) => void;
  onOpenCsvImport: () => void;
  onOpenWidgetOrganizer?: () => void;
  onOpenAiChat: () => void;
  onOpenRelatorios?: () => void;
  onOpenProjection?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  onNavigateToTab,
  onOpenCsvImport,
  onOpenWidgetOrganizer,
  onOpenAiChat,
  onOpenRelatorios,
  onOpenProjection,
}) => {
  const { accounts, subscriptions, pendingNotifications, isPrivacyMode, resetAllData } = useFinance();
  const { mode, toggleTheme } = useTheme();

  const [selectedPersonality, setSelectedPersonality] = useState<SobiPersonalityId>(() => loadSavedPersonality());
  const [isResetting, setIsResetting] = useState(false);

  const handleSelectPersonality = (id: SobiPersonalityId) => {
    setSelectedPersonality(id);
    savePersonality(id);
  };

  const handleResetData = async () => {
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO: Deseja realmente zerar todos os dados do aplicativo?\n\n' +
      'Todas as contas bancárias, cartões de crédito, transações, orçamentos e metas serão completamente apagados para você iniciar o teste com seus dados reais.\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    if (!confirmed) return;

    try {
      setIsResetting(true);
      await resetAllData();
      alert('✅ Todas as informações foram zeradas com sucesso! O aplicativo está pronto para seus cartões e contas reais.');
    } catch (err) {
      console.error('Erro ao zerar dados:', err);
      alert('Erro ao zerar dados. Tente novamente.');
    } finally {
      setIsResetting(false);
    }
  };

  const activePersonaConfig = getSobiPersonality(selectedPersonality);

  const creditCards = accounts.filter(a => a.type === 'credit_card');
  const bankAccounts = accounts.filter(a => a.type !== 'credit_card');
  const totalCash = bankAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const totalSubsMonthly = activeSubs.reduce((acc, s) => acc + (s.cadence === 'yearly' ? s.amount / 12 : s.amount), 0);

  const maskValue = (v: string) => isPrivacyMode ? '••••••' : v;

  const sectionGroups: Array<{
    id: string;
    groupTitle: string;
    items: Array<{
      id: string;
      title: string;
      subtitle: string;
      icon: any;
      badge?: string;
      rightElement?: React.ReactNode;
      onClick?: () => void;
    }>;
  }> = [
    {
      id: 'intelligence',
      groupTitle: 'Inteligência & Projeção',
      items: [
        {
          id: 'reports',
          title: 'Relatório de Saúde Financeira',
          subtitle: 'Diagnóstico inteligente e pilares de avaliação',
          icon: Activity,
          badge: undefined,
          onClick: onOpenRelatorios,
        },
        {
          id: 'projection',
          title: 'Projeção de Sobra & Ritmo',
          subtitle: 'Estimativa de sobra no fim do mês e teto diário',
          icon: Flame,
          badge: undefined,
          onClick: onOpenProjection,
        },
      ],
    },
    {
      id: 'management',
      groupTitle: 'Gestão & Contas',
      items: [
        {
          id: 'accounts',
          title: 'Contas Bancárias',
          subtitle: `${bankAccounts.length} ${bankAccounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'} • Saldo: ${maskValue(formatBrlCurrency(totalCash))}`,
          icon: Wallet,
          badge: undefined,
          onClick: () => onNavigateToTab('accounts'),
        },
        {
          id: 'subscriptions',
          title: 'Assinaturas & Recorrências',
          subtitle: `${activeSubs.length} ativa${activeSubs.length !== 1 ? 's' : ''} • ${maskValue(formatBrlCurrency(totalSubsMonthly))}/mês`,
          icon: CalendarClock,
          badge: undefined,
          onClick: () => onNavigateToTab('subscriptions'),
        },
      ],
    },
    {
      id: 'automation',
      groupTitle: 'Automação & IA',
      items: [
        {
          id: 'notifications',
          title: 'Detector de Notificações',
          subtitle: 'Captura automática de comprovantes bancários',
          icon: BellRing,
          badge: pendingNotifications.length > 0 ? `${pendingNotifications.length} pendente${pendingNotifications.length !== 1 ? 's' : ''}` : undefined,
          onClick: () => onNavigateToTab('notifications'),
        },
        {
          id: 'sobra_ai',
          title: 'Sobra AI com Gemini',
          subtitle: 'Consultoria financeira e insights do Sobi',
          icon: Sparkles,
          badge: 'PRO',
          onClick: onOpenAiChat,
        },
      ],
    },
    {
      id: 'preferences',
      groupTitle: 'Preferências & Sistema',
      items: [
        {
          id: 'theme',
          title: 'Aparência & Tema',
          subtitle: mode === 'dark' ? 'Modo Escuro (Obsidian) ativo' : 'Modo Claro ativo',
          icon: mode === 'dark' ? Moon : Sun,
          badge: undefined,
          rightElement: (
            <div
              style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: mode === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                color: mode === 'dark' ? '#38BDF8' : '#F59E0B',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: `1px solid ${mode === 'dark' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
              }}
            >
              {mode === 'dark' ? 'Escuro' : 'Claro'}
            </div>
          ),
          onClick: toggleTheme,
        },
        {
          id: 'csv',
          title: 'Importar Extrato Bancário',
          subtitle: 'Importar movimentações via planilha CSV',
          icon: UploadCloud,
          badge: undefined,
          rightElement: undefined,
          onClick: onOpenCsvImport,
        },
      ],
    },
    {
      id: 'data_management',
      groupTitle: 'Dados & Reset',
      items: [
        {
          id: 'reset_data',
          title: isResetting ? 'Zerando informações...' : 'Zerar Dados do Aplicativo',
          subtitle: 'Limpar todos os cartões, contas e lançamentos para começar do zero',
          icon: RotateCcw,
          badge: undefined,
          onClick: isResetting ? undefined : handleResetData,
        },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '30px' }}>
      {/* Header da tela Mais */}
      <div style={{ padding: '6px 2px 2px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
          Mais Recursos
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '2px 0 0 0' }}>
          Gerenciamento completo e configurações do seu Sobra
        </p>
      </div>

      {/* Grupos Temáticos de Recursos */}
      {sectionGroups.map(group => (
        <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#8E8E93',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 4px',
            }}
          >
            {group.groupTitle}
          </div>

          <div className="card-sobra" style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column' }}>
            {group.items.map((sec, idx) => {
              const Icon = sec.icon;
              const isLast = idx === group.items.length - 1;
              return (
                <div
                  key={sec.id}
                  onClick={sec.onClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 12px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.03)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '11px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        color: '#CBD5E1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{sec.title}</span>
                        {sec.badge && (
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '9999px',
                              backgroundColor: sec.badge === 'PRO' ? 'rgba(192, 132, 252, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                              color: sec.badge === 'PRO' ? '#C084FC' : '#4ADE80',
                              border: sec.badge === 'PRO' ? '1px solid rgba(192, 132, 252, 0.3)' : '1px solid rgba(74, 222, 128, 0.3)',
                            }}
                          >
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sec.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                    {sec.rightElement ? (
                      sec.rightElement
                    ) : (
                      <ChevronRight size={16} color="#64748B" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Seção: Personalidade do Sobi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#8E8E93',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0 4px',
          }}
        >
          Assistente & Personalidade
        </div>

        <div className="card-sobra" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cabeçalho enxuto */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <SobiAvatar expression={activePersonaConfig.suggestedExpression} size={38} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Tom de Voz do Sobi
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                  Estilo de conversa e respostas do assistente
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenAiChat}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                transition: 'color 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
            >
              <span>Testar chat</span>
              <span style={{ fontSize: '0.8rem' }}>↗</span>
            </button>
          </div>

          {/* Grade 2x2 compacta de opções (Sem emojis, foco em clareza) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}
          >
            {(Object.keys(SOBI_PERSONALITIES) as SobiPersonalityId[]).map((key) => {
              const persona = SOBI_PERSONALITIES[key];
              const isSelected = selectedPersonality === key;

              const labels: Record<SobiPersonalityId, { name: string; desc: string }> = {
                amigo: { name: 'Parceiro', desc: 'Descontraído e empático' },
                formal: { name: 'Consultor', desc: 'Analítico e formal' },
                direto: { name: 'Direto ao Ponto', desc: 'Curto e objetivo' },
                coach: { name: 'Motivador', desc: 'Foco em disciplina' },
              };

              const itemInfo = labels[key] || { name: persona.title, desc: persona.subtitle };

              return (
                <div
                  key={persona.id}
                  onClick={() => handleSelectPersonality(persona.id)}
                  style={{
                    padding: '11px 12px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#FFFFFF' : '#CBD5E1' }}>
                      {itemInfo.name}
                    </span>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: isSelected ? '4px solid #4ADE80' : '1.5px solid rgba(255, 255, 255, 0.2)',
                        backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>
                    {itemInfo.desc}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Exemplo de Resposta Dinâmico & Compacto */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exemplo de tom:
            </div>
            <div style={{ fontSize: '0.76rem', color: '#E2E8F0', fontStyle: 'italic', lineHeight: 1.35 }}>
              "{activePersonaConfig.sampleQuote}"
            </div>
          </div>
        </div>
      </div>

      {/* Brand Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px', gap: '8px' }}>
        <SobraLogo variant="vertical" size={44} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748B' }}>
          <ShieldCheck size={14} color="#4ADE80" />
          <span>Seus dados ficam 100% seguros no seu dispositivo</span>
        </div>
      </div>
    </div>
  );
};
