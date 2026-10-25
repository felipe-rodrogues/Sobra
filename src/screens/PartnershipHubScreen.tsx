import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SharedBadge } from '../components/common/SharedBadge';
import { UserAvatar } from '../components/common/UserAvatar';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { BankLogo } from '../components/common/BankLogo';
import { SubscriptionLogo } from '../components/subscriptions/SubscriptionLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { getSubscriptionBillingDay } from '../core/subscriptions/recurrenceDetector';
import { 
  ArrowLeft, 
  ArrowRight,
  CreditCard, 
  Target, 
  PieChart, 
  Repeat, 
  Copy, 
  Check, 
  Share2, 
  ShieldCheck, 
  Plus, 
  Scale, 
  AlertCircle,
  HeartHandshake,
  Settings2,
  ChevronRight,
  UserCheck,
  Calendar,
  Users,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Account, Goal, Budget, Subscription } from '../core/types';

interface PartnershipHubScreenProps {
  onBack: () => void;
  onOpenCardDetails?: (account: Account) => void;
  onOpenNewCard?: () => void;
  onOpenNewGoal?: () => void;
  onOpenGoalDetails?: (goalId: string) => void;
  onOpenNewBudget?: () => void;
  onOpenNewSubscription?: () => void;
  onOpenSubscriptionDetails?: (subscription: Subscription) => void;
}

export const PartnershipHubScreen: React.FC<PartnershipHubScreenProps> = ({
  onBack,
  onOpenCardDetails,
  onOpenNewCard,
  onOpenNewGoal,
  onOpenGoalDetails,
  onOpenNewBudget,
  onOpenNewSubscription,
  onOpenSubscriptionDetails,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { 
    accounts, 
    goals, 
    budgets, 
    categories, 
    subscriptions, 
    transactions,
    partnershipSpace, 
    isPartnershipActive, 
    activatePartnership, 
    joinPartnershipWithCode,
    updatePartnershipSettings,
    disconnectPartnership 
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'overview' | 'cards' | 'goals' | 'budgets' | 'subscriptions' | 'settlement'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [tempUserSplit, setTempUserSplit] = useState<number>(() => partnershipSpace?.defaultSplitUser ?? 50);
  const [splitSavedToast, setSplitSavedToast] = useState(false);

  // Filtra entidades compartilhadas
  const sharedCards = useMemo(() => accounts.filter(a => a.type === 'credit_card' && a.isShared), [accounts]);
  const sharedGoals = useMemo(() => goals.filter(g => g.isShared), [goals]);
  const sharedBudgets = useMemo(() => budgets.filter(b => b.isShared), [budgets]);
  const sharedSubscriptions = useMemo(() => {
    return subscriptions.filter(s => {
      if (s.accountId) {
        const acc = accounts.find(a => a.id === s.accountId);
        if (acc) return Boolean(acc.isShared);
      }
      return Boolean(s.isShared);
    });
  }, [subscriptions, accounts]);

  // Estatísticas consolidadas
  const totalSharedCardsInvoice = useMemo(() => {
    return sharedCards.reduce((acc, c) => acc + Math.abs(c.balance || 0), 0);
  }, [sharedCards]);

  const totalSharedGoalsAmount = useMemo(() => {
    return sharedGoals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);
  }, [sharedGoals]);

  const totalSharedBudgetsLimit = useMemo(() => {
    return sharedBudgets.reduce((acc, b) => acc + (b.monthlyLimit || 0), 0);
  }, [sharedBudgets]);

  const totalSharedSubscriptionsMonthly = useMemo(() => {
    return sharedSubscriptions.reduce((acc, s) => {
      const monthly = s.cadence === 'yearly' ? s.amount / 12 : s.amount;
      return acc + monthly;
    }, 0);
  }, [sharedSubscriptions]);

  // Cálculo de Acerto de Contas do Mês Atual (Divisão personalizada ou padrão do casal)
  const settlementData = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const sharedTxs = transactions.filter(t => {
      const d = new Date(t.date);
      const isThisMonth = d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
      if (!isThisMonth || t.type !== 'expense') return false;
      if (t.isShared) return true;
      const acc = accounts.find(a => a.id === t.accountId);
      return Boolean(acc?.isShared);
    });

    let paidByUser = 0;
    let paidByPartner = 0;
    let userExpectedShare = 0;
    const currentUserId = user?.id || 'current-user';

    const defaultUserRatio = (partnershipSpace?.defaultSplitUser ?? 50) / 100;

    sharedTxs.forEach(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      // Proporção individual do cartão/conta se definida, ou o padrão do espaço
      const txUserRatio = acc?.splitRatio !== undefined ? acc.splitRatio : defaultUserRatio;
      userExpectedShare += t.amount * txUserRatio;

      const isPaidByCurrentUser = t.createdById
        ? t.createdById === currentUserId
        : (acc?.ownerId === currentUserId);

      if (isPaidByCurrentUser) {
        paidByUser += t.amount;
      } else {
        paidByPartner += t.amount;
      }
    });

    const total = paidByUser + paidByPartner;
    const diff = paidByUser - userExpectedShare;
    const partnerExpectedShare = total - userExpectedShare;
    const userSplitPercent = Math.round(defaultUserRatio * 100);
    const partnerSplitPercent = 100 - userSplitPercent;

    return {
      total,
      paidByUser,
      paidByPartner,
      userExpectedShare,
      partnerExpectedShare,
      diff,
      txCount: sharedTxs.length,
      userSplitPercent,
      partnerSplitPercent,
    };
  }, [transactions, accounts, user, partnershipSpace?.defaultSplitUser]);

  const handleCopyCode = () => {
    if (!partnershipSpace?.code) return;
    navigator.clipboard.writeText(partnershipSpace.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!partnershipSpace?.code) return;
    const text = `Oi! Vamos organizar nossas finanças juntos no app Sobra? Acesse no menu Mais > Finanças a Dois e digite meu código de convite: *${partnershipSpace.code}*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      await joinPartnershipWithCode(joinCodeInput.trim());
      setJoinCodeInput('');
    } catch (err: any) {
      setJoinError('Não foi possível conectar com este código. Verifique e tente novamente.');
    } finally {
      setIsJoining(false);
    }
  };

  const isOwner = !partnershipSpace?.ownerId || partnershipSpace.ownerId === user?.id;

  const partnerName = useMemo(() => {
    if (isOwner) {
      return partnershipSpace?.partnerName || 'Parceiro(a)';
    }
    return partnershipSpace?.ownerName || 'Parceiro(a)';
  }, [isOwner, partnershipSpace]);

  const partnerFirstName = useMemo(() => {
    return (partnerName || '').trim().split(' ')[0] || partnerName;
  }, [partnerName]);

  const userFirstName = useMemo(() => {
    return (user?.displayName || 'Você').trim().split(' ')[0] || 'Você';
  }, [user?.displayName]);

  const isPartnerConnected = useMemo(() => {
    if (!partnershipSpace?.isActive) return false;
    if (isOwner) {
      return Boolean(partnershipSpace?.partnerName);
    }
    return Boolean(partnershipSpace?.ownerName && partnershipSpace.ownerName !== 'Parceiro(a)');
  }, [isOwner, partnershipSpace]);

  const totalSharedItems = sharedCards.length + sharedGoals.length + sharedBudgets.length + sharedSubscriptions.length;

  // Resolve foto do parceiro(a) e do usuário respeitando quem está logado
  const partnerAvatarUrl = useMemo(() => {
    if (isOwner) {
      if (partnershipSpace?.partnerAvatarUrl) return partnershipSpace.partnerAvatarUrl;
    } else {
      if (partnershipSpace?.ownerAvatarUrl) return partnershipSpace.ownerAvatarUrl;
    }
    for (const card of sharedCards) {
      const other = card.sharedMembers?.find(m => m.userId !== user?.id && m.avatarUrl);
      if (other?.avatarUrl) return other.avatarUrl;
    }
    return isOwner ? partnershipSpace?.partnerAvatarUrl : partnershipSpace?.ownerAvatarUrl;
  }, [isOwner, partnershipSpace, user, sharedCards]);

  const userAvatarUrl = user?.avatarUrl || (isOwner ? partnershipSpace?.ownerAvatarUrl : partnershipSpace?.partnerAvatarUrl);

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO 1: FINANÇAS A DOIS AINDA NÃO ATIVADO (ONBOARDING CALMO & ENXUTO)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isPartnershipActive) {
    return (
      <SwipeBackView onBack={onBack} enabled={!!onBack}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            paddingBottom: '100px',
            minWidth: 0,
          }}
        >
          {/* Header Superior Padronizado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={onBack}
              title="Voltar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={19} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                Finanças a Dois
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                A vida a dois sem o estresse das contas
              </div>
            </div>
          </div>

          {/* Hero Card Pierre */}
          <div
            style={{
              width: '100%',
              borderRadius: '16px',
              padding: '22px 18px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                marginBottom: '14px',
              }}
            >
              <HeartHandshake size={26} color={colors.textSecondary} />
            </div>

            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '8px', letterSpacing: '-0.01em' }}>
              Menos contas de cabeça, mais tempo para vocês
            </div>

            <p style={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.55, margin: '0 0 20px', maxWidth: '340px' }}>
              Faturas da casa, assinaturas e divisão 50/50 automática. Cada um sabe exatamente o que pagar no fim do mês, sem cobranças chatas ou planilhas confusas.
            </p>

            <button
              type="button"
              onClick={activatePartnership}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: '#22C55E',
                border: 'none',
                color: '#0A150D',
                fontSize: '0.9rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.92';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <span>Ativar Finanças a Dois</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          </div>

          {/* Pilares Reais da Vida a Dois (Sem jargões burocráticos) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
                boxSizing: 'border-box',
              }}
            >
              <Scale size={18} color={colors.textSecondary} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>Acerto automático no fim do mês</div>
                <div style={{ fontSize: '0.76rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.45 }}>
                  O app calcula quem adiantou despesas e mostra em uma frase quem deve transferir a diferença. Sem DR e sem estresse.
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
                boxSizing: 'border-box',
              }}
            >
              <CreditCard size={18} color={colors.textSecondary} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>Faturas e contas fixas reunidas</div>
                <div style={{ fontSize: '0.76rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.45 }}>
                  Mercado, contas de casa e streamings somados em tempo real para os dois acompanharem sem surpresas.
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
                boxSizing: 'border-box',
              }}
            >
              <Target size={18} color={colors.textSecondary} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>Sonhos e viagens planejadas a dois</div>
                <div style={{ fontSize: '0.76rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.45 }}>
                  Guardem dinheiro juntos para a próxima viagem ou reserva com histórico colaborativo de cada aporte.
                </div>
              </div>
            </div>
          </div>

          {/* Conectar via Código */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '4px' }}>
              Já recebeu um convite?
            </div>
            <div style={{ fontSize: '0.76rem', color: colors.textSecondary, marginBottom: '12px' }}>
              Digite o código recebido para sincronizar as finanças do casal.
            </div>

            <form onSubmit={handleJoinWithCode} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Ex: SOBRA-4921"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  letterSpacing: '0.04em',
                  fontFamily: "'Outfit', 'Inter', monospace",
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isJoining || !joinCodeInput.trim()}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#38BDF8',
                  border: 'none',
                  color: '#0A150D',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: isJoining || !joinCodeInput.trim() ? 0.5 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                {isJoining ? '...' : 'Conectar'}
              </button>
            </form>
            {joinError && (
              <div style={{ color: '#FB7185', fontSize: '0.75rem', marginTop: '8px' }}>
                {joinError}
              </div>
            )}
          </div>
        </div>
      </SwipeBackView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO 2: FINANÇAS A DOIS ATIVO (INTERFACE CONVERSACIONAL CALMA E ENXUTA)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          paddingBottom: 'calc(160px + var(--safe-area-bottom, 0px))',
          minWidth: 0,
          overflowX: 'hidden',
        }}
      >
        {/* 1. Header Superior Unificado (Pierre / Fintech) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <button
              type="button"
              onClick={onBack}
              title="Voltar"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeft size={18} />
            </button>

            {/* Avatares do Casal integrados ao Header */}
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <UserAvatar
                src={userAvatarUrl}
                name={user?.displayName || 'Você'}
                size={34}
                border={`2px solid ${colors.surface}`}
                backgroundColor={userAvatarUrl ? colors.surfaceElevated : '#22C55E'}
                textColor="#0A150D"
                style={{ zIndex: 2 }}
              />
              <UserAvatar
                src={partnerAvatarUrl}
                name={partnerName}
                size={34}
                border={`2px solid ${colors.surface}`}
                backgroundColor={partnerAvatarUrl ? colors.surfaceElevated : (isPartnerConnected ? '#38BDF8' : 'rgba(255, 255, 255, 0.12)')}
                textColor={isPartnerConnected ? '#0A150D' : colors.textMuted}
                style={{ marginLeft: '-8px', zIndex: 1 }}
              />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 600,
                  color: colors.textPrimary,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isPartnerConnected ? `${userFirstName} & ${partnerFirstName}` : 'Finanças a Dois'}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: colors.textSecondary,
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isPartnerConnected ? 'Finanças a Dois' : 'Aguardando conexão'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTempUserSplit(partnershipSpace?.defaultSplitUser ?? 50);
              setShowOptionsMenu(true);
            }}
            title="Opções do Finanças a Dois"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>

        {/* 2. Se ainda NÃO conectou, exibe card para convidar parceiro(a) */}
        {!isPartnerConnected && (
          <div
            style={{
              width: '100%',
              borderRadius: '16px',
              padding: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
                  Convide seu parceiro(a)
                </div>
                <div style={{ fontSize: '0.74rem', color: colors.textSecondary, marginTop: '2px' }}>
                  Compartilhe o código para conectar as finanças
                </div>
              </div>
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#22C55E',
                  letterSpacing: '0.06em',
                  fontFamily: 'monospace',
                }}
              >
                {partnershipSpace?.code}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', paddingTop: '8px', borderTop: `1px solid ${colors.border}` }}>
              <button
                type="button"
                onClick={handleCopyCode}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: copiedCode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${colors.border}`,
                  color: copiedCode ? '#4ADE80' : colors.textPrimary,
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCode ? 'Copiado!' : 'Copiar código'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  color: '#4ADE80',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Share2 size={13} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Hero Conversacional: Acerto de Contas do Mês (Estilo Pierre - Sem sub-cards aninhados) */}
        <div
          style={{
            width: '100%',
            borderRadius: '16px',
            padding: '18px 16px',
            backgroundColor: colors.surfaceElevated,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Título da Dobra */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={15} color={colors.textSecondary} />
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                Acerto do Mês
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTempUserSplit(settlementData.userSplitPercent);
                setShowOptionsMenu(true);
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 500,
                color: colors.textSecondary,
                background: 'none',
                border: 'none',
                padding: '2px 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = colors.textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = colors.textSecondary)}
              title="Personalizar divisão de despesas"
            >
              <span>Divisão {settlementData.userSplitPercent}/{settlementData.partnerSplitPercent}</span>
              <SlidersHorizontal size={12} color={colors.textSecondary} />
            </button>
          </div>

          {/* Destaque Conversacional Principal */}
          <div>
            {settlementData.total === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={18} color="#22C55E" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 600, color: colors.textPrimary }}>
                    Tudo equilibrado
                  </div>
                  <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '2px' }}>
                    Nenhum gasto compartilhado a acertar neste mês.
                  </div>
                </div>
              </div>
            ) : Math.abs(settlementData.diff) < 0.01 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={18} color="#22C55E" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 600, color: '#22C55E' }}>
                    Contas em dia
                  </div>
                  <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '2px' }}>
                    Vocês gastaram {formatBrlCurrency(settlementData.total)} juntos e as cotas estão 100% quitadas.
                  </div>
                </div>
              </div>
            ) : settlementData.diff > 0 ? (
              <div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
                  {partnerName} transfere para você:
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#22C55E',
                    letterSpacing: '-0.03em',
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.1,
                  }}
                >
                  {formatBrlCurrency(settlementData.diff)}
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textMuted, marginTop: '5px' }}>
                  Você adiantou mais despesas conjuntas neste mês.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
                  Você transfere para {partnerName}:
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#FB7185',
                    letterSpacing: '-0.03em',
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.1,
                  }}
                >
                  {formatBrlCurrency(Math.abs(settlementData.diff))}
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textMuted, marginTop: '5px' }}>
                  {partnerName} adiantou mais despesas da casa neste mês.
                </div>
              </div>
            )}
          </div>

          {/* Breakdown Tipográfico + Barra Visual de Proporção (SEM CARDS ANINHADOS) */}
          {settlementData.total > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: `1px solid ${colors.border}` }}>
              {/* Barra de Proporção Visual */}
              <div style={{ height: '4px', width: '100%', borderRadius: '2px', backgroundColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', display: 'flex' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, (settlementData.paidByUser / settlementData.total) * 100))}%`,
                    backgroundColor: '#22C55E',
                    transition: 'width 0.3s ease',
                  }}
                />
                <div
                  style={{
                    height: '100%',
                    flex: 1,
                    backgroundColor: '#38BDF8',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* 2 Colunas Limpas Sem Quebra de Linha */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                {/* Coluna 1: O que você pagou */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: colors.textSecondary, fontWeight: 500 }}>
                    Pago por você
                  </div>
                  <div
                    style={{
                      fontSize: '1.02rem',
                      fontWeight: 600,
                      color: colors.textPrimary,
                      marginTop: '2px',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatBrlCurrency(settlementData.paidByUser)}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: colors.textSecondary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Total do mês
                    </div>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: colors.textPrimary,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        marginTop: '1px',
                      }}
                    >
                      {formatBrlCurrency(settlementData.total)}
                    </div>
                  </div>
                </div>

                {/* Coluna 2: O que a parceira pagou */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: colors.textSecondary,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={`Pago por ${partnerName}`}
                  >
                    Pago por {partnerFirstName}
                  </div>
                  <div
                    style={{
                      fontSize: '1.02rem',
                      fontWeight: 600,
                      color: colors.textPrimary,
                      marginTop: '2px',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatBrlCurrency(settlementData.paidByPartner)}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: colors.textSecondary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Sua cota ({settlementData.userSplitPercent}%)
                    </div>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: colors.textPrimary,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        marginTop: '1px',
                      }}
                    >
                      {formatBrlCurrency(settlementData.userExpectedShare)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Seletor de Abas Mobile (Pills Enxutas) */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
            minWidth: 0,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'overview', label: 'Resumo', count: 0 },
            { id: 'cards', label: 'Cartões', count: sharedCards.length },
            { id: 'goals', label: 'Metas', count: sharedGoals.length },
            { id: 'budgets', label: 'Orçamentos', count: sharedBudgets.length },
            { id: 'subscriptions', label: 'Assinaturas', count: sharedSubscriptions.length },
            { id: 'settlement', label: 'Acerto', count: 0 },
          ].map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.16)' : colors.border}`,
                  color: isSelected ? '#FFFFFF' : colors.textSecondary,
                  fontSize: '0.76rem',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: '999px',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                      color: isSelected ? '#FFFFFF' : colors.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CONTEÚDO DAS SEÇÕES: EXIBIÇÃO ENXUTA E ZERO POLUIÇÃO
           ═══════════════════════════════════════════════════════════════════ */}

        {/* CASO ESPECIAL: RESUMO COM 0 ITENS COMPARTILHADOS (ONBOARDING ATIVO) */}
        {activeTab === 'overview' && totalSharedItems === 0 && (
          <div
            style={{
              padding: '24px 18px',
              borderRadius: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                }}
              >
                <Users size={20} color={colors.textSecondary} />
              </div>
              <div style={{ fontSize: '0.96rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                Comece a vida financeira a dois
              </div>
              <p style={{ fontSize: '0.78rem', color: colors.textSecondary, margin: '4px auto 0', maxWidth: '320px', lineHeight: 1.45 }}>
                Adicione itens para acompanhar despesas divididas, metas em comum e limites da casa em tempo real.
              </p>
            </div>

            {/* Grid 2x2 elegante de atalhos iniciais de criação */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {onOpenNewCard && (
                <button
                  type="button"
                  onClick={onOpenNewCard}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <CreditCard size={18} color={colors.textSecondary} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>Cartão Conjunto</span>
                  <span style={{ fontSize: '0.68rem', color: colors.textSecondary }}>Dividir fatura</span>
                </button>
              )}
              {onOpenNewGoal && (
                <button
                  type="button"
                  onClick={onOpenNewGoal}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <Target size={18} color={colors.textSecondary} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>Meta a Dois</span>
                  <span style={{ fontSize: '0.68rem', color: colors.textSecondary }}>Sonhos do casal</span>
                </button>
              )}
              {onOpenNewBudget && (
                <button
                  type="button"
                  onClick={onOpenNewBudget}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <PieChart size={18} color={colors.textSecondary} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>Teto da Casa</span>
                  <span style={{ fontSize: '0.68rem', color: colors.textSecondary }}>Limite do mês</span>
                </button>
              )}
              {onOpenNewSubscription && (
                <button
                  type="button"
                  onClick={onOpenNewSubscription}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <Repeat size={18} color={colors.textSecondary} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>Assinatura</span>
                  <span style={{ fontSize: '0.68rem', color: colors.textSecondary }}>Serviços divididos</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. SEÇÃO DE CARTÕES */}
        {(activeTab === 'cards' || (activeTab === 'overview' && sharedCards.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={15} color={colors.textSecondary} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                  Cartões Compartilhados
                </span>
              </div>
              {onOpenNewCard && (
                <button
                  type="button"
                  onClick={onOpenNewCard}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    color: colors.textSecondary,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = colors.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = colors.textSecondary)}
                >
                  <Plus size={13} /> Novo
                </button>
              )}
            </div>

            {sharedCards.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '16px',
                  backgroundColor: colors.surfaceElevated,
                  border: `1px dashed ${colors.border}`,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: colors.textSecondary, margin: '0 0 10px' }}>
                  Nenhum cartão compartilhado no momento.
                </p>
                {onOpenNewCard && (
                  <button
                    type="button"
                    onClick={onOpenNewCard}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${colors.border}`,
                      color: colors.textPrimary,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Adicionar Cartão
                  </button>
                )}
              </div>
            ) : (
              sharedCards.map(card => (
                <div
                  key={card.id}
                  onClick={() => onOpenCardDetails?.(card)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '16px',
                    backgroundColor: colors.surfaceElevated,
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <BankLogo bankId={card.bankId || card.name} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: colors.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {card.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '1px' }}>
                        Vence dia {card.dueDay || 8}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: '0.94rem',
                        fontWeight: 600,
                        color: colors.textPrimary,
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatBrlCurrency(Math.abs(card.balance || 0))}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: colors.textSecondary,
                        marginTop: '1px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      50%: {formatBrlCurrency(Math.abs(card.balance || 0) * 0.5)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. SEÇÃO DE METAS */}
        {(activeTab === 'goals' || (activeTab === 'overview' && sharedGoals.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={15} color={colors.textSecondary} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                  Metas do Casal
                </span>
              </div>
              {onOpenNewGoal && (
                <button
                  type="button"
                  onClick={onOpenNewGoal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    color: colors.textSecondary,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = colors.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = colors.textSecondary)}
                >
                  <Plus size={13} /> Nova
                </button>
              )}
            </div>

            {sharedGoals.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '16px',
                  backgroundColor: colors.surfaceElevated,
                  border: `1px dashed ${colors.border}`,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: colors.textSecondary, margin: '0 0 10px' }}>
                  Nenhuma meta compartilhada configurada.
                </p>
                {onOpenNewGoal && (
                  <button
                    type="button"
                    onClick={onOpenNewGoal}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${colors.border}`,
                      color: colors.textPrimary,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Criar Meta do Casal
                  </button>
                )}
              </div>
            ) : (
              sharedGoals.map(goal => {
                const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                return (
                  <div
                    key={goal.id}
                    onClick={() => onOpenGoalDetails?.(goal.id)}
                    style={{
                      padding: '14px',
                      borderRadius: '16px',
                      backgroundColor: colors.surfaceElevated,
                      border: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {goal.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#A855F7', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {pct}%
                      </span>
                    </div>

                    <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: goal.color || '#A855F7', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: colors.textSecondary }}>
                      <span>Guardado: <strong style={{ color: colors.textPrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatBrlCurrency(goal.currentAmount)}</strong></span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>Alvo: {formatBrlCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 3. SEÇÃO DE ORÇAMENTOS */}
        {(activeTab === 'budgets' || (activeTab === 'overview' && sharedBudgets.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PieChart size={15} color={colors.textSecondary} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                  Orçamentos da Casa
                </span>
              </div>
              {onOpenNewBudget && (
                <button
                  type="button"
                  onClick={onOpenNewBudget}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    color: colors.textSecondary,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = colors.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = colors.textSecondary)}
                >
                  <Plus size={13} /> Novo
                </button>
              )}
            </div>

            {sharedBudgets.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '16px',
                  backgroundColor: colors.surfaceElevated,
                  border: `1px dashed ${colors.border}`,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: colors.textSecondary, margin: '0 0 10px' }}>
                  Nenhum teto de gastos conjunto definido.
                </p>
                {onOpenNewBudget && (
                  <button
                    type="button"
                    onClick={onOpenNewBudget}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${colors.border}`,
                      color: colors.textPrimary,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Definir Teto
                  </button>
                )}
              </div>
            ) : (
              sharedBudgets.map(b => {
                const category = categories.find(c => c.id === b.categoryId);
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '16px',
                      backgroundColor: colors.surfaceElevated,
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: colors.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {category?.name || 'Categoria'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '1px' }}>
                        Teto mensal compartilhado
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: 600,
                          color: colors.textPrimary,
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatBrlCurrency(b.monthlyLimit)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. SEÇÃO DE ASSINATURAS */}
        {(activeTab === 'subscriptions' || (activeTab === 'overview' && sharedSubscriptions.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Repeat size={15} color={colors.textSecondary} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                  Assinaturas da Casa
                </span>
              </div>
              {onOpenNewSubscription && (
                <button
                  type="button"
                  onClick={onOpenNewSubscription}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    color: colors.textSecondary,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = colors.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = colors.textSecondary)}
                >
                  <Plus size={13} /> Nova
                </button>
              )}
            </div>

            {sharedSubscriptions.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '16px',
                  backgroundColor: colors.surfaceElevated,
                  border: `1px dashed ${colors.border}`,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: colors.textSecondary, margin: '0 0 10px' }}>
                  Nenhuma assinatura compartilhada configurada.
                </p>
                {onOpenNewSubscription && (
                  <button
                    type="button"
                    onClick={onOpenNewSubscription}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${colors.border}`,
                      color: colors.textPrimary,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Adicionar Assinatura
                  </button>
                )}
              </div>
            ) : (
              sharedSubscriptions.map(sub => {
                const acc = accounts.find(a => a.id === sub.accountId);
                return (
                  <div
                    key={sub.id}
                    onClick={() => onOpenSubscriptionDetails?.(sub)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '16px',
                      backgroundColor: colors.surfaceElevated,
                      border: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <SubscriptionLogo name={sub.name} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            color: colors.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sub.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: colors.textSecondary,
                            marginTop: '1px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Vence dia {getSubscriptionBillingDay(sub)} {acc ? `• ${acc.name}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: 600,
                          color: colors.textPrimary,
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatBrlCurrency(sub.amount)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: colors.textSecondary, marginTop: '1px' }}>
                        {sub.cadence === 'yearly' ? 'Anual' : 'Mensal'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 5. SEÇÃO DE ACERTO DE CONTAS (ABA DEDICADA) */}
        {activeTab === 'settlement' && (
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
              Como funciona o Acerto 50/50?
            </div>
            <p style={{ fontSize: '0.78rem', color: colors.textSecondary, lineHeight: 1.5, margin: 0 }}>
              Todas as transações feitas em cartões conjuntos e despesas marcadas como compartilhadas são somadas no mês. Cada parceiro é responsável pela sua cota combinada. A diferença entre o total adiantado e a divisão justa gera o valor de transferência de equilíbrio.
            </p>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${colors.border}`,
                fontSize: '0.75rem',
                color: colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Transações compartilhadas no mês</span>
              <strong style={{ color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{settlementData.txCount}</strong>
            </div>
          </div>
        )}

        {/* MODAL DE OPÇÕES DO FINANÇAS A DOIS (DIVISÃO GERAL E GERENCIAMENTO) */}
        {showOptionsMenu && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(8px)',
              zIndex: 3000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              boxSizing: 'border-box',
            }}
            onClick={() => setShowOptionsMenu(false)}
          >
            <div
              className="animate-slide-up"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '430px',
                borderRadius: '20px',
                backgroundColor: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
                padding: '20px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              {/* Header do Modal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings2 size={18} color={colors.textSecondary} />
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
                    Opções da Parceria
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Seção 1: Divisão Padrão de Despesas (Design Pierre - Calmo, Sem Neon) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
                    Divisão Padrão de Despesas
                  </div>
                  <div style={{ fontSize: '0.74rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.45 }}>
                    Essa proporção é o padrão para calcular o acerto do mês e novas despesas da vida a dois.
                  </div>
                </div>

                {/* Cards Visuais da Proporção (Monocromáticos e Elegantes) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {/* Você */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: colors.textSecondary,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {userFirstName}
                    </span>
                    <span
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 600,
                        color: colors.textPrimary,
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.15,
                        margin: '2px 0',
                      }}
                    >
                      {tempUserSplit}%
                    </span>
                    <span style={{ fontSize: '0.68rem', color: colors.textMuted }}>
                      Paga {tempUserSplit}%
                    </span>
                  </div>

                  {/* Parceiro */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: colors.textSecondary,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                      title={partnerName}
                    >
                      {partnerFirstName}
                    </span>
                    <span
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 600,
                        color: colors.textPrimary,
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.15,
                        margin: '2px 0',
                      }}
                    >
                      {100 - tempUserSplit}%
                    </span>
                    <span style={{ fontSize: '0.68rem', color: colors.textMuted }}>
                      Paga {100 - tempUserSplit}%
                    </span>
                  </div>
                </div>

                {/* Slider Interativo de Ajuste Fino (Linha Única) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '2px' }}>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={tempUserSplit}
                    onChange={e => setTempUserSplit(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: '#22C55E',
                      cursor: 'pointer',
                      margin: '4px 0',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: colors.textMuted }}>
                    <span>Você 10%</span>
                    <span>50/50</span>
                    <span>Você 90%</span>
                  </div>
                </div>

                {/* Presets Rápidos de 1 toque (Pills Neutras) */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { u: 50, label: '50 / 50' },
                    { u: 60, label: '60 / 40' },
                    { u: 70, label: '70 / 30' },
                    { u: 40, label: '40 / 60' },
                  ].map(preset => {
                    const isSelected = tempUserSplit === preset.u;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setTempUserSplit(preset.u)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid rgba(255, 255, 255, 0.24)' : `1px solid ${colors.border}`,
                          color: isSelected ? '#FFFFFF' : colors.textSecondary,
                          fontSize: '0.74rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Botão Salvar Proporção (Sólido, Calmo e Decisivo) */}
                <button
                  type="button"
                  onClick={() => {
                    updatePartnershipSettings({
                      defaultSplitUser: tempUserSplit,
                      defaultSplitPartner: 100 - tempUserSplit,
                    });
                    setSplitSavedToast(true);
                    setTimeout(() => setSplitSavedToast(false), 2000);
                  }}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: splitSavedToast ? '#22C55E' : '#FFFFFF',
                    border: 'none',
                    color: splitSavedToast ? '#FFFFFF' : '#0A150D',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '2px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!splitSavedToast) e.currentTarget.style.opacity = '0.92';
                  }}
                  onMouseLeave={e => {
                    if (!splitSavedToast) e.currentTarget.style.opacity = '1';
                  }}
                >
                  {splitSavedToast ? <Check size={16} /> : null}
                  <span>{splitSavedToast ? 'Divisão Atualizada!' : 'Salvar Divisão Padrão'}</span>
                </button>
              </div>

              {/* Seção 2: Gerenciamento do Espaço */}
              <div
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Código do Espaço */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', color: colors.textSecondary }}>Código do Espaço</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: colors.textPrimary, fontFamily: 'monospace', letterSpacing: '0.04em', marginTop: '1px' }}>
                      {partnershipSpace?.code}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={{
                      padding: '7px 11px',
                      borderRadius: '8px',
                      backgroundColor: copiedCode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${copiedCode ? 'rgba(34, 197, 94, 0.25)' : colors.border}`,
                      color: copiedCode ? '#22C55E' : colors.textPrimary,
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Desativar Espaço a Dois (Link Discreto, Sem Alarme Vermelho) */}
                <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Deseja desativar o espaço Finanças a Dois? Suas contas e dados individuais permanecerão intactos.')) {
                        disconnectPartnership();
                        setShowOptionsMenu(false);
                        onBack();
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.textMuted,
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FB7185')}
                    onMouseLeave={e => (e.currentTarget.style.color = colors.textMuted)}
                  >
                    Desativar Espaço a Dois
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SwipeBackView>
  );
};
