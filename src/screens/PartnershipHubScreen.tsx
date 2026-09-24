import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SharedBadge } from '../components/common/SharedBadge';
import { UserAvatar } from '../components/common/UserAvatar';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
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
      if (s.isShared) return true;
      if (s.accountId) {
        const acc = accounts.find(a => a.id === s.accountId);
        return Boolean(acc?.isShared);
      }
      return false;
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
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
              borderRadius: '20px',
              padding: '22px 18px',
              backgroundColor: '#12161F',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(74, 222, 128, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ADE80',
                marginBottom: '14px',
              }}
            >
              <HeartHandshake size={28} />
            </div>

            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px', letterSpacing: '-0.01em' }}>
              Menos contas de cabeça, mais tempo para vocês
            </div>

            <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.55, margin: '0 0 20px', maxWidth: '340px' }}>
              Faturas da casa, assinaturas e divisão 50/50 automática. Cada um sabe exatamente o que pagar no fim do mês, sem cobranças chatas ou planilhas confusas.
            </p>

            <button
              type="button"
              onClick={activatePartnership}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#22C55E',
                border: 'none',
                color: '#0A150D',
                fontSize: '0.92rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.92';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>Ativar Finanças a Dois</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          </div>

          {/* Pilares Reais da Vida a Dois (Sem jargões burocráticos) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: '#12161F',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxSizing: 'border-box',
              }}
            >
              <Scale size={20} color="#4ADE80" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>Acerto automático no fim do mês</div>
                <div style={{ fontSize: '0.76rem', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.45 }}>
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
                backgroundColor: '#12161F',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxSizing: 'border-box',
              }}
            >
              <CreditCard size={20} color="#38BDF8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>Faturas e contas fixas reunidas</div>
                <div style={{ fontSize: '0.76rem', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.45 }}>
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
                backgroundColor: '#12161F',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxSizing: 'border-box',
              }}
            >
              <Target size={20} color="#A855F7" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>Sonhos e viagens planejadas a dois</div>
                <div style={{ fontSize: '0.76rem', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.45 }}>
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
              backgroundColor: '#0F131A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              Já recebeu um convite?
            </div>
            <div style={{ fontSize: '0.76rem', color: '#9CA3AF', marginBottom: '12px' }}>
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
                  padding: '11px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  letterSpacing: '0.04em',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isJoining || !joinCodeInput.trim()}
                style={{
                  padding: '11px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#38BDF8',
                  border: 'none',
                  color: '#0A150D',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: isJoining || !joinCodeInput.trim() ? 0.5 : 1,
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
          paddingBottom: 'calc(130px + var(--safe-area-bottom, 0px))',
          minWidth: 0,
          overflowX: 'hidden',
        }}
      >
        {/* 1. Header Superior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              type="button"
              onClick={onBack}
              title="Voltar"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  Finanças a Dois
                </span>
                <SharedBadge label="Ativo" size="sm" />
              </div>
              <div style={{ fontSize: '0.76rem', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isPartnerConnected ? `Conectado com ${partnerName}` : 'Espaço compartilhado pronto'}
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
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9CA3AF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Settings2 size={18} />
          </button>
        </div>

        {/* 2. Card de Parceria / Convite (Compacto, sem truncamento e responsivo) */}
        <div
          style={{
            width: '100%',
            borderRadius: '20px',
            padding: '16px',
            backgroundColor: '#12161F',
            border: '1px solid rgba(74, 222, 128, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxSizing: 'border-box',
          }}
        >
          {/* Linha Superior: Avatares + Nomes / Status (Largura total sem cortes) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {/* Avatar do Usuário */}
              <UserAvatar
                src={userAvatarUrl}
                name={user?.displayName || 'Você'}
                size={38}
                border="2px solid #12161F"
                backgroundColor={userAvatarUrl ? '#12161F' : '#22C55E'}
                textColor="#0A150D"
                style={{ zIndex: 2 }}
              />

              {/* Avatar do Parceiro(a) */}
              <UserAvatar
                src={partnerAvatarUrl}
                name={partnerName}
                size={38}
                border="2px solid #12161F"
                backgroundColor={partnerAvatarUrl ? '#12161F' : (isPartnerConnected ? '#38BDF8' : 'rgba(255, 255, 255, 0.12)')}
                textColor={isPartnerConnected ? '#0A150D' : '#9CA3AF'}
                style={{ marginLeft: '-8px', zIndex: 1 }}
              />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {isPartnerConnected
                  ? `${user?.displayName || 'Você'} & ${partnerName}`
                  : 'Aguardando parceiro(a)'}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#94A3B8',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isPartnerConnected ? (
                  <>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ADE80', flexShrink: 0 }} />
                    <span>Sincronização em tempo real ativa</span>
                  </>
                ) : (
                  <>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FACC15', flexShrink: 0 }} />
                    <span>Compartilhe o código para conectar</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Se ainda não conectou, exibe bloco limpo e espaçoso para copiar/compartilhar */}
          {!isPartnerConnected ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '14px',
                padding: '12px 14px',
                boxSizing: 'border-box',
              }}
            >
              {/* Linha do Código com destaque e zero quebra */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Código de convite
                </span>
                <span
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: '#4ADE80',
                    letterSpacing: '0.06em',
                    fontFamily: "'Outfit', 'Inter', monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {partnershipSpace?.code}
                </span>
              </div>

              {/* Botões de Ação ocupando 50% cada, com ótimo toque no mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: copiedCode ? 'rgba(74, 222, 128, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: copiedCode ? '#4ADE80' : '#FFFFFF',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: '#4ADE80',
                    fontSize: '0.76rem',
                    fontWeight: 600,
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Código do espaço: <strong style={{ color: '#94A3B8' }}>{partnershipSpace?.code}</strong>
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4ADE80',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copiedCode ? <Check size={11} /> : <Copy size={11} />}
                {copiedCode ? 'Copiado' : 'Copiar código'}
              </button>
            </div>
          )}
        </div>

        {/* 3. Hero Conversacional: Acerto de Contas do Mês (Estilo Pierre) */}
        <div
          style={{
            width: '100%',
            borderRadius: '20px',
            padding: '18px 16px',
            backgroundColor: '#12161F',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxSizing: 'border-box',
          }}
        >
          {/* Título da Dobra */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={16} color="#4ADE80" />
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
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
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#4ADE80',
                backgroundColor: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid rgba(74, 222, 128, 0.22)',
                padding: '3px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
              title="Personalizar divisão de despesas"
            >
              <span>Divisão {settlementData.userSplitPercent}/{settlementData.partnerSplitPercent}</span>
              <SlidersHorizontal size={11} />
            </button>
          </div>

          {/* Destaque Conversacional Principal */}
          <div>
            {settlementData.total === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={18} color="#4ADE80" strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Tudo equilibrado
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                    Nenhum gasto compartilhado a acertar neste mês.
                  </div>
                </div>
              </div>
            ) : Math.abs(settlementData.diff) < 0.01 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(74, 222, 128, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={18} color="#4ADE80" strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#4ADE80' }}>
                    Contas em dia
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                    Vocês gastaram {formatBrlCurrency(settlementData.total)} juntos e as cotas estão 100% quitadas.
                  </div>
                </div>
              </div>
            ) : settlementData.diff > 0 ? (
              <div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                  {partnerName} transfere para você:
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ADE80', letterSpacing: '-0.02em', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatBrlCurrency(settlementData.diff)}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                  Você adiantou mais despesas conjuntas neste mês.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>
                  Você transfere para {partnerName}:
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FB7185', letterSpacing: '-0.02em', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatBrlCurrency(Math.abs(settlementData.diff))}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px' }}>
                  {partnerName} adiantou mais despesas da casa neste mês.
                </div>
              </div>
            )}
          </div>

          {/* Sub-cards apenas se houver gastos registrados */}
          {settlementData.total > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ padding: '9px 12px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Total Compartilhado</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatBrlCurrency(settlementData.total)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#4ADE80', marginTop: '1px' }}>
                  Sua cota: {formatBrlCurrency(settlementData.userExpectedShare)} ({settlementData.userSplitPercent}%)
                </div>
              </div>

              <div style={{ padding: '9px 12px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>Pago por Você</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatBrlCurrency(settlementData.paidByUser)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '1px' }}>
                  {partnerName}: {formatBrlCurrency(settlementData.paidByPartner)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Seletor de Abas Mobile (Limpo, sem contadores zerados) */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '4px',
            minWidth: 0,
            WebkitOverflowScrolling: 'touch',
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
                  padding: '7px 12px',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  color: isSelected ? '#4ADE80' : '#9CA3AF',
                  fontSize: '0.76rem',
                  fontWeight: 600,
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
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '999px',
                      backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#4ADE80' : '#E2E8F0',
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
              borderRadius: '20px',
              backgroundColor: '#12161F',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                }}
              >
                <Users size={22} color="#4ADE80" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                Comece a vida financeira a dois
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '4px auto 0', maxWidth: '320px', lineHeight: 1.45 }}>
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
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <CreditCard size={18} color="#38BDF8" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>Cartão Conjunto</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Dividir fatura</span>
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
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <Target size={18} color="#A855F7" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>Meta a Dois</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Sonhos do casal</span>
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
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <PieChart size={18} color="#22C55E" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>Teto da Casa</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Limite do mês</span>
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
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  <Repeat size={18} color="#F59E0B" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>Assinatura</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Serviços divididos</span>
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
                <CreditCard size={15} color="#38BDF8" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
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
                    fontWeight: 600,
                    color: '#4ADE80',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Novo
                </button>
              )}
            </div>

            {sharedCards.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#12161F',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 10px' }}>
                  Nenhum cartão compartilhado no momento.
                </p>
                {onOpenNewCard && (
                  <button
                    type="button"
                    onClick={onOpenNewCard}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38BDF8',
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
                    padding: '14px',
                    borderRadius: '14px',
                    backgroundColor: '#12161F',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: card.color || '#820AD1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        flexShrink: 0,
                      }}
                    >
                      <CreditCard size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {card.name}
                        </span>
                        <SharedBadge size="sm" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '1px' }}>
                        Vence dia {card.dueDay || 8}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {formatBrlCurrency(Math.abs(card.balance || 0))}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#4ADE80' }}>
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
                <Target size={15} color="#A855F7" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
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
                    fontWeight: 600,
                    color: '#4ADE80',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Nova
                </button>
              )}
            </div>

            {sharedGoals.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#12161F',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 10px' }}>
                  Nenhuma meta compartilhada configurada.
                </p>
                {onOpenNewGoal && (
                  <button
                    type="button"
                    onClick={onOpenNewGoal}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      color: '#C084FC',
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
                      borderRadius: '14px',
                      backgroundColor: '#12161F',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {goal.name}
                        </span>
                        <SharedBadge size="sm" />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#A855F7', flexShrink: 0 }}>
                        {pct}%
                      </span>
                    </div>

                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: goal.color || '#A855F7', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#9CA3AF' }}>
                      <span>Guardado: <strong style={{ color: '#E2E8F0' }}>{formatBrlCurrency(goal.currentAmount)}</strong></span>
                      <span>Alvo: {formatBrlCurrency(goal.targetAmount)}</span>
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
                <PieChart size={15} color="#22C55E" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
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
                    fontWeight: 600,
                    color: '#4ADE80',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Novo
                </button>
              )}
            </div>

            {sharedBudgets.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#12161F',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 10px' }}>
                  Nenhum teto de gastos conjunto definido.
                </p>
                {onOpenNewBudget && (
                  <button
                    type="button"
                    onClick={onOpenNewBudget}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#4ADE80',
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
                      padding: '14px',
                      borderRadius: '14px',
                      backgroundColor: '#12161F',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {category?.name || 'Categoria'}
                        </span>
                        <SharedBadge size="sm" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '1px' }}>
                        Teto mensal compartilhado
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
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
                <Repeat size={15} color="#F59E0B" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
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
                    fontWeight: 600,
                    color: '#4ADE80',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Nova
                </button>
              )}
            </div>

            {sharedSubscriptions.length === 0 ? (
              <div
                style={{
                  padding: '20px 16px',
                  borderRadius: '14px',
                  backgroundColor: '#12161F',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 10px' }}>
                  Nenhuma assinatura compartilhada configurada.
                </p>
                {onOpenNewSubscription && (
                  <button
                    type="button"
                    onClick={onOpenNewSubscription}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#FBBF24',
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
                      padding: '14px',
                      borderRadius: '14px',
                      backgroundColor: '#12161F',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sub.name}
                        </span>
                        <SharedBadge size="sm" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Vence dia {sub.nextBillingDate?.substring(8, 10)} {acc ? `• ${acc.name}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                        {formatBrlCurrency(sub.amount)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                        {sub.cadence === 'yearly' ? 'Anual' : 'Mensal'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 5. SEÇÃO DE ACERTO DE CONTAS (ABAS DEDICADAS) */}
        {activeTab === 'settlement' && (
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: '#12161F',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
              Como funciona o Acerto 50/50?
            </div>
            <p style={{ fontSize: '0.78rem', color: '#9CA3AF', lineHeight: 1.5, margin: 0 }}>
              Todas as transações feitas em cartões conjuntos e despesas marcadas com o selo <strong>👥 Conjunto</strong> são somadas no mês. Cada parceiro é responsável por 50%. A diferença entre quem pagou e a metade justa gera o valor de transferência de equilíbrio.
            </p>
            <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.04)', fontSize: '0.75rem', color: '#CBD5E1' }}>
              Transações conjuntas computadas neste mês: <strong>{settlementData.txCount}</strong>
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
                borderRadius: '24px',
                backgroundColor: '#12161F',
                border: '1px solid rgba(255, 255, 255, 0.1)',
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
                  <Settings2 size={18} color="#4ADE80" />
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
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
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    color: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Seção 1: Divisão Padrão de Despesas */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Divisão Padrão de Despesas
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px', lineHeight: 1.4 }}>
                    Essa proporção é o padrão para calcular o acerto do mês e novas despesas da vida a dois.
                  </div>
                </div>

                {/* Cards Visuais da Proporção */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {/* Você */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(74, 222, 128, 0.08)',
                      border: '1px solid rgba(74, 222, 128, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>
                      {user?.displayName || 'Você'}
                    </span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ADE80', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                      {tempUserSplit}%
                    </span>
                    <span style={{ fontSize: '0.66rem', color: '#4ADE80' }}>
                      Paga {tempUserSplit}%
                    </span>
                  </div>

                  {/* Parceiro */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>
                      {partnerName}
                    </span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38BDF8', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                      {100 - tempUserSplit}%
                    </span>
                    <span style={{ fontSize: '0.66rem', color: '#38BDF8' }}>
                      Paga {100 - tempUserSplit}%
                    </span>
                  </div>
                </div>

                {/* Slider Interativo de Ajuste Fino */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={tempUserSplit}
                    onChange={e => setTempUserSplit(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: '#4ADE80',
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748B' }}>
                    <span>Você 10%</span>
                    <span>50/50</span>
                    <span>Você 90%</span>
                  </div>
                </div>

                {/* Presets Rápidos de 1 toque */}
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
                          padding: '7px 4px',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected ? '1px solid rgba(74, 222, 128, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#4ADE80' : '#94A3B8',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Botão Salvar Proporção */}
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
                    padding: '11px',
                    borderRadius: '12px',
                    backgroundColor: splitSavedToast ? '#22C55E' : '#4ADE80',
                    border: 'none',
                    color: '#0A150D',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {splitSavedToast ? <Check size={16} /> : null}
                  <span>{splitSavedToast ? 'Divisão Atualizada!' : 'Salvar Divisão Padrão'}</span>
                </button>
              </div>

              {/* Seção 2: Gerenciamento do Espaço */}
              <div
                style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
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
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#F87171',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Desativar Espaço a Dois
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SwipeBackView>
  );
};
