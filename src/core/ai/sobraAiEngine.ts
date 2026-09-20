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
    const day = referenceDate.getDate();
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthProgress = day / daysInMonth;

    const monthlySummary = calculateMonthlySummary(transactions, month, year);
    const financialSummary = calculateFinancialSummary(accounts);

    // Métrica de Ritmo de Gastos Diários (Burn Rate / Pace temporal)
    const daysElapsed = Math.max(1, day);
    const dailyExpensePace = monthlySummary.expense / daysElapsed;
    const projectedMonthlyExpense = dailyExpensePace * daysInMonth;

    // --- PILAR 1: SOBRA DO MÊS & FLUXO TEMPORAL (Peso 30%) ---
    let savingsScore = 80;
    let savingsStatus: SobraScoreStatus = 'bom';
    let savingsHeadline = 'Finanças em Equilíbrio';
    let savingsRate = 0;
    let savingsMetricLabel = 'Taxa de Sobra';
    let savingsMetricValue = '0% da renda';
    let savingsFeedback = '';

    if (monthlySummary.income > 0) {
      savingsRate = (monthlySummary.income - monthlySummary.expense) / monthlySummary.income;
      savingsMetricValue = `${Math.round(savingsRate * 100)}% da renda`;

      if (savingsRate >= 0.25) {
        savingsScore = 100;
        savingsStatus = 'excelente';
        savingsHeadline = 'Poupança de Alto Nível (≥ 25%)';
        savingsFeedback = 'Você está mantendo uma sobra saudável no mês, ideal para acumular patrimônio.';
      } else if (savingsRate >= 0.15) {
        savingsScore = Math.round(80 + ((savingsRate - 0.15) / 0.10) * 20);
        savingsStatus = 'bom';
        savingsHeadline = 'Boa Sobra Mensal (15% a 25%)';
        savingsFeedback = 'Suas contas estão no azul, com sobra consistente para reforçar suas reservas.';
      } else if (savingsRate >= 0.0) {
        savingsScore = Math.round(55 + (savingsRate / 0.15) * 25);
        savingsStatus = 'atencao';
        savingsHeadline = 'Margem Apertada de Sobra (< 15%)';
        savingsFeedback = 'Você está fechando no azul, mas pequenas economias em supérfluos aumentam sua segurança.';
      } else {
        // Déficit: despesas > receitas
        const deficit = Math.abs(monthlySummary.income - monthlySummary.expense);
        if (financialSummary.cashBalance >= deficit) {
          savingsScore = Math.max(50, Math.round(75 - (deficit / (monthlySummary.income || 1)) * 30));
          savingsStatus = 'atencao';
          savingsHeadline = 'Saídas cobertas pelo saldo bancário';
          savingsFeedback = `Suas saídas superaram a renda do mês em ${formatBrlCurrency(deficit)}, mas seu saldo em conta cobre essa diferença com tranquilidade.`;
        } else {
          savingsScore = Math.max(15, Math.round(45 - (deficit / (financialSummary.cashBalance + 1)) * 30));
          savingsStatus = 'critico';
          savingsHeadline = 'Déficit no Mês sem Cobertura';
          savingsFeedback = 'Os gastos do mês estão superando sua renda e o saldo disponível em conta. Vale frear despesas imediatamente.';
        }
      }
    } else if (monthlySummary.expense > 0) {
      // Sem receitas cadastradas no mês ainda (income === 0)
      savingsMetricLabel = 'Gastos no Mês';
      savingsMetricValue = `${formatBrlCurrency(monthlySummary.expense)} gastos`;

      const isLowExpense = monthlySummary.expense <= 300;
      const isCoveredByCash = financialSummary.cashBalance >= monthlySummary.expense;

      if (isCoveredByCash) {
        if (isLowExpense) {
          savingsScore = 85;
          savingsStatus = 'excelente';
          savingsHeadline = 'Gastos contidos e cobertos pelo saldo';
          savingsFeedback = day > 15
            ? `Estamos no dia ${day} e você gastou apenas ${formatBrlCurrency(monthlySummary.expense)}, valor garantido pelo seu saldo. Cadastre sua renda para ver a taxa de sobra exata.`
            : `Primeiros gastos do mês (${formatBrlCurrency(monthlySummary.expense)}) estão 100% cobertos pelo saldo em conta.`;
        } else {
          savingsScore = day > 20 ? 70 : 80;
          savingsStatus = 'bom';
          savingsHeadline = 'Despesas garantidas pelo saldo em conta';
          savingsFeedback = `Você gastou ${formatBrlCurrency(monthlySummary.expense)} até o dia ${day}, totalmente cobertos pelo saldo. Registre suas entradas para apurar sua taxa de sobra.`;
        }
      } else {
        if (isLowExpense) {
          savingsScore = 65;
          savingsStatus = 'atencao';
          savingsHeadline = 'Aguardando receitas do mês';
          savingsFeedback = `Você registrou ${formatBrlCurrency(monthlySummary.expense)} em saídas. Cadastre suas receitas para equilibrar o diagnóstico.`;
        } else {
          savingsScore = day > 15 ? 35 : 50;
          savingsStatus = 'critico';
          savingsHeadline = 'Saídas sem receita correspondente';
          savingsFeedback = `Até o dia ${day} foram registrados ${formatBrlCurrency(monthlySummary.expense)} em saídas sem receitas cadastradas.`;
        }
      }
    } else {
      savingsScore = 85;
      savingsStatus = 'excelente';
      savingsHeadline = 'Mês sem saídas registradas';
      savingsMetricLabel = 'Movimentação';
      savingsMetricValue = 'Sem despesas';
      savingsFeedback = 'Nenhuma despesa registrada até o momento no ciclo atual.';
    }

    const savingsPillar: SobraHealthPillar = {
      type: 'savings',
      name: 'Sobra do Mês',
      weight: 0.30,
      score: savingsScore,
      status: savingsStatus,
      headline: savingsHeadline,
      metricLabel: savingsMetricLabel,
      metricValue: savingsMetricValue,
      feedback: savingsFeedback,
    };

    // --- PILAR 2: SAÚDE E ALAVANCAGEM DO CARTÃO DE CRÉDITO (Peso 25%) ---
    let creditScore = 95;
    let creditStatus: SobraScoreStatus = 'excelente';
    let creditHeadline = 'Cartões Sob Controle';
    let creditFeedback = '';
    const creditCards = accounts.filter(a => a.type === 'credit_card');
    const totalCreditLimit = creditCards.reduce((acc, c) => acc + (c.creditLimit || 0), 0);
    const totalCreditDebt = financialSummary.creditCardDebt;
    let utilizationRate = totalCreditLimit > 0 ? totalCreditDebt / totalCreditLimit : 0;

    if (totalCreditDebt === 0) {
      creditScore = 100;
      creditStatus = 'excelente';
      creditHeadline = 'Faturas Zeradas';
      creditFeedback = 'Nenhum valor em aberto nos seus cartões de crédito.';
    } else if (totalCreditDebt <= 300) {
      // Fatura de baixo valor absoluto (ex: R$ 100)
      if (financialSummary.cashBalance >= totalCreditDebt) {
        creditScore = 95;
        creditStatus = 'excelente';
        creditHeadline = 'Fatura pequena 100% coberta';
        creditFeedback = `Sua fatura de ${formatBrlCurrency(totalCreditDebt)} é baixa e está totalmente garantida pelo saldo disponível em conta.`;
      } else {
        creditScore = 80;
        creditStatus = 'bom';
        creditHeadline = 'Fatura pontual em aberto';
        creditFeedback = `Fatura baixa de ${formatBrlCurrency(totalCreditDebt)}. Mantenha atenção para quitá-la no vencimento.`;
      }
    } else {
      // Fatura acima de R$ 300
      const isCoveredByCash = financialSummary.cashBalance >= totalCreditDebt;

      if (totalCreditLimit > 0) {
        if (utilizationRate <= 0.30) {
          creditScore = 100;
          creditStatus = 'excelente';
          creditHeadline = 'Uso Ideal de Limite (≤ 30%)';
          creditFeedback = 'Uso muito equilibrado dos cartões, mantendo o limite bem protegido.';
        } else if (utilizationRate <= 0.50) {
          creditScore = Math.round(85 - ((utilizationRate - 0.30) / 0.20) * 10);
          creditStatus = 'bom';
          creditHeadline = 'Uso Moderado (30% a 50%)';
          creditFeedback = 'Uso de limite sob controle, sem risco de rotativo.';
        } else if (utilizationRate <= 0.75) {
          creditScore = isCoveredByCash 
            ? Math.round(75 - ((utilizationRate - 0.50) / 0.25) * 10)
            : Math.round(65 - ((utilizationRate - 0.50) / 0.25) * 20);
          creditStatus = isCoveredByCash ? 'bom' : 'atencao';
          creditHeadline = isCoveredByCash ? 'Fatura garantida por saldo' : 'Limite Comprometido (50% a 75%)';
          creditFeedback = isCoveredByCash
            ? `Você utilizou ${Math.round(utilizationRate * 100)}% do limite, mas seu saldo bancário garante o pagamento integral.`
            : 'O comprometimento de limite subiu. Evite parcelamentos adicionais nas próximas semanas.';
        } else {
          creditScore = isCoveredByCash
            ? Math.max(55, Math.round(70 - ((utilizationRate - 0.75) / 0.25) * 15))
            : Math.max(15, Math.round(40 - ((utilizationRate - 0.75) / 0.25) * 25));
          creditStatus = isCoveredByCash ? 'atencao' : 'critico';
          creditHeadline = isCoveredByCash ? 'Limite alto coberto por saldo' : 'Alavancagem Alta (> 75% do Limite)';
          creditFeedback = isCoveredByCash
            ? 'A maior parte do limite foi utilizada, mas seu saldo em conta cobre o valor antes do vencimento.'
            : 'Mais de 75% do limite está ocupado e sem cobertura de saldo. Priorize amortizar faturas.';
        }
      } else {
        creditScore = isCoveredByCash ? 80 : 60;
        creditStatus = isCoveredByCash ? 'bom' : 'atencao';
        creditHeadline = 'Fatura sem Limite Cadastrado';
        creditFeedback = isCoveredByCash
          ? 'Fatura ativa coberta pelo saldo bancário. Cadastre o limite do cartão para métricas mais precisas.'
          : 'Fatura ativa sem limite cadastrado. Mantenha atenção para o pagamento.';
      }
    }

    const creditMetricValue = totalCreditDebt <= 300 && totalCreditLimit > 0 && utilizationRate > 0.5
      ? `${formatBrlCurrency(totalCreditDebt)} (Fatura baixa)`
      : totalCreditLimit > 0 
        ? `${Math.round(utilizationRate * 100)}% do limite` 
        : formatBrlCurrency(totalCreditDebt);

    const creditPillar: SobraHealthPillar = {
      type: 'credit_cards',
      name: 'Cartões de Crédito',
      weight: 0.25,
      score: creditScore,
      status: creditStatus,
      headline: creditHeadline,
      metricLabel: 'Comprometimento de Limite',
      metricValue: creditMetricValue,
      feedback: creditFeedback,
    };

    // --- PILAR 3: DISCIPLINA DE ORÇAMENTOS & RITMO DIÁRIO (Peso 25%) ---
    let budgetScore = 80;
    let budgetStatus: SobraScoreStatus = 'bom';
    let budgetHeadline = 'Planejamento Regular';
    let budgetMetricLabel = 'Orçamentos Ativos';
    let budgetMetricValue = '0 categorias';
    let budgetFeedback = '';
    const activeBudgets = budgets.filter(b => b.month === month && b.year === year);

    if (activeBudgets.length > 0) {
      const budgetStatuses = calculateBudgetStatuses(budgets, [], transactions, month, year);
      const dangerCount = budgetStatuses.filter(b => b.status === 'danger').length;
      const warningCount = budgetStatuses.filter(b => b.status === 'warning').length;
      budgetMetricLabel = 'Orçamentos Ativos';
      budgetMetricValue = `${activeBudgets.length} categoria${activeBudgets.length > 1 ? 's' : ''}`;

      if (dangerCount === 0 && warningCount === 0) {
        budgetScore = 100;
        budgetStatus = 'excelente';
        budgetHeadline = 'Todos Orçamentos Respeitados';
        budgetFeedback = 'Excelente disciplina orçamentária. Todos os tetos de gastos estão sob controle rigoroso.';
      } else if (dangerCount === 0 && warningCount > 0) {
        budgetScore = 80;
        budgetStatus = 'bom';
        budgetHeadline = `${warningCount} Orçamento${warningCount > 1 ? 's' : ''} em Atenção (80% - 100%)`;
        budgetFeedback = 'Você tem categorias encostando no teto. Vale desacelerar gastos variáveis até o fim do ciclo.';
      } else if (dangerCount === 1) {
        budgetScore = 55;
        budgetStatus = 'atencao';
        budgetHeadline = '1 Orçamento Ultrapassado';
        budgetFeedback = 'Uma categoria ultrapassou o teto planejado. Ajuste as saídas para restabelecer o equilíbrio.';
      } else {
        budgetScore = Math.max(20, 45 - (dangerCount - 2) * 15);
        budgetStatus = 'critico';
        budgetHeadline = `${dangerCount} Orçamentos Estourados`;
        budgetFeedback = 'Múltiplos tetos foram superados este mês. Revise gastos variáveis imediatamente.';
      }
    } else {
      // Sem orçamentos definidos: Heurística de Ritmo Diário (Burn Rate temporal)
      budgetMetricLabel = 'Ritmo Diário';
      budgetMetricValue = `${formatBrlCurrency(dailyExpensePace)}/dia`;

      if (monthlySummary.expense <= 300 || dailyExpensePace <= 25) {
        budgetScore = 85;
        budgetStatus = 'excelente';
        budgetHeadline = `Ritmo de gastos contido (${formatBrlCurrency(dailyExpensePace)}/dia)`;
        budgetFeedback = `Estamos no dia ${day} e seu ritmo médio é de apenas ${formatBrlCurrency(dailyExpensePace)}/dia. Defina metas por categoria para manter essa disciplina.`;
      } else if (dailyExpensePace <= 80) {
        budgetScore = 75;
        budgetStatus = 'bom';
        budgetHeadline = `Média de ${formatBrlCurrency(dailyExpensePace)}/dia`;
        budgetFeedback = `No dia ${day}, seus gastos projetam ${formatBrlCurrency(projectedMonthlyExpense)} até o fim do mês. Cadastrar tetos de orçamento ajudará a manter o controle.`;
      } else {
        budgetScore = 65;
        budgetStatus = 'atencao';
        budgetHeadline = 'Ritmo acelerado sem tetos definidos';
        budgetFeedback = `Seus gastos médios estão em ${formatBrlCurrency(dailyExpensePace)}/dia. Defina orçamentos para evitar surpresas no fechamento do mês.`;
      }
    }

    const budgetPillar: SobraHealthPillar = {
      type: 'budgets',
      name: 'Limites & Orçamentos',
      weight: 0.25,
      score: budgetScore,
      status: budgetStatus,
      headline: budgetHeadline,
      metricLabel: budgetMetricLabel,
      metricValue: budgetMetricValue,
      feedback: budgetFeedback,
    };

    // --- PILAR 4: ÍNDICE DE LIQUIDEZ E COBERTURA IMEDIATA (Peso 20%) ---
    let liquidityScore = 80;
    let liquidityStatus: SobraScoreStatus = 'bom';
    let liquidityHeadline = 'Liquidez Equilibrada';
    let liquidityFeedback = '';
    const totalCash = financialSummary.cashBalance;
    const totalSubsCost = subscriptions.filter(s => s.status === 'active').reduce((acc, s) => acc + s.amount, 0);
    const shortTermObligations = totalCreditDebt + totalSubsCost;
    let coverageRatio = 1.0;

    if (shortTermObligations > 0) {
      coverageRatio = totalCash / shortTermObligations;

      if (coverageRatio >= 2.0) {
        liquidityScore = 100;
        liquidityStatus = 'excelente';
        liquidityHeadline = 'Reserva Confortável (≥ 2x Obrigações)';
        liquidityFeedback = 'Caixa robusto. Seu saldo em conta cobre com folga todas as faturas e despesas a vencer.';
      } else if (coverageRatio >= 1.0) {
        if (shortTermObligations <= 300) {
          liquidityScore = 95;
          liquidityStatus = 'excelente';
          liquidityHeadline = 'Faturas 100% Cobertas por Saldo';
          liquidityFeedback = `Seu saldo em conta cobre integralmente os ${formatBrlCurrency(shortTermObligations)} de faturas e compromissos do mês.`;
        } else {
          liquidityScore = Math.round(85 + (coverageRatio - 1.0) * 15);
          liquidityStatus = 'bom';
          liquidityHeadline = 'Cobertura Integral (Saldo ≥ Faturas)';
          liquidityFeedback = 'O saldo disponível em conta cobre 100% de todas as suas faturas e assinaturas.';
        }
      } else if (coverageRatio >= 0.70) {
        liquidityScore = Math.round(60 + ((coverageRatio - 0.70) / 0.30) * 20);
        liquidityStatus = 'atencao';
        liquidityHeadline = 'Atenção: Saldo Menor que Faturas';
        liquidityFeedback = 'Seu saldo cobre boa parte das despesas, mas deixa pouca margem antes do próximo recebimento.';
      } else {
        liquidityScore = Math.max(15, Math.round(coverageRatio * 75));
        liquidityStatus = 'critico';
        liquidityHeadline = 'Alerta de Caixa Imediato';
        liquidityFeedback = 'Seu saldo em conta atual não é suficiente para pagar as faturas abertas. Reforce o caixa antes do vencimento.';
      }
    } else if (totalCash > 0) {
      liquidityScore = 100;
      liquidityStatus = 'excelente';
      liquidityHeadline = 'Caixa Livre Sem Faturas Pendentes';
      liquidityFeedback = 'Você não possui faturas pendentes e seu saldo em conta está livre.';
    } else {
      liquidityScore = 75;
      liquidityStatus = 'bom';
      liquidityHeadline = 'Contas Equilibradas';
      liquidityFeedback = 'Sem faturas nem compromissos imediatos pendentes.';
    }

    const liquidityPillar: SobraHealthPillar = {
      type: 'liquidity',
      name: 'Cobertura de Contas',
      weight: 0.20,
      score: liquidityScore,
      status: liquidityStatus,
      headline: liquidityHeadline,
      metricLabel: 'Cobertura de Dívidas',
      metricValue: `${coverageRatio.toFixed(1)}x compromissos`,
      feedback: liquidityFeedback,
    };

    // --- SCORE CONSOLIDADO PONDERADO ---
    const overallScore = Math.round(
      savingsScore * 0.30 +
      creditScore * 0.25 +
      budgetScore * 0.25 +
      liquidityScore * 0.20
    );

    let grade: SobraScoreGrade = 'B';
    let status: SobraScoreStatus = 'bom';
    let headline = 'Finanças em ritmo equilibrado';

    if (overallScore >= 90) {
      grade = 'A+';
      status = 'excelente';
      headline = 'Suas contas estão em ritmo excelente';
    } else if (overallScore >= 80) {
      grade = 'A';
      status = 'excelente';
      headline = 'Ótimo controle e boa previsibilidade';
    } else if (overallScore >= 65) {
      grade = 'B';
      status = 'bom';
      headline = 'Finanças equilibradas no mês';
    } else if (overallScore >= 50) {
      grade = 'C';
      status = 'atencao';
      headline = 'Mês pedindo um pouco de cautela';
    } else {
      grade = 'D';
      status = 'critico';
      headline = 'Atenção ao fechamento do mês';
    }

    const summary = overallScore >= 80
      ? (monthlySummary.income === 0 && monthlySummary.expense > 0
          ? `No dia ${day} do mês, seus gastos estão contidos (${formatBrlCurrency(monthlySummary.expense)}) e cobertos pelo saldo. Cadastre sua renda para ver a taxa de sobra exata.`
          : 'Você está mantendo uma boa sobra e suas saídas estão bem cobertas pelo saldo disponível.')
      : overallScore >= 65
      ? 'Suas contas estão organizadas, com boa margem para formar ou reforçar sua reserva.'
      : overallScore >= 50
      ? 'Algumas saídas e faturas deste mês pedem atenção para garantir que o fechamento fique no azul.'
      : 'Faturas e despesas previstas estão próximas do saldo disponível em conta. Vale ajustar saídas pontuais.';

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
      if (deficit > 100) {
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
    }

    // 2. Alavancagem por Cartão Individual (> 70%)
    for (const card of creditCards) {
      if (card.creditLimit && card.creditLimit > 0) {
        const debt = Math.abs(card.balance);
        const ratio = debt / card.creditLimit;
        // Só alertar se a dívida for relevante (> R$ 300) E o saldo bancário NÃO cobrir a dívida
        if (ratio >= 0.70 && debt > 300 && debt > summary.cashBalance) {
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
        title: 'Atenção ao Saldo para Faturas',
        description: criticalInsight.message,
        estimatedImpact: 'Evita juros e cheque especial',
        action: criticalInsight.action,
      });
    } else {
      plan.push({
        stepNumber: 1,
        title: 'Manter Média Diária de Gastos',
        description: 'Mantenha os gastos variáveis dentro do planejado para fechar o mês com sobra tranquila.',
        estimatedImpact: '+R$ 200 a R$ 450 de sobra',
        action: { label: 'Ver Projeção', actionType: 'open_modal', target: 'burn_rate' },
      });
    }

    // Passo 2: Otimização de Assinaturas ou Cartão
    const subInsight = insights.find(i => i.category === 'subscription');
    const creditInsight = insights.find(i => i.category === 'credit');

    if (creditInsight) {
      plan.push({
        stepNumber: 2,
        title: 'Equilibrar Uso do Cartão',
        description: 'Priorize pagar compras pontuais no débito ou Pix nos próximos dias para diminuir a próxima fatura.',
        estimatedImpact: 'Mais limite livre e alívio nas faturas',
        action: creditInsight.action,
      });
    } else if (subInsight) {
      plan.push({
        stepNumber: 2,
        title: 'Revisar Assinaturas Mensais',
        description: subInsight.message,
        estimatedImpact: 'Economia de R$ 50 a R$ 120/mês',
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
        estimatedImpact: 'Conquista de objetivo financeiro',
        action: goalInsight.action,
      });
    } else {
      plan.push({
        stepNumber: 3,
        title: 'Separar uma Sobra para a Reserva',
        description: 'Ao receber sua próxima receita, transfira uma parte para a sua reserva antes de iniciar os gastos do mês.',
        estimatedImpact: 'Construção de reserva financeira',
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
