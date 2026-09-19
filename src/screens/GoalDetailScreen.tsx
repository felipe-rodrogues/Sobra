import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Goal, GoalContribution } from '../core/types';
import { formatBrlCurrency, parseBrlCurrency } from '../core/parsers/currencyHelper';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { Modal } from '../components/common/Modal';
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
  Target
} from 'lucide-react';

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
    goalContributions,
    addGoalContribution,
    updateGoalContribution,
    deleteGoalContribution,
    saveGoal,
    isPrivacyMode,
  } = useFinance();

  // Busca a meta atualizada
  const goal = useMemo(() => goals.find(g => g.id === goalId), [goals, goalId]);

  // Modais locais de Aporte
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmountStr, setDepositAmountStr] = useState('');
  const [depositNote, setDepositNote] = useState('');

  // Edição inline de Aporte
  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [editContribAmountStr, setEditContribAmountStr] = useState('');
  const [editContribNote, setEditContribNote] = useState('');

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
      note: depositNote.trim() || 'Aporte manual',
    });

    setIsDepositModalOpen(false);
    setDepositAmountStr('');
    setDepositNote('');
  };

  // Salvar edição de aporte
  const handleSaveEditContrib = async (c: GoalContribution) => {
    const amount = parseBrlCurrency(editContribAmountStr);
    if (!amount || amount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    await updateGoalContribution(c.id, amount, undefined, editContribNote.trim() || undefined);
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
              backgroundColor: '#161F18',
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
            <ArrowLeft size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: accentColor,
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#FFFFFF',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                maxWidth: '220px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {goal.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onEditGoalSettings?.(goal)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#161F18',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Valor acumulado
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '2.7rem',
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
            <span style={{ fontSize: '0.88rem', color: '#94A3B8', fontWeight: 400 }}>
              de {isPrivacyMode ? '••••••' : formatBrlCurrency(targetAmount)} • <strong style={{ color: '#E2E8F0', fontWeight: 600 }}>{progressPercent}%</strong> concluído
            </span>
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
                boxShadow: `0 0 10px ${accentColor}60`,
              }}
            />
          </div>

          {/* Microcópia Conversacional: Faltam X • Prazo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#64748B',
              marginTop: '2px',
            }}
          >
            <span>
              {remaining > 0
                ? `Faltam ${isPrivacyMode ? '••••••' : formatBrlCurrency(remaining)}`
                : '🎉 Meta atingida!'}
            </span>

            {deadlineInfo && (
              <span>
                {deadlineInfo.isPast
                  ? 'Prazo encerrado'
                  : `${deadlineInfo.days} ${deadlineInfo.days === 1 ? 'dia restante' : 'dias restantes'}`}
              </span>
            )}
          </div>
        </div>

        {/* ── 3. CARD DE APORTE AUTOMÁTICO MENSAL (PIERRE: CALMO, SEM CAIXA DUPLA) ── */}
        <div
          style={{
            backgroundColor: '#111519',
            borderRadius: '18px',
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
                  backgroundColor: goal.autoContributionEnabled ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 0.2s ease',
                }}
              >
                <Zap size={18} color={goal.autoContributionEnabled ? '#4ADE80' : '#64748B'} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Aporte automático
                </span>
                <span style={{ fontSize: '0.74rem', color: '#8E8E93' }}>
                  {goal.autoContributionEnabled ? 'Reserva mensal ativa' : 'Economia automática desativada'}
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
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Valor por mês
                </span>
                {isEditingAutoAmount ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={autoAmountInput}
                      onChange={e => setAutoAmountInput(e.target.value)}
                      placeholder="0,00"
                      autoFocus
                      style={{
                        width: '100px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#1A222A',
                        border: '1px solid #4ADE80',
                        color: '#FFFFFF',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveAutoAmount}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#4ADE80',
                        border: 'none',
                        color: '#0A0E0C',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingAutoAmount(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8E8E93',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#4ADE80', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                      {formatBrlCurrency(goal.monthlyContributionAmount || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoAmountInput(
                          goal.monthlyContributionAmount
                            ? goal.monthlyContributionAmount.toFixed(2).replace('.', ',')
                            : ''
                        );
                        setIsEditingAutoAmount(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.74rem',
                        padding: '2px 4px',
                      }}
                      title="Editar valor mensal"
                    >
                      <Pencil size={12} />
                      <span>Alterar</span>
                    </button>
                  </div>
                )}
              </div>

              <span style={{ fontSize: '0.74rem', color: '#64748B', textAlign: 'right', maxWidth: '160px', lineHeight: 1.3 }}>
                Deduzido no Limite de Gastos do mês
              </span>
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                color: '#4ADE80',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Novo aporte</span>
            </button>
          </div>

          {contributions.length === 0 ? (
            <div
              style={{
                backgroundColor: '#111519',
                borderRadius: '16px',
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
                backgroundColor: '#111519',
                borderRadius: '18px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                overflow: 'hidden',
              }}
            >
              {contributions.map((c, index) => {
                const isEditing = editingContribId === c.id;
                const isLast = index === contributions.length - 1;

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
                      /* Formulário Inline de Edição */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editContribAmountStr}
                            onChange={e => setEditContribAmountStr(e.target.value)}
                            placeholder="0,00"
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#1A222A',
                              border: '1px solid #4ADE80',
                              color: '#FFFFFF',
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              outline: 'none',
                            }}
                          />
                          <input
                            type="text"
                            value={editContribNote}
                            onChange={e => setEditContribNote(e.target.value)}
                            placeholder="Descrição"
                            style={{
                              flex: 1.5,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#1A222A',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#FFFFFF',
                              fontSize: '0.85rem',
                              outline: 'none',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setEditingContribId(null)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#8E8E93',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditContrib(c)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              backgroundColor: '#4ADE80',
                              border: 'none',
                              color: '#0A0E0C',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Linha do Feed Padrão Pierre */
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              backgroundColor: c.isAutomatic ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {c.isAutomatic ? (
                              <Zap size={16} color="#4ADE80" />
                            ) : (
                              <Wallet size={16} color="#94A3B8" />
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                color: '#FFFFFF',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {c.note || (c.isAutomatic ? 'Aporte automático' : 'Aporte manual')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                {formatFriendlyDate(c.date)}
                              </span>
                              {c.isAutomatic && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    color: '#4ADE80',
                                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Automático
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontSize: '0.98rem',
                              fontWeight: 700,
                              color: '#4ADE80',
                              fontFamily: "'Outfit', 'Inter', sans-serif",
                              whiteSpace: 'nowrap',
                            }}
                          >
                            +{formatBrlCurrency(c.amount)}
                          </span>

                          {/* Ações de Edição e Exclusão */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContribId(c.id);
                                setEditContribAmountStr(c.amount.toFixed(2).replace('.', ','));
                                setEditContribNote(c.note || '');
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#64748B',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
                              title="Editar aporte"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContrib(c)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
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
                              <Trash2 size={13} />
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

        {/* ── 5. MODAL LIMPO PARA FAZER NOVO APORTE ── */}
        <Modal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          title="Fazer Aporte"
          subtitle={`Adicionar valor à meta "${goal.name}"`}
          maxWidth="400px"
        >
          <form onSubmit={handleConfirmDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '6px' }}>
                Valor do aporte (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={depositAmountStr}
                onChange={e => setDepositAmountStr(e.target.value)}
                placeholder="0,00"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#111519',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '6px' }}>
                Descrição / Nota (opcional)
              </label>
              <input
                type="text"
                value={depositNote}
                onChange={e => setDepositNote(e.target.value)}
                placeholder="Ex: Sobra do salário, Economia extra..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#111519',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsDepositModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                type="submit"
                style={{ flex: 1 }}
              >
                Confirmar Aporte
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </SwipeBackView>
  );
};
