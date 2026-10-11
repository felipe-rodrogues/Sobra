import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconRenderer } from '../components/common/IconRenderer';
import { useFinance } from '../context/FinanceContext';
import { Goal, GoalContribution } from '../core/types';
import { formatBrlCurrency, parseBrlCurrency, formatCurrencyInput } from '../core/parsers/currencyHelper';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { SharedBadge } from '../components/common/SharedBadge';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../components/common/SwipeBackIndicator';
import { Button } from '../components/common/Button';
import { Switch } from '../components/common/Switch';
import {
  ArrowLeft,
  Settings,
  Zap,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Sparkles,
  Check,
  X,
  Clock,
  TrendingUp,
  Target,
  ChevronDown
} from 'lucide-react';
import { BankLogo } from '../components/common/BankLogo';

interface GoalDetailScreenProps {
  goalId: string;
  onBack: () => void;
  onEditGoalSettings?: (goal: Goal) => void;
}

export const GoalDetailScreen: React.FC<GoalDetailScreenProps> = ({
  goalId,
  onBack,
  onEditGoalSettings,
}) => {
  const {
    goals,
    accounts,
    goalContributions,
    addGoalContribution,
    updateGoalContribution,
    deleteGoalContribution,
    saveGoal,
    isPrivacyMode,
  } = useFinance();

  // Busca a meta atualizada
  const goal = useMemo(() => goals.find(g => g.id === goalId), [goals, goalId]);

  // Contas disponíveis para débito (corrente, dinheiro, carteira; ignora cartão de crédito)
  const validAccounts = useMemo(
    () => accounts.filter(a => a.type !== 'credit_card'),
    [accounts]
  );

  const defaultAccount = useMemo(
    () => validAccounts.find(a => a.id === goal?.defaultAccountId),
    [validAccounts, goal?.defaultAccountId]
  );

  // Modais locais de Aporte
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmountStr, setDepositAmountStr] = useState('');
  const [isDepositAmountFocused, setIsDepositAmountFocused] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const depositInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza a conta de débito ao abrir o modal de aporte
  useEffect(() => {
    if (isDepositModalOpen) {
      setDepositAccountId(goal?.defaultAccountId || validAccounts[0]?.id || '');
      setIsAccountPickerOpen(false);
    }
  }, [isDepositModalOpen, goal?.defaultAccountId, validAccounts]);

  const selectedDepositAccount = useMemo(
    () => validAccounts.find(a => a.id === depositAccountId),
    [validAccounts, depositAccountId]
  );

  const handleCloseDepositModal = () => {
    setIsDepositModalOpen(false);
    setDepositAmountStr('');
    setIsAccountPickerOpen(false);
  };

  const depositSwipeState = useSwipeBack({
    onBack: handleCloseDepositModal,
    enabled: isDepositModalOpen,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDepositModalOpen) {
        handleCloseDepositModal();
      }
    };
    if (isDepositModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      const timer = setTimeout(() => {
        depositInputRef.current?.focus();
      }, 100);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isDepositModalOpen]);

  // Edição inline de Aporte
  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [editContribAmountStr, setEditContribAmountStr] = useState('');

  // Edição rápida do valor de aporte automático
  const [isEditingAutoAmount, setIsEditingAutoAmount] = useState(false);
  const [autoAmountInput, setAutoAmountInput] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  // Aportes da meta ordenados por data decrescente
  const contributions = useMemo(() => {
    if (!goal) return [];
    return goalContributions
      .filter(c => c.goalId === goal.id)
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [goalContributions, goal]);

  if (!goal) {
    return (
      <SwipeBackView onBack={onBack}>
        <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
          <p>Meta não encontrada ou foi removida.</p>
          <Button variant="secondary" onClick={onBack} style={{ marginTop: '16px' }}>
            Voltar
          </Button>
        </div>
      </SwipeBackView>
    );
  }

  // Métricas da meta
  const currentAmount = goal.currentAmount || 0;
  const targetAmount = Math.max(1, goal.targetAmount);
  const remaining = Math.max(0, targetAmount - currentAmount);
  const progressPercent = Math.min(100, Math.round((currentAmount / targetAmount) * 100));

  // Prazo e ritmo
  const hasDeadline = Boolean(goal.targetDate);
  const deadlineInfo = useMemo(() => {
    if (!goal.targetDate) return null;
    const targetDateObj = new Date(goal.targetDate.substring(0, 10) + 'T23:59:59');
    const now = new Date();
    const diffMs = targetDateObj.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const formattedDate = targetDateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const monthlyNeeded = days > 0 ? (remaining / days) * 30.41 : 0;

    return {
      days,
      isPast: days < 0,
      formattedDate,
      monthlyNeeded,
    };
  }, [goal.targetDate, remaining]);

  // Formatação de data amigável para o extrato (hoje, ontem ou dd/mm/aaaa)
  const formatFriendlyDate = (dateStr: string) => {
    const rawDate = dateStr.substring(0, 10);
    if (rawDate === todayStr) return 'Hoje';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);
    if (rawDate === yesterdayStr) return 'Ontem';

    const parts = rawDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
    return dateStr;
  };

  // Toggle do aporte automático
  const handleToggleAutoContribution = async (checked: boolean) => {
    let monthlyAmount = goal.monthlyContributionAmount;
    if (checked && (!monthlyAmount || monthlyAmount <= 0)) {
      monthlyAmount = deadlineInfo && deadlineInfo.monthlyNeeded > 0
        ? Math.round(deadlineInfo.monthlyNeeded * 100) / 100
        : Math.round((targetAmount / 12) * 100) / 100;
    }

    await saveGoal({
      ...goal,
      autoContributionEnabled: checked,
      monthlyContributionAmount: monthlyAmount,
    });
  };

  // Salva alteração de valor do aporte automático
  const handleSaveAutoAmount = async () => {
    const parsed = parseBrlCurrency(autoAmountInput);
    if (parsed !== null && parsed > 0) {
      await saveGoal({
        ...goal,
        monthlyContributionAmount: parsed,
      });
    }
    setIsEditingAutoAmount(false);
  };

  // Submeter novo aporte manual
  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBrlCurrency(depositAmountStr);
    if (!amount || amount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    await addGoalContribution({
      goalId: goal.id,
      amount,
      date: todayStr,
      isAutomatic: false,
      note: 'Aporte manual',
      sourceAccountId: depositAccountId || undefined,
    });

    handleCloseDepositModal();
  };

  // Salvar edição de aporte
  const handleSaveEditContrib = async (c: GoalContribution) => {
    const amount = parseBrlCurrency(editContribAmountStr);
    if (!amount || amount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    await updateGoalContribution(c.id, amount, undefined, c.note || undefined);
    setEditingContribId(null);
  };

  // Excluir aporte com confirmação
  const handleDeleteContrib = async (c: GoalContribution) => {
    const isAuto = c.isAutomatic;
    const msg = isAuto
      ? `Deseja remover este aporte automático de ${formatBrlCurrency(c.amount)}? O saldo da meta será atualizado.`
      : `Deseja remover este aporte de ${formatBrlCurrency(c.amount)}?`;
    if (confirm(msg)) {
      await deleteGoalContribution(c.id);
    }
  };

  const accentColor = goal.color || '#4ADE80';

  return (
    <SwipeBackView onBack={onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '16px 20px 110px',
          maxWidth: '460px',
          margin: '0 auto',
          boxSizing: 'border-box',
          minHeight: '100vh',
          backgroundColor: '#0A0E0C',
        }}
      >
        {/* ── 1. HEADER LIMPO COM VOLTAR E CONFIGURAÇÕES ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            aria-label="Voltar"
          >
            <ArrowLeft size={19} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: goal.color || '#4ADE80',
                flexShrink: 0,
              }}
            >
              <IconRenderer name={goal.icon || 'Target'} size={15} color={goal.color || '#4ADE80'} />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#FFFFFF',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                maxWidth: '200px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {goal.name}
            </h2>
            {goal.isShared && <SharedBadge size="sm" />}
          </div>

          <button
            type="button"
            onClick={() => onEditGoalSettings?.(goal)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.color = '#94A3B8';
            }}
            title="Configurações da meta"
            aria-label="Configurações da meta"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* ── 2. HERO TIPOGRÁFICO PIERRE: VALOR ACUMULADO & PROGRESSO ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Valor Acumulado
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}
              >
                {isPrivacyMode ? '••••••' : formatBrlCurrency(currentAmount)}
              </span>
            </div>
          </div>

          {/* Barra de Progresso Ultrafina e Elegante */}
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
              marginTop: '4px',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: accentColor,
                borderRadius: '999px',
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {/* Linha de Apoio Equilibrada: Faltam X de Alvo à esquerda, % Concluído à direita */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: '#64748B',
              lineHeight: 1.2,
            }}
          >
            <span>
              {remaining > 0 ? (
                <>
                  Faltam <strong style={{ color: '#E2E8F0', fontWeight: 600 }}>{isPrivacyMode ? '••••••' : formatBrlCurrency(remaining)}</strong> de {isPrivacyMode ? '••••••' : formatBrlCurrency(targetAmount)}
                </>
              ) : (
                <strong style={{ color: '#4ADE80', fontWeight: 600 }}>🎉 Meta 100% atingida!</strong>
              )}
            </span>

            <span style={{ color: progressPercent >= 100 ? '#4ADE80' : accentColor, fontWeight: 700 }}>
              {progressPercent}%
            </span>
          </div>

          {deadlineInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', color: '#64748B' }}>
              <Clock size={12} color="#64748B" />
              <span>
                Prazo: até {deadlineInfo.formattedDate} •{' '}
                {deadlineInfo.isPast
                  ? 'Prazo encerrado'
                  : `${deadlineInfo.days} ${deadlineInfo.days === 1 ? 'dia restante' : 'dias restantes'}`}
              </span>
            </div>
          )}
        </div>

        {/* ── 3. CARD DE APORTE AUTOMÁTICO MENSAL (PIERRE: CALMO, SEM CAIXA DUPLA) ── */}
        <div
          style={{
            backgroundColor: '#12161B',
            borderRadius: '20px',
            padding: '16px 18px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 0.2s ease',
                }}
              >
                <Zap size={17} color="#CBD5E1" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Aporte automático
                </span>
                <span style={{ fontSize: '0.74rem', color: '#8E8E93' }}>
                  {goal.autoContributionEnabled
                    ? (defaultAccount ? `Reserva mensal ativa • Debita de ${defaultAccount.name}` : 'Reserva mensal ativa')
                    : 'Economia automática desativada'}
                </span>
              </div>
            </div>

            <Switch
              checked={Boolean(goal.autoContributionEnabled)}
              onChange={handleToggleAutoContribution}
            />
          </div>

          {goal.autoContributionEnabled && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {isEditingAutoAmount ? (
                /* Modo de Edição Limpo e Direto */
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSaveAutoAmount();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Novo valor por mês
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={autoAmountInput}
                      onChange={e => setAutoAmountInput(formatCurrencyInput(e.target.value, autoAmountInput))}
                      placeholder="0,00"
                      autoFocus
                      style={{
                        flex: 1,
                        minWidth: 0,
                        boxSizing: 'border-box',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#111519',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#4ADE80',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingAutoAmount(false)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#94A3B8',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: '#4ADE80',
                        border: 'none',
                        color: '#0A0E0C',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      Salvar
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.3 }}>
                      Aporte mensal para alcançar sua meta
                    </span>
                    {defaultAccount && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.70rem',
                          color: '#94A3B8',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          padding: '1px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        <BankLogo bankId={defaultAccount.bankId} size={13} />
                        <span>Debita de {defaultAccount.name}</span>
                      </span>
                    )}
                  </div>
                </form>
              ) : (
                /* Modo de Visualização com Lápis Sutil e Texto de Apoio Abaixo */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Valor por mês
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1px' }}>
                    <span
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        color: '#4ADE80',
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                      }}
                    >
                      {formatBrlCurrency(goal.monthlyContributionAmount || 0)}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setAutoAmountInput(
                          goal.monthlyContributionAmount
                            ? formatCurrencyInput(goal.monthlyContributionAmount)
                            : ''
                        );
                        setIsEditingAutoAmount(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        transition: 'color 0.15s ease, background-color 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#FFFFFF';
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = '#64748B';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Editar valor mensal"
                    >
                      <Pencil size={13} />
                      <span style={{ fontSize: '0.76rem', fontWeight: 500 }}>Alterar</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.3 }}>
                      Aporte mensal para alcançar sua meta
                    </span>
                    {defaultAccount && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.70rem',
                          color: '#94A3B8',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          padding: '1px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        <BankLogo bankId={defaultAccount.bankId} size={13} />
                        <span>Debita de {defaultAccount.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 4. EXTRATO DE APORTES (FEED DE TRANSAÇÕES BANCÁRIAS LIMPO) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                Histórico de Aportes
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#64748B',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  padding: '2px 7px',
                  borderRadius: '999px',
                }}
              >
                {contributions.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsDepositModalOpen(true)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(74, 222, 128, 0.10)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
                color: '#4ADE80',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.18)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.10)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Novo aporte"
              aria-label="Novo aporte"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>

          {contributions.length === 0 ? (
            <div
              style={{
                backgroundColor: '#12161B',
                borderRadius: '20px',
                padding: '32px 20px',
                textAlign: 'center',
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Wallet size={28} color="#64748B" />
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>
                Nenhum aporte registrado ainda.
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', maxWidth: '260px' }}>
                Guarde uma quantia hoje ou ative o aporte automático para começar.
              </p>
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(true)}
                style={{
                  marginTop: '8px',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(74, 222, 128, 0.12)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  color: '#4ADE80',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Fazer primeiro aporte
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#12161B',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                overflow: 'hidden',
              }}
            >
              {contributions.map((c, index) => {
                const isEditing = editingContribId === c.id;
                const isLast = index === contributions.length - 1;
                const titleText = c.isAutomatic
                  ? 'Aporte automático'
                  : (c.note && c.note !== 'Aporte manual' && c.note !== 'Aporte automático da economia' ? c.note : 'Aporte');

                return (
                  <div
                    key={c.id}
                    style={{
                      padding: '14px 16px',
                      borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {isEditing ? (
                      /* Formulário de Edição Inline Numérico Limpo e Rápido */
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          handleSaveEditContrib(c);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Campo Numérico com R$ Unificado (espaço amplo para nunca cortar dígitos) */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flex: 1,
                            minWidth: 0,
                            backgroundColor: '#111519',
                            border: '1px solid rgba(74, 222, 128, 0.35)',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editContribAmountStr}
                            onChange={e => setEditContribAmountStr(formatCurrencyInput(e.target.value, editContribAmountStr))}
                            placeholder="0,00"
                            autoFocus
                            style={{
                              width: '100%',
                              minWidth: 0,
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#4ADE80',
                              fontSize: '1.02rem',
                              fontWeight: 700,
                              fontFamily: "'Outfit', 'Inter', sans-serif",
                              outline: 'none',
                              padding: 0,
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setEditingContribId(null)}
                            style={{
                              padding: '7px 11px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              color: '#94A3B8',
                              fontSize: '0.76rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            style={{
                              padding: '7px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#4ADE80',
                              border: 'none',
                              color: '#0A0E0C',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'opacity 0.15s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            Salvar
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Linha do Feed Padrão Pierre */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        {/* Coluna Esquerda: Ícone Neutro + Título e Subtítulo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#CBD5E1',
                              flexShrink: 0,
                            }}
                          >
                            {c.isAutomatic ? (
                              <Zap size={16} color="#CBD5E1" />
                            ) : (
                              <Wallet size={16} color="#CBD5E1" />
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: '0.86rem',
                                fontWeight: 600,
                                color: '#FFFFFF',
                                lineHeight: 1.25,
                                wordBreak: 'break-word',
                              }}
                              title={titleText}
                            >
                              {titleText}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                {formatFriendlyDate(c.date)}
                              </span>
                              {(() => {
                                const srcAcc = accounts.find(a => a.id === c.sourceAccountId);
                                if (!srcAcc) return null;
                                return (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.64rem',
                                      fontWeight: 500,
                                      color: '#94A3B8',
                                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                      border: '1px solid rgba(255, 255, 255, 0.07)',
                                      padding: '1px 6px',
                                      borderRadius: '5px',
                                      lineHeight: '1.4',
                                    }}
                                    title={`Debitado de ${srcAcc.name}`}
                                  >
                                    <BankLogo bankId={srcAcc.bankId} size={13} />
                                    <span>{srcAcc.name}</span>
                                  </span>
                                );
                              })()}
                              {c.isAutomatic && !titleText.toLowerCase().includes('automático') && (
                                <span
                                  style={{
                                    fontSize: '0.64rem',
                                    fontWeight: 600,
                                    color: '#94A3B8',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    padding: '0px 5px',
                                    borderRadius: '4px',
                                    lineHeight: '1.4',
                                  }}
                                >
                                  Automático
                                </span>
                              )}
                              {c.contributedByName && (
                                <span
                                  style={{
                                    fontSize: '0.64rem',
                                    fontWeight: 600,
                                    color: '#38BDF8',
                                    backgroundColor: 'rgba(56, 189, 248, 0.10)',
                                    border: '1px solid rgba(56, 189, 248, 0.20)',
                                    padding: '0px 5px',
                                    borderRadius: '4px',
                                    lineHeight: '1.4',
                                  }}
                                >
                                  Por {c.contributedByName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Coluna Direita: Valor no Topo + Ações Compactas Abaixo (NUNCA ESMAGA O TÍTULO) */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '0.98rem',
                              fontWeight: 700,
                              color: '#4ADE80',
                              fontFamily: "'Outfit', 'Inter', sans-serif",
                              whiteSpace: 'nowrap',
                              lineHeight: 1.1,
                            }}
                          >
                            +{formatBrlCurrency(c.amount)}
                          </span>

                          {/* Ações Sutis de Edição e Exclusão alinhadas abaixo do valor */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContribId(c.id);
                                setEditContribAmountStr(formatCurrencyInput(c.amount));
                              }}
                              style={{
                                padding: '2px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#64748B',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#CBD5E1')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
                              title="Editar aporte"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContrib(c)}
                              style={{
                                padding: '2px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#64748B',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
                              title="Excluir aporte"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 5. MODAL PREMIUM PARA FAZER NOVO APORTE (PADRÃO PIERRE / CLOUDWALK) ── */}
        {isDepositModalOpen && typeof document !== 'undefined' && createPortal(
          <>
            <SwipeBackIndicator swipeState={depositSwipeState} />
            <div
              data-modal-backdrop="true"
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
                boxSizing: 'border-box',
              }}
              onClick={handleCloseDepositModal}
            >
              <div
                className="animate-slide-up"
                style={{
                  backgroundColor: '#0A0E0C',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '24px',
                  width: '100%',
                  maxWidth: '380px',
                  maxHeight: 'calc(100dvh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 32px)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                  overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header Superior Limpo */}
                <div
                  style={{
                    padding: '16px 20px 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '11px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: goal.color || '#4ADE80',
                        flexShrink: 0,
                      }}
                    >
                      <IconRenderer name={goal.icon || 'Target'} size={18} color={goal.color || '#4ADE80'} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          margin: 0,
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Fazer Aporte
                      </h3>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          color: '#94A3B8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={`Meta "${goal.name}"`}
                      >
                        Meta &ldquo;{goal.name}&rdquo;
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseDepositModal}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      color: '#94A3B8',
                      backgroundColor: '#161F18',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = '#94A3B8';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                    title="Fechar"
                    aria-label="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Conteúdo do Formulário */}
                <form
                  onSubmit={handleConfirmDeposit}
                  style={{
                    padding: '22px 20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '22px',
                    overflowY: 'auto',
                  }}
                >
                  {/* Hero do Valor: Cápsula Interativa Centralizada */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      gap: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: '#64748B',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        textAlign: 'center',
                      }}
                    >
                      Valor do Aporte
                    </span>

                    <div
                      onClick={() => depositInputRef.current?.focus()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 22px',
                        borderRadius: '20px',
                        backgroundColor: isDepositAmountFocused
                          ? 'rgba(74, 222, 128, 0.06)'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: isDepositAmountFocused
                          ? '1px solid rgba(74, 222, 128, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.09)',
                        boxShadow: isDepositAmountFocused
                          ? '0 0 24px rgba(74, 222, 128, 0.14)'
                          : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'text',
                        gap: '6px',
                        margin: '0 auto',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#64748B',
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          userSelect: 'none',
                          lineHeight: 1,
                        }}
                      >
                        R$
                      </span>
                      <input
                        ref={depositInputRef}
                        type="text"
                        inputMode="numeric"
                        value={depositAmountStr}
                        onChange={e => setDepositAmountStr(formatCurrencyInput(e.target.value, depositAmountStr))}
                        onFocus={() => setIsDepositAmountFocused(true)}
                        onBlur={() => setIsDepositAmountFocused(false)}
                        placeholder="0,00"
                        style={{
                          width: `${Math.max(3, (depositAmountStr || '0,00').length + 0.3)}ch`,
                          minWidth: '60px',
                          maxWidth: '220px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: (parseBrlCurrency(depositAmountStr) || 0) > 0 ? '#4ADE80' : '#E2E8F0',
                          fontSize: '2.3rem',
                          fontWeight: 800,
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          textAlign: 'center',
                          outline: 'none',
                          padding: 0,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.1,
                        }}
                      />
                    </div>

                    {/* Contexto motivacional com feedback dinâmico */}
                    <div style={{ textAlign: 'center', minHeight: '18px' }}>
                      {(() => {
                        const numeric = parseBrlCurrency(depositAmountStr) || 0;
                        if (remaining <= 0) {
                          return (
                            <span style={{ fontSize: '0.78rem', color: '#4ADE80', fontWeight: 600 }}>
                              🎉 Parabéns! Meta já atingida.
                            </span>
                          );
                        }
                        if (numeric >= remaining) {
                          return (
                            <span style={{ fontSize: '0.78rem', color: '#4ADE80', fontWeight: 600 }}>
                              🎯 Com este aporte você conclui sua meta!
                            </span>
                          );
                        }
                        return (
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                            Faltam <strong style={{ color: '#E2E8F0', fontWeight: 600 }}>{formatBrlCurrency(Math.max(0, remaining - numeric))}</strong> para concluir
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Atalhos Rápidos com Pílulas Elegantes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: '#64748B',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Atalhos rápidos
                    </span>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {[20, 50, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            const current = parseBrlCurrency(depositAmountStr) || 0;
                            const next = current + val;
                            setDepositAmountStr(formatCurrencyInput(next));
                            depositInputRef.current?.focus();
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#CBD5E1',
                            fontSize: '0.80rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#FFFFFF';
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = '#CBD5E1';
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          }}
                        >
                          +R$ {val}
                        </button>
                      ))}

                      {goal.monthlyContributionAmount && goal.monthlyContributionAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDepositAmountStr(formatCurrencyInput(goal.monthlyContributionAmount!));
                            depositInputRef.current?.focus();
                          }}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(74, 222, 128, 0.08)',
                            border: '1px solid rgba(74, 222, 128, 0.25)',
                            color: '#4ADE80',
                            fontSize: '0.80rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.16)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.08)')}
                          title="Definir valor do aporte mensal programado"
                        >
                          Parcela ({formatBrlCurrency(goal.monthlyContributionAmount)})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Seletor de Conta de Origem (Debitar de) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: '#64748B',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Debitar da Conta
                      </span>
                      {goal.defaultAccountId && selectedDepositAccount?.id === goal.defaultAccountId && (
                        <span
                          style={{
                            fontSize: '0.64rem',
                            color: '#4ADE80',
                            fontWeight: 600,
                            backgroundColor: 'rgba(74, 222, 128, 0.08)',
                            border: '1px solid rgba(74, 222, 128, 0.2)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          Padrão da meta
                        </span>
                      )}
                    </div>

                    {validAccounts.length > 0 ? (
                      <div style={{ position: 'relative' }}>
                        {/* Botão Gatilho do Seletor */}
                        <button
                          type="button"
                          onClick={() => setIsAccountPickerOpen(prev => !prev)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '14px',
                            backgroundColor: isAccountPickerOpen ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                            border: isAccountPickerOpen ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            outline: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            {selectedDepositAccount ? (
                              <BankLogo bankId={selectedDepositAccount.bankId} size={24} />
                            ) : (
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '7px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#64748B',
                                  flexShrink: 0,
                                }}
                              >
                                <Wallet size={14} />
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  fontSize: '0.86rem',
                                  fontWeight: 600,
                                  color: selectedDepositAccount ? '#FFFFFF' : '#E2E8F0',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                }}
                              >
                                {selectedDepositAccount ? selectedDepositAccount.name : 'Nenhuma conta'}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.70rem',
                                  color: '#64748B',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                }}
                              >
                                {selectedDepositAccount ? (
                                  <>Saldo disponível: <strong style={{ color: selectedDepositAccount.balance >= 0 ? '#94A3B8' : '#EF4444', fontWeight: 600 }}>{formatBrlCurrency(selectedDepositAccount.balance)}</strong></>
                                ) : (
                                  'Não debitar do saldo bancário'
                                )}
                              </span>
                            </div>
                          </div>

                          <ChevronDown
                            size={16}
                            color="#94A3B8"
                            style={{
                              transform: isAccountPickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              flexShrink: 0,
                            }}
                          />
                        </button>

                        {/* Menu Aberto */}
                        {isAccountPickerOpen && (
                          <div
                            style={{
                              marginTop: '6px',
                              backgroundColor: '#111519',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '14px',
                              overflow: 'hidden',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            {validAccounts.map(acc => {
                              const isSelected = acc.id === depositAccountId;
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => {
                                    setDepositAccountId(acc.id);
                                    setIsAccountPickerOpen(false);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.12s ease',
                                    textAlign: 'left',
                                    width: '100%',
                                  }}
                                  onMouseEnter={e => {
                                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <BankLogo bankId={acc.bankId} size={22} />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                                        {acc.name}
                                      </span>
                                      <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                                        {formatBrlCurrency(acc.balance)}
                                      </span>
                                    </div>
                                  </div>

                                  {isSelected && <Check size={16} color="#4ADE80" />}
                                </button>
                              );
                            })}

                            {/* Opção de não debitar */}
                            <button
                              type="button"
                              onClick={() => {
                                setDepositAccountId('');
                                setIsAccountPickerOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                backgroundColor: !depositAccountId ? 'rgba(74, 222, 128, 0.08)' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.12s ease',
                                textAlign: 'left',
                                width: '100%',
                              }}
                              onMouseEnter={e => {
                                if (depositAccountId) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                              }}
                              onMouseLeave={e => {
                                if (depositAccountId) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#64748B',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Wallet size={12} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                                    Nenhuma conta
                                  </span>
                                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                                    Não debitar do saldo bancário
                                  </span>
                                </div>
                              </div>

                              {!depositAccountId && <Check size={16} color="#4ADE80" />}
                            </button>
                          </div>
                        )}

                        {/* Alerta de saldo insuficiente */}
                        {selectedDepositAccount && (parseBrlCurrency(depositAmountStr) || 0) > selectedDepositAccount.balance && (
                          <span style={{ display: 'block', fontSize: '0.70rem', color: '#F59E0B', marginTop: '6px' }}>
                            ⚠️ Saldo disponível ({formatBrlCurrency(selectedDepositAccount.balance)}) menor que o valor do aporte.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px dashed rgba(255, 255, 255, 0.08)',
                          fontSize: '0.76rem',
                          color: '#64748B',
                        }}
                      >
                        Nenhuma conta bancária cadastrada. O aporte será registrado sem débito em conta.
                      </div>
                    )}
                  </div>

                  {/* Ação Principal Full-Width (Sem botões divididos clunky) */}
                  <div style={{ marginTop: '2px' }}>
                    <button
                      type="submit"
                      disabled={(parseBrlCurrency(depositAmountStr) || 0) <= 0}
                      style={{
                        width: '100%',
                        height: '48px',
                        borderRadius: '14px',
                        backgroundColor: (parseBrlCurrency(depositAmountStr) || 0) > 0 ? '#4ADE80' : 'rgba(255, 255, 255, 0.06)',
                        border: 'none',
                        color: (parseBrlCurrency(depositAmountStr) || 0) > 0 ? '#0A0E0C' : '#64748B',
                        fontSize: '0.94rem',
                        fontWeight: 700,
                        cursor: (parseBrlCurrency(depositAmountStr) || 0) > 0 ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: (parseBrlCurrency(depositAmountStr) || 0) > 0 ? '0 4px 18px rgba(74, 222, 128, 0.25)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if ((parseBrlCurrency(depositAmountStr) || 0) > 0) {
                          e.currentTarget.style.backgroundColor = '#3cd073';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if ((parseBrlCurrency(depositAmountStr) || 0) > 0) {
                          e.currentTarget.style.backgroundColor = '#4ADE80';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      Confirmar Aporte
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    </SwipeBackView>
  );
};
