import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBrlCurrency } from '../../core/parsers/currencyHelper';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose }) => {
  const { saveGoal } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [targetDate, setTargetDate] = useState('');

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
    if (!targetDate) {
      alert('Informe a data limite para a meta.');
      return;
    }

    await saveGoal({
      name: name.trim(),
      targetAmount: target,
      currentAmount: current,
      targetDate,
      color: '#10B981',
      icon: 'Target',
      isCompleted: current >= target,
    });

    setName('');
    setTargetAmountStr('');
    setCurrentAmountStr('');
    setTargetDate('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova Meta Financeira"
      subtitle="Defina seus objetivos e acompanhe o progresso em tempo real"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Nome da Meta *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Reserva de Emergência, Viagem, Carro Novo"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Valor Alvo (R$) *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: 10.000,00"
            value={targetAmountStr}
            onChange={e => setTargetAmountStr(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Valor Já Guardado (R$)
          </label>
          <input
            type="text"
            placeholder="0,00"
            value={currentAmountStr}
            onChange={e => setCurrentAmountStr(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Data Limite *
          </label>
          <input
            type="date"
            required
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Salvar Meta
          </Button>
        </div>
      </form>
    </Modal>
  );
};
