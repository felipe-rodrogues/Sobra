/**
 * Sobra - Motor de Detecção de Assinaturas e Recorrências (100% On-Device)
 * 
 * Analisa o histórico de transações locais para identificar:
 * 1. Padrões de cobranças recorrentes (~30 dias ou ~365 dias) do mesmo estabelecimento com valores semelhantes
 * 2. Alertas de reajuste de valor em relação à cobrança anterior
 * 3. Alertas de sobreposição quando há múltiplas assinaturas na mesma categoria
 * 4. Cálculo do total mensal consolidado de assinaturas ativas
 */

import { Transaction, Subscription, SubscriptionSuggestion, CategoryOverlapAlert, Category } from '../types';
import { categorizationEngine } from '../categorization/categorizationEngine';

export class RecurrenceDetector {
  /**
   * Identifica cobranças recorrentes do mesmo estabelecimento com valores semelhantes
   */
  detectRecurringSubscriptions(
    transactions: Transaction[],
    confirmedSubscriptions: Subscription[],
    dismissedMerchants: string[] = [],
    categories: Category[] = []
  ): SubscriptionSuggestion[] {
    // Apenas despesas confirmadas
    const expenses = transactions.filter(t => t.type === 'expense' && t.amount > 0);

    // Agrupar por estabelecimento normalizado
    const groups = new Map<string, Transaction[]>();

    for (const tx of expenses) {
      const normalized = categorizationEngine.normalize(tx.description);
      if (!normalized || normalized.length < 3) continue;

      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(tx);
    }

    const suggestions: SubscriptionSuggestion[] = [];
    const confirmedNormalized = confirmedSubscriptions.map(s => categorizationEngine.normalize(s.name));
    const dismissedNormalized = dismissedMerchants.map(m => categorizationEngine.normalize(m));

    for (const [normMerchant, txList] of groups.entries()) {
      // Ignora se já for confirmada (correspondência exata ou contida, ex: "netflix" e "netflix.com")
      const isAlreadyConfirmed = confirmedNormalized.some(
        c => normMerchant === c || normMerchant.includes(c) || c.includes(normMerchant)
      );
      if (isAlreadyConfirmed) continue;

      // Ignora se tiver sido descartada pelo usuário ("não é assinatura")
      const isDismissed = dismissedNormalized.some(
        d => normMerchant === d || normMerchant.includes(d) || d.includes(normMerchant)
      );
      if (isDismissed) continue;

      // Necessita de pelo menos 2 transações para estabelecer intervalo
      if (txList.length < 2) continue;

      // Ordenar por data cronológica crescente
      const sorted = [...txList].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Analisar intervalos e valores entre ocorrências adjacentes
      const intervals: number[] = [];
      let isSimilarAmount = true;

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        const prevTime = new Date(prev.date).getTime();
        const currTime = new Date(curr.date).getTime();
        const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));

        intervals.push(diffDays);

        // Tolerância de valor: variação de até 20% ou até R$ 15,00 para acomodar reajustes ou IOF
        const amountDiff = Math.abs(curr.amount - prev.amount);
        const maxAmount = Math.max(curr.amount, prev.amount);
        if (amountDiff > 15 && (amountDiff / maxAmount) > 0.20) {
          isSimilarAmount = false;
        }
      }

      if (!isSimilarAmount || intervals.length === 0) continue;

      // Checar se a média dos intervalos atende a cadência mensal (~30 dias) ou anual (~365 dias)
      const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);

      let cadence: 'monthly' | 'yearly' | null = null;

      // Tolerância: Mensal entre 24 e 36 dias
      if (avgInterval >= 24 && avgInterval <= 36) {
        cadence = 'monthly';
      }
      // Tolerância: Anual entre 345 e 385 dias
      else if (avgInterval >= 345 && avgInterval <= 385) {
        cadence = 'yearly';
      }

      if (cadence) {
        const latestTx = sorted[sorted.length - 1];
        const previousTx = sorted[sorted.length - 2];

        // Calcular próxima cobrança prevista
        const lastDate = new Date(latestTx.date);
        const nextBilling = new Date(lastDate);
        if (cadence === 'monthly') {
          nextBilling.setDate(nextBilling.getDate() + 30);
        } else {
          nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        }

        // Tentar sugerir categoria correta se não definida
        let catId = latestTx.categoryId;
        if (!catId || catId === 'cat-outros-desp') {
          const suggested = categorizationEngine.suggestCategory(latestTx.description, categories);
          if (suggested) catId = suggested.id;
        }

        suggestions.push({
          id: `sugg-${normMerchant.replace(/\s+/g, '-')}`,
          merchantName: latestTx.description,
          amount: latestTx.amount,
          previousAmount: previousTx.amount !== latestTx.amount ? previousTx.amount : undefined,
          categoryId: catId,
          accountId: latestTx.accountId,
          cadence,
          intervalDays: avgInterval,
          transactionCount: sorted.length,
          lastDate: latestTx.date,
          nextBillingDate: nextBilling.toISOString().substring(0, 10),
          transactions: sorted,
        });
      }
    }

    return suggestions;
  }

  /**
   * Calcula o valor total mensal gasto com assinaturas ativas
   * (Mensal = valor integral, Anual = valor / 12)
   */
  calculateTotalMonthlyCost(subscriptions: Subscription[]): number {
    const active = subscriptions.filter(s => s.status === 'active');
    const total = active.reduce((acc, sub) => {
      if (sub.cadence === 'yearly') {
        return acc + (sub.amount / 12);
      }
      return acc + sub.amount;
    }, 0);

    return Math.round(total * 100) / 100;
  }

  /**
   * Detecta quando o valor de uma assinatura mudou em relação à cobrança anterior
   */
  detectPriceChanges(
    subscriptions: Subscription[],
    transactions: Transaction[]
  ): Array<{
    subscription: Subscription;
    currentAmount: number;
    previousAmount: number;
    difference: number;
    percentage: number;
    isIncrease: boolean;
  }> {
    const alerts: Array<{
      subscription: Subscription;
      currentAmount: number;
      previousAmount: number;
      difference: number;
      percentage: number;
      isIncrease: boolean;
    }> = [];

    const activeSubs = subscriptions.filter(s => s.status === 'active');

    for (const sub of activeSubs) {
      // 1. Caso explícito na própria assinatura
      if (sub.previousAmount && sub.previousAmount !== sub.amount) {
        const diff = Math.round((sub.amount - sub.previousAmount) * 100) / 100;
        const pct = Math.round((Math.abs(diff) / sub.previousAmount) * 100);
        alerts.push({
          subscription: sub,
          currentAmount: sub.amount,
          previousAmount: sub.previousAmount,
          difference: diff,
          percentage: pct,
          isIncrease: diff > 0,
        });
        continue;
      }

      // 2. Verificar últimas 2 transações do mesmo estabelecimento
      const normName = categorizationEngine.normalize(sub.name);
      const matches = transactions
        .filter(t => t.type === 'expense' && categorizationEngine.normalize(t.description).includes(normName))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (matches.length >= 2) {
        const latest = matches[0];
        const previous = matches[1];

        if (latest.amount !== previous.amount) {
          const diff = Math.round((latest.amount - previous.amount) * 100) / 100;
          const pct = Math.round((Math.abs(diff) / previous.amount) * 100);
          alerts.push({
            subscription: sub,
            currentAmount: latest.amount,
            previousAmount: previous.amount,
            difference: diff,
            percentage: pct,
            isIncrease: diff > 0,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Alerta quando há mais de uma assinatura na mesma categoria
   */
  detectCategoryOverlaps(
    subscriptions: Subscription[],
    categories: Category[]
  ): CategoryOverlapAlert[] {
    const active = subscriptions.filter(s => s.status === 'active');
    const categoryMap = new Map<string, Subscription[]>();

    for (const sub of active) {
      if (!categoryMap.has(sub.categoryId)) {
        categoryMap.set(sub.categoryId, []);
      }
      categoryMap.get(sub.categoryId)!.push(sub);
    }

    const alerts: CategoryOverlapAlert[] = [];

    for (const [catId, subs] of categoryMap.entries()) {
      if (subs.length > 1) {
        const cat = categories.find(c => c.id === catId);
        const total = subs.reduce((acc, s) => {
          return acc + (s.cadence === 'yearly' ? s.amount / 12 : s.amount);
        }, 0);

        alerts.push({
          categoryId: catId,
          categoryName: cat?.name || 'Categoria Desconhecida',
          categoryColor: cat?.color || '#64748B',
          categoryIcon: cat?.icon || 'PieChart',
          subscriptions: subs,
          totalMonthlyAmount: Math.round(total * 100) / 100,
        });
      }
    }

    return alerts;
  }

  /**
   * Avalia proativamente se uma cobrança possui padrão de assinatura recorrente
   * com base em serviços conhecidos ou histórico de transações prévias
   */
  checkIfLikelySubscription(
    description: string,
    amount = 0,
    transactions: Transaction[] = []
  ): {
    isLikely: boolean;
    cadence: 'monthly' | 'yearly';
    reason: string;
    serviceName?: string;
  } {
    if (!description || description.trim().length < 3) {
      return { isLikely: false, cadence: 'monthly', reason: '' };
    }

    const norm = categorizationEngine.normalize(description);

    // 1. Catálogo de serviços típicos de assinatura
    const knownSubscriptionKeywords: Array<{ keyword: string; displayName: string; defaultCadence: 'monthly' | 'yearly' }> = [
      { keyword: 'netflix', displayName: 'Netflix', defaultCadence: 'monthly' },
      { keyword: 'spotify', displayName: 'Spotify', defaultCadence: 'monthly' },
      { keyword: 'amazon prime', displayName: 'Amazon Prime', defaultCadence: 'monthly' },
      { keyword: 'prime video', displayName: 'Prime Video', defaultCadence: 'monthly' },
      { keyword: 'disney', displayName: 'Disney+', defaultCadence: 'monthly' },
      { keyword: 'hbo', displayName: 'HBO Max', defaultCadence: 'monthly' },
      { keyword: 'deezer', displayName: 'Deezer', defaultCadence: 'monthly' },
      { keyword: 'youtube premium', displayName: 'YouTube Premium', defaultCadence: 'monthly' },
      { keyword: 'youtube music', displayName: 'YouTube Music', defaultCadence: 'monthly' },
      { keyword: 'apple music', displayName: 'Apple Music', defaultCadence: 'monthly' },
      { keyword: 'apple tv', displayName: 'Apple TV', defaultCadence: 'monthly' },
      { keyword: 'globoplay', displayName: 'Globoplay', defaultCadence: 'monthly' },
      { keyword: 'crunchyroll', displayName: 'Crunchyroll', defaultCadence: 'monthly' },
      { keyword: 'paramount', displayName: 'Paramount+', defaultCadence: 'monthly' },
      { keyword: 'icloud', displayName: 'iCloud', defaultCadence: 'monthly' },
      { keyword: 'google one', displayName: 'Google One', defaultCadence: 'monthly' },
      { keyword: 'google storage', displayName: 'Google Storage', defaultCadence: 'monthly' },
      { keyword: 'chatgpt', displayName: 'ChatGPT Plus', defaultCadence: 'monthly' },
      { keyword: 'openai', displayName: 'OpenAI', defaultCadence: 'monthly' },
      { keyword: 'microsoft 365', displayName: 'Microsoft 365', defaultCadence: 'monthly' },
      { keyword: 'office 365', displayName: 'Office 365', defaultCadence: 'monthly' },
      { keyword: 'adobe', displayName: 'Adobe Creative Cloud', defaultCadence: 'monthly' },
      { keyword: 'canva', displayName: 'Canva Pro', defaultCadence: 'monthly' },
      { keyword: 'smart fit', displayName: 'Smart Fit', defaultCadence: 'monthly' },
      { keyword: 'bluefit', displayName: 'Bluefit', defaultCadence: 'monthly' },
      { keyword: 'gympass', displayName: 'Gympass / Wellhub', defaultCadence: 'monthly' },
      { keyword: 'totalpass', displayName: 'TotalPass', defaultCadence: 'monthly' },
      { keyword: 'academia', displayName: 'Academia', defaultCadence: 'monthly' },
      { keyword: 'sem parar', displayName: 'Sem Parar', defaultCadence: 'monthly' },
      { keyword: 'veloe', displayName: 'Veloe', defaultCadence: 'monthly' },
      { keyword: 'conectcar', displayName: 'ConectCar', defaultCadence: 'monthly' },
      { keyword: 'vivo fibra', displayName: 'Vivo Fibra', defaultCadence: 'monthly' },
      { keyword: 'claro internet', displayName: 'Claro Internet', defaultCadence: 'monthly' },
      { keyword: 'aluguel', displayName: 'Aluguel', defaultCadence: 'monthly' },
      { keyword: 'condominio', displayName: 'Condomínio', defaultCadence: 'monthly' },
    ];

    // Detecta se contém indicação de anuidade na descrição
    const isExplicitlyYearly = norm.includes('anual') || norm.includes('ano') || norm.includes('yearly') || norm.includes('12x');

    for (const item of knownSubscriptionKeywords) {
      if (norm.includes(item.keyword)) {
        return {
          isLikely: true,
          cadence: isExplicitlyYearly ? 'yearly' : item.defaultCadence,
          reason: `Serviço com padrão de assinatura reconhecido (${item.displayName})`,
          serviceName: item.displayName,
        };
      }
    }

    // 2. Análise de histórico de transações existentes
    if (transactions && transactions.length > 0) {
      const pastMatches = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const pastNorm = categorizationEngine.normalize(t.description);
        return pastNorm === norm || pastNorm.includes(norm) || norm.includes(pastNorm);
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (pastMatches.length >= 1) {
        const now = Date.now();
        const latest = pastMatches[0];
        const diffDays = Math.round((now - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));

        // Cobrança prévia há cerca de 25 a 35 dias
        if (diffDays >= 25 && diffDays <= 35) {
          return {
            isLikely: true,
            cadence: 'monthly',
            reason: `Cobrança semelhante identificada há ~${diffDays} dias no seu extrato`,
            serviceName: description,
          };
        }

        // Cobrança prévia há cerca de um ano
        if (diffDays >= 345 && diffDays <= 385) {
          return {
            isLikely: true,
            cadence: 'yearly',
            reason: `Cobrança semelhante identificada há ~${diffDays} dias (~1 ano) no seu extrato`,
            serviceName: description,
          };
        }
      }
    }

    return { isLikely: false, cadence: 'monthly', reason: '' };
  }
}

export const recurrenceDetector = new RecurrenceDetector();
