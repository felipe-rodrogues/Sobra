/**
 * Sobra AI - Tipos e Modelos de Domínio da Inteligência Financeira
 */

export type SobraScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
export type SobraScoreStatus = 'excelente' | 'bom' | 'atencao' | 'critico';

export type SobraPillarType = 'savings' | 'credit_cards' | 'budgets' | 'liquidity';

export interface SobraHealthPillar {
  type: SobraPillarType;
  name: string;
  weight: number; // Peso percentual (ex: 0.30)
  score: number;  // 0 a 100
  status: SobraScoreStatus;
  headline: string;
  metricLabel: string;
  metricValue: string;
  feedback: string;
}

export interface SobraHealthScore {
  overallScore: number; // 0 a 100
  grade: SobraScoreGrade;
  status: SobraScoreStatus;
  headline: string;
  summary: string;
  pillars: SobraHealthPillar[];
}

export type SobraInsightSeverity = 'critical' | 'warning' | 'opportunity' | 'achievement' | 'pattern';

export type SobraInsightCategory = 
  | 'liquidity' 
  | 'anomaly' 
  | 'credit' 
  | 'subscription' 
  | 'pattern' 
  | 'goal' 
  | 'achievement'
  | 'opportunity';

export interface SobraAction {
  label: string;
  actionType: 'navigate_tab' | 'open_modal' | 'custom';
  target: string; // Ex: 'accounts', 'budgets', 'transactions', 'subscriptions'
  params?: Record<string, any>;
}

export interface SobraInsight {
  id: string;
  category: SobraInsightCategory;
  severity: SobraInsightSeverity;
  title: string;
  message: string;
  highlightValue?: string;
  iconName: string;
  accentColor: string;
  action?: SobraAction;
  scoreImpact?: number;
  metadata?: Record<string, any>;
}

export interface SobraStrategicStep {
  stepNumber: number;
  title: string;
  description: string;
  estimatedImpact?: string; // Ex: "+R$ 250,00 de sobra"
  action?: SobraAction;
}

export interface SobraSpendingPattern {
  weekendExpenseRatio: number; // Percentual de gastos em sextas, sábados e domingos (ex: 48%)
  peakDayName: string; // Ex: 'Sábado'
  topSpikeCategory?: {
    categoryId: string;
    categoryName: string;
    currentMonthAmount: number;
    baselineAverage: number;
    percentageIncrease: number;
  };
}

export type FinancialStage = 'debt_relief' | 'emergency_fund' | 'wealth_building';

export interface FinancialLadderCheckpoint {
  id: string;
  name: string; // Ex: 'Tampão (1m)', 'Estabilidade (3m)', 'Blindagem (6m)'
  targetMonths: number; // 1, 3, 6
  targetAmount: number;
  isReached: boolean;
}

export interface FinancialLadderProgress {
  currentStage: FinancialStage;
  stageNumber: 1 | 2 | 3;
  stageTitle: string;
  stageBadge: string;
  headline: string;
  summary: string;
  
  // Métricas da Reserva e Custo de Vida
  monthlyLivingCost: number;
  emergencyFundCurrent: number;
  emergencyFundTarget: number;
  monthsProtected: number;
  percentProgress: number;
  checkpoints: FinancialLadderCheckpoint[];
  nextMilestoneLabel: string;
  
  // Detalhes se estiver no Degrau 1
  debtAlertDetails?: {
    negativeAccountsCount: number;
    negativeBalanceTotal: number;
    overdueCardsCount: number;
    uncoveredInvoicesAmount: number;
  };
  
  // Destaques do Degrau 3
  wealthHighlights?: {
    totalInvested: number;
    activeGoalsCount: number;
  };
}

export interface SobraFullDiagnosis {
  generatedAt: string;
  score: SobraHealthScore;
  ladder: FinancialLadderProgress;
  insights: SobraInsight[];
  strengths: string[];
  vulnerabilities: string[];
  pattern: SobraSpendingPattern;
  actionPlan: SobraStrategicStep[];
}
