import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { Goal } from '../../core/types';

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
  const { saveGoal } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState('#10B981');

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmountStr(editingGoal.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setCurrentAmountStr(editingGoal.currentAmount ? editingGoal.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      setTargetDate(editingGoal.targetDate ? editingGoal.targetDate.substring(0, 10) : '');
      setSelectedColor(editingGoal.color || '#10B981');
    } else {
      setName('');
      setTargetAmountStr('');
      setCurrentAmountStr('');
      setTargetDate('');
      setSelectedColor('#10B981');
    }
  }, [editingGoal, isOpen]);

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
      id: editingGoal?.id,
      name: name.trim(),
      targetAmount: target,
      currentAmount: current,
      targetDate,
      color: selectedColor,
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
