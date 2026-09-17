import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { Budget } from '../../core/types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBudget?: Budget | null;
  onDelete?: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, editingBudget, onDelete }) => {
  const { categories, saveBudget } = useFinance();
  const { colors } = useTheme();

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id || '');
  const [limitStr, setLimitStr] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (editingBudget) {
      setCategoryId(editingBudget.categoryId);
      setLimitStr(editingBudget.monthlyLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      setCategoryId(expenseCategories[0]?.id || '');
      setLimitStr('');
    }
  }, [editingBudget, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseBrlCurrency(limitStr);
    if (!limit || limit <= 0) {
      alert('Informe um limite mensal válido maior que zero.');
      return;
    }

    await saveBudget({
      id: editingBudget?.id,
      categoryId,
      monthlyLimit: limit,
      month: editingBudget ? editingBudget.month : currentMonth,
      year: editingBudget ? editingBudget.year : currentYear,
    });

    setLimitStr('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingBudget ? 'Editar Orçamento' : 'Definir Orçamento'}
      subtitle={`Configure o teto de gastos para o mês corrente (${currentMonth}/${currentYear})`}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Categoria de Despesa *
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            disabled={!!editingBudget}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
              outline: 'none',
              cursor: editingBudget ? 'not-allowed' : 'pointer',
              opacity: editingBudget ? 0.7 : 1,
            }}
          >
            {expenseCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Limite Mensal (R$) *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontWeight: 700, color: colors.primary }}>
              R$
            </span>
            <input
              type="text"
              required
              placeholder="0,00"
              value={limitStr}
              onChange={e => setLimitStr(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '1.25rem',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>
          <p style={{ fontSize: '0.76rem', color: colors.textSecondary, marginTop: '6px' }}>
            O Sobra avisará com calma ao atingir 80% e destacará se o limite for ultrapassado.
          </p>
        </div>

        {editingBudget && onDelete && (
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
            Excluir orçamento
          </button>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px', alignItems: 'center' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {editingBudget ? 'Salvar Alterações' : 'Salvar Orçamento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
