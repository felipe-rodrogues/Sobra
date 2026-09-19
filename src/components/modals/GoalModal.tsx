import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBrlCurrency, formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Goal } from '../../core/types';
import { Calendar, Clock, Sparkles } from 'lucide-react';

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
  const { saveGoal, transactions } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState('#10B981');

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

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmountStr(editingGoal.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setCurrentAmountStr(editingGoal.currentAmount ? editingGoal.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      const rawDate = editingGoal.targetDate ? editingGoal.targetDate.substring(0, 10) : '';
      setTargetDate(rawDate);
      setHasDeadline(Boolean(rawDate));
      setSelectedColor(editingGoal.color || '#10B981');
    } else {
      setName('');
      setTargetAmountStr('');
      setCurrentAmountStr('');
      setTargetDate('');
      setHasDeadline(false);
      setSelectedColor('#10B981');
    }
  }, [editingGoal, isOpen]);

  // Cálculos automáticos de economia e teto de gastos baseado na renda mensal
  const rhythmPreview = useMemo(() => {
    if (!hasDeadline || !targetDate) return null;
    const target = parseBrlCurrency(targetAmountStr) || 0;
    const current = currentAmountStr ? parseBrlCurrency(currentAmountStr) || 0 : 0;
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
  }, [hasDeadline, targetDate, targetAmountStr, currentAmountStr, typicalMonthlyIncome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseBrlCurrency(targetAmountStr);
    const current = currentAmountStr ? parseBrlCurrency(currentAmountStr) || 0 : 0;

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

    await saveGoal({
      id: editingGoal?.id,
      name: name.trim(),
      targetAmount: target,
      currentAmount: current,
      targetDate: hasDeadline && targetDate ? targetDate : undefined,
      color: selectedColor,
      icon: 'Target',
      isCompleted: current >= target,
    });

    setName('');
    setTargetAmountStr('');
    setCurrentAmountStr('');
    setTargetDate('');
    setHasDeadline(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingGoal ? 'Editar Meta Financeira' : 'Nova Meta Financeira'}
      subtitle="Defina seus objetivos e acompanhe o progresso em tempo real"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Nome do Objetivo *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Reserva de Emergência, Viagem, Carro"
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
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
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
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
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
              }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OPÇÃO DE DEFINIR TEMPO PARA A META (OPCIONAL POR PADRÃO)                  */}
        {/* ========================================================================= */}
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
          {/* Header do Switch */}
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
                  Definir tempo para a meta
                </div>
                <div style={{ fontSize: '0.78rem', color: colors.textSecondary, marginTop: '2px' }}>
                  {hasDeadline
                    ? 'Escolha a data limite no calendário'
                    : 'Opcional. Ative se quiser planejar um prazo'}
                </div>
              </div>
            </div>

            {/* Switch Toggle */}
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '24px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <input
                type="checkbox"
                checked={hasDeadline}
                onChange={e => {
                  const checked = e.target.checked;
                  setHasDeadline(checked);
                  if (checked && !targetDate) {
                    // Pré-seleciona data sugestiva de 6 meses
                    const d = new Date();
                    d.setMonth(d.getMonth() + 6);
                    setTargetDate(d.toISOString().substring(0, 10));
                  }
                }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: hasDeadline ? '#38BDF8' : 'rgba(255, 255, 255, 0.14)',
                  borderRadius: '24px',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    height: '18px',
                    width: '18px',
                    left: hasDeadline ? '22px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Calendário e Cálculo Automático de Gastos */}
          {hasDeadline && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginTop: '4px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: colors.textSecondary, marginBottom: '6px' }}>
                  Data Limite no Calendário *
                </label>
                <input
                  type="date"
                  required={hasDeadline}
                  min={todayStr}
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Preview de Ritmo e Teto de Gastos baseado na renda mensal */}
              {rhythmPreview && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    backgroundColor: rhythmPreview.isPast
                      ? 'rgba(244, 63, 94, 0.08)'
                      : rhythmPreview.incomeExceeded
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'rgba(56, 189, 248, 0.07)',
                    border: rhythmPreview.isPast
                      ? '1px solid rgba(244, 63, 94, 0.25)'
                      : rhythmPreview.incomeExceeded
                      ? '1px solid rgba(245, 158, 11, 0.25)'
                      : '1px solid rgba(56, 189, 248, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* Badge de Prazo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: rhythmPreview.isPast ? '#FB7185' : rhythmPreview.incomeExceeded ? '#FBBF24' : '#38BDF8', fontWeight: 600, fontSize: '0.82rem' }}>
                    {rhythmPreview.isPast ? <Clock size={14} /> : <Sparkles size={14} />}
                    <span>
                      {rhythmPreview.isPast
                        ? 'A data selecionada já passou'
                        : `${rhythmPreview.days} dias de prazo (~${Math.max(1, Math.round(rhythmPreview.days / 30))} meses)`}
                    </span>
                  </div>

                  {!rhythmPreview.isPast && rhythmPreview.remaining > 0 && (
                    <>
                      {rhythmPreview.incomeExceeded ? (
                        <div style={{ fontSize: '0.82rem', color: '#FCD34D', lineHeight: 1.5, paddingTop: '2px' }}>
                          Para bater esta meta no prazo, você precisaria guardar{' '}
                          <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(rhythmPreview.monthlySavings)}/mês</strong>, o que supera sua renda média de{' '}
                          <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(rhythmPreview.typicalMonthlyIncome)}/mês</strong>. Que tal escolher uma data um pouco mais adiante?
                        </div>
                      ) : rhythmPreview.hasIncome ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', color: colors.textSecondary, marginBottom: '4px' }}>
                              Você deverá gastar no máximo:
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '1.65rem',
                                  fontWeight: 800,
                                  color: '#FFFFFF',
                                  letterSpacing: '-0.02em',
                                  lineHeight: 1.1,
                                }}
                              >
                                {formatBrlCurrency(rhythmPreview.maxDailySpend)}
                              </span>
                              <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 600 }}>
                                / dia
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>
                              Teto de até <strong style={{ color: '#E2E8F0' }}>{formatBrlCurrency(rhythmPreview.maxMonthlySpend)}</strong> por mês
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: colors.textSecondary,
                              lineHeight: 1.45,
                              paddingTop: '8px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                            }}
                          >
                            💡 Baseado na sua renda de <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(rhythmPreview.typicalMonthlyIncome)}/mês</strong>: mantendo esse teto, sobram{' '}
                            <strong style={{ color: '#38BDF8' }}>{formatBrlCurrency(rhythmPreview.dailySavings)}/dia</strong> ({formatBrlCurrency(rhythmPreview.monthlySavings)}/mês) para atingir sua meta no prazo.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', color: colors.textSecondary, marginBottom: '4px' }}>
                              Meta de economia diária:
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '1.65rem',
                                  fontWeight: 800,
                                  color: '#FFFFFF',
                                  letterSpacing: '-0.02em',
                                  lineHeight: 1.1,
                                }}
                              >
                                {formatBrlCurrency(rhythmPreview.dailySavings)}
                              </span>
                              <span style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 600 }}>
                                / dia
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>
                              Equivalente a <strong style={{ color: '#E2E8F0' }}>{formatBrlCurrency(rhythmPreview.monthlySavings)}</strong> por mês
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: colors.textSecondary,
                              lineHeight: 1.45,
                              paddingTop: '8px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                            }}
                          >
                            💡 Guardando esse valor diariamente, você acumula <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(rhythmPreview.remaining)}</strong> no prazo de {rhythmPreview.days} dias.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cor da Meta */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '8px' }}>
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
