import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Switch } from '../common/Switch';
import { IconRenderer } from '../common/IconRenderer';
import { BankLogo } from '../common/BankLogo';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { parseBrlCurrency, formatBrlCurrency, formatCurrencyInput } from '../../core/parsers/currencyHelper';
import { Goal } from '../../core/types';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';
import { 
  Calendar, 
  Zap, 
  Users,
  X,
  Pencil,
  ChevronDown,
  Check,
  Wallet,
  Trash2,
  Sparkles
} from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGoal?: Goal | null;
  onDelete?: () => void;
  initialIsShared?: boolean;
}

const PRESET_COLORS = [
  '#4ADE80', // Verde Esmeralda Sobra
  '#38BDF8', // Azul Celeste
  '#A855F7', // Roxo Moderno
  '#F59E0B', // Âmbar Quente
  '#EC4899', // Rosa Intenso
  '#6366F1', // Indigo
];

const AVAILABLE_GOAL_ICONS = [
  // Metas clássicas, financeiras & conquistas
  'Target', 'Flag', 'Trophy', 'Award', 'Rocket', 'Sparkles',
  // Reserva & Investimentos
  'Shield', 'ShieldCheck', 'Lock', 'Coins', 'PiggyBank', 'Wallet', 'TrendingUp', 'Landmark',
  // Bens, Compras & Casa
  'Home', 'Car', 'Smartphone', 'Laptop', 'Gamepad2', 'Tv', 'Watch', 'Key',
  // Viagem & Experiências
  'Plane', 'Palmtree', 'MapPin', 'Ticket', 'Luggage', 'Camera', 'Compass',
  // Vida, Família & Educação
  'GraduationCap', 'BookOpen', 'Heart', 'Baby', 'Users', 'Gift',
];

export const GoalModal: React.FC<GoalModalProps> = ({ 
  isOpen, 
  onClose, 
  editingGoal, 
  onDelete, 
  initialIsShared 
}) => {
  const { 
    saveGoal, 
    transactions, 
    isPartnershipActive,
    partnershipSpace,
    accounts,
  } = useFinance();
  const { user } = useAuth();

  const validAccounts = useMemo(() => accounts.filter(a => a.type !== 'credit_card'), [accounts]);

  const isOwner = !partnershipSpace?.ownerId || partnershipSpace.ownerId === user?.id;
  const partnerName = isOwner ? (partnershipSpace?.partnerName || 'Parceiro(a)') : (partnershipSpace?.ownerName || 'Parceiro(a)');

  // Campos do formulário da meta
  const [name, setName] = useState(() => editingGoal?.name || '');
  const [targetAmountStr, setTargetAmountStr] = useState(() => (
    editingGoal ? formatCurrencyInput(editingGoal.targetAmount) : ''
  ));
  const [isTargetAmountFocused, setIsTargetAmountFocused] = useState(false);
  const [currentAmountStr, setCurrentAmountStr] = useState(() => (
    editingGoal?.currentAmount ? formatCurrencyInput(editingGoal.currentAmount) : ''
  ));
  const [hasDeadline, setHasDeadline] = useState(() => Boolean(editingGoal?.targetDate));
  const [targetDate, setTargetDate] = useState(() => (
    editingGoal?.targetDate ? editingGoal.targetDate.substring(0, 10) : ''
  ));
  const [selectedColor, setSelectedColor] = useState(() => editingGoal?.color || '#4ADE80');
  const [selectedIcon, setSelectedIcon] = useState(() => editingGoal?.icon || 'Target');
  const [isCustomizingVisual, setIsCustomizingVisual] = useState(false);
  const [autoContributionEnabled, setAutoContributionEnabled] = useState(() => Boolean(editingGoal?.autoContributionEnabled));
  const [monthlyContributionAmountStr, setMonthlyContributionAmountStr] = useState(() => (
    editingGoal?.monthlyContributionAmount
      ? formatCurrencyInput(editingGoal.monthlyContributionAmount)
      : ''
  ));
  const [defaultAccountId, setDefaultAccountId] = useState(() => (
    editingGoal?.defaultAccountId || validAccounts[0]?.id || ''
  ));
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [isShared, setIsShared] = useState(() => (
    editingGoal?.isShared !== undefined ? editingGoal.isShared : Boolean(initialIsShared)
  ));

  const targetInputRef = useRef<HTMLInputElement>(null);
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  const selectedDepositAccount = useMemo(
    () => validAccounts.find(a => a.id === defaultAccountId),
    [validAccounts, defaultAccountId]
  );

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

  const prevIsOpenRef = useRef(false);
  const prevGoalIdRef = useRef<string | undefined>(undefined);

  // Sincroniza dados da meta ao abrir ou trocar de meta
  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevIsOpenRef.current;
    const isGoalChanged = editingGoal?.id !== prevGoalIdRef.current;
    prevIsOpenRef.current = isOpen;
    prevGoalIdRef.current = editingGoal?.id;

    if (!isOpen) return;
    if (!isTransitionToOpen && !isGoalChanged) return;

    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmountStr(formatCurrencyInput(editingGoal.targetAmount));
      setCurrentAmountStr(editingGoal.currentAmount ? formatCurrencyInput(editingGoal.currentAmount) : '');
      const rawDate = editingGoal.targetDate ? editingGoal.targetDate.substring(0, 10) : '';
      setTargetDate(rawDate);
      setHasDeadline(Boolean(rawDate));
      setSelectedColor(editingGoal.color || '#4ADE80');
      setSelectedIcon(editingGoal.icon || 'Target');
      setIsCustomizingVisual(false);
      setAutoContributionEnabled(Boolean(editingGoal.autoContributionEnabled));
      setMonthlyContributionAmountStr(
        editingGoal.monthlyContributionAmount
          ? formatCurrencyInput(editingGoal.monthlyContributionAmount)
          : ''
      );
      setDefaultAccountId(editingGoal.defaultAccountId || validAccounts[0]?.id || '');
      setIsAccountPickerOpen(false);
      setIsShared(editingGoal.isShared !== undefined ? editingGoal.isShared : Boolean(initialIsShared));
    } else {
      setName('');
      setTargetAmountStr('');
      setCurrentAmountStr('');
      setTargetDate('');
      setHasDeadline(false);
      setSelectedColor('#4ADE80');
      setSelectedIcon('Target');
      setIsCustomizingVisual(false);
      setAutoContributionEnabled(false);
      setMonthlyContributionAmountStr('');
      setDefaultAccountId(validAccounts[0]?.id || '');
      setIsAccountPickerOpen(false);
      setIsShared(initialIsShared !== undefined ? initialIsShared : false);
    }
  }, [editingGoal, isOpen, initialIsShared, validAccounts]);

  // Bloqueio de scroll do body e listener de Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  const swipeState = useSwipeBack({
    onBack: onClose,
    enabled: isOpen,
  });

  // Cálculos automáticos de ritmo de economia necessária
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
      icon: selectedIcon || 'Target',
      isCompleted: (editingGoal ? editingGoal.currentAmount : initialCurrent) >= target,
      autoContributionEnabled,
      monthlyContributionAmount: monthlyAmount,
      defaultAccountId: defaultAccountId || undefined,
      isShared: isPartnershipActive ? isShared : (editingGoal?.isShared || false),
      ownerId: isShared ? (editingGoal?.ownerId || user?.id || 'current-user') : undefined,
      ownerName: isShared ? (editingGoal?.ownerName || user?.displayName || 'Você') : undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div
        data-modal-backdrop="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
          boxSizing: 'border-box',
        }}
        onClick={onClose}
      >
        <div
          className="animate-slide-up"
          style={{
            backgroundColor: '#0A0E0C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: 'calc(100dvh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 32px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Superior Limpo Padrão Pierre */}
          <div
            style={{
              padding: '16px 20px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selectedColor || '#4ADE80',
                }}
              >
                <IconRenderer name={selectedIcon || 'Target'} size={15} color={selectedColor || '#4ADE80'} />
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                {editingGoal ? 'Configurações da Meta' : 'Nova Meta'}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                color: '#94A3B8',
                backgroundColor: '#161F18',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#94A3B8';
              }}
              title="Fechar"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo do Formulário */}
          <form
            onSubmit={handleSubmitSettings}
            style={{
              padding: '20px 20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              overflowY: 'auto',
            }}
          >
            {/* 1. Nome da Meta + Avatar Customizável de Ícone e Cor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCustomizingVisual(prev => !prev)}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: isCustomizingVisual ? `1.5px solid ${selectedColor}` : '1px solid rgba(255, 255, 255, 0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                  title="Personalizar ícone e cor"
                >
                  <IconRenderer name={selectedIcon || 'Target'} size={22} color={selectedColor} />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-3px',
                      right: '-3px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#1E2620',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                    }}
                  >
                    <Pencil size={9} />
                  </span>
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    required
                    placeholder="Nome da meta (ex: PlayStation)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.09)',
                      color: '#FFFFFF',
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.4)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)')}
                  />
                </div>
              </div>

              {/* Painel Expansível de Ícone e Cor */}
              {isCustomizingVisual && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '16px',
                    backgroundColor: '#111519',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Seletor de Cores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Cor de Destaque
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {PRESET_COLORS.map(color => {
                        const isSelected = selectedColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              border: isSelected ? '2.5px solid #FFFFFF' : 'none',
                              boxShadow: isSelected ? `0 0 10px ${color}80` : 'none',
                              cursor: 'pointer',
                              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Grade de Ícones Curados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Ícone
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCustomizingVisual(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4ADE80',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Pronto
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: '6px',
                        maxHeight: '130px',
                        overflowY: 'auto',
                        padding: '4px',
                      }}
                    >
                      {AVAILABLE_GOAL_ICONS.map(iconName => {
                        const isSelected = selectedIcon === iconName;
                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => setSelectedIcon(iconName)}
                            style={{
                              aspectRatio: '1',
                              borderRadius: '9px',
                              backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                              border: isSelected ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <IconRenderer name={iconName} size={16} color={isSelected ? selectedColor : '#94A3B8'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Hero do Valor Alvo: Cápsula Interativa Centralizada */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: '8px',
                padding: '4px 0',
              }}
            >
              <span
                style={{
                  fontSize: '0.68rem',
                  color: '#64748B',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'center',
                }}
              >
                Valor Alvo da Meta
              </span>

              <div
                onClick={() => targetInputRef.current?.focus()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 20px',
                  borderRadius: '20px',
                  backgroundColor: isTargetAmountFocused
                    ? 'rgba(74, 222, 128, 0.06)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isTargetAmountFocused
                    ? '1px solid rgba(74, 222, 128, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.09)',
                  boxShadow: isTargetAmountFocused
                    ? '0 0 24px rgba(74, 222, 128, 0.14)'
                    : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'text',
                  gap: '6px',
                  margin: '0 auto',
                }}
              >
                <span
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: '#64748B',
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    userSelect: 'none',
                    lineHeight: 1,
                  }}
                >
                  R$
                </span>
                <input
                  ref={targetInputRef}
                  type="text"
                  inputMode="numeric"
                  required
                  value={targetAmountStr}
                  onChange={e => setTargetAmountStr(formatCurrencyInput(e.target.value, targetAmountStr))}
                  onFocus={() => setIsTargetAmountFocused(true)}
                  onBlur={() => setIsTargetAmountFocused(false)}
                  placeholder="0,00"
                  style={{
                    width: `${Math.max(3, (targetAmountStr || '0,00').length + 0.3)}ch`,
                    minWidth: '60px',
                    maxWidth: '220px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: (parseBrlCurrency(targetAmountStr) || 0) > 0 ? '#4ADE80' : '#E2E8F0',
                    fontSize: '2.1rem',
                    fontWeight: 800,
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    textAlign: 'center',
                    outline: 'none',
                    padding: 0,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                />
              </div>

              {/* Se for criação de nova meta, campo sutil de valor inicial já guardado */}
              {!editingGoal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Já guardado:</span>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={currentAmountStr}
                      onChange={e => setCurrentAmountStr(formatCurrencyInput(e.target.value, currentAmountStr))}
                      placeholder="0,00"
                      style={{
                        width: '70px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#FFFFFF',
                        fontSize: '0.80rem',
                        fontWeight: 600,
                        outline: 'none',
                        padding: 0,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Card de Prazo da Meta */}
            <div
              style={{
                backgroundColor: '#12161B',
                borderRadius: '18px',
                padding: '14px 16px',
                border: hasDeadline ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: hasDeadline ? '#38BDF8' : '#CBD5E1',
                      flexShrink: 0,
                    }}
                  >
                    <Calendar size={17} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Definir prazo
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#8E8E93' }}>
                      {hasDeadline && targetDate
                        ? new Date(targetDate + 'T23:59:59').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Sem data limite definida'}
                    </span>
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
                    gap: '8px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <input
                    type="date"
                    required={hasDeadline}
                    min={todayStr}
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38BDF8',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />

                  {rhythmPreview && !rhythmPreview.isPast && rhythmPreview.monthlySavings > 0 && (
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      Ritmo sugerido: <strong style={{ color: '#38BDF8', fontWeight: 600 }}>{formatBrlCurrency(rhythmPreview.monthlySavings)}/mês</strong> ({formatBrlCurrency(rhythmPreview.dailySavings)}/dia)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4. Card de Aporte Automático Mensal */}
            <div
              style={{
                backgroundColor: '#12161B',
                borderRadius: '18px',
                padding: '14px 16px',
                border: autoContributionEnabled ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: autoContributionEnabled ? '#4ADE80' : '#CBD5E1',
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={17} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Aporte automático mensal
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#8E8E93' }}>
                      {autoContributionEnabled
                        ? 'Reserva programada todo mês'
                        : 'Desativado'}
                    </span>
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
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                    Valor mensal:
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(74, 222, 128, 0.06)',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      borderRadius: '8px',
                      padding: '4px 10px',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: '#4ADE80', fontWeight: 700 }}>R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required={autoContributionEnabled}
                      placeholder="0,00"
                      value={monthlyContributionAmountStr}
                      onChange={e => setMonthlyContributionAmountStr(formatCurrencyInput(e.target.value, monthlyContributionAmountStr))}
                      style={{
                        width: '90px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#4ADE80',
                        fontSize: '0.94rem',
                        fontWeight: 700,
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        outline: 'none',
                        padding: 0,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 5. Seletor de Conta de Débito (Padrão Pierre, Sem Select Nativo) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#64748B',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Debitar da Conta
                </span>
                <span
                  style={{
                    fontSize: '0.64rem',
                    color: '#4ADE80',
                    fontWeight: 600,
                    backgroundColor: 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  Padrão da meta
                </span>
              </div>

              {validAccounts.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIsAccountPickerOpen(prev => !prev)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      backgroundColor: isAccountPickerOpen ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                      border: isAccountPickerOpen ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      {selectedDepositAccount ? (
                        <BankLogo bankId={selectedDepositAccount.bankId} size={24} />
                      ) : (
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '7px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748B',
                            flexShrink: 0,
                          }}
                        >
                          <Wallet size={14} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: selectedDepositAccount ? '#FFFFFF' : '#E2E8F0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}
                        >
                          {selectedDepositAccount ? selectedDepositAccount.name : 'Nenhuma conta'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.70rem',
                            color: '#64748B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}
                        >
                          {selectedDepositAccount ? (
                            <>Saldo disponível: <strong style={{ color: selectedDepositAccount.balance >= 0 ? '#94A3B8' : '#EF4444', fontWeight: 600 }}>{formatBrlCurrency(selectedDepositAccount.balance)}</strong></>
                          ) : (
                            'Não debitar do saldo bancário'
                          )}
                        </span>
                      </div>
                    </div>

                    <ChevronDown
                      size={16}
                      color="#94A3B8"
                      style={{
                        transform: isAccountPickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {isAccountPickerOpen && (
                    <div
                      style={{
                        marginTop: '6px',
                        backgroundColor: '#111519',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {validAccounts.map(acc => {
                        const isSelected = acc.id === defaultAccountId;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setDefaultAccountId(acc.id);
                              setIsAccountPickerOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : 'transparent',
                              border: 'none',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              cursor: 'pointer',
                              transition: 'background-color 0.12s ease',
                              textAlign: 'left',
                              width: '100%',
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <BankLogo bankId={acc.bankId} size={22} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                                  {acc.name}
                                </span>
                                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                                  {formatBrlCurrency(acc.balance)}
                                </span>
                              </div>
                            </div>

                            {isSelected && <Check size={16} color="#4ADE80" />}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setDefaultAccountId('');
                          setIsAccountPickerOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: !defaultAccountId ? 'rgba(74, 222, 128, 0.08)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.12s ease',
                          textAlign: 'left',
                          width: '100%',
                        }}
                        onMouseEnter={e => {
                          if (defaultAccountId) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        }}
                        onMouseLeave={e => {
                          if (defaultAccountId) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748B',
                              flexShrink: 0,
                            }}
                          >
                            <Wallet size={12} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                              Nenhuma conta
                            </span>
                            <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                              Não debitar do saldo bancário
                            </span>
                          </div>
                        </div>

                        {!defaultAccountId && <Check size={16} color="#4ADE80" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                    fontSize: '0.76rem',
                    color: '#64748B',
                  }}
                >
                  Nenhuma conta cadastrada.
                </div>
              )}
            </div>

            {/* 6. Meta Conjunta (Finanças a Dois) */}
            {(isPartnershipActive || isShared) && (
              <div
                style={{
                  backgroundColor: '#12161B',
                  borderRadius: '18px',
                  padding: '14px 16px',
                  border: isShared ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isShared ? '#4ADE80' : '#CBD5E1',
                      flexShrink: 0,
                    }}
                  >
                    <Users size={17} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Meta Conjunta
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#8E8E93' }}>
                      {partnerName !== 'Parceiro(a)' 
                        ? `Compartilhar com ${partnerName}`
                        : 'Espaço compartilhado a dois'
                      }
                    </span>
                  </div>
                </div>

                <Switch
                  checked={isShared}
                  onChange={setIsShared}
                  activeColor="#4ADE80"
                />
              </div>
            )}

            {/* 7. Botão Principal Full-Width (Padrão Pierre) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={!name.trim() || (parseBrlCurrency(targetAmountStr) || 0) <= 0}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '14px',
                  backgroundColor: name.trim() && (parseBrlCurrency(targetAmountStr) || 0) > 0 ? '#4ADE80' : 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  color: name.trim() && (parseBrlCurrency(targetAmountStr) || 0) > 0 ? '#0A0E0C' : '#64748B',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  cursor: name.trim() && (parseBrlCurrency(targetAmountStr) || 0) > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: name.trim() && (parseBrlCurrency(targetAmountStr) || 0) > 0 ? '0 4px 18px rgba(74, 222, 128, 0.25)' : 'none',
                }}
                onMouseEnter={e => {
                  if (name.trim() && (parseBrlCurrency(targetAmountStr) || 0) > 0) {
                    e.currentTarget.style.backgroundColor = '#3cd073';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (name.trim() && (parseBrlCurrency(targetAmountStr) || 0) > 0) {
                    e.currentTarget.style.backgroundColor = '#4ADE80';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
              </button>

              {/* Ação Destrutiva Sutil */}
              {editingGoal && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#64748B',
                    fontSize: '0.80rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#FB7185';
                    e.currentTarget.style.backgroundColor = 'rgba(251, 113, 133, 0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#64748B';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={13} />
                  <span>Excluir meta</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
