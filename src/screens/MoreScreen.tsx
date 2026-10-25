import React, { useState } from 'react';
import { 
  CreditCard,
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
  SlidersHorizontal,
  PiggyBank,
  Bot,
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
import { UserAvatar } from '../components/common/UserAvatar';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { JoinSharedAccountModal } from '../components/modals/JoinSharedAccountModal';
import { EditProfileModal } from '../components/modals/EditProfileModal';
import { CloudBackupModal } from '../components/modals/CloudBackupModal';
import { PayFirstConfigModal } from '../components/modals/PayFirstConfigModal';
import { ResetDataModal } from '../components/modals/ResetDataModal';
import { getPayFirstConfig, PayFirstConfig } from '../core/payFirst/payFirstHelper';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { getActiveInstallmentGroups } from '../core/installments/installmentHelper';

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
    transactions,
    accounts,
  } = useFinance();
  const { mode, toggleTheme } = useTheme();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const [selectedPersonality, setSelectedPersonality] = useState<SobiPersonalityId>(() => loadSavedPersonality());
  const [isResetting, setIsResetting] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isPayFirstModalOpen, setIsPayFirstModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
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
    try {
      setIsResetting(true);
      await resetAllData();
      setIsResetModalOpen(false);
    } catch (err) {
      console.error('Erro ao zerar dados:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const activePersonaConfig = getSobiPersonality(selectedPersonality);

  const isOwner = !partnershipSpace?.ownerId || partnershipSpace.ownerId === user?.id;
  const partnerName = isOwner ? (partnershipSpace?.partnerName || 'Parceiro(a)') : (partnershipSpace?.ownerName || 'Parceiro(a)');
  const isPartnerConnected = Boolean(
    isOwner ? partnershipSpace?.partnerName : (partnershipSpace?.ownerName && partnershipSpace.ownerName !== 'Parceiro(a)')
  );

  const activeInstallmentGroups = React.useMemo(() => {
    return getActiveInstallmentGroups(transactions, undefined, true, accounts);
  }, [transactions, accounts]);

  const activeInstallmentsCount = activeInstallmentGroups.length;
  const totalRemainingInstallments = React.useMemo(() => {
    return activeInstallmentGroups.reduce((acc, g) => acc + g.remainingAmount, 0);
  }, [activeInstallmentGroups]);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

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
          id: 'installments',
          title: 'Compras Parceladas',
          subtitle: activeInstallmentsCount > 0
            ? `${maskValue(formatBrlCurrency(totalRemainingInstallments))} a quitar`
            : 'Acompanhe planos, parcelas e prazos',
          icon: CreditCard,
          badge: undefined,
          onClick: () => onNavigateToTab('installments'),
        },
        {
          id: 'partnership_hub',
          title: 'Finanças a Dois',
          subtitle: isPartnershipActive 
            ? (isPartnerConnected ? `Conectado com ${partnerName}` : `Espaço Ativo • Código ${partnershipSpace?.code || ''}`)
            : 'Cartões e orçamentos compartilhados',
          icon: Users,
          badge: undefined,
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
          subtitle: 'Ajuste limites diários e metas de controle',
          icon: SlidersHorizontal,
          badge: undefined,
          onClick: () => onNavigateToTab('daily_goal'),
        },
        {
          id: 'pay_first',
          title: 'Pague-se Primeiro',
          subtitle: payFirstConfig.enabled 
            ? `Meta de ${formatBrlCurrency(payFirstConfig.monthlyAmount)}/mês ativa`
            : 'Defina uma meta para sua reserva antes de gastar',
          icon: PiggyBank,
          badge: undefined,
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
          icon: Bot,
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
                padding: '3px 9px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#CBD5E1',
                fontSize: '0.72rem',
                fontWeight: 500,
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
          subtitle: 'Importe transações em formato CSV ou OFX',
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
          subtitle: 'Salve ou sincronize em outro aparelho',
          icon: Cloud,
          badge: undefined,
          onClick: () => setIsBackupModalOpen(true),
        },
        {
          id: 'reset_data',
          title: isResetting ? 'Zerando informações...' : 'Zerar Dados do Aplicativo',
          subtitle: 'Apagar registros e recomeçar do zero',
          icon: RotateCcw,
          badge: undefined,
          onClick: isResetting ? undefined : () => setIsResetModalOpen(true),
        },
      ],
    },
  ];

  return (
    <>
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 96px)' }}>
      {/* Header da tela Mais */}
      <div style={{ padding: '4px 2px 0' }}>
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#F8FAFC',
            margin: 0,
            letterSpacing: '-0.025em',
            lineHeight: 1.25,
          }}
        >
          Mais Recursos
        </h2>
        <p
          style={{
            fontSize: '0.8125rem',
            color: '#94A3B8',
            margin: '4px 0 0 0',
            lineHeight: 1.4,
          }}
        >
          Gerenciamento da sua conta, automações e preferências
        </p>
      </div>

      {/* Card de Conta Sobra / Sincronização e Nuvem */}
      {isAuthenticated ? (
        <div
          style={{
            background: 'linear-gradient(180deg, #141916 0%, #0F1311 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div
            onClick={() => setIsEditProfileOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, cursor: 'pointer', flex: 1 }}
            title="Editar perfil"
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <UserAvatar
                src={user?.avatarUrl}
                name={user?.displayName}
                size={44}
                border="1.5px solid rgba(74, 222, 128, 0.4)"
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  border: '1.5px solid #0F1311',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0A0F0D',
                }}
              >
                <Camera size={9} strokeWidth={2.5} />
              </div>
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#F8FAFC',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {user?.displayName || 'Minha Conta'}
                </span>
                <Pencil size={12} color="#64748B" style={{ flexShrink: 0 }} />
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94A3B8',
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
                    backgroundColor: '#22C55E',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>Sincronizado na Nuvem</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Desconectar conta"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              color: '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 500,
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
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#94A3B8';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
            }}
          >
            <LogOut size={13} strokeWidth={2} />
            <span>Sair</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(180deg, #141916 0%, #0F1311 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            onClick={() => setIsEditProfileOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}
            title="Personalizar perfil"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <UserAvatar
                  src={user?.avatarUrl}
                  name={user?.displayName}
                  size={44}
                  border="1.5px solid rgba(255, 255, 255, 0.15)"
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-1px',
                    right: '-1px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#475569',
                    border: '1.5px solid #0F1311',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <Camera size={9} strokeWidth={2.5} />
                </div>
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: '#F8FAFC',
                      letterSpacing: '-0.01em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user?.displayName || 'Perfil Local'}
                  </span>
                  <Pencil size={12} color="#64748B" style={{ flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Toque para editar nome e foto
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94A3B8',
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
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: 'none',
              color: '#0F172A',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.94';
              e.currentTarget.style.transform = 'translateY(-0.5px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
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
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0 4px',
            }}
          >
            {group.groupTitle}
          </div>

          <div
            style={{
              background: 'linear-gradient(180deg, #131815 0%, #0F1311 100%)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
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
                    padding: '13px 16px',
                    cursor: 'pointer',
                    borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        color: '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={20} strokeWidth={1.6} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#F8FAFC',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minWidth: 0,
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sec.title}
                        </span>
                        {sec.badge && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor:
                                sec.badge === 'PRO'
                                  ? 'rgba(192, 132, 252, 0.10)'
                                  : 'rgba(255, 255, 255, 0.06)',
                              color: sec.badge === 'PRO' ? '#C084FC' : '#94A3B8',
                              border:
                                sec.badge === 'PRO'
                                  ? '1px solid rgba(192, 132, 252, 0.20)'
                                  : '1px solid rgba(255, 255, 255, 0.08)',
                              flexShrink: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#94A3B8',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sec.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
                    {sec.rightElement ? (
                      sec.rightElement
                    ) : (
                      <ChevronRight size={15} color="#475569" strokeWidth={2} />
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
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '0 4px',
          }}
        >
          Assistente & Personalidade
        </div>

        <div
          style={{
            background: 'linear-gradient(180deg, #131815 0%, #0F1311 100%)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Cabeçalho enxuto */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div style={{ flexShrink: 0 }}>
                <SobiAvatar expression={activePersonaConfig.suggestedExpression} size={34} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Tom do Sobi IA
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedPersonality === 'amigo' ? 'Leve e empático' : selectedPersonality === 'formal' ? 'Analítico e formal' : selectedPersonality === 'direto' ? 'Curto e objetivo' : 'Foco em disciplina'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenAiChat}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                color: '#CBD5E1',
                fontSize: '0.72rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 9px',
                borderRadius: '8px',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.color = '#CBD5E1';
              }}
            >
              <span>Testar</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>↗</span>
            </button>
          </div>

          {/* Segmented Control iOS Style */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '3px',
              gap: '2px',
            }}
          >
            {[
              { id: 'amigo', label: 'Parceiro' },
              { id: 'formal', label: 'Consultor' },
              { id: 'direto', label: 'Direto' },
              { id: 'coach', label: 'Motivador' },
            ].map(tab => {
              const isSelected = selectedPersonality === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectPersonality(tab.id as SobiPersonalityId)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '7px 4px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    backgroundColor: isSelected ? '#1B241E' : 'transparent',
                    color: isSelected ? '#4ADE80' : '#94A3B8',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.color = '#F8FAFC';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.color = '#94A3B8';
                    }
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Balão de Fala do Sobi (estilo conversa natural Pierre) */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#4ADE80',
                marginTop: '6px',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#CBD5E1',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                "{activePersonaConfig.sampleQuote}"
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px', gap: '8px' }}>
        <SobraLogo variant="vertical" size={40} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748B' }}>
          <ShieldCheck size={14} color="#4ADE80" strokeWidth={2} />
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

    <ResetDataModal
      isOpen={isResetModalOpen}
      onClose={() => !isResetting && setIsResetModalOpen(false)}
      onConfirm={handleResetData}
      isResetting={isResetting}
    />
    </>
  );
};
