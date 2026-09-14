/**
 * Sobra - Paleta de Cores e Tokens de Design
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  border: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  
  // Cores de Ação e Feedback
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  
  // Status financeiro
  income: string;
  incomeBg: string;
  expense: string;
  expenseBg: string;
  
  // Alertas de orçamento
  budgetNormal: string;
  budgetWarning: string;
  budgetDanger: string;
  budgetDangerBg: string;
  
  cardShadow: string;
}

export const darkTheme: ThemeColors = {
  background: '#0A0E0C',
  surface: '#131915',
  surfaceElevated: '#1A231C',
  surfaceGlass: 'rgba(19, 25, 21, 0.82)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderFocus: '#4ADE80',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
  primary: '#22C55E',        // Verde esmeralda vivo do logotipo
  primaryLight: '#4ADE80',
  primaryDark: '#16A34A',
  secondary: '#10B981',      // Verde menta
  
  income: '#22C55E',
  incomeBg: 'rgba(34, 197, 94, 0.12)',
  expense: '#F43F5E',        // Rose / Coral vibrante
  expenseBg: 'rgba(244, 63, 94, 0.12)',
  
  budgetNormal: '#22C55E',
  budgetWarning: '#F59E0B',
  budgetDanger: '#EF4444',
  budgetDangerBg: 'rgba(239, 68, 68, 0.15)',
  
  cardShadow: '0 12px 36px 0 rgba(0, 0, 0, 0.55)',
};

export const lightTheme: ThemeColors = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  border: '#E2E8F0',
  borderFocus: '#0284C7',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  
  primary: '#059669',
  primaryLight: '#10B981',
  primaryDark: '#047857',
  secondary: '#4F46E5',
  
  income: '#059669',
  incomeBg: 'rgba(5, 150, 105, 0.10)',
  expense: '#E11D48',
  expenseBg: 'rgba(225, 29, 72, 0.10)',
  
  budgetNormal: '#059669',
  budgetWarning: '#D97706',
  budgetDanger: '#DC2626',
  budgetDangerBg: 'rgba(220, 38, 38, 0.12)',
  
  cardShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
};
