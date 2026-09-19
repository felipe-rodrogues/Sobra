import React from 'react';
import { DailyBudgetGoalScreen, DailySpendingGoal } from '../../screens/DailyBudgetGoalScreen';
import { BurnRateProjection } from '../../core/calculations';

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
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        backgroundColor: '#0A0E0C',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
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
      />
    </div>
  );
};
