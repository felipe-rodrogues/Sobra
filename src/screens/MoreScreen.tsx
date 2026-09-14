import React, { useState } from 'react';
import { 
  WalletCards, 
  CalendarClock, 
  BellRing, 
  Sparkles, 
  UploadCloud, 
  Sliders, 
  Sun, 
  Moon, 
  Eye, 
  EyeOff, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  MessageSquare
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
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  onNavigateToTab,
  onOpenCsvImport,
  onOpenWidgetOrganizer,
  onOpenAiChat,
}) => {
  const { accounts, subscriptions, pendingNotifications, isPrivacyMode, togglePrivacyMode } = useFinance();
  const { mode, toggleTheme } = useTheme();

  const [selectedPersonality, setSelectedPersonality] = useState<SobiPersonalityId>(() => loadSavedPersonality());

  const handleSelectPersonality = (id: SobiPersonalityId) => {
    setSelectedPersonality(id);
    savePersonality(id);
  };

  const activePersonaConfig = getSobiPersonality(selectedPersonality);

  const creditCards = accounts.filter(a => a.type === 'credit_card');
  const bankAccounts = accounts.filter(a => a.type !== 'credit_card');
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const totalSubsMonthly = activeSubs.reduce((acc, s) => acc + (s.cadence === 'yearly' ? s.amount / 12 : s.amount), 0);

  const maskValue = (v: string) => isPrivacyMode ? '••••••' : v;

  const sections = [
    {
      id: 'accounts',
      title: 'Contas & Cartões',
      subtitle: `${bankAccounts.length} conta${bankAccounts.length !== 1 ? 's' : ''} • ${creditCards.length} cartão${creditCards.length !== 1 ? 'ões' : ''}`,
      icon: WalletCards,
      iconColor: '#38BDF8',
      bgColor: 'rgba(56, 189, 248, 0.15)',
      badge: undefined,
      onClick: () => onNavigateToTab('accounts'),
    },
    {
      id: 'subscriptions',
      title: 'Assinaturas & Recorrências',
      subtitle: `${activeSubs.length} ativa${activeSubs.length !== 1 ? 's' : ''} • ${maskValue(formatBrlCurrency(totalSubsMonthly))}/mês`,
      icon: CalendarClock,
      iconColor: '#FB923C',
      bgColor: 'rgba(251, 146, 60, 0.15)',
      badge: undefined,
      onClick: () => onNavigateToTab('subscriptions'),
    },
    {
      id: 'notifications',
      title: 'Detector de Notificações',
      subtitle: 'Captura inteligente de comprovantes bancários',
      icon: BellRing,
      iconColor: '#4ADE80',
      bgColor: 'rgba(74, 222, 128, 0.15)',
      badge: pendingNotifications.length > 0 ? `${pendingNotifications.length} pendente${pendingNotifications.length !== 1 ? 's' : ''}` : undefined,
      onClick: () => onNavigateToTab('notifications'),
    },
    {
      id: 'sobra_ai',
      title: 'Sobra AI com Gemini',
      subtitle: 'Diagnóstico financeiro e consultoria inteligente',
      icon: Sparkles,
      iconColor: '#C084FC',
      bgColor: 'rgba(192, 132, 252, 0.15)',
      badge: 'PRO',
      onClick: onOpenAiChat,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
      {/* Header da tela Mais */}
      <div style={{ padding: '6px 2px 2px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
          Mais Recursos
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '2px 0 0 0' }}>
          Gerenciamento completo e configurações do seu Sobra
        </p>
      </div>

      {/* Módulos Principais */}
      <div className="card-sobra" style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
        {sections.map((sec, idx) => {
          const Icon = sec.icon;
          const isLast = idx === sections.length - 1;
          return (
            <div
              key={sec.id}
              onClick={sec.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '16px',
                cursor: 'pointer',
                borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    backgroundColor: sec.bgColor,
                    color: sec.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={19} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {sec.title}
                    {sec.badge && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: sec.badge === 'PRO' ? 'rgba(192, 132, 252, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: sec.badge === 'PRO' ? '#C084FC' : '#4ADE80',
                          border: sec.badge === 'PRO' ? '1px solid rgba(192, 132, 252, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
                        }}
                      >
                        {sec.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                    {sec.subtitle}
                  </div>
                </div>
              </div>

              <ChevronRight size={16} color="#64748B" />
            </div>
          );
        })}
      </div>

      {/* Configurações do App & Preferências */}
      <div className="card-sobra" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Configurações do App
          </h4>
          <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: '2px 0 0' }}>
            Personalize a aparência, privacidade e ferramentas do sistema
          </p>
        </div>

        {/* Linha 1: Alternador de Tema Claro / Escuro em destaque */}
        <div
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '16px',
            backgroundColor: '#1A231C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.35)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: mode === 'dark' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                color: mode === 'dark' ? '#38BDF8' : '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mode === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                Aparência & Tema
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                {mode === 'dark' ? 'Modo Escuro (Obsidian) ativo' : 'Modo Claro ativo'}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: mode === 'dark' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: mode === 'dark' ? '#38BDF8' : '#F59E0B',
              fontSize: '0.76rem',
              fontWeight: 700,
              border: `1px solid ${mode === 'dark' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            }}
          >
            {mode === 'dark' ? 'Mudar para Claro' : 'Mudar para Escuro'}
          </div>
        </div>

        {/* Linha 2: Grade de Ações Rápidas (Privacidade, Importar CSV, Widgets) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {/* Alternar Modo Privacidade */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            style={{
              padding: '12px 10px',
              borderRadius: '14px',
              backgroundColor: '#1A231C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
          >
            {isPrivacyMode ? <EyeOff size={18} color="#FB7185" /> : <Eye size={18} color="#94A3B8" />}
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>
              Privacidade
            </span>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
              {isPrivacyMode ? 'Oculto' : 'Visível'}
            </span>
          </button>

          {/* Importar CSV */}
          <button
            type="button"
            onClick={onOpenCsvImport}
            style={{
              padding: '12px 10px',
              borderRadius: '14px',
              backgroundColor: '#1A231C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
          >
            <UploadCloud size={18} color="#4ADE80" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>
              Extrato CSV
            </span>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
              Importar
            </span>
          </button>

          {/* Organizar Widgets */}
          <button
            type="button"
            onClick={onOpenWidgetOrganizer}
            style={{
              padding: '12px 10px',
              borderRadius: '14px',
              backgroundColor: '#1A231C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
          >
            <Sliders size={18} color="#38BDF8" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>
              Widgets
            </span>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
              Personalizar
            </span>
          </button>
        </div>
      </div>

      {/* Card: Personalidade do Sobi (Assistente IA) */}
      <div className="card-sobra" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Cabeçalho do Card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SobiAvatar expression={activePersonaConfig.suggestedExpression} size={44} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.01em' }}>
                  Personalidade do Sobi (IA)
                </h4>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: `${activePersonaConfig.accentColor}20`,
                    color: activePersonaConfig.accentColor,
                    border: `1px solid ${activePersonaConfig.accentColor}40`,
                  }}
                >
                  {activePersonaConfig.shortName}
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: '2px 0 0' }}>
                Escolha o tom de voz e o estilo de conversa do assistente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAiChat}
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(192, 132, 252, 0.12)',
              border: '1px solid rgba(192, 132, 252, 0.25)',
              color: '#C084FC',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(192, 132, 252, 0.2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(192, 132, 252, 0.12)')}
          >
            <MessageSquare size={14} />
            <span>Testar no Chat</span>
          </button>
        </div>

        {/* Grade de 4 Personalidades Selecionáveis */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '10px',
          }}
        >
          {(Object.keys(SOBI_PERSONALITIES) as SobiPersonalityId[]).map((key) => {
            const persona = SOBI_PERSONALITIES[key];
            const isSelected = selectedPersonality === key;

            return (
              <div
                key={persona.id}
                onClick={() => handleSelectPersonality(persona.id)}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: isSelected ? `${persona.accentColor}10` : '#1A231C',
                  border: isSelected
                    ? `1.5px solid ${persona.accentColor}`
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  boxShadow: isSelected ? `0 4px 16px ${persona.accentColor}18` : 'none',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.backgroundColor = '#1A231C';
                  }
                }}
              >
                {/* Cabeçalho do Card da Opção */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>{persona.emoji}</span>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#FFFFFF' }}>
                        {persona.title}
                      </div>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: persona.accentColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {persona.tag}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isSelected ? `2px solid ${persona.accentColor}` : '2px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: isSelected ? persona.accentColor : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <CheckCircle2 size={14} color="#0D130E" strokeWidth={3} />}
                  </div>
                </div>

                {/* Descrição resumida */}
                <p style={{ margin: 0, fontSize: '0.73rem', color: '#94A3B8', lineHeight: 1.35 }}>
                  {persona.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Demonstração / Balão de Exemplo */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: '#161E18',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: activePersonaConfig.accentColor }}>
            <span>{activePersonaConfig.emoji}</span>
            <span>Exemplo de resposta no estilo {activePersonaConfig.shortName}:</span>
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: '#E2E8F0',
              fontStyle: 'italic',
              lineHeight: 1.4,
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderLeft: `3px solid ${activePersonaConfig.accentColor}`,
            }}
          >
            "{activePersonaConfig.sampleQuote}"
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
            ✓ Salvo automaticamente. O Sobi conversará com você neste estilo nas próximas interações.
          </span>
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
