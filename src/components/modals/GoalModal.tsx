import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Switch } from '../common/Switch';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBrlCurrency, formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Goal } from '../../core/types';
import { 
  Calendar, 
  Zap, 
  Users,
} from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGoal?: Goal | null;
  onDelete?: () => void;
}

const PRESET_COLORS = [
  '#10B981', // Verde Esmeralda
  '#38BDF8', // Azul Claro
  '#A855F7', // Roxo
  '#F59E0B', // Âmbar
  '#EC4899', // Rosa
  '#6366F1', // Indigo
];

export const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose, editingGoal, onDelete }) => {
  const { 
    saveGoal, 
    transactions, 
    isPartnershipActive,
    partnershipSpace,
  } = useFinance();
  const { user } = useAuth();
  const { colors } = useTheme();

  const isOwner = !partnershipSpace?.ownerId || partnershipSpace.ownerId === user?.id;
  const partnerName = isOwner ? (partnershipSpace?.partnerName || 'Parceiro(a)') : (partnershipSpace?.ownerName || 'Parceiro(a)');

  // Campos do formulário da meta
  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState('#10B981');
  const [autoContributionEnabled, setAutoContributionEnabled] = useState(false);
  const [monthlyContributionAmountStr, setMonthlyContributionAmountStr] = useState('');
  const [isShared, setIsShared] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  // Renda mensal usual calculada com base nas receitas reais do usuário
  const typicalMonthlyIncome = useMemo(() => {
    const incomeByMonth = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === 'income' && tx.amount > 0) {
        const monthKey = tx.date.substring(0, 7); // YYYY-MM
        incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + tx.amount);
      }
    }

    if (incomeByMonth.size === 0) {
      return 0;
    }

    const values = Array.from(incomeByMonth.values());
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }, [transactions]);

  // Sincroniza dados da meta ao abrir ou trocar de meta
  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmountStr(editingGoal.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setCurrentAmountStr(editingGoal.currentAmount ? editingGoal.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      const rawDate = editingGoal.targetDate ? editingGoal.targetDate.substring(0, 10) : '';
      setTargetDate(rawDate);
      setHasDeadline(Boolean(rawDate));
      setSelectedColor(editingGoal.color || '#10B981');
      setAutoContributionEnabled(Boolean(editingGoal.autoContributionEnabled));
      setMonthlyContributionAmountStr(
        editingGoal.monthlyContributionAmount
          ? editingGoal.monthlyContributionAmount.toFixed(2).replace('.', ',')
          : ''
      );
      setIsShared(Boolean(editingGoal.isShared));
    } else {
      setName('');
      setTargetAmountStr('');
      setCurrentAmountStr('');
      setTargetDate('');
      setHasDeadline(false);
      setSelectedColor('#10B981');
      setAutoContributionEnabled(false);
      setMonthlyContributionAmountStr('');
      setIsShared(false);
    }
  }, [editingGoal, isOpen]);

  // Cálculos automáticos de economia necessária
  const rhythmPreview = useMemo(() => {
    if (!hasDeadline || !targetDate) return null;
    const target = parseBrlCurrency(targetAmountStr) || 0;
    const current = editingGoal 
      ? editingGoal.currentAmount 
      : (currentAmountStr ? parseBrlCurrency(currentAmountStr) || 0 : 0);
    const remaining = Math.max(0, target - current);

    const targetDateObj = new Date(targetDate + 'T23:59:59');
    const now = new Date();
    const diffMs = targetDateObj.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return { 
        days, 
        isPast: true, 
        dailySavings: 0, 
        monthlySavings: 0, 
        remaining, 
        hasIncome: false, 
        maxDailySpend: 0, 
        maxMonthlySpend: 0, 
        typicalMonthlyIncome: 0, 
        incomeExceeded: false 
      };
    }

    const dailySavings = remaining / days;
    const monthlySavings = (remaining / days) * 30.41;

    const hasIncome = typicalMonthlyIncome > 0;
    const maxMonthlySpend = hasIncome ? Math.max(0, typicalMonthlyIncome - monthlySavings) : 0;
    const maxDailySpend = hasIncome ? maxMonthlySpend / 30.41 : 0;
    const incomeExceeded = hasIncome && monthlySavings > typicalMonthlyIncome;

    return {
      days,
      isPast: false,
      dailySavings,
      monthlySavings,
      remaining,
      hasIncome,
      maxDailySpend,
      maxMonthlySpend,
      typicalMonthlyIncome,
      incomeExceeded,
    };
  }, [hasDeadline, targetDate, targetAmountStr, currentAmountStr, typicalMonthlyIncome, editingGoal]);

  // Sugere valor de aporte automático se o usuário ativar e o campo estiver vazio
  const handleToggleAutoContribution = (checked: boolean) => {
    setAutoContributionEnabled(checked);
    if (checked && (!monthlyContributionAmountStr || monthlyContributionAmountStr === '0,00')) {
      if (rhythmPreview && rhythmPreview.monthlySavings > 0) {
        setMonthlyContributionAmountStr(rhythmPreview.monthlySavings.toFixed(2).replace('.', ','));
      } else {
        const target = parseBrlCurrency(targetAmountStr) || 0;
        if (target > 0) {
          const suggested = Math.round((target / 12) * 100) / 100;
          setMonthlyContributionAmountStr(suggested.toFixed(2).replace('.', ','));
        }
      }
    }
  };

  // Salvar alterações nas configurações da meta
  const handleSubmitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseBrlCurrency(targetAmountStr);
    const initialCurrent = currentAmountStr ? parseBrlCurrency(currentAmountStr) || 0 : 0;

    if (!name.trim()) {
      alert('Informe o nome da meta.');
      return;
    }
    if (!target || target <= 0) {
      alert('Informe um valor alvo válido maior que zero.');
      return;
    }
    if (hasDeadline && !targetDate) {
      alert('Selecione uma data no calendário ou desative a opção de definir tempo.');
      return;
    }

    const monthlyAmount = autoContributionEnabled
      ? (parseBrlCurrency(monthlyContributionAmountStr) || (rhythmPreview ? Math.round(rhythmPreview.monthlySavings * 100) / 100 : Math.round((target / 12) * 100) / 100))
      : undefined;

    await saveGoal({
      id: editingGoal?.id,
      name: name.trim(),
      targetAmount: target,
      currentAmount: editingGoal ? editingGoal.currentAmount : initialCurrent,
      targetDate: hasDeadline && targetDate ? targetDate : undefined,
      color: selectedColor,
      icon: 'Target',
      isCompleted: (editingGoal ? editingGoal.currentAmount : initialCurrent) >= target,
      autoContributionEnabled,
      monthlyContributionAmount: monthlyAmount,
      isShared: isPartnershipActive ? isShared : (editingGoal?.isShared || false),
      ownerName: isShared ? (partnershipSpace?.ownerName || 'Você') : undefined,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingGoal ? 'Configurações da Meta' : 'Nova Meta Financeira'}
      subtitle={editingGoal ? 'Edite o nome, valor alvo, prazo ou cor desta meta' : 'Defina seus objetivos e planeje quanto guardar'}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmitSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '6px' }}>
            Nome do Objetivo *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Reserva de Emergência, Viagem, Play 5"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: editingGoal ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '6px' }}>
              Valor Alvo (R$) *
            </label>
            <input
              type="text"
              required
              placeholder="0,00"
              value={targetAmountStr}
              onChange={e => setTargetAmountStr(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '1rem',
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {!editingGoal && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '6px' }}>
                Já Guardado (R$)
              </label>
              <input
                type="text"
                placeholder="0,00"
                value={currentAmountStr}
                onChange={e => setCurrentAmountStr(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  fontSize: '1rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* OPÇÃO DE DEFINIR TEMPO PARA A META */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '16px',
            backgroundColor: hasDeadline ? 'rgba(56, 189, 248, 0.05)' : colors.surfaceElevated,
            border: hasDeadline ? '1px solid rgba(56, 189, 248, 0.25)' : `1px solid ${colors.border}`,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: hasDeadline ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: hasDeadline ? '#38BDF8' : colors.textSecondary,
                  transition: 'all 0.2s ease',
                }}
              >
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: colors.textPrimary }}>
                  Definir prazo para a meta
                </div>
                <div style={{ fontSize: '0.78rem', color: colors.textSecondary, marginTop: '2px' }}>
                  {hasDeadline
                    ? 'Escolha a data limite no calendário'
                    : 'Opcional. Ative se quiser planejar um prazo'}
                </div>
              </div>
            </div>

            <Switch
              checked={hasDeadline}
              onChange={checked => {
                setHasDeadline(checked);
                if (checked && !targetDate) {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 6);
                  setTargetDate(d.toISOString().substring(0, 10));
                }
              }}
              activeColor="#38BDF8"
            />
          </div>

          {hasDeadline && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '4px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: colors.textSecondary, marginBottom: '6px' }}>
                  Data Limite *
                </label>
                <input
                  type="date"
                  required={hasDeadline}
                  min={todayStr}
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: '#16191D',
                    color: '#FFFFFF',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {rhythmPreview && !rhythmPreview.isPast && (
                <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                    Economia estimada para cumprir o prazo:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38BDF8', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                      {formatBrlCurrency(rhythmPreview.dailySavings)}/dia
                    </span>
                    <span style={{ fontSize: '0.84rem', color: '#E2E8F0', fontWeight: 600 }}>
                      ≈ {formatBrlCurrency(rhythmPreview.monthlySavings)}/mês
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* APORTE AUTOMÁTICO MENSAL */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '16px',
            backgroundColor: autoContributionEnabled ? 'rgba(74, 222, 128, 0.05)' : colors.surfaceElevated,
            border: autoContributionEnabled ? '1px solid rgba(74, 222, 128, 0.35)' : `1px solid ${colors.border}`,
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: autoContributionEnabled ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: autoContributionEnabled ? '#4ADE80' : colors.textSecondary,
                  transition: 'all 0.2s ease',
                }}
              >
                <Zap size={18} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: colors.textPrimary }}>
                  Aporte automático mensal
                </div>
                <div style={{ fontSize: '0.76rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.35 }}>
                  Reserva esse valor todo mês no seu Limite de Gastos.
                </div>
              </div>
            </div>

            <Switch
              checked={autoContributionEnabled}
              onChange={handleToggleAutoContribution}
              activeColor="#4ADE80"
            />
          </div>

          {autoContributionEnabled && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#CBD5E1', marginBottom: '2px', fontWeight: 600 }}>
                Valor mensal (R$) *
              </label>
              <input
                type="text"
                required={autoContributionEnabled}
                placeholder="0,00"
                value={monthlyContributionAmountStr}
                onChange={e => setMonthlyContributionAmountStr(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(74, 222, 128, 0.35)',
                  backgroundColor: '#161D19',
                  color: '#FFFFFF',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Toggle Meta Conjunta (Finanças a Dois) - Exibido apenas se ativado em Mais ou se a meta já for conjunta */}
        {(isPartnershipActive || isShared) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '16px',
              backgroundColor: isShared ? 'rgba(74, 222, 128, 0.05)' : colors.surfaceElevated,
              border: isShared ? '1px solid rgba(74, 222, 128, 0.35)' : `1px solid ${colors.border}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: isShared ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isShared ? '#4ADE80' : colors.textSecondary,
                  transition: 'all 0.2s ease',
                }}
              >
                <Users size={18} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: colors.textPrimary }}>
                  Meta Conjunta (Finanças a Dois)
                </div>
                <div style={{ fontSize: '0.76rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.35 }}>
                  {partnerName !== 'Parceiro(a)' 
                    ? `Compartilhar progresso e aportes com ${partnerName}`
                    : 'Visível e colaborativa no seu espaço a dois'
                  }
                </div>
              </div>
            </div>

            <Switch
              checked={isShared}
              onChange={setIsShared}
              activeColor="#4ADE80"
            />
          </div>
        )}

        {/* Cor da Meta */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: '#94A3B8', marginBottom: '8px' }}>
            Cor de Identificação
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: selectedColor === color ? '3px solid #FFFFFF' : 'none',
                  boxShadow: selectedColor === color ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                  transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {editingGoal && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '4px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#9CA3AF',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FB7185'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
          >
            Excluir meta
          </button>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px', alignItems: 'center' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
