import React, { useState } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  Sun, 
  Moon, 
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Users,
  Cloud,
  CloudOff, 
  LogOut, 
  Tag, 
  Target,
  Camera,
  Pencil
} from 'lucide-react';
import { SobraLogo } from '../components/common/SobraLogo';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

import { 
  SobiPersonalityId, 
  SOBI_PERSONALITIES, 
  getSobiPersonality, 
  loadSavedPersonality, 
  savePersonality 
} from '../core/ai/sobiPersonality';
import { SobiAvatar } from '../components/common/SobiAvatar';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { JoinSharedAccountModal } from '../components/modals/JoinSharedAccountModal';
import { EditProfileModal } from '../components/modals/EditProfileModal';
import { CloudBackupModal } from '../components/modals/CloudBackupModal';
import { PayFirstConfigModal } from '../components/modals/PayFirstConfigModal';
import { getPayFirstConfig, PayFirstConfig } from '../core/payFirst/payFirstHelper';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';

interface MoreScreenProps {
  onBack?: () => void;
  onNavigateToTab: (tab: string) => void;
  onOpenCsvImport: () => void;
  onOpenWidgetOrganizer?: () => void;
  onOpenAiChat: () => void;
  onOpenRelatorios?: () => void;
  onOpenProjection?: () => void;
  onOpenPermissionsSetup?: () => void;
  onOpenPartnershipHub?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  onBack,
  onNavigateToTab,
  onOpenCsvImport,
  onOpenWidgetOrganizer,
  onOpenAiChat,
  onOpenRelatorios,
  onOpenProjection,
  onOpenPermissionsSetup,
  onOpenPartnershipHub,
}) => {
  const { 
    subscriptions, 
    categories, 
    isPrivacyMode, 
    resetAllData,
    isPartnershipActive,
    partnershipSpace,
  } = useFinance();
  const { mode, toggleTheme } = useTheme();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const [selectedPersonality, setSelectedPersonality] = useState<SobiPersonalityId>(() => loadSavedPersonality());
  const [isResetting, setIsResetting] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isPayFirstModalOpen, setIsPayFirstModalOpen] = useState(false);
  const [payFirstConfig, setPayFirstConfig] = useState<PayFirstConfig>(() => getPayFirstConfig());

  React.useEffect(() => {
    const handlePayFirstChanged = () => setPayFirstConfig(getPayFirstConfig());
    window.addEventListener('sobra:pay_first_changed', handlePayFirstChanged);
    return () => window.removeEventListener('sobra:pay_first_changed', handlePayFirstChanged);
  }, []);

  const userInitials = (user?.displayName || 'U')
    .trim()
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || 'U';

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
      id: 'management',
      groupTitle: 'Gestão & Contas',
      items: [
        {
          id: 'partnership_hub',
          title: 'Finanças a Dois',
          subtitle: isPartnershipActive 
            ? (partnershipSpace?.partnerName ? `Conectado com ${partnershipSpace.partnerName}` : `Espaço Ativo • Código ${partnershipSpace?.code || ''}`)
            : 'Cartões, metas, orçamentos e assinaturas a dois',
          icon: Users,
          badge: isPartnershipActive ? 'ATIVO' : undefined,
          onClick: onOpenPartnershipHub || (() => onNavigateToTab('partnership')),
        },
        {
          id: 'categories',
          title: 'Categorias',
          subtitle: `${categories.length} categorias cadastradas`,
          icon: Tag,
          badge: undefined,
          onClick: () => onNavigateToTab('categories'),
        },
        {
          id: 'daily_goal',
          title: 'Limite de Gastos',
          subtitle: 'Ajuste seu limite diário ou semanal & metas',
          icon: Target,
          badge: undefined,
          onClick: () => onNavigateToTab('daily_goal'),
        },
        {
          id: 'pay_first',
          title: 'Pague-se Primeiro',
          subtitle: payFirstConfig.enabled 
            ? `Meta de ${formatBrlCurrency(payFirstConfig.monthlyAmount)}/mês ativa`
            : 'Defina uma meta para sua reserva antes de gastar',
          icon: ShieldCheck,
          badge: payFirstConfig.enabled ? 'ATIVO' : undefined,
          onClick: () => setIsPayFirstModalOpen(true),
        },
      ],
    },
    {
      id: 'automation',
      groupTitle: 'Automação & IA',
      items: [
        {
          id: 'permissions_setup',
          title: 'Autorizações & Permissões',
          subtitle: 'Leitura de comprovantes, alertas e segundo plano',
          icon: ShieldCheck,
          badge: undefined,
          onClick: onOpenPermissionsSetup,
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
          subtitle: 'Importe transações do seu extrato bancário',
          icon: UploadCloud,
          badge: undefined,
          rightElement: undefined,
          onClick: onOpenCsvImport,
        },
      ],
    },
    {
      id: 'data_management',
      groupTitle: 'Backup & Dados',
      items: [
        {
          id: 'cloud_backup',
          title: 'Backup em Nuvem',
          subtitle: 'Salve ou restaure suas contas e lançamentos para trocar de aparelho',
          icon: Cloud,
          badge: undefined,
          onClick: () => setIsBackupModalOpen(true),
        },
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
    <>
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
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

      {/* Card de Conta Sobra / Sincronização e Nuvem */}
      {isAuthenticated ? (
        <div
          style={{
            background: 'linear-gradient(150deg, rgba(20, 36, 26, 0.8) 0%, rgba(13, 22, 17, 0.95) 100%)',
            border: '1px solid rgba(74, 222, 128, 0.22)',
            borderRadius: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            onClick={() => setIsEditProfileOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, cursor: 'pointer', flex: 1 }}
            title="Clique para editar nome e foto de perfil"
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #4ADE80',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                    border: '2px solid #4ADE80',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4ADE80',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {userInitials}
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#4ADE80',
                  border: '1.5px solid #111713',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000000',
                }}
              >
                <Camera size={10} strokeWidth={2.5} />
              </div>
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.96rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.displayName || 'Conta Conectada'}
                </span>
                <Pencil size={12} color="#4ADE80" style={{ flexShrink: 0, opacity: 0.85 }} />
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#4ADE80',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#4ADE80',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>Sincronizado na Nuvem • Toque para editar</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Desconectar conta"
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
              e.currentTarget.style.color = '#F87171';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#94A3B8';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <LogOut size={13} />
            <span>Sair</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(150deg, rgba(24, 27, 25, 0.85) 0%, rgba(15, 17, 16, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            onClick={() => setIsEditProfileOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}
            title="Clique para personalizar seu nome e foto"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(74, 222, 128, 0.4)',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    {userInitials}
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#4ADE80',
                    border: '1.5px solid #111713',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000000',
                  }}
                >
                  <Camera size={10} strokeWidth={2.5} />
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    {user?.displayName || 'Personalizar Nome & Foto'}
                  </span>
                  <Pencil size={12} color="#94A3B8" />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px', lineHeight: 1.35 }}>
                  Toque para editar nome e foto do perfil
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#A1A1AA',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              Offline
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              openAuthModal({
                title: 'Conectar Conta Sobra',
                subtitle: 'Conecte sua conta para fazer backup na nuvem e sincronizar cartões em tempo real.',
                hideGuestOption: true,
              })
            }
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: 'none',
              color: '#0F172A',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Conectar conta Google</span>
          </button>
        </div>
      )}

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
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sec.title}</span>
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
                              flexShrink: 0,
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
                amigo: { name: 'Parceiro', desc: 'Leve e empático' },
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
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: '#8E8E93',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
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
    </SwipeBackView>

    <JoinSharedAccountModal
      isOpen={isJoinModalOpen}
      onClose={() => setIsJoinModalOpen(false)}
    />

    <EditProfileModal
      isOpen={isEditProfileOpen}
      onClose={() => setIsEditProfileOpen(false)}
    />

    <CloudBackupModal
      isOpen={isBackupModalOpen}
      onClose={() => setIsBackupModalOpen(false)}
    />

    <PayFirstConfigModal
      isOpen={isPayFirstModalOpen}
      onClose={() => setIsPayFirstModalOpen(false)}
    />
    </>
  );
};
