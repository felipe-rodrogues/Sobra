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

export interface SobraFullDiagnosis {
  generatedAt: string;
  score: SobraHealthScore;
  insights: SobraInsight[];
  strengths: string[];
  vulnerabilities: string[];
  pattern: SobraSpendingPattern;
  actionPlan: SobraStrategicStep[];
}
