import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBrlCurrency } from '../../core/parsers/currencyHelper';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose }) => {
  const { categories, saveBudget } = useFinance();
  const { colors } = useTheme();

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id || '');
  const [limitStr, setLimitStr] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseBrlCurrency(limitStr);
    if (!limit || limit <= 0) {
      alert('Informe um limite mensal válido maior que zero.');
      return;
    }

    await saveBudget({
      categoryId,
      monthlyLimit: limit,
      month: currentMonth,
      year: currentYear,
    });

    setLimitStr('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definir Orçamento Mensal"
      subtitle={`Configure o limite de gastos para o mês corrente (${currentMonth}/${currentYear})`}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Categoria de Despesa *
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
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
              placeholder="Ex: 500,00"
              value={limitStr}
              onChange={e => setLimitStr(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '1.25rem',
                fontWeight: 700,
              }}
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '6px' }}>
            O app alertará quando atingir 80% do limite e emitirá aviso em destaque ao ultrapassar 100%.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Salvar Orçamento
          </Button>
        </div>
      </form>
    </Modal>
  );
};
