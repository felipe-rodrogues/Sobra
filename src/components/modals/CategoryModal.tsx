import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { IconRenderer } from '../common/IconRenderer';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Category, CategoryType } from '../../core/types';
import { Check } from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit?: Category | null;
}

// 16 cores harmoniosas e modernas para categorias
const PRESET_COLORS = [
  '#10B981', // Emerald
  '#059669', // Green Dark
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#64748B', // Slate
];

// Ícones populares organizados por áreas de vida / finanças
const AVAILABLE_ICONS = [
  // Finanças & Renda
  'Wallet', 'CreditCard', 'Coins', 'TrendingUp', 'PiggyBank', 'Briefcase', 'Receipt', 'DollarSign', 'Gift',
  // Alimentação & Consumo
  'Utensils', 'Coffee', 'ShoppingBag', 'ShoppingCart', 'Store', 'Shirt',
  // Moradia, Contas & Transporte
  'Home', 'Car', 'Fuel', 'Bus', 'Plane', 'Bike', 'Wrench', 'Zap', 'Wifi',
  // Saúde & Bem-Estar
  'Heart', 'Activity', 'Pill', 'Dumbbell', 'Smile', 'Scissors',
  // Lazer, Educação & Tecnologia
  'Film', 'Music', 'Gamepad2', 'Tv', 'BookOpen', 'GraduationCap', 'Laptop', 'Smartphone', 'Sparkles',
  // Família & Diversos
  'Baby', 'Dog', 'Users', 'Award', 'Tag', 'MoreHorizontal'
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categoryToEdit,
}) => {
  const { saveCategory } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('Tag');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (categoryToEdit && isOpen) {
      setName(categoryToEdit.name);
      setType(categoryToEdit.type);
      setColor(categoryToEdit.color || '#3B82F6');
      setIcon(categoryToEdit.icon || 'Tag');
    } else if (isOpen) {
      setName('');
      setType('expense');
      setColor('#3B82F6');
      setIcon('Tag');
    }
  }, [categoryToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome da categoria.');
      return;
    }

    try {
      setIsSubmitting(true);
      await saveCategory({
        ...(categoryToEdit || {}),
        id: categoryToEdit?.id,
        name: name.trim(),
        type,
        color,
        icon,
        isCustom: categoryToEdit ? categoryToEdit.isCustom : true,
      });

      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar categoria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoryToEdit ? 'Editar Categoria' : 'Nova Categoria'}
      subtitle={
        categoryToEdit
          ? 'Personalize o nome, ícone ou cor desta categoria'
          : 'Crie uma categoria personalizada para organizar seus lançamentos'
      }
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Preview ao Vivo do Crachá */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: `${color}14`,
            border: `1px solid ${color}35`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.25s ease',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: `${color}25`,
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${color}20`,
              transition: 'all 0.25s ease',
            }}
          >
            <IconRenderer name={icon} size={24} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: color, fontWeight: 700 }}>
              Pré-visualização
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name.trim() || 'Nome da Categoria'}
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
              {type === 'expense' ? 'Despesa' : 'Receita'} • {categoryToEdit ? (categoryToEdit.isCustom ? 'Personalizada' : 'Padrão do Sistema') : 'Personalizada'}
            </div>
          </div>
        </div>

        {/* Tipo de Categoria: Despesa vs Receita */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: colors.textSecondary, marginBottom: '6px', fontWeight: 600 }}>
            Tipo de Movimentação *
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              backgroundColor: colors.surfaceElevated,
              padding: '4px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (!categoryToEdit && color === '#10B981') setColor('#EF4444');
              }}
              style={{
                padding: '9px',
                borderRadius: '9px',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                backgroundColor: type === 'expense' ? '#EF4444' : 'transparent',
                color: type === 'expense' ? '#FFFFFF' : colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                if (!categoryToEdit && color === '#EF4444') setColor('#10B981');
              }}
              style={{
                padding: '9px',
                borderRadius: '9px',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                backgroundColor: type === 'income' ? '#10B981' : 'transparent',
                color: type === 'income' ? '#FFFFFF' : colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Receita
            </button>
          </div>
        </div>

        {/* Nome da Categoria */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: colors.textSecondary, marginBottom: '6px', fontWeight: 600 }}>
            Nome da Categoria *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Assinaturas & Streaming, Pets, Farmácia, Bicos"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          />
        </div>

        {/* Paleta de Cores */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.82rem', color: colors.textSecondary, fontWeight: 600 }}>
              Cor de Identificação
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: colors.primary,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <span>Personalizada</span>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '8px',
            }}
          >
            {PRESET_COLORS.map(c => {
              const isSelected = color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '8px',
                    backgroundColor: c,
                    border: isSelected ? '2px solid #FFFFFF' : '2px solid transparent',
                    outline: isSelected ? `2px solid ${c}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? `0 2px 8px ${c}60` : 'none',
                  }}
                  title={c}
                >
                  {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seletor de Ícones */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: colors.textSecondary, marginBottom: '8px', fontWeight: 600 }}>
            Ícone Representativo
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              maxHeight: '170px',
              overflowY: 'auto',
              padding: '8px',
              borderRadius: '12px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
            }}
          >
            {AVAILABLE_ICONS.map(iconName => {
              const isSelected = icon === iconName;
              return (
                <button
                  type="button"
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? `${color}30` : 'transparent',
                    border: isSelected ? `2px solid ${color}` : `1px solid transparent`,
                    color: isSelected ? color : colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={iconName}
                >
                  <IconRenderer name={iconName} size={20} color={isSelected ? color : undefined} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <Button
            type="button"
            variant="ghost"
            style={{ flex: 1 }}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            style={{ flex: 2 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : categoryToEdit ? 'Salvar Alterações' : 'Criar Categoria'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
