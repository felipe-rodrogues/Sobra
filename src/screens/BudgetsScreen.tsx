import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { IconRenderer } from '../components/common/IconRenderer';
import { calculateBudgetStatuses, calculateGoalProgress } from '../core/calculations';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { 
  Plus, 
  AlertTriangle, 
  Target, 
  Calendar, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import { BudgetCalculationResult, Budget, Goal, Category } from '../core/types';
import { SwipeBackView } from '../components/common/SwipeBackView';

interface BudgetsScreenProps {
  onBack?: () => void;
  onOpenNewBudget: () => void;
  onOpenNewGoal: () => void;
  onOpenNewCategory?: () => void;
  onEditCategory?: (category: Category) => void;
  onEditBudget?: (budget: Budget) => void;
  onEditGoal?: (goal: Goal) => void;
}

export const BudgetsScreen: React.FC<BudgetsScreenProps> = ({
  onBack,
  onOpenNewBudget,
  onOpenNewGoal,
  onOpenNewCategory,
  onEditCategory,
  onEditBudget,
  onEditGoal,
}) => {
  const { 
    budgets, 
    categories, 
    transactions, 
    goals, 
    deleteBudget, 
    deleteGoal, 
    deleteCategory, 
    saveGoal,
    isPrivacyMode, 
    togglePrivacyMode 
  } = useFinance();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'budgets' | 'goals' | 'categories'>('budgets');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'expense' | 'income'>('all');

  // Modal para aporte rápido em metas
  const [depositingGoal, setDepositingGoal] = useState<Goal | null>(null);
  const [depositAmountStr, setDepositAmountStr] = useState('');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemainingInMonth = Math.max(1, daysInMonth - currentDay);
  
  const monthNameRaw = now.toLocaleDateString('pt-BR', { month: 'long' });
  const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);

  const budgetStatuses = useMemo(() => {
    return calculateBudgetStatuses(budgets, categories, transactions, currentMonth, currentYear);
  }, [budgets, categories, transactions, currentMonth, currentYear]);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  // Totais do Hero de Orçamentos
  const { totalBudgetLimit, totalBudgetSpent, totalBudgetRemaining, overallBudgetPercentage, overallDailyAvailable } = useMemo(() => {
    let limit = 0;
    let spent = 0;
    budgetStatuses.forEach(b => {
      limit += b.monthlyLimit;
      spent += b.spentAmount;
    });
    const remaining = Math.max(0, limit - spent);
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const daily = daysRemainingInMonth > 0 ? remaining / daysRemainingInMonth : 0;
    return {
      totalBudgetLimit: limit,
      totalBudgetSpent: spent,
      totalBudgetRemaining: remaining,
      overallBudgetPercentage: pct,
      overallDailyAvailable: daily,
    };
  }, [budgetStatuses, daysRemainingInMonth]);

  // Totais do Hero de Metas
  const { totalGoalsTarget, totalGoalsSaved, overallGoalsPercentage, goalsCompletedCount } = useMemo(() => {
    let target = 0;
    let saved = 0;
    let completed = 0;
    goals.forEach(g => {
      target += g.targetAmount;
      saved += g.currentAmount;
      if (g.isCompleted || g.currentAmount >= g.targetAmount) completed++;
    });
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return {
      totalGoalsTarget: target,
      totalGoalsSaved: saved,
      overallGoalsPercentage: pct,
      goalsCompletedCount: completed,
    };
  }, [goals]);

  // Aporte rápido em meta
  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositingGoal) return;
    const num = parseFloat(depositAmountStr.replace(/\./g, '').replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      alert('Informe um valor válido.');
      return;
    }
    const newAmount = depositingGoal.currentAmount + num;
    await saveGoal({
      ...depositingGoal,
      currentAmount: newAmount,
      isCompleted: newAmount >= depositingGoal.targetAmount,
    });
    setDepositingGoal(null);
    setDepositAmountStr('');
  };

  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '40px' }}>
      {/* 1. Header Superior Padrão Pierre com Título, Mês e Privacidade */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Planejamento
          </h2>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#9CA3AF',
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              padding: '3px 9px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {monthName} {currentYear}
          </span>
        </div>

        {/* Botão de Privacidade Circular */}
        <button
          type="button"
          onClick={togglePrivacyMode}
          title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: isPrivacyMode ? '#A3E635' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        >
          {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* 2. Segmented Control Pierre (Orçamentos / Metas / Categorias) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '26px',
          padding: '4px',
          gap: '4px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('budgets')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '22px',
            fontSize: '0.86rem',
            fontWeight: activeTab === 'budgets' ? 700 : 500,
            backgroundColor: activeTab === 'budgets' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
            color: activeTab === 'budgets' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeTab === 'budgets' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
          }}
        >
          Orçamentos {budgetStatuses.length > 0 && `(${budgetStatuses.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '22px',
            fontSize: '0.86rem',
            fontWeight: activeTab === 'goals' ? 700 : 500,
            backgroundColor: activeTab === 'goals' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
            color: activeTab === 'goals' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeTab === 'goals' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
          }}
        >
          Metas {goals.length > 0 && `(${goals.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '22px',
            fontSize: '0.86rem',
            fontWeight: activeTab === 'categories' ? 700 : 500,
            backgroundColor: activeTab === 'categories' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
            color: activeTab === 'categories' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeTab === 'categories' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
          }}
        >
          Categorias
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. ABA 1: ORÇAMENTOS MENSAIS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'budgets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Hero Section Pierre de Orçamentos */}
          <div
            style={{
              backgroundColor: '#12161B',
              borderRadius: '24px',
              padding: '24px 22px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Glow sutil de fundo */}
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                backgroundColor: totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0 
                  ? 'rgba(244, 63, 94, 0.15)' 
                  : 'rgba(34, 197, 94, 0.12)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }}
            />

            <div>
              <div style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 500 }}>
                {totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0
                  ? 'Limite do Mês Ultrapassado'
                  : 'Disponível no Orçamento'}
              </div>
              <div
                style={{
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  color: totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0 ? '#FB7185' : '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  marginTop: '4px',
                }}
              >
                {totalBudgetLimit === 0
                  ? 'R$ 0,00'
                  : totalBudgetSpent > totalBudgetLimit
                  ? maskValue(`- ${formatBrlCurrency(totalBudgetSpent - totalBudgetLimit)}`)
                  : maskValue(formatBrlCurrency(totalBudgetRemaining))}
              </div>

              {totalBudgetLimit > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '6px' }}>
                  {totalBudgetSpent > totalBudgetLimit ? (
                    <span>Teto total de {maskValue(formatBrlCurrency(totalBudgetLimit))} estourado</span>
                  ) : (
                    <span>
                      Gasto: <strong style={{ color: '#FFFFFF' }}>{maskValue(formatBrlCurrency(totalBudgetSpent))}</strong> de {maskValue(formatBrlCurrency(totalBudgetLimit))} ({overallBudgetPercentage}%)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Barra de Progresso Geral */}
            {totalBudgetLimit > 0 && (
              <div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(overallBudgetPercentage, 100)}%`,
                      backgroundColor: totalBudgetSpent > totalBudgetLimit 
                        ? '#F43F5E' 
                        : overallBudgetPercentage >= 80 
                        ? '#F59E0B' 
                        : '#22C55E',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Frase Contextual Pierre */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '14px',
                backgroundColor: totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0
                  ? 'rgba(244, 63, 94, 0.1)'
                  : overallBudgetPercentage >= 80 && totalBudgetLimit > 0
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0
                  ? '1px solid rgba(244, 63, 94, 0.2)'
                  : overallBudgetPercentage >= 80 && totalBudgetLimit > 0
                  ? '1px solid rgba(245, 158, 11, 0.2)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.82rem',
                color: totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0
                  ? '#FB7185'
                  : overallBudgetPercentage >= 80 && totalBudgetLimit > 0
                  ? '#FBBF24'
                  : '#CBD5E1',
              }}
            >
              {totalBudgetSpent > totalBudgetLimit && totalBudgetLimit > 0 ? (
                <AlertTriangle size={16} color="#FB7185" style={{ flexShrink: 0 }} />
              ) : overallBudgetPercentage >= 80 && totalBudgetLimit > 0 ? (
                <AlertTriangle size={16} color="#FBBF24" style={{ flexShrink: 0 }} />
              ) : (
                <ShieldCheck size={16} color="#22C55E" style={{ flexShrink: 0 }} />
              )}
              <span style={{ lineHeight: 1.4 }}>
                {totalBudgetLimit === 0
                  ? 'Crie seu primeiro teto por categoria para o Sobra cuidar do seu ritmo de gastos.'
                  : totalBudgetSpent > totalBudgetLimit
                  ? `Orçamento ultrapassado. Sugerimos segurar compras não essenciais pelos próximos ${daysRemainingInMonth} dias.`
                  : overallBudgetPercentage >= 80
                  ? `Atenção: você já utilizou ${overallBudgetPercentage}% do limite do mês. Média segura de ${maskValue(formatBrlCurrency(overallDailyAvailable))}/dia.`
                  : `Tudo sob controle. Restam ${daysRemainingInMonth} dias no mês com média de ${maskValue(formatBrlCurrency(overallDailyAvailable))}/dia disponível.`}
              </span>
            </div>

            {/* Botão "+ Novo Orçamento" Estilo Pierre */}
            <div>
              <button
                type="button"
                onClick={onOpenNewBudget}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 20px',
                  borderRadius: '24px',
                  backgroundColor: '#1E232B',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#282F3A';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1E232B';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Plus size={17} />
                <span>Novo Orçamento</span>
              </button>
            </div>
          </div>

          {/* Subtítulo de Lista */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
              color: '#9CA3AF',
              fontWeight: 500,
              padding: '0 4px',
            }}
          >
            <div>
              {budgetStatuses.length} {budgetStatuses.length === 1 ? 'categoria orçada' : 'categorias orçadas'}
            </div>
            <div>
              {maskValue(formatBrlCurrency(totalBudgetSpent))} gastos
            </div>
          </div>

          {/* Lista de Cards de Orçamento (Espaçosa e sem truncamento) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {budgetStatuses.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  borderRadius: '20px',
                  backgroundColor: '#12161B',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  color: '#6B7280',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <SlidersHorizontal size={32} color="#9CA3AF" />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Nenhum orçamento configurado
                </div>
                <p style={{ fontSize: '0.84rem', color: '#9CA3AF', maxWidth: '300px', margin: 0 }}>
                  Defina limites para Alimentação, Lazer ou Transporte e saiba exatamente quanto pode gastar.
                </p>
              </div>
            ) : (
              budgetStatuses.map((b: BudgetCalculationResult) => {
                const budgetObj = budgets.find(
                  (item: Budget) => item.categoryId === b.categoryId && item.month === currentMonth && item.year === currentYear
                );
                const isDanger = b.status === 'danger';
                const isWarning = b.status === 'warning';

                const barColor = isDanger ? '#F43F5E' : isWarning ? '#F59E0B' : '#22C55E';
                const catDailyRemaining = daysRemainingInMonth > 0 ? b.remainingAmount / daysRemainingInMonth : 0;

                return (
                  <div
                    key={b.categoryId}
                    onClick={() => budgetObj && onEditBudget?.(budgetObj)}
                    style={{
                      backgroundColor: isDanger ? 'rgba(244, 63, 94, 0.04)' : '#12161B',
                      borderRadius: '20px',
                      padding: '18px 20px',
                      border: isDanger 
                        ? '1px solid rgba(244, 63, 94, 0.25)' 
                        : isWarning 
                        ? '1px solid rgba(245, 158, 11, 0.25)' 
                        : '1px solid rgba(255, 255, 255, 0.07)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      cursor: budgetObj && onEditBudget ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => {
                      if (budgetObj && onEditBudget) {
                        e.currentTarget.style.borderColor = isDanger
                          ? 'rgba(244, 63, 94, 0.5)'
                          : isWarning
                          ? 'rgba(245, 158, 11, 0.5)'
                          : 'rgba(255, 255, 255, 0.16)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = isDanger
                        ? 'rgba(244, 63, 94, 0.25)'
                        : isWarning
                        ? 'rgba(245, 158, 11, 0.25)'
                        : 'rgba(255, 255, 255, 0.07)';
                    }}
                  >
                    {/* Linha Superior: Ícone + Título + Badge de status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '13px',
                            backgroundColor: `${b.categoryColor}18`,
                            border: `1px solid ${b.categoryColor}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <IconRenderer name={b.categoryIcon} size={20} color={b.categoryColor} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {b.categoryName}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#9CA3AF', marginTop: '2px' }}>
                            Teto: {maskValue(formatBrlCurrency(b.monthlyLimit))}
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Badge de alerta se necessário */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {isDanger ? (
                          <div
                            style={{
                              padding: '3px 9px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'rgba(244, 63, 94, 0.14)',
                              color: '#FB7185',
                              border: '1px solid rgba(244, 63, 94, 0.25)',
                            }}
                          >
                            <AlertTriangle size={11} />
                            <span>Estourado</span>
                          </div>
                        ) : isWarning ? (
                          <div
                            style={{
                              padding: '3px 9px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'rgba(245, 158, 11, 0.14)',
                              color: '#FBBF24',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                            }}
                          >
                            <AlertTriangle size={11} />
                            <span>{b.percentageSpent}%</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Barra de Progresso Suave */}
                    <div>
                      <div
                        style={{
                          height: '6px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(b.percentageSpent, 100)}%`,
                            backgroundColor: barColor,
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Valores de Gasto e Restante */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: '#9CA3AF' }}>
                        Gasto:{' '}
                        <strong style={{ color: isDanger ? '#FB7185' : '#FFFFFF', fontWeight: 700 }}>
                          {maskValue(formatBrlCurrency(b.spentAmount))}
                        </strong>{' '}
                        <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>({b.percentageSpent}%)</span>
                      </span>

                      <span>
                        {isDanger ? (
                          <span style={{ color: '#FB7185', fontWeight: 600 }}>
                            Estourado por {maskValue(formatBrlCurrency(b.spentAmount - b.monthlyLimit))}
                          </span>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>
                            Resta:{' '}
                            <strong style={{ color: '#4ADE80', fontWeight: 700 }}>
                              {maskValue(formatBrlCurrency(b.remainingAmount))}
                            </strong>
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Rodapé Conversacional Pierre */}
                    {!isDanger && b.remainingAmount > 0 && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: '#64748B',
                          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                          paddingTop: '8px',
                        }}
                      >
                        Você pode gastar em média <strong>{maskValue(formatBrlCurrency(catDailyRemaining))}/dia</strong> até o fim do mês.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ABA 2: METAS FINANCEIRAS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Hero Section Pierre de Metas */}
          <div
            style={{
              backgroundColor: '#12161B',
              borderRadius: '24px',
              padding: '24px 22px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }}
            />

            <div>
              <div style={{ fontSize: '0.9rem', color: '#9CA3AF', fontWeight: 500 }}>
                Patrimônio Guardado em Metas
              </div>
              <div
                style={{
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  marginTop: '4px',
                }}
              >
                {maskValue(formatBrlCurrency(totalGoalsSaved))}
              </div>

              {totalGoalsTarget > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '6px' }}>
                  Alvo acumulado de {maskValue(formatBrlCurrency(totalGoalsTarget))} ({overallGoalsPercentage}% concluído)
                </div>
              )}
            </div>

            {/* Barra de Progresso Global */}
            {totalGoalsTarget > 0 && (
              <div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${overallGoalsPercentage}%`,
                      backgroundColor: '#38BDF8',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Insight Conversacional */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.82rem',
                color: '#CBD5E1',
              }}
            >
              <TrendingUp size={16} color="#38BDF8" style={{ flexShrink: 0 }} />
              <span style={{ lineHeight: 1.4 }}>
                {goals.length === 0
                  ? 'Defina objetivos concretos (como reserva ou viagens) para poupar com propósito.'
                  : goalsCompletedCount === goals.length
                  ? 'Parabéns! Todas as suas metas foram atingidas. Que tal definir novos horizontes?'
                  : `Você tem ${goals.length - goalsCompletedCount} meta(s) em andamento. Cada real economizado hoje aproxima seus sonhos.`}
              </span>
            </div>

            {/* Botão "+ Nova Meta" Pierre */}
            <div>
              <button
                type="button"
                onClick={onOpenNewGoal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 20px',
                  borderRadius: '24px',
                  backgroundColor: '#1E232B',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#282F3A';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1E232B';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Plus size={17} />
                <span>Nova Meta</span>
              </button>
            </div>
          </div>

          {/* Subtítulo de Metas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
              color: '#9CA3AF',
              fontWeight: 500,
              padding: '0 4px',
            }}
          >
            <div>
              {goals.length} {goals.length === 1 ? 'meta ativa' : 'metas ativas'}
            </div>
            {goalsCompletedCount > 0 && (
              <div style={{ color: '#4ADE80' }}>
                {goalsCompletedCount} concluída{goalsCompletedCount === 1 ? '' : 's'} 🎉
              </div>
            )}
          </div>

          {/* Lista de Metas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {goals.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  borderRadius: '20px',
                  backgroundColor: '#12161B',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  color: '#6B7280',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Target size={32} color="#9CA3AF" />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Nenhuma meta cadastrada
                </div>
                <p style={{ fontSize: '0.84rem', color: '#9CA3AF', maxWidth: '300px', margin: 0 }}>
                  Guarde para sua reserva, viagem ou aquisição de bens e acompanhe a evolução do seu dinheiro.
                </p>
              </div>
            ) : (
              goals.map((goal: Goal) => {
                const progress = calculateGoalProgress(goal);
                const targetDateFormatted = new Date(goal.targetDate).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={goal.id}
                    style={{
                      backgroundColor: '#12161B',
                      borderRadius: '20px',
                      padding: '18px 20px',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      {/* Ícone + Título — clicável para editar */}
                      <div
                        onClick={() => onEditGoal?.(goal)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, cursor: onEditGoal ? 'pointer' : 'default' }}
                        onMouseEnter={e => { if (onEditGoal) (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.16)'; }}
                        onMouseLeave={e => { if (onEditGoal) (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.07)'; }}
                      >
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '13px',
                            backgroundColor: `${goal.color}18`,
                            border: `1px solid ${goal.color}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Target size={20} color={goal.color} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {goal.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>
                            <Calendar size={12} />
                            <span>
                              Até {targetDateFormatted} • {progress.daysRemaining > 0 ? `${progress.daysRemaining} dias` : 'Prazo encerrado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Badge de progresso */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {progress.isCompleted ? (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(34, 197, 94, 0.15)',
                              color: '#4ADE80',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                            }}
                          >
                            Concluída! 🎉
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.95rem',
                              fontWeight: 800,
                              color: goal.color,
                            }}
                          >
                            {progress.percentageCompleted}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barra de Progresso */}
                    <div>
                      <div
                        style={{
                          height: '6px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(progress.percentageCompleted, 100)}%`,
                            backgroundColor: goal.color,
                            borderRadius: '9999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Valores e Botão Aporte Rápido */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: '#9CA3AF' }}>
                        Acumulado:{' '}
                        <strong style={{ color: '#FFFFFF', fontWeight: 700 }}>
                          {maskValue(formatBrlCurrency(goal.currentAmount))}
                        </strong>{' '}
                        <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                          de {maskValue(formatBrlCurrency(goal.targetAmount))}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setDepositingGoal(goal);
                          setDepositAmountStr('');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '16px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                      >
                        <Plus size={14} color={goal.color} />
                        <span>Aportar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ABA 3: CATEGORIAS (CATÁLOGO REFINADO)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Header com Filtros & Botão Nova Categoria */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Pílulas de Sub-filtro */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '20px',
                padding: '3px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: categoryFilter === 'all' ? 700 : 500,
                  backgroundColor: categoryFilter === 'all' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                  color: categoryFilter === 'all' ? '#FFFFFF' : '#9CA3AF',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Todas ({categories.length})
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('expense')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: categoryFilter === 'expense' ? 700 : 500,
                  backgroundColor: categoryFilter === 'expense' ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                  color: categoryFilter === 'expense' ? '#FB7185' : '#9CA3AF',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Despesas ({categories.filter(c => c.type === 'expense').length})
              </button>

              <button
                type="button"
                onClick={() => setCategoryFilter('income')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: categoryFilter === 'income' ? 700 : 500,
                  backgroundColor: categoryFilter === 'income' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                  color: categoryFilter === 'income' ? '#4ADE80' : '#9CA3AF',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Receitas ({categories.filter(c => c.type === 'income').length})
              </button>
            </div>

            {/* Botão "+ Nova Categoria" Pierre */}
            {onOpenNewCategory && (
              <button
                type="button"
                onClick={onOpenNewCategory}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '22px',
                  backgroundColor: '#1E232B',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#282F3A';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1E232B';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Plus size={15} />
                <span>Nova Categoria</span>
              </button>
            )}
          </div>

          {/* Grid de Categorias Limpo Pierre */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
            {categories
              .filter(cat => categoryFilter === 'all' || cat.type === categoryFilter)
              .map(cat => {
                const txCount = transactions.filter(t => t.categoryId === cat.id).length;

                return (
                  <div
                    key={cat.id}
                    onClick={() => onEditCategory?.(cat)}
                    style={{
                      backgroundColor: '#12161B',
                      borderRadius: '18px',
                      padding: '14px 16px',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      cursor: onEditCategory ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => { if (onEditCategory) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '13px',
                          backgroundColor: `${cat.color}18`,
                          border: `1px solid ${cat.color}30`,
                          color: cat.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconRenderer name={cat.icon} size={20} color={cat.color} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.96rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cat.name}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: cat.type === 'expense' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                              color: cat.type === 'expense' ? '#FB7185' : '#4ADE80',
                            }}
                          >
                            {cat.type === 'expense' ? 'Despesa' : 'Receita'}
                          </span>

                          {cat.isCustom ? (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                color: '#38BDF8',
                                fontWeight: 600,
                              }}
                            >
                              Personalizada
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                color: '#64748B',
                                fontWeight: 500,
                              }}
                            >
                              Padrão
                            </span>
                          )}

                          <span style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>
                            • {txCount} {txCount === 1 ? 'lançamento' : 'lançamentos'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Modal Rápido de Aporte em Meta */}
      {depositingGoal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
          }}
          onClick={() => setDepositingGoal(null)}
        >
          <div
            style={{
              backgroundColor: '#14181E',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '22px',
              width: '100%',
              maxWidth: '380px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Adicionar à meta
              </div>
              <div style={{ fontSize: '0.84rem', color: '#9CA3AF', marginTop: '3px' }}>
                {depositingGoal.name}
              </div>
            </div>

            <form onSubmit={handleQuickDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '6px' }}>
                  Quanto você guardou? (R$)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: 250,00"
                  value={depositAmountStr}
                  onChange={e => setDepositAmountStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#FFFFFF',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDepositingGoal(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '18px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#9CA3AF',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '18px',
                    backgroundColor: '#22C55E',
                    border: 'none',
                    color: '#0A0E0C',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </SwipeBackView>
  );
};
