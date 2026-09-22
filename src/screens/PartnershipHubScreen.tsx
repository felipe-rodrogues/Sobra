import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SharedBadge } from '../components/common/SharedBadge';
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
  Users
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
    disconnectPartnership 
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'overview' | 'cards' | 'goals' | 'budgets' | 'subscriptions' | 'settlement'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

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

  // Cálculo de Acerto de Contas do Mês Atual (Divisão 50/50 em despesas conjuntas)
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
    const currentUserId = user?.id || 'current-user';

    sharedTxs.forEach(t => {
      if (t.createdById && t.createdById !== currentUserId) {
        paidByPartner += t.amount;
      } else {
        paidByUser += t.amount;
      }
    });

    const total = paidByUser + paidByPartner;
    const fairShare = total / 2;
    // Se o usuário pagou mais que a sua cota de 50%, o parceiro deve pagar a diferença
    const diff = paidByUser - fairShare;

    return {
      total,
      paidByUser,
      paidByPartner,
      diff,
      txCount: sharedTxs.length,
    };
  }, [transactions, accounts, user]);

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

  const partnerName = partnershipSpace?.partnerName || 'Parceiro(a)';
  const totalSharedItems = sharedCards.length + sharedGoals.length + sharedBudgets.length + sharedSubscriptions.length;

  // Resolve foto do parceiro(a) e do usuário
  const partnerAvatarUrl = useMemo(() => {
    if (partnershipSpace?.ownerId === user?.id) {
      if (partnershipSpace?.partnerAvatarUrl) return partnershipSpace.partnerAvatarUrl;
    } else {
      if (partnershipSpace?.ownerAvatarUrl) return partnershipSpace.ownerAvatarUrl;
    }
    for (const card of sharedCards) {
      const other = card.sharedMembers?.find(m => m.userId !== user?.id && m.avatarUrl);
      if (other?.avatarUrl) return other.avatarUrl;
    }
    return partnershipSpace?.partnerAvatarUrl;
  }, [partnershipSpace, user, sharedCards]);

  const userAvatarUrl = user?.avatarUrl || (partnershipSpace?.ownerId === user?.id ? partnershipSpace?.ownerAvatarUrl : undefined);

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
          paddingBottom: '120px',
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
                {partnershipSpace?.partnerName ? `Conectado com ${partnershipSpace.partnerName}` : 'Espaço compartilhado pronto'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDisconnectConfirm(true)}
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

        {/* 2. Card de Parceria / Convite (Compacto e Responsivo) */}
        <div
          style={{
            width: '100%',
            borderRadius: '18px',
            padding: '16px',
            backgroundColor: '#12161F',
            border: '1px solid rgba(74, 222, 128, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {/* Avatar do Usuário */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: userAvatarUrl ? '#12161F' : '#22C55E',
                    color: '#0A150D',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #12161F',
                    zIndex: 2,
                    overflow: 'hidden',
                  }}
                >
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt={user?.displayName || 'Você'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (user?.displayName || 'V')[0].toUpperCase()
                  )}
                </div>

                {/* Avatar do Parceiro(a) */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: partnerAvatarUrl 
                      ? '#12161F' 
                      : (partnershipSpace?.partnerName ? '#38BDF8' : 'rgba(255, 255, 255, 0.12)'),
                    color: partnershipSpace?.partnerName ? '#0A150D' : '#9CA3AF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #12161F',
                    marginLeft: '-10px',
                    zIndex: 1,
                    overflow: 'hidden',
                  }}
                >
                  {partnerAvatarUrl ? (
                    <img
                      src={partnerAvatarUrl}
                      alt={partnershipSpace?.partnerName || 'Parceiro(a)'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : partnershipSpace?.partnerName ? (
                    partnershipSpace.partnerName[0].toUpperCase()
                  ) : (
                    '?'
                  )}
                </div>
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {partnershipSpace?.partnerName
                    ? `${user?.displayName || 'Você'} & ${partnershipSpace.partnerName}`
                    : 'Aguardando parceiro'}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#9CA3AF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {partnershipSpace?.partnerName
                    ? 'Sincronização em tempo real'
                    : 'Convide para sincronizar'}
                </div>
              </div>
            </div>

            {/* Código do Espaço */}
            <div
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4ADE80', letterSpacing: '0.04em' }}>
                {partnershipSpace?.code}
              </span>
            </div>
          </div>

          {/* Botões de Ação do Código */}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: copiedCode ? 'rgba(74, 222, 128, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: copiedCode ? '#4ADE80' : '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              {copiedCode ? <Check size={13} /> : <Copy size={13} />}
              <span style={{ whiteSpace: 'nowrap' }}>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                color: '#4ADE80',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <Share2 size={13} />
              <span style={{ whiteSpace: 'nowrap' }}>WhatsApp</span>
            </button>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Scale size={16} color="#4ADE80" />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Acerto do Mês Atual
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>
              Divisão 50/50
            </span>
          </div>

          {/* Destaque Conversacional Principal */}
          <div>
            {settlementData.total === 0 ? (
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FFFFFF' }}>
                  R$ 0,00
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>
                  Nenhum gasto compartilhado registrado neste mês ainda.
                </div>
              </div>
            ) : Math.abs(settlementData.diff) < 0.01 ? (
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ADE80' }}>
                  Tudo em dia 🎉
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>
                  Vocês gastaram {formatBrlCurrency(settlementData.total)} juntos e as contas estão 100% equilibradas.
                </div>
              </div>
            ) : settlementData.diff > 0 ? (
              <div>
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '2px' }}>
                  {partnerName} transfere para você:
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#4ADE80', letterSpacing: '-0.02em' }}>
                  {formatBrlCurrency(settlementData.diff)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>
                  Você adiantou mais gastos compartilhados neste mês.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '2px' }}>
                  Você transfere para {partnerName}:
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#FB7185', letterSpacing: '-0.02em' }}>
                  {formatBrlCurrency(Math.abs(settlementData.diff))}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>
                  {partnerName} adiantou mais despesas da casa neste mês.
                </div>
              </div>
            )}
          </div>

          {/* Detalhe Enxuto de Gastos (Cobre sem scroll) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ padding: '8px 10px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
              <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>Total Compartilhado</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', marginTop: '1px' }}>
                {formatBrlCurrency(settlementData.total)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#4ADE80' }}>
                Sua cota: {formatBrlCurrency(settlementData.total / 2)}
              </div>
            </div>

            <div style={{ padding: '8px 10px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
              <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>Pago por Você</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', marginTop: '1px' }}>
                {formatBrlCurrency(settlementData.paidByUser)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>
                {partnerName}: {formatBrlCurrency(settlementData.paidByPartner)}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Barra de Atalhos Rápidos para Criação ("Adicionar à Vida a Dois") */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', minWidth: 0 }}>
          {onOpenNewCard && (
            <button
              type="button"
              onClick={onOpenNewCard}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <CreditCard size={13} color="#38BDF8" /> + Cartão
            </button>
          )}

          {onOpenNewGoal && (
            <button
              type="button"
              onClick={onOpenNewGoal}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Target size={13} color="#A855F7" /> + Meta a Dois
            </button>
          )}

          {onOpenNewBudget && (
            <button
              type="button"
              onClick={onOpenNewBudget}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <PieChart size={13} color="#22C55E" /> + Teto da Casa
            </button>
          )}

          {onOpenNewSubscription && (
            <button
              type="button"
              onClick={onOpenNewSubscription}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Repeat size={13} color="#F59E0B" /> + Assinatura
            </button>
          )}
        </div>

        {/* 5. Seletor de Abas Mobile */}
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
            { id: 'overview', label: 'Resumo' },
            { id: 'cards', label: `Cartões (${sharedCards.length})` },
            { id: 'goals', label: `Metas (${sharedGoals.length})` },
            { id: 'budgets', label: `Orçamentos (${sharedBudgets.length})` },
            { id: 'subscriptions', label: `Assinaturas (${sharedSubscriptions.length})` },
            { id: 'settlement', label: 'Acerto' },
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
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CONTEÚDO DAS SEÇÕES: EXIBIÇÃO ENXUTA E ZERO POLUIÇÃO
           ═══════════════════════════════════════════════════════════════════ */}

        {/* CASO ESPECIAL: RESUMO COM 0 ITENS COMPARTILHADOS */}
        {activeTab === 'overview' && totalSharedItems === 0 && (
          <div
            style={{
              padding: '24px 18px',
              borderRadius: '18px',
              backgroundColor: '#12161F',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            <Users size={26} color="#4ADE80" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              Nenhum item conjunto adicionado
            </div>
            <p style={{ fontSize: '0.78rem', color: '#9CA3AF', margin: '0 0 16px', lineHeight: 1.4 }}>
              Crie ou compartilhe um cartão, meta, teto ou assinatura usando os atalhos acima ou selecione a opção "Conjunto" ao criar qualquer item no Sobra.
            </p>
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

        {/* Modal de confirmação para desconectar */}
        {showDisconnectConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '380px',
                backgroundColor: '#161D24',
                borderRadius: '20px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FB7185', marginBottom: '12px' }}>
                <AlertCircle size={22} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Opções do Finanças a Dois
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF', lineHeight: 1.5, marginBottom: '18px' }}>
                Deseja desativar o espaço Finanças a Dois? Suas contas e dados pessoais individuais permanecerão 100% intactos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    disconnectPartnership();
                    setShowDisconnectConfirm(false);
                    onBack();
                  }}
                  style={{
                    padding: '11px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#F87171',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  Desativar Espaço a Dois
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(false)}
                  style={{
                    padding: '11px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SwipeBackView>
  );
};
