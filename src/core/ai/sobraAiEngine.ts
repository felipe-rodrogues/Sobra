/**
 * Sobra AI - Motor Puro de Inteligência Financeira e Diagnósticos Ativos
 * Processamento 100% local, heurístico, estatístico e privado.
 */

import { 
  Account, 
  Transaction, 
  Budget, 
  Category, 
  Goal, 
  Subscription 
} from '../types';
import { 
  calculateFinancialSummary, 
  calculateMonthlySummary, 
  calculateBudgetStatuses, 
  filterTransactionsByMonth 
} from '../calculations';
import { formatBrlCurrency } from '../parsers/currencyHelper';
import { 
  SobraHealthScore, 
  SobraHealthPillar, 
  SobraInsight, 
  SobraFullDiagnosis, 
  SobraSpendingPattern, 
  SobraStrategicStep,
  SobraScoreGrade,
  SobraScoreStatus 
} from './types';

export class SobraAiEngine {
  /**
   * Calcula o Sobra Health Score (0 a 100) ponderado em 4 pilares estratégicos.
   */
  public calculateHealthScore(
    accounts: Account[],
    transactions: Transaction[],
    budgets: Budget[],
    subscriptions: Subscription[],
    referenceDate: Date = new Date()
  ): SobraHealthScore {
    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();

    const monthlySummary = calculateMonthlySummary(transactions, month, year);
    const financialSummary = calculateFinancialSummary(accounts);

    // --- PILAR 1: TAXA DE POUPANÇA / SOBRA LÍQUIDA (Peso 30%) ---
    let savingsScore = 50;
    let savingsStatus: SobraScoreStatus = 'bom';
    let savingsHeadline = 'Equilíbrio Financeiro';
    let savingsRate = 0;

    if (monthlySummary.income > 0) {
      savingsRate = (monthlySummary.income - monthlySummary.expense) / monthlySummary.income;
      if (savingsRate >= 0.25) {
        savingsScore = 100;
        savingsStatus = 'excelente';
        savingsHeadline = 'Poupança de Alto Nível (≥ 25%)';
      } else if (savingsRate >= 0.15) {
        savingsScore = Math.round(80 + ((savingsRate - 0.15) / 0.10) * 20);
        savingsStatus = 'bom';
        savingsHeadline = 'Boa Sobra Mensal (15% a 25%)';
      } else if (savingsRate >= 0.0) {
        savingsScore = Math.round(50 + (savingsRate / 0.15) * 30);
        savingsStatus = 'atencao';
        savingsHeadline = 'Margem Apertada de Sobra (< 15%)';
      } else {
        // Déficit
        savingsScore = Math.max(10, Math.round(50 - Math.abs(savingsRate) * 50));
        savingsStatus = 'critico';
        savingsHeadline = 'Déficit no Mês (Despesas > Receitas)';
      }
    } else if (monthlySummary.expense > 0) {
      savingsScore = 25;
      savingsStatus = 'critico';
      savingsHeadline = 'Sem Receitas Registradas no Mês';
    } else {
      savingsScore = 65;
      savingsStatus = 'bom';
      savingsHeadline = 'Aguardando Lançamentos do Mês';
    }

    const savingsPillar: SobraHealthPillar = {
      type: 'savings',
      name: 'Sobra & Poupança',
      weight: 0.30,
      score: savingsScore,
      status: savingsStatus,
      headline: savingsHeadline,
      metricLabel: 'Taxa de Sobra',
      metricValue: `${Math.round(savingsRate * 100)}% da renda`,
      feedback: savingsScore >= 80 
        ? 'Excelente disciplina de retenção de capital. Você está mantendo uma sobra superior à média nacional.'
        : savingsScore >= 50
        ? 'Você está no azul, mas pequenas reduções em gastos não essenciais aumentarão seu colchão de segurança.'
        : 'Atenção: seus gastos estão superando suas entradas este mês. Revise saídas variáveis imediatamente.',
    };

    // --- PILAR 2: SAÚDE E ALAVANCAGEM DO CARTÃO DE CRÉDITO (Peso 25%) ---
    let creditScore = 85;
    let creditStatus: SobraScoreStatus = 'excelente';
    let creditHeadline = 'Cartões Sob Controle';
    const creditCards = accounts.filter(a => a.type === 'credit_card');
    const totalCreditLimit = creditCards.reduce((acc, c) => acc + (c.creditLimit || 0), 0);
    const totalCreditDebt = financialSummary.creditCardDebt;
    let utilizationRate = 0;

    if (totalCreditLimit > 0) {
      utilizationRate = totalCreditDebt / totalCreditLimit;
      if (utilizationRate <= 0.30) {
        creditScore = 100;
        creditStatus = 'excelente';
        creditHeadline = 'Uso Ideal de Limite (≤ 30%)';
      } else if (utilizationRate <= 0.50) {
        creditScore = Math.round(80 - ((utilizationRate - 0.30) / 0.20) * 15);
        creditStatus = 'bom';
        creditHeadline = 'Uso Moderado (30% a 50%)';
      } else if (utilizationRate <= 0.75) {
        creditScore = Math.round(65 - ((utilizationRate - 0.50) / 0.25) * 25);
        creditStatus = 'atencao';
        creditHeadline = 'Limite Comprometido (50% a 75%)';
      } else {
        creditScore = Math.max(10, Math.round(40 - ((utilizationRate - 0.75) / 0.25) * 30));
        creditStatus = 'critico';
        creditHeadline = 'Alavancagem Alta (> 75% do Limite)';
      }
    } else if (creditCards.length > 0 && totalCreditDebt > 0) {
      creditScore = 60;
      creditStatus = 'atencao';
      creditHeadline = 'Faturas Ativas Sem Limite Cadastrado';
    }

    const creditPillar: SobraHealthPillar = {
      type: 'credit_cards',
      name: 'Cartões & Dívida',
      weight: 0.25,
      score: creditScore,
      status: creditStatus,
      headline: creditHeadline,
      metricLabel: 'Comprometimento de Limite',
      metricValue: totalCreditLimit > 0 ? `${Math.round(utilizationRate * 100)}% do limite` : formatBrlCurrency(totalCreditDebt),
      feedback: creditScore >= 80
        ? 'Alavancagem saudável. Seus cartões estão sendo usados como meio de conveniência, sem risco de rotativo.'
        : creditScore >= 50
        ? 'O comprometimento de limite começou a subir. Evite parcelamentos adicionais nas próximas semanas.'
        : 'Risco de endividamento: mais de 75% do limite está ocupado. Priorize amortizar faturas abertas.',
    };

    // --- PILAR 3: DISCIPLINA DE ORÇAMENTOS (Peso 25%) ---
    let budgetScore = 75;
    let budgetStatus: SobraScoreStatus = 'bom';
    let budgetHeadline = 'Planejamento Regular';
    const activeBudgets = budgets.filter(b => b.month === month && b.year === year);

    if (activeBudgets.length > 0) {
      const budgetStatuses = calculateBudgetStatuses(budgets, [], transactions, month, year);
      const dangerCount = budgetStatuses.filter(b => b.status === 'danger').length;
      const warningCount = budgetStatuses.filter(b => b.status === 'warning').length;

      if (dangerCount === 0 && warningCount === 0) {
        budgetScore = 100;
        budgetStatus = 'excelente';
        budgetHeadline = 'Todos Orçamentos Respeitados';
      } else if (dangerCount === 0 && warningCount > 0) {
        budgetScore = 80;
        budgetStatus = 'bom';
        budgetHeadline = `${warningCount} Orçamento${warningCount > 1 ? 's' : ''} em Atenção (80% - 100%)`;
      } else if (dangerCount === 1) {
        budgetScore = 50;
        budgetStatus = 'atencao';
        budgetHeadline = '1 Orçamento Estourado';
      } else {
        budgetScore = Math.max(15, 40 - (dangerCount - 2) * 15);
        budgetStatus = 'critico';
        budgetHeadline = `${dangerCount} Orçamentos Estourados`;
      }
    } else {
      // Sem orçamentos definidos
      budgetScore = savingsRate >= 0.15 ? 75 : 60;
      budgetStatus = 'atencao';
      budgetHeadline = 'Sem Limites de Orçamento Ativos';
    }

    const budgetPillar: SobraHealthPillar = {
      type: 'budgets',
      name: 'Orçamentos & Metas',
      weight: 0.25,
      score: budgetScore,
      status: budgetStatus,
      headline: budgetHeadline,
      metricLabel: 'Orçamentos Ativos',
      metricValue: `${activeBudgets.length} categorias`,
      feedback: budgetScore >= 80
        ? 'Excelente disciplina orçamentária. Todos os tetos de gastos estão sob controle rigoroso.'
        : budgetScore >= 50
        ? 'Você tem categorias encostando no teto. Ative o freio nos gastos variáveis até o fim do ciclo.'
        : 'Estouros identificados. Ajuste os limites ou corte gastos de supérfluos para conter o sangramento.',
    };

    // --- PILAR 4: ÍNDICE DE LIQUIDEZ E COBERTURA IMEDIATA (Peso 20%) ---
    let liquidityScore = 70;
    let liquidityStatus: SobraScoreStatus = 'bom';
    let liquidityHeadline = 'Liquidez Equilibrada';
    const totalCash = financialSummary.cashBalance;
    const totalSubsCost = subscriptions.filter(s => s.status === 'active').reduce((acc, s) => acc + s.amount, 0);
    const shortTermObligations = totalCreditDebt + totalSubsCost;
    let coverageRatio = 1.0;

    if (shortTermObligations > 0) {
      coverageRatio = totalCash / shortTermObligations;
      if (coverageRatio >= 2.0) {
        liquidityScore = 100;
        liquidityStatus = 'excelente';
        liquidityHeadline = 'Reserva Confortável (2x Obrigações)';
      } else if (coverageRatio >= 1.0) {
        liquidityScore = Math.round(75 + (coverageRatio - 1.0) * 25);
        liquidityStatus = 'bom';
        liquidityHeadline = 'Cobertura Integral (Saldo > Faturas)';
      } else if (coverageRatio >= 0.5) {
        liquidityScore = Math.round(45 + (coverageRatio - 0.5) * 60);
        liquidityStatus = 'atencao';
        liquidityHeadline = 'Atenção: Saldo Menor que Faturas';
      } else {
        liquidityScore = Math.max(10, Math.round(coverageRatio * 80));
        liquidityStatus = 'critico';
        liquidityHeadline = 'Alerta de Caixa Imediato';
      }
    } else if (totalCash > 0) {
      liquidityScore = 100;
      liquidityStatus = 'excelente';
      liquidityHeadline = 'Caixa Livre Sem Faturas Pendentes';
    }

    const liquidityPillar: SobraHealthPillar = {
      type: 'liquidity',
      name: 'Liquidez & Cobertura',
      weight: 0.20,
      score: liquidityScore,
      status: liquidityStatus,
      headline: liquidityHeadline,
      metricLabel: 'Cobertura de Dívidas',
      metricValue: `${coverageRatio.toFixed(1)}x faturas e assinaturas`,
      feedback: liquidityScore >= 80
        ? 'Caixa robusto. Seu dinheiro líquido em conta cobre com folga todas as faturas e assinaturas a vencer.'
        : liquidityScore >= 50
        ? 'Seu saldo cobre as despesas, mas deixa pouca margem para imprevistos. Mantenha uma reserva intocada.'
        : 'Atenção urgente: seu saldo em conta não é suficiente para pagar as faturas abertas sem usar cheque especial.',
    };

    // --- SCORE CONSOLIDADO ---
    const overallScore = Math.round(
      savingsScore * 0.30 +
      creditScore * 0.25 +
      budgetScore * 0.25 +
      liquidityScore * 0.20
    );

    let grade: SobraScoreGrade = 'B';
    let status: SobraScoreStatus = 'bom';
    let headline = 'Saúde Financeira Equilibrada';

    if (overallScore >= 90) {
      grade = 'A+';
      status = 'excelente';
      headline = 'Impecável! Alta Eficiência Financeira';
    } else if (overallScore >= 80) {
      grade = 'A';
      status = 'excelente';
      headline = 'Excelente Controle e Alta Previsibilidade';
    } else if (overallScore >= 65) {
      grade = 'B';
      status = 'bom';
      headline = 'Finanças em Equilíbrio com Espaço para Poupar Mais';
    } else if (overallScore >= 50) {
      grade = 'C';
      status = 'atencao';
      headline = 'Atenção Necessária em Gastos e Limites';
    } else {
      grade = 'D';
      status = 'critico';
      headline = 'Alerta: Alavancagem e Risco de Caixa';
    }

    const summary = `Seu índice de saúde financeira é ${overallScore}/100 (${grade}). O Sobra AI analisou seus ${transactions.length} lançamentos, saldos de ${accounts.length} contas e compromissos ativos.`;

    return {
      overallScore,
      grade,
      status,
      headline,
      summary,
      pillars: [savingsPillar, creditPillar, budgetPillar, liquidityPillar],
    };
  }

  /**
   * Detector de Anomalias de Gastos (Spike Detection)
   * Compara o mês atual com a média dos últimos 3 meses para cada categoria.
   */
  public detectCategoryAnomalies(
    transactions: Transaction[],
    categories: Category[],
    referenceDate: Date = new Date()
  ): SobraInsight[] {
    const insights: SobraInsight[] = [];
    const currentMonth = referenceDate.getMonth() + 1;
    const currentYear = referenceDate.getFullYear();

    const categoryMap = new Map<string, Category>();
    categories.forEach(c => categoryMap.set(c.id, c));

    // Gastos do mês atual por categoria
    const currentMonthTxns = filterTransactionsByMonth(transactions, currentMonth, currentYear)
      .filter(t => t.type === 'expense');

    const currentSpending = new Map<string, number>();
    for (const t of currentMonthTxns) {
      currentSpending.set(t.categoryId, (currentSpending.get(t.categoryId) || 0) + t.amount);
    }

    // Histórico dos 3 meses anteriores
    const baselineSpending = new Map<string, { total: number; monthsCount: number }>();

    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const pastTxns = filterTransactionsByMonth(transactions, m, y).filter(t => t.type === 'expense');
      const monthCats = new Set<string>();

      for (const t of pastTxns) {
        monthCats.add(t.categoryId);
        const prev = baselineSpending.get(t.categoryId) || { total: 0, monthsCount: 0 };
        prev.total += t.amount;
        baselineSpending.set(t.categoryId, prev);
      }

      for (const catId of monthCats) {
        const item = baselineSpending.get(catId);
        if (item) item.monthsCount += 1;
      }
    }

    // Identificar anomalias
    for (const [catId, currentAmount] of currentSpending.entries()) {
      const baseline = baselineSpending.get(catId);
      if (!baseline || baseline.monthsCount === 0) continue;

      const baselineAvg = baseline.total / baseline.monthsCount;

      // Se a média histórica for relevante (> R$ 50) e o gasto atual for acima de R$ 80
      if (baselineAvg >= 50 && currentAmount >= 80) {
        const increaseRatio = (currentAmount - baselineAvg) / baselineAvg;

        // Se subiu mais de 35%
        if (increaseRatio >= 0.35) {
          const cat = categoryMap.get(catId);
          const percentFormatted = Math.round(increaseRatio * 100);
          const catName = cat?.name || 'Categoria';

          insights.push({
            id: `insight-spike-${catId}`,
            category: 'anomaly',
            severity: increaseRatio >= 0.60 ? 'critical' : 'warning',
            title: `Pico Incomum em ${catName}`,
            message: `Você gastou ${formatBrlCurrency(currentAmount)} este mês, o que está ${percentFormatted}% acima da sua média dos últimos 3 meses (${formatBrlCurrency(baselineAvg)}).`,
            highlightValue: `+${percentFormatted}%`,
            iconName: cat?.icon || 'TrendingUp',
            accentColor: cat?.color || '#EF4444',
            action: {
              label: 'Ver Extrato',
              actionType: 'navigate_tab',
              target: 'transactions',
              params: { categoryId: catId },
            },
            scoreImpact: -5,
          });
        }
      }
    }

    return insights;
  }

  /**
   * Analisa a Liquidez Imediata e Alavancagem dos Cartões.
   */
  public analyzeLiquidityAndCards(
    accounts: Account[],
    transactions: Transaction[]
  ): SobraInsight[] {
    const insights: SobraInsight[] = [];
    const summary = calculateFinancialSummary(accounts);
    const creditCards = accounts.filter(a => a.type === 'credit_card');

    // 1. Risco de Liquidez Imediata
    if (summary.creditCardDebt > summary.cashBalance && summary.creditCardDebt > 0) {
      const deficit = summary.creditCardDebt - summary.cashBalance;
      insights.push({
        id: 'insight-liquidity-deficit',
        category: 'liquidity',
        severity: 'critical',
        title: 'Alerta de Cobertura de Faturas',
        message: `As faturas abertas dos seus cartões (${formatBrlCurrency(summary.creditCardDebt)}) superam seu saldo em conta (${formatBrlCurrency(summary.cashBalance)}) em ${formatBrlCurrency(deficit)}. Priorize organizar o caixa para o vencimento.`,
        highlightValue: formatBrlCurrency(deficit),
        iconName: 'AlertTriangle',
        accentColor: '#EF4444',
        action: {
          label: 'Ver Cartões',
          actionType: 'navigate_tab',
          target: 'accounts',
        },
        scoreImpact: -15,
      });
    }

    // 2. Alavancagem por Cartão Individual (> 70%)
    for (const card of creditCards) {
      if (card.creditLimit && card.creditLimit > 0) {
        const debt = Math.abs(card.balance);
        const ratio = debt / card.creditLimit;
        if (ratio >= 0.70) {
          insights.push({
            id: `insight-card-limit-${card.id}`,
            category: 'credit',
            severity: 'warning',
            title: `Limite do Cartão ${card.name} em ${Math.round(ratio * 100)}%`,
            message: `Você utilizou ${formatBrlCurrency(debt)} de um limite de ${formatBrlCurrency(card.creditLimit)}. Manter o limite abaixo de 50% protege sua pontuação de crédito.`,
            highlightValue: `${Math.round(ratio * 100)}%`,
            iconName: 'CreditCard',
            accentColor: card.color || '#F97316',
            action: {
              label: 'Ver Fatura',
              actionType: 'navigate_tab',
              target: 'accounts',
            },
            scoreImpact: -8,
          });
        }
      }
    }

    // 3. Oportunidade de Liquidação com Folga
    if (summary.cashBalance >= summary.creditCardDebt * 2.5 && summary.creditCardDebt >= 300) {
      insights.push({
        id: 'insight-liquidity-surplus',
        category: 'opportunity',
        severity: 'opportunity',
        title: 'Folga de Caixa Confortável',
        message: `Seu saldo em conta corrente cobre 2.5x todas as faturas a vencer. Você pode antecipar pagamentos para liberar limite sem comprometer sua reserva.`,
        highlightValue: `${formatBrlCurrency(summary.cashBalance)} em conta`,
        iconName: 'ShieldCheck',
        accentColor: '#10B981',
        action: {
          label: 'Pagar Fatura',
          actionType: 'navigate_tab',
          target: 'accounts',
        },
        scoreImpact: +5,
      });
    }

    return insights;
  }

  /**
   * Analisa Concentração de Gastos Comportamentais (Fim de semana vs Dias úteis).
   */
  public detectSpendingPattern(transactions: Transaction[]): {
    pattern: SobraSpendingPattern;
    insights: SobraInsight[];
  } {
    const insights: SobraInsight[] = [];
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    let totalVariableExpense = 0;

    // Analisa últimos 60 dias de despesas
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const relevantTxns = transactions.filter(t => {
      if (t.type !== 'expense' || t.status !== 'confirmed') return false;
      const d = new Date(t.date);
      return d >= sixtyDaysAgo;
    });

    for (const t of relevantTxns) {
      const d = new Date(t.date);
      const dayIndex = d.getDay(); // 0 (Domingo) a 6 (Sábado)
      dayTotals[dayIndex] += t.amount;
      totalVariableExpense += t.amount;
    }

    let weekendTotal = dayTotals[5] + dayTotals[6] + dayTotals[0]; // Sex + Sáb + Dom
    let weekendRatio = totalVariableExpense > 0 ? weekendTotal / totalVariableExpense : 0;

    let peakDayIndex = 0;
    let maxAmount = 0;
    dayTotals.forEach((val, idx) => {
      if (val > maxAmount) {
        maxAmount = val;
        peakDayIndex = idx;
      }
    });

    const peakDayName = dayNames[peakDayIndex];

    if (weekendRatio >= 0.45 && totalVariableExpense >= 400) {
      const percent = Math.round(weekendRatio * 100);
      insights.push({
        id: 'insight-pattern-weekend',
        category: 'pattern',
        severity: 'pattern',
        title: 'Padrão de Fim de Semana Detectado',
        message: `${percent}% das suas despesas variáveis dos últimos 60 dias acontecem entre sexta-feira e domingo, com pico especial no ${peakDayName}.`,
        highlightValue: `${percent}% no Fim de Semana`,
        iconName: 'Sparkles',
        accentColor: '#8B5CF6',
        action: {
          label: 'Ver Extrato',
          actionType: 'navigate_tab',
          target: 'transactions',
        },
      });
    }

    return {
      pattern: {
        weekendExpenseRatio: Math.round(weekendRatio * 100),
        peakDayName,
      },
      insights,
    };
  }

  /**
   * Avalia Otimização de Assinaturas e Recorrências.
   */
  public analyzeSubscriptions(
    subscriptions: Subscription[],
    categories: Category[],
    monthlyIncome: number
  ): SobraInsight[] {
    const insights: SobraInsight[] = [];
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    const totalSubsCost = activeSubs.reduce((acc, s) => acc + s.amount, 0);

    if (monthlyIncome > 0 && totalSubsCost > 0) {
      const ratio = totalSubsCost / monthlyIncome;
      if (ratio >= 0.12) {
        insights.push({
          id: 'insight-subs-heavy',
          category: 'subscription',
          severity: 'warning',
          title: 'Assinaturas Ocupam 12%+ da Renda',
          message: `Suas assinaturas somam ${formatBrlCurrency(totalSubsCost)} por mês (${Math.round(ratio * 100)}% da sua renda). Avalie cancelar serviços que você não utilizou no último mês.`,
          highlightValue: formatBrlCurrency(totalSubsCost),
          iconName: 'CalendarClock',
          accentColor: '#F59E0B',
          action: {
            label: 'Ver Assinaturas',
            actionType: 'navigate_tab',
            target: 'subscriptions',
          },
          scoreImpact: -5,
        });
      }
    }

    // Verificar sobreposição de assinaturas por categoria
    const categoryCount = new Map<string, Subscription[]>();
    for (const sub of activeSubs) {
      const list = categoryCount.get(sub.categoryId) || [];
      list.push(sub);
      categoryCount.set(sub.categoryId, list);
    }

    for (const [catId, list] of categoryCount.entries()) {
      if (list.length >= 2) {
        const cat = categories.find(c => c.id === catId);
        const subNames = list.map(s => s.name).join(' e ');
        const total = list.reduce((acc, s) => acc + s.amount, 0);

        insights.push({
          id: `insight-subs-overlap-${catId}`,
          category: 'subscription',
          severity: 'opportunity',
          title: `Múltiplas Assinaturas em ${cat?.name || 'Categoria'}`,
          message: `Você possui ${list.length} assinaturas ativas concorrentes (${subNames}), somando ${formatBrlCurrency(total)}/mês. Alternar mensalmente pode gerar economia.`,
          highlightValue: `${list.length} ativas`,
          iconName: 'Layers',
          accentColor: '#38BDF8',
          action: {
            label: 'Gerenciar',
            actionType: 'navigate_tab',
            target: 'subscriptions',
          },
        });
      }
    }

    return insights;
  }

  /**
   * Avalia Metas com Alto Momentum (Próximas da Conclusão).
   */
  public analyzeGoals(goals: Goal[]): SobraInsight[] {
    const insights: SobraInsight[] = [];

    for (const g of goals) {
      if (!g.isCompleted && g.targetAmount > 0) {
        const ratio = g.currentAmount / g.targetAmount;
        const remaining = g.targetAmount - g.currentAmount;

        if (ratio >= 0.80) {
          insights.push({
            id: `insight-goal-near-${g.id}`,
            category: 'goal',
            severity: 'achievement',
            title: `Meta "${g.name}" Quase Concluída!`,
            message: `Você já alcançou ${Math.round(ratio * 100)}% da meta! Faltam apenas ${formatBrlCurrency(remaining)} para atingir o objetivo planejado.`,
            highlightValue: `${Math.round(ratio * 100)}% concluída`,
            iconName: 'Target',
            accentColor: g.color || '#10B981',
            action: {
              label: 'Ver Metas',
              actionType: 'navigate_tab',
              target: 'budgets',
            },
            scoreImpact: +5,
          });
        }
      }
    }

    return insights;
  }

  /**
   * Gera o Plano de Ação Estratégico em 3 Passos do Sobra AI.
   */
  public generateStrategicPlan(
    score: SobraHealthScore,
    insights: SobraInsight[],
    accounts: Account[],
    subscriptions: Subscription[]
  ): SobraStrategicStep[] {
    const plan: SobraStrategicStep[] = [];

    // Passo 1: Ação de contenção imediata ou liquidez
    const criticalInsight = insights.find(i => i.severity === 'critical');
    if (criticalInsight) {
      plan.push({
        stepNumber: 1,
        title: 'Estancar Vazamento Crítico de Caixa',
        description: criticalInsight.message,
        estimatedImpact: 'Proteção contra juros e cheque especial',
        action: criticalInsight.action,
      });
    } else {
      plan.push({
        stepNumber: 1,
        title: 'Manter Teto de Gastos Diários (Burn Rate)',
        description: 'Mantenha os gastos variáveis alinhados com o orçamento recomendado para fechar o mês no azul com sobra.',
        estimatedImpact: '+R$ 200 a R$ 450 de sobra extra',
        action: { label: 'Ver Projeção', actionType: 'open_modal', target: 'burn_rate' },
      });
    }

    // Passo 2: Otimização de Assinaturas ou Cartão
    const subInsight = insights.find(i => i.category === 'subscription');
    const creditInsight = insights.find(i => i.category === 'credit');

    if (creditInsight) {
      plan.push({
        stepNumber: 2,
        title: 'Reduzir Comprometimento do Cartão de Crédito',
        description: 'Priorize pagar compras pontuais no débito ou Pix nas próximas duas semanas para diminuir a fatura futura.',
        estimatedImpact: 'Recuperação de limite e score de crédito',
        action: creditInsight.action,
      });
    } else if (subInsight) {
      plan.push({
        stepNumber: 2,
        title: 'Auditar e Enxugar Assinaturas Recorrentes',
        description: subInsight.message,
        estimatedImpact: 'Economia imediata de R$ 50 a R$ 120/mês',
        action: subInsight.action,
      });
    } else {
      plan.push({
        stepNumber: 2,
        title: 'Definir Limites em Categorias Principais',
        description: 'Configure orçamentos mensais para Alimentação e Lazer para receber avisos antes de atingir o limite.',
        estimatedImpact: 'Controle de 100% das saídas',
        action: { label: 'Novo Orçamento', actionType: 'navigate_tab', target: 'budgets' },
      });
    }

    // Passo 3: Aceleração Patrimonial e Metas
    const goalInsight = insights.find(i => i.category === 'goal');
    if (goalInsight) {
      plan.push({
        stepNumber: 3,
        title: 'Completar Sua Meta Financeira',
        description: goalInsight.message,
        estimatedImpact: 'Conquista de objetivo financeiro real 🎉',
        action: goalInsight.action,
      });
    } else {
      plan.push({
        stepNumber: 3,
        title: 'Direcionar a Sobra para Investimento ou Reserva',
        description: 'Assim que receber sua próxima receita, transfira imediatamente ao menos 15% para a sua conta de reserva antes de gastar.',
        estimatedImpact: 'Crescimento patrimonial acelerado',
        action: { label: 'Ver Contas', actionType: 'navigate_tab', target: 'accounts' },
      });
    }

    return plan;
  }

  /**
   * Gera o Diagnóstico Completo do Sobra AI consolidado.
   */
  public generateFullDiagnosis(
    accounts: Account[],
    categories: Category[],
    transactions: Transaction[],
    budgets: Budget[],
    goals: Goal[],
    subscriptions: Subscription[],
    referenceDate: Date = new Date()
  ): SobraFullDiagnosis {
    const score = this.calculateHealthScore(accounts, transactions, budgets, subscriptions, referenceDate);
    const anomalies = this.detectCategoryAnomalies(transactions, categories, referenceDate);
    const liquidity = this.analyzeLiquidityAndCards(accounts, transactions);
    const patternResult = this.detectSpendingPattern(transactions);
    
    const month = referenceDate.getMonth() + 1;
    const year = referenceDate.getFullYear();
    const monthlySummary = calculateMonthlySummary(transactions, month, year);
    const subInsights = this.analyzeSubscriptions(subscriptions, categories, monthlySummary.income);
    const goalInsights = this.analyzeGoals(goals);

    // Todos os insights combinados e ordenados por severidade
    const allInsights = [
      ...anomalies,
      ...liquidity,
      ...subInsights,
      ...goalInsights,
      ...patternResult.insights,
    ].sort((a, b) => {
      const order: Record<string, number> = { critical: 1, warning: 2, opportunity: 3, pattern: 4, achievement: 5 };
      return (order[a.severity] || 9) - (order[b.severity] || 9);
    });

    // Forças e Vulnerabilidades
    const strengths: string[] = [];
    const vulnerabilities: string[] = [];

    score.pillars.forEach(p => {
      if (p.score >= 80) strengths.push(`${p.name}: ${p.headline} (${p.metricValue})`);
      else if (p.score < 60) vulnerabilities.push(`${p.name}: ${p.headline} (${p.metricValue})`);
    });

    if (strengths.length === 0) strengths.push('Contas ativas e movimentações sendo rastreadas com precisão.');
    if (vulnerabilities.length === 0) vulnerabilities.push('Sem vulnerabilidades críticas detectadas no momento.');

    const actionPlan = this.generateStrategicPlan(score, allInsights, accounts, subscriptions);

    return {
      generatedAt: new Date().toISOString(),
      score,
      insights: allInsights,
      strengths,
      vulnerabilities,
      pattern: patternResult.pattern,
      actionPlan,
    };
  }
}

export const sobraAiEngine = new SobraAiEngine();
