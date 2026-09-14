import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { IconRenderer } from '../components/common/IconRenderer';
import { calculateBudgetStatuses, calculateGoalProgress } from '../core/calculations';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { Plus, AlertTriangle, CheckCircle2, Target, Calendar, Trash2, Edit2 } from 'lucide-react';
import { BudgetCalculationResult, Budget, Goal, Category } from '../core/types';

interface BudgetsScreenProps {
  onOpenNewBudget: () => void;
  onOpenNewGoal: () => void;
  onOpenNewCategory?: () => void;
  onEditCategory?: (category: Category) => void;
}

export const BudgetsScreen: React.FC<BudgetsScreenProps> = ({
  onOpenNewBudget,
  onOpenNewGoal,
  onOpenNewCategory,
  onEditCategory,
}) => {
  const { budgets, categories, transactions, goals, deleteBudget, deleteGoal, deleteCategory } = useFinance();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'budgets' | 'goals' | 'categories'>('budgets');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'expense' | 'income'>('all');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const budgetStatuses = calculateBudgetStatuses(budgets, categories, transactions, currentMonth, currentYear);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      {/* Header com Switcher entre Orçamentos, Metas e Categorias */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            backgroundColor: colors.surfaceElevated,
            borderRadius: '12px',
            padding: '4px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <button
            onClick={() => setActiveTab('budgets')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'budgets' ? colors.primary : 'transparent',
              color: activeTab === 'budgets' ? '#FFFFFF' : colors.textSecondary,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Orçamentos
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'goals' ? colors.primary : 'transparent',
              color: activeTab === 'goals' ? '#FFFFFF' : colors.textSecondary,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Metas
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'categories' ? colors.primary : 'transparent',
              color: activeTab === 'categories' ? '#FFFFFF' : colors.textSecondary,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Categorias
          </button>
        </div>

        {activeTab === 'budgets' && (
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={onOpenNewBudget}>
            Novo Orçamento
          </Button>
        )}
        {activeTab === 'goals' && (
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={onOpenNewGoal}>
            Nova Meta
          </Button>
        )}
        {activeTab === 'categories' && (
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={onOpenNewCategory}>
            Nova Categoria
          </Button>
        )}
      </div>

      {/* Seção de Orçamentos Mensais */}
      {activeTab === 'budgets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {budgetStatuses.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 20px', color: colors.textSecondary }}>
              Nenhum orçamento configurado para o mês atual. Clique em "Novo Orçamento" para começar!
            </Card>
          ) : (
            budgetStatuses.map((b: BudgetCalculationResult) => {
              const budgetObj = budgets.find((item: Budget) => item.categoryId === b.categoryId && item.month === currentMonth && item.year === currentYear);
              const isDanger = b.status === 'danger';
              const isWarning = b.status === 'warning';

              const barColor = isDanger 
                ? colors.budgetDanger 
                : isWarning 
                ? colors.budgetWarning 
                : colors.budgetNormal;

              return (
                <Card
                  key={b.categoryId}
                  className={isDanger ? 'animate-alert-glow' : ''}
                  style={{
                    padding: '18px 20px',
                    borderColor: isDanger ? colors.budgetDanger : isWarning ? colors.budgetWarning : colors.border,
                    backgroundColor: isDanger ? colors.budgetDangerBg : colors.surfaceGlass,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: `${b.categoryColor}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconRenderer name={b.categoryIcon} size={18} color={b.categoryColor} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary }}>
                          {b.categoryName}
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: colors.textSecondary }}>
                          Limite: {formatBrlCurrency(b.monthlyLimit)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Badge
                        variant={isDanger ? 'expense' : isWarning ? 'warning' : 'income'}
                        size="sm"
                        icon={isDanger ? <AlertTriangle size={12} /> : isWarning ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                      >
                        {isDanger ? 'Ultrapassou Limite!' : isWarning ? 'Atenção (>80%)' : 'Dentro do Limite'}
                      </Badge>

                      {budgetObj && (
                        <button
                          onClick={() => {
                            if (confirm(`Remover orçamento de "${b.categoryName}"?`)) {
                              deleteBudget(budgetObj.id);
                            }
                          }}
                          style={{
                            padding: '6px',
                            borderRadius: '8px',
                            color: colors.textMuted,
                          }}
                          title="Remover orçamento"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div style={{ marginBottom: '10px' }}>
                    <div
                      style={{
                        height: '10px',
                        borderRadius: '9999px',
                        backgroundColor: colors.surfaceElevated,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(b.percentageSpent, 100)}%`,
                          backgroundColor: barColor,
                          borderRadius: '9999px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Estatísticas de Gastos */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: colors.textSecondary }}>
                      Gasto: <strong style={{ color: isDanger ? colors.expense : colors.textPrimary }}>{formatBrlCurrency(b.spentAmount)}</strong> ({b.percentageSpent}%)
                    </span>
                    <span style={{ color: isDanger ? colors.expense : colors.textSecondary }}>
                      {isDanger 
                        ? `Estourado por ${formatBrlCurrency(b.spentAmount - b.monthlyLimit)}`
                        : `Resta: ${formatBrlCurrency(b.remainingAmount)}`
                      }
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Seção de Metas Financeiras */}
      {activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {goals.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 20px', color: colors.textSecondary }}>
              Nenhuma meta cadastrada ainda. Defina seu primeiro objetivo financeiro!
            </Card>
          ) : (
            goals.map((goal: Goal) => {
              const progress = calculateGoalProgress(goal);
              const targetDateFormatted = new Date(goal.targetDate).toLocaleDateString('pt-BR');

              return (
                <Card key={goal.id} style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          backgroundColor: `${goal.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Target size={20} color={goal.color} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary }}>
                          {goal.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: colors.textSecondary }}>
                          <Calendar size={12} />
                          Prazo: {targetDateFormatted} ({progress.daysRemaining > 0 ? `${progress.daysRemaining} dias restantes` : 'Prazo encerrado'})
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {progress.isCompleted ? (
                        <Badge variant="income" size="sm">
                          Concluída! 🎉
                        </Badge>
                      ) : (
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: goal.color }}>
                          {progress.percentageCompleted}%
                        </span>
                      )}

                      <button
                        onClick={() => {
                          if (confirm(`Excluir a meta "${goal.name}"?`)) {
                            deleteGoal(goal.id);
                          }
                        }}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          color: colors.textMuted,
                        }}
                        title="Remover meta"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Barra de Progresso da Meta */}
                  <div style={{ marginBottom: '10px' }}>
                    <div
                      style={{
                        height: '10px',
                        borderRadius: '9999px',
                        backgroundColor: colors.surfaceElevated,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(progress.percentageCompleted, 100)}%`,
                          backgroundColor: goal.color,
                          borderRadius: '9999px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: colors.textSecondary }}>
                      Acumulado: <strong style={{ color: colors.textPrimary }}>{formatBrlCurrency(goal.currentAmount)}</strong>
                    </span>
                    <span style={{ color: colors.textSecondary }}>
                      Alvo: <strong>{formatBrlCurrency(goal.targetAmount)}</strong> (Falta {formatBrlCurrency(progress.remainingAmount)})
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Seção de Gestão de Categorias */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sub-filtros: Todas, Despesas, Receitas */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCategoryFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: `1px solid ${categoryFilter === 'all' ? colors.primary : colors.border}`,
                  backgroundColor: categoryFilter === 'all' ? `${colors.primary}18` : colors.surfaceElevated,
                  color: categoryFilter === 'all' ? colors.primary : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Todas ({categories.length})
              </button>
              <button
                onClick={() => setCategoryFilter('expense')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: `1px solid ${categoryFilter === 'expense' ? '#EF4444' : colors.border}`,
                  backgroundColor: categoryFilter === 'expense' ? 'rgba(239, 68, 68, 0.12)' : colors.surfaceElevated,
                  color: categoryFilter === 'expense' ? '#EF4444' : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Despesas ({categories.filter(c => c.type === 'expense').length})
              </button>
              <button
                onClick={() => setCategoryFilter('income')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: `1px solid ${categoryFilter === 'income' ? '#10B981' : colors.border}`,
                  backgroundColor: categoryFilter === 'income' ? 'rgba(16, 185, 129, 0.12)' : colors.surfaceElevated,
                  color: categoryFilter === 'income' ? '#10B981' : colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Receitas ({categories.filter(c => c.type === 'income').length})
              </button>
            </div>

            <span style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              Categorias personalizadas podem ser editadas ou excluídas
            </span>
          </div>

          {/* Grid de Categorias */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
            {categories
              .filter(cat => categoryFilter === 'all' || cat.type === categoryFilter)
              .map(cat => {
                const txCount = transactions.filter(t => t.categoryId === cat.id).length;
                return (
                  <Card
                    key={cat.id}
                    style={{
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      borderLeft: `4px solid ${cat.color}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: `${cat.color}22`,
                          color: cat.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconRenderer name={cat.icon} size={22} color={cat.color} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cat.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <Badge variant={cat.type === 'expense' ? 'expense' : 'income'} size="sm">
                            {cat.type === 'expense' ? 'Despesa' : 'Receita'}
                          </Badge>
                          {cat.isCustom ? (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', fontWeight: 600 }}>
                              Personalizada
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: colors.surfaceElevated, color: colors.textMuted, fontWeight: 500 }}>
                              Padrão
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: colors.textSecondary }}>
                            • {txCount} {txCount === 1 ? 'lançamento' : 'lançamentos'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => onEditCategory?.(cat)}
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          color: colors.textSecondary,
                          backgroundColor: colors.surfaceElevated,
                          border: `1px solid ${colors.border}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Editar categoria"
                      >
                        <Edit2 size={14} />
                      </button>

                      {cat.isCustom ? (
                        <button
                          onClick={async () => {
                            const fallbackName = cat.type === 'income' ? 'Outras Receitas' : 'Outras Despesas';
                            const msg = txCount > 0
                              ? `Excluir a categoria personalizada "${cat.name}"?\n\nOs ${txCount} lançamentos vinculados serão reatribuídos com segurança para "${fallbackName}".`
                              : `Deseja realmente excluir a categoria "${cat.name}"?`;
                            if (confirm(msg)) {
                              await deleteCategory(cat.id);
                            }
                          }}
                          style={{
                            padding: '7px',
                            borderRadius: '8px',
                            color: '#EF4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Excluir categoria"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <div style={{ width: '30px' }} />
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
