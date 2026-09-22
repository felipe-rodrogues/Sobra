import React from 'react';
import { DailyBudgetGoalScreen, DailySpendingGoal } from '../../screens/DailyBudgetGoalScreen';
import { BurnRateProjection } from '../../core/calculations';

import { Home, ArrowLeftRight, Target, SlidersHorizontal, Plus } from 'lucide-react';

export type { DailySpendingGoal };

interface DailyBudgetGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  projection: BurnRateProjection;
  currentGoal?: DailySpendingGoal | null;
  onSaveGoalConfig: (goal: DailySpendingGoal) => void;
  onRemoveGoalConfig?: () => void;
  onOpenAiChat?: (prompt?: string) => void;
  onCreateGoal?: () => void;
  initialCadence?: 'daily' | 'weekly';
  onNavigate?: (tab: string) => void;
}

export const DailyBudgetGoalModal: React.FC<DailyBudgetGoalModalProps> = ({
  isOpen,
  onClose,
  projection,
  currentGoal,
  onSaveGoalConfig,
  onRemoveGoalConfig,
  onOpenAiChat,
  onCreateGoal,
  initialCadence = 'weekly',
  onNavigate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        backgroundColor: '#0A0E0C',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(75px + var(--safe-area-bottom, 0px))',
        }}
      >
        <DailyBudgetGoalScreen
          onBack={onClose}
          projection={projection}
          currentGoal={currentGoal}
          onSaveGoalConfig={onSaveGoalConfig}
          onRemoveGoalConfig={onRemoveGoalConfig}
          onOpenAiChat={onOpenAiChat}
          onCreateGoal={onCreateGoal}
          initialCadence={initialCadence}
        />
      </div>

      {/* Barra de Navegação Inferior Docked Fiel ao Mockup */}
      <nav
        className="glass"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(10, 14, 12, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 2100,
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: 'var(--safe-area-bottom, 0px)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 18px 10px',
            position: 'relative',
          }}
        >
          {/* Lado Esquerdo: Início e Transações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate?.('dashboard');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                color: '#64748B',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              <Home size={20} color="#64748B" />
              <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748B' }}>
                Início
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate?.('transactions');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                color: '#64748B',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              <ArrowLeftRight size={20} color="#64748B" />
              <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748B' }}>
                Transações
              </span>
            </button>
          </div>

          {/* Centro: Botão Flutuante Circular Verde (+) do Mockup */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate?.('add_transaction');
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#4ADE80',
                color: '#0A0E0C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(74, 222, 128, 0.5)',
                border: 'none',
                cursor: 'pointer',
                transform: 'translateY(-14px)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title="Adicionar Lançamento"
            >
              <Plus size={26} strokeWidth={2.8} />
            </button>
          </div>

          {/* Lado Direito: Planejamento e Mais */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate?.('budgets');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                color: '#10B981',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              <Target size={20} color="#10B981" />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10B981' }}>
                Planejamento
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate?.('more');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                position: 'relative',
                padding: '4px 6px',
                color: '#64748B',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              <SlidersHorizontal size={20} color="#64748B" />
              <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748B' }}>
                Mais
              </span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};
