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
import { merchantCleaner } from '../categorization/merchantCleaner';
import { extractInstallmentFromDescription, isInvoicePaymentDescription } from '../parsers/csvParser';

/**
 * Identifica se uma transação é parte de um parcelamento finito
 * (compras parceladas com número/total de parcelas definidas NUNCA são assinaturas).
 */
export function isInstallmentTransaction(tx?: Partial<Transaction> | null): boolean {
  if (!tx) return false;
  if (tx.isInstallment) return true;
  if (Boolean(tx.installmentGroupId)) return true;
  if (tx.installmentTotal !== undefined && tx.installmentTotal > 1) return true;
  if (tx.installmentNumber !== undefined && tx.installmentNumber > 0) return true;
  if (tx.description) {
    if (extractInstallmentFromDescription(tx.description).isInstallment) return true;
    if (/\b(?:parc(?:ela)?|prest(?:a[çc][ãa]o)?)\b/i.test(tx.description)) return true;
    if (/\b\d{1,2}\s*(?:\/|\s+de\s+)\d{1,2}\b/i.test(tx.description)) return true;
    if (/\b\d{1,2}x\b/i.test(tx.description)) return true;
  }
  return false;
}

/**
 * Verifica inteligentemente se uma transação corresponde a uma assinatura cadastrada.
 * Suporta correspondência por ID, nomes limpos de ruídos bancários (MP*, PAG*, etc.),
 * apelidos e famílias conhecidas (ex: Meli+, Disney+, HBO/Max, etc.) e combinação conta/valor.
 */
/**
 * Palavras-chave que indicam compras avulsas de varejo, restaurantes, delivery ou transporte,
 * que NUNCA devem ser confundidas com assinaturas de serviços recorrentes.
 */
const NON_SUBSCRIPTION_KEYWORDS = [
  'restaurante', 'rest:', 'pizzaria', 'hamburgueria', 'lanches', 'acai', 'padaria', 'sushi',
  'trip', 'rides', 'viagem', 'corrida',
  'carrinho', 'marketplace', 'varejo', 'loja', 'compra avulsa',
];

/**
 * Plataformas híbridas que possuem tanto assinaturas quanto comércio eletrônico,
 * entrega de comida, corridas ou lojas de aplicativos.
 */
const HYBRID_ECOSYSTEMS: Record<string, { subKeywords: string[]; requireExactAmount?: boolean }> = {
  'ifood': { subKeywords: ['clube', 'ifood clube', 'clube ifood', 'ifd*clube', 'ifood pass', 'ifood+'] },
  'uber': { subKeywords: ['one', 'uber one', 'pass', 'uber pass'] },
  'prime': { subKeywords: ['prime', 'amazon prime', 'prime video', 'amzn prime', 'kindle unlimited', 'music unlimited', 'audible'] },
  'meli': { subKeywords: ['meli+', 'meli plus', 'meli mais', 'melimais', 'mp*meli', 'mp*assina', 'mercado pago', 'mercadopago', 'meli'] },
  'apple': { subKeywords: ['icloud', 'apple music', 'apple tv', 'apple one', 'apple arcade'], requireExactAmount: true },
  'google': { subKeywords: ['google one', 'youtube premium', 'youtube music', 'google storage', 'workspace'], requireExactAmount: true },
};

/**
 * Verifica inteligentemente se uma transação corresponde a uma assinatura cadastrada.
 * Suporta correspondência por ID, nomes limpos de ruídos bancários (MP*, PAG*, etc.),
 * apelidos e famílias conhecidas (ex: Meli+, Disney+, HBO/Max, etc.) e combinação conta/valor.
 * 
 * Blindado contra:
 * 1. Parcelamentos (ex: 1/10, 3x)
 * 2. Compras avulsas de marketplace (ex: Mercado Livre, Amazon)
 * 3. Pedidos de restaurantes em apps de delivery (ex: iFood)
 * 4. Corridas avulsas em apps de transporte (ex: Uber)
 * 5. Compras de apps/jogos sob a mesma razão social bancária (ex: Apple, Google)
 */
export function isSubscriptionMatchingTransaction(
  sub: Subscription,
  tx: Transaction
): boolean {
  if (tx.type !== 'expense') return false;
  if (tx.isInvoicePayment || isInvoicePaymentDescription(tx.description)) return false;
  if (tx.isRefund || tx.isRefunded) return false;
  if (isInstallmentTransaction(tx)) return false;

  const rawSubName = sub.name || '';
  const rawTxDesc = tx.description || '';
  const rawSubLower = rawSubName.toLowerCase();
  const rawTxLower = rawTxDesc.toLowerCase();

  // 1. Se a transação contiver termos explícitos de consumo avulso (restaurante, corrida, carrinho),
  // rejeita de imediato, a menos que o nome cadastrado pelo usuário também tenha esse termo específico
  const hasNonSubKeyword = NON_SUBSCRIPTION_KEYWORDS.some(kw => rawTxLower.includes(kw) && !rawSubLower.includes(kw));
  if (hasNonSubKeyword) {
    return false;
  }

  // Checagem de coerência de valor: uma transação de assinatura deve ter valor igual
  // ou dentro de uma tolerância plausível de reajuste (até 35% ou R$ 25,00).
  const diff = Math.abs(sub.amount - tx.amount);
  const isExactOrKnown = diff < 0.05 || (Boolean(sub.previousAmount) && Math.abs(Number(sub.previousAmount) - tx.amount) < 0.05);
  const isRealisticReajuste = sub.amount > 0 && (diff / sub.amount <= 0.35 || diff <= 25.0);

  // 2. Vínculo direto por ID
  if (tx.subscriptionId && tx.subscriptionId === sub.id) {
    if (isExactOrKnown || isRealisticReajuste) return true;
    return false; // Se o valor for desproporcional, foi vinculado indevidamente por compra avulsa
  }
  if (tx.id?.startsWith(`tx-sub-${sub.id}-`) || tx.id?.startsWith(`proj-sub-${sub.id}-`)) return true;

  // Se o valor estiver totalmente fora da assinatura e fora de qualquer reajuste plausível, rejeita
  if (!isExactOrKnown && !isRealisticReajuste) {
    return false;
  }

  // 3. Normalização avançada com remoção de ruídos bancários (MP*, PAG*, adquirentes, etc.)
  const cleanSubName = merchantCleaner.clean(rawSubName);
  const cleanTxDesc = merchantCleaner.clean(rawTxDesc);

  const normSub = categorizationEngine.normalize(cleanSubName);
  const normDesc = categorizationEngine.normalize(cleanTxDesc);
  const normRawSub = categorizationEngine.normalize(rawSubName);
  const normRawDesc = categorizationEngine.normalize(rawTxDesc);

  // 4. Mapeamento de apelidos e famílias conhecidas de assinaturas
  const subAliases: Record<string, string[]> = {
    'meli': [
      'meli+',
      'meli plus',
      'meli mais',
      'melimais',
      'mp*meli',
      'mp * meli',
      'mp*assina',
      'mercado pago',
      'mercadopago',
      'mp*mercadopago',
      'meli',
    ],
    'netflix': ['netflix', 'netflix.com', 'nflx'],
    'spotify': ['spotify', 'spotify brasil', 'spotify ab'],
    'disney': ['disney+', 'disney plus', 'disney'],
    'max': ['hbo', 'hbo max', 'hbomax', 'max'],
    'prime': ['amazon prime', 'prime video', 'amazon prime video', 'amzn prime', 'prime'],
    'globo': ['globoplay', 'globo play', 'editora globo'],
    'playstation': ['ps plus', 'ps+', 'playstation plus', 'playstation', 'sony playstation', 'ps5', 'ps4'],
    'xbox': ['xbox game pass', 'game pass', 'gamepass', 'xbox'],
    'apple': ['apple.com/bill', 'apple music', 'apple tv', 'icloud', 'apple'],
    'google': ['google storage', 'google one', 'youtube premium', 'youtube music', 'google play', 'google'],
    'ifood': ['ifood clube', 'clube ifood', 'ifd*clube', 'ifood'],
    'uber': ['uber one', 'uber pass', 'uber'],
    'chatgpt': ['openai', 'chatgpt', 'chat gpt'],
    'gympass': ['gympass', 'wellhub'],
    'totalpass': ['totalpass', 'total pass'],
    'smartfit': ['smart fit', 'smartfit'],
    'bluefit': ['bluefit', 'blue fit'],
    'paramount': ['paramount+', 'paramount plus', 'paramount'],
    'deezer': ['deezer'],
    'crunchyroll': ['crunchyroll'],
    'claro': ['claro flex', 'claroflex', 'claro'],
    'vivo': ['vivo fibra', 'vivo controle', 'vivo'],
    'tim': ['tim live', 'tim controle', 'tim ultrafi', 'tim'],
  };

  // 5. Regras para Ecossistemas Híbridos (Amazon, Mercado Pago, iFood, Uber, Apple, Google)
  for (const [ecoKey, ecoConfig] of Object.entries(HYBRID_ECOSYSTEMS)) {
    const subBelongsToEco =
      normSub.includes(ecoKey) ||
      normRawSub.includes(ecoKey) ||
      rawSubLower.includes(ecoKey) ||
      (subAliases[ecoKey] && subAliases[ecoKey].some(v => normSub.includes(v) || rawSubLower.includes(v)));

    if (subBelongsToEco) {
      // Se a plataforma exigir valor exato (Apple / Google), como todas as compras vêm com o mesmo nome bancário,
      // compras de apps/jogos com valor divergente NUNCA devem casar com a assinatura
      if (ecoConfig.requireExactAmount) {
        const txBelongsToEco =
          normDesc.includes(ecoKey) ||
          normRawDesc.includes(ecoKey) ||
          rawTxLower.includes(ecoKey) ||
          (subAliases[ecoKey] && subAliases[ecoKey].some(v => normDesc.includes(v) || rawTxLower.includes(v)));
        if (txBelongsToEco && isExactOrKnown) {
          return true;
        }
        return false;
      }

      // Para iFood, Uber, Amazon Prime, Meli+:
      // A transação DEVE conter o produto de assinatura (ex: "clube", "one", "prime", "meli", "mercado pago")
      const txHasSubKeyword = ecoConfig.subKeywords.some(kw =>
        normDesc.includes(kw) || normRawDesc.includes(kw) || rawTxLower.includes(kw)
      );

      if (txHasSubKeyword) {
        if (isExactOrKnown || isRealisticReajuste) {
          return true;
        }
      }

      // Se a transação NÃO tem a palavra de assinatura (ex: diz apenas "Uber", "iFood", "Amazon"),
      // é corrida, comida ou compra de loja, NÃO a assinatura
      return false;
    }
  }

  // 6. Serviços Puros / Dedicados (Netflix, Spotify, Max, Disney+, Academias, Operadoras)
  if (normSub && normDesc) {
    if (normSub === normDesc) return true;
    if (normSub.length >= 3 && normDesc.includes(normSub)) return true;
    if (normDesc.length >= 3 && normSub.includes(normDesc)) return true;
  }

  if (normRawSub && normRawDesc) {
    if (normRawSub === normRawDesc) return true;
    if (normRawSub.length >= 3 && normRawDesc.includes(normRawSub)) return true;
    if (normRawDesc.length >= 3 && normRawSub.includes(normRawDesc)) return true;
  }

  // 7. Mapeamento de apelidos para serviços dedicados
  for (const [, variants] of Object.entries(subAliases)) {
    const subHasVariant = variants.some(v => normSub.includes(v) || normRawSub.includes(v) || rawSubLower.includes(v));
    const txHasVariant = variants.some(v => normDesc.includes(v) || normRawDesc.includes(v) || rawTxLower.includes(v));
    if (subHasVariant && txHasVariant) {
      if (isExactOrKnown || isRealisticReajuste) {
        return true;
      }
    }
  }

  // 8. Se for no mesmo cartão/conta e tiver palavras em comum com valor EXATO
  if (sub.accountId && tx.accountId && sub.accountId === tx.accountId) {
    const subWords = normSub.split(' ').filter(w => w.length >= 3);
    const descWords = normDesc.split(' ').filter(w => w.length >= 3);
    const hasCommonWord = subWords.some(w => descWords.includes(w) || normDesc.includes(w));
    if (hasCommonWord && isExactOrKnown) {
      return true;
    }
  }

  return false;
}

/**
 * Utilitário seguro para analisar strings de data (ex: 'YYYY-MM-DD' ou ISO)
 * como data local ao meio-dia, prevenindo que fusos horários a oeste de Greenwich
 * (como UTC-3 / Brasil) retrocedam a data para o dia anterior às 21h.
 */
export function parseLocalDateSafe(dateStr?: string | null): Date {
  if (!dateStr) return new Date();
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Retorna o dia habitual de cobrança/vencimento da assinatura (1–31).
 * Unifica a lógica em toda a aplicação e é 100% imune a desvios de fuso horário (UTC vs Local).
 */
export function getSubscriptionBillingDay(
  sub?: {
    dayOfMonth?: number;
    lastChargeDate?: string;
    nextBillingDate?: string;
  } | null
): number {
  if (!sub) return 1;

  // 1. Se possuir dayOfMonth válido (1 a 31)
  if (typeof sub.dayOfMonth === 'number' && sub.dayOfMonth >= 1 && sub.dayOfMonth <= 31) {
    return sub.dayOfMonth;
  }

  // 2. Extrai de lastChargeDate ou nextBillingDate (formato YYYY-MM-DD)
  // Prioriza lastChargeDate pois representa o dia real registrado no extrato/fatura
  const rawDateStr = sub.lastChargeDate || sub.nextBillingDate;
  if (rawDateStr) {
    const match = String(rawDateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const parsedDay = parseInt(match[3], 10);
      if (parsedDay >= 1 && parsedDay <= 31) {
        return parsedDay;
      }
    }
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) {
      const utcDay = d.getUTCDate();
      if (utcDay >= 1 && utcDay <= 31) return utcDay;
      return d.getDate();
    }
  }

  // 3. Fallback em nextBillingDate se lastChargeDate não forneceu dia válido
  if (sub.nextBillingDate) {
    const match = String(sub.nextBillingDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const parsedDay = parseInt(match[3], 10);
      if (parsedDay >= 1 && parsedDay <= 31) {
        return parsedDay;
      }
    }
  }

  return 1;
}

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
    // Apenas despesas confirmadas (ignora pagamentos de fatura, estornos e parcelamentos finitos)
    const expenses = transactions.filter(t => {
      if (t.type !== 'expense' || t.amount <= 0) return false;
      if (t.isInvoicePayment || isInvoicePaymentDescription(t.description)) return false;
      if (t.isRefund || t.isRefunded) return false;
      if (isInstallmentTransaction(t)) return false;
      return true;
    });

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
      // Ignora se qualquer transação do histórico deste estabelecimento for uma parcela definida
      const isInstallmentGroup = txList.some(t => isInstallmentTransaction(t));
      if (isInstallmentGroup) continue;
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

        // Calcular próxima cobrança prevista de forma segura (preservando o dia do mês)
        const dateMatch = latestTx.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        let nextYear: number;
        let nextMonth: number;
        let day: number;

        if (dateMatch) {
          nextYear = parseInt(dateMatch[1], 10);
          nextMonth = parseInt(dateMatch[2], 10) - 1; // 0-indexed
          day = parseInt(dateMatch[3], 10);
        } else {
          const d = new Date(latestTx.date);
          nextYear = d.getUTCFullYear();
          nextMonth = d.getUTCMonth();
          day = d.getUTCDate();
        }

        if (cadence === 'monthly') {
          nextMonth += 1;
          if (nextMonth > 11) {
            nextMonth = 0;
            nextYear += 1;
          }
        } else {
          nextYear += 1;
        }

        const daysInTargetMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const safeDay = Math.min(Math.max(1, day), daysInTargetMonth);
        const nextBillingDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

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
          nextBillingDate: nextBillingDateStr,
          dayOfMonth: safeDay,
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
    const active = subscriptions.filter(s => s.status === 'active' && s.type !== 'income');
    const total = active.reduce((acc, sub) => {
      if (sub.cadence === 'yearly') {
        return acc + (sub.amount / 12);
      }
      return acc + sub.amount;
    }, 0);

    return Math.round(total * 100) / 100;
  }

  /**
   * Calcula o total mensal de receitas recorrentes (salário, renda fixa)
   */
  calculateTotalMonthlyIncome(subscriptions: Subscription[]): number {
    const active = subscriptions.filter(s => s.status === 'active' && s.type === 'income');
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

    // Se o texto indicar compra parcelada com parcelas definidas, nunca é assinatura
    if (isInstallmentTransaction({ description })) {
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
      { keyword: 'max', displayName: 'Max', defaultCadence: 'monthly' },
      { keyword: 'hbo', displayName: 'Max', defaultCadence: 'monthly' },
      { keyword: 'deezer', displayName: 'Deezer', defaultCadence: 'monthly' },
      { keyword: 'meli+', displayName: 'Meli+', defaultCadence: 'monthly' },
      { keyword: 'meli plus', displayName: 'Meli+', defaultCadence: 'monthly' },
      { keyword: 'meli mais', displayName: 'Meli+', defaultCadence: 'monthly' },
      { keyword: 'melimais', displayName: 'Meli+', defaultCadence: 'monthly' },
      { keyword: 'youtube premium', displayName: 'YouTube Premium', defaultCadence: 'monthly' },
      { keyword: 'youtube music', displayName: 'YouTube Music', defaultCadence: 'monthly' },
      { keyword: 'apple music', displayName: 'Apple Music', defaultCadence: 'monthly' },
      { keyword: 'apple tv', displayName: 'Apple TV', defaultCadence: 'monthly' },
      { keyword: 'globoplay', displayName: 'Globoplay', defaultCadence: 'monthly' },
      { keyword: 'crunchyroll', displayName: 'Crunchyroll', defaultCadence: 'monthly' },
      { keyword: 'paramount', displayName: 'Paramount+', defaultCadence: 'monthly' },
      { keyword: 'xbox gamepass', displayName: 'Xbox Game Pass', defaultCadence: 'monthly' },
      { keyword: 'xbox game pass', displayName: 'Xbox Game Pass', defaultCadence: 'monthly' },
      { keyword: 'gamepass', displayName: 'Xbox Game Pass', defaultCadence: 'monthly' },
      { keyword: 'game pass', displayName: 'Xbox Game Pass', defaultCadence: 'monthly' },
      { keyword: 'xbox', displayName: 'Xbox Game Pass', defaultCadence: 'monthly' },
      { keyword: 'playstation plus', displayName: 'PlayStation Plus', defaultCadence: 'monthly' },
      { keyword: 'playstation', displayName: 'PlayStation Plus', defaultCadence: 'monthly' },
      { keyword: 'ps plus', displayName: 'PlayStation Plus', defaultCadence: 'monthly' },
      { keyword: 'ps+', displayName: 'PlayStation Plus', defaultCadence: 'monthly' },
      { keyword: 'play 5', displayName: 'PlayStation Plus', defaultCadence: 'monthly' },
      { keyword: 'ps5', displayName: 'PlayStation Plus', defaultCadence: 'monthly' },
      { keyword: 'icloud', displayName: 'iCloud', defaultCadence: 'monthly' },
      { keyword: 'google one', displayName: 'Google One', defaultCadence: 'monthly' },
      { keyword: 'google storage', displayName: 'Google Storage', defaultCadence: 'monthly' },
      { keyword: 'chatgpt', displayName: 'ChatGPT Plus', defaultCadence: 'monthly' },
      { keyword: 'openai', displayName: 'OpenAI', defaultCadence: 'monthly' },
      { keyword: 'microsoft 365', displayName: 'Microsoft 365', defaultCadence: 'monthly' },
      { keyword: 'office 365', displayName: 'Office 365', defaultCadence: 'monthly' },
      { keyword: 'adobe', displayName: 'Adobe Creative Cloud', defaultCadence: 'monthly' },
      { keyword: 'canva', displayName: 'Canva Pro', defaultCadence: 'monthly' },
      { keyword: 'ifood clube', displayName: 'iFood Clube', defaultCadence: 'monthly' },
      { keyword: 'ifood', displayName: 'iFood Clube', defaultCadence: 'monthly' },
      { keyword: '99 food', displayName: '99 Food', defaultCadence: 'monthly' },
      { keyword: '99food', displayName: '99 Food', defaultCadence: 'monthly' },
      { keyword: '99 pop', displayName: '99 Pop', defaultCadence: 'monthly' },
      { keyword: '99 pay', displayName: '99 Pay', defaultCadence: 'monthly' },
      { keyword: '99 corrida', displayName: '99 Corridas', defaultCadence: 'monthly' },
      { keyword: '99 corridas', displayName: '99 Corridas', defaultCadence: 'monthly' },
      { keyword: 'uber one', displayName: 'Uber One', defaultCadence: 'monthly' },
      { keyword: 'uber pass', displayName: 'Uber One', defaultCadence: 'monthly' },
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
        if (isInstallmentTransaction(t)) return false;
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
