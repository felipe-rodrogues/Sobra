/**
 * Sobra - Controle Financeiro Pessoal
 * Definições de Tipos do Domínio (Pronto para Open Finance)
 */

export type AccountType = 
  | 'checking'    // Conta Corrente
  | 'credit_card' // Cartão de Crédito
  | 'cash'        // Dinheiro
  | 'savings'     // Poupança
  | 'investment'; // Investimentos

export type SyncStatus = 'manual' | 'synced' | 'pending' | 'error';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  icon: string;
  currency: string; // 'BRL', etc.
  bankId?: string; // 'nubank', 'itau', 'bradesco', etc.
  creditLimit?: number; // Limite total para cartões de crédito
  closingDay?: number; // Dia de fechamento da fatura (ex: 1, 4, 15)
  dueDay?: number; // Dia de vencimento da fatura (ex: 8, 10, 20)
  cardBrand?: 'mastercard' | 'visa' | 'elo' | 'amex' | 'other';
  lastDigits?: string; // Últimos 4 dígitos do cartão principal/titular
  additionalCardLastDigits?: string; // Últimos 4 dígitos do cartão adicional (ex: parceiro/dependente)
  additionalCardHolderName?: string; // Nome do portador do cartão adicional (ex: "Jéssica Furtado")
  additionalCards?: AdditionalCard[]; // Lista extensível de cartões adicionais vinculados à mesma fatura
  linkedAccountId?: string; // Conta corrente vinculada para débito/pagamento
  invoiceAmount?: number; // Valor específico da fatura fechada
  openAmount?: number; // Valor total em aberto
  invoiceStatus?: 'closed' | 'open' | 'paid' | 'overdue'; // 'closed' (Fechada), 'open' (Aberta), 'paid' (Paga), 'overdue' (Vencida)
  invoiceMonth?: number; // Mês da fatura selecionada para pagamento/visualização (1-12)
  invoiceYear?: number; // Ano da fatura selecionada para pagamento/visualização
  
  // Open Finance Fields (agregadores como Pluggy / Belvo)
  openFinanceProvider?: 'pluggy' | 'belvo' | null;
  openFinanceAccountId?: string | null;
  syncStatus: SyncStatus;

  // Compartilhamento e Contas Conjuntas
  isShared?: boolean;
  ownerId?: string;
  ownerName?: string;
  sharedMembers?: SharedMember[];
  inviteCode?: string;
  splitRatio?: number; // Ex: 0.5 para considerar 50% dos gastos no fluxo de caixa pessoal
  splitMode?: 'full' | 'half' | 'none'; // 'full' (100%), 'half' (50%), 'none' (0% - apenas visualização)
  
  createdAt: string;
  updatedAt: string;
}

export interface AdditionalCard {
  id: string;
  lastDigits: string; // Últimos 4 dígitos do cartão adicional (ex: "4432")
  holderName?: string; // Nome no cartão adicional (ex: "Jéssica Furtado")
}

export interface SharedMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface SharedCardInvite {
  code: string; // Ex: SOBRA-4892
  accountId: string;
  accountName: string;
  ownerId: string;
  ownerName: string;
  bankId?: string;
  color?: string;
  creditLimit?: number;
  type?: AccountType;
  lastDigits?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface PartnershipSpace {
  id: string;
  code: string; // Ex: SOBRA-CASAL-8491 ou SOBRA-8491
  isActive: boolean;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl?: string;
  partnerId?: string;
  partnerName?: string;
  partnerEmail?: string;
  partnerAvatarUrl?: string;
  joinedAt?: string;
  defaultSplitUser?: number; // % padrão do usuário (ex: 50, 60). Padrão: 50
  defaultSplitPartner?: number; // % padrão do parceiro (ex: 50, 40). Padrão: 50
}

export type CategoryType = 'income' | 'expense';

export type CategoryBucket = 'essentials' | 'lifestyle' | 'future';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isCustom: boolean;
  bucket?: CategoryBucket;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'confirmed' | 'pending_review';
export type PaymentMethod = 'credit' | 'debit' | 'pix' | 'cash' | 'transfer' | 'other';
export type TransactionSource = 'manual' | 'notification' | 'csv' | 'open_finance';

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: string; // ISO 8601 YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  source: TransactionSource;
  cardLastDigits?: string; // 4 dígitos do cartão utilizado (titular ou adicional)
  
  // Transferência entre Contas
  destinationAccountId?: string; // Conta de destino quando type === 'transfer'

  // Estornos e Reembolsos de Cartão
  isRefund?: boolean; // Se true, representa o lançamento de crédito / estorno na fatura
  isRefunded?: boolean; // Se true, a despesa original foi estornada
  refundDate?: string; // Data em que o estorno ocorreu
  refundAmount?: number; // Valor estornado
  refundTransactionId?: string; // ID do lançamento de estorno gerado
  refundedTransactionId?: string; // ID da despesa original estornada

  // Quitação / Pagamento de Fatura de Cartão
  isInvoicePayment?: boolean; // Se true, representa a quitação de fatura e não deve ser computada como despesa de consumo duplicada

  // Auditoria e Rastreabilidade
  rawNotificationPayload?: string | null;
  externalId?: string | null; // ID da transação no banco / agregador Open Finance
  notes?: string | null;

  // Parcelamento em Cartão de Crédito
  isInstallment?: boolean;
  installmentGroupId?: string;
  installmentNumber?: number; // ex: 1, 2...
  installmentTotal?: number;  // ex: 10
  originalTotalAmount?: number; // ex: 1200.00

  // Compartilhamento e Autoria
  isShared?: boolean;
  createdById?: string;
  createdByName?: string; // Ex: "Felipe", exibido no badge do extrato
  
  // Competência Financeira / Adiantamento Salarial
  competenceMonth?: number; // 1 - 12: Mês em que a transação produz efeito no orçamento/fluxo
  competenceYear?: number;  // YYYY: Ano de competência
  isSalaryAdvance?: boolean; // Sinaliza que a receita foi antecipada do ciclo seguinte

  // Recorrência
  isRecurring?: boolean; // Sinaliza que a transação é recorrente (ex: salário mensal, receita fixa)
  recurringCadence?: SubscriptionCadence; // Cadência da recorrência ('monthly' | 'yearly')
  recurringDayOfMonth?: number; // Dia habitual do mês em que cai a receita recorrente (1–31)
  
  createdAt: string;
  updatedAt: string;
}

export interface CardDateStatus {
  bestPurchaseDay: number; // Ex: dia 2 (dia seguinte ao fechamento)
  bestPurchaseDayFormatted: string; // "Dia 02"
  isInvoiceClosed: boolean; // Se a fatura do ciclo atual já fechou
  daysUntilClosing: number; // Dias restantes para fechar
  daysUntilDue: number; // Dias restantes para o vencimento
  statusText: string; // Ex: "Fecha em 4 dias", "Fatura fechada • Vence em 6 dias", "Sem pendências"
  statusBadgeVariant: 'warning' | 'info' | 'success' | 'danger';
  displayStatus: 'open' | 'closed' | 'overdue' | 'paid' | 'zero';
  statusLabel: string; // "Aberta" | "Fechada" | "Vencida" | "Paga" | "Em dia"
  cycleClosingDateFormatted: string; // Ex: "01/SET" ou "02/OUT"
  cycleDueDateFormatted: string; // Ex: "07/SET" ou "10/OUT"
}

export interface InvoiceMonthProjection {
  month: number; // 1 - 12
  year: number;  // YYYY
  monthLabel: string; // "Outubro/2026"
  totalAmount: number;
  transactions: Transaction[];
  closingDate?: string;
  dueDate?: string;
  status: 'closed' | 'open' | 'future';
}

export interface ActiveInstallmentGroup {
  groupId: string;
  description: string;
  accountId: string;
  categoryId: string;
  originalTotalAmount: number;
  installmentTotal: number;
  paidInstallmentsCount: number;
  remainingInstallmentsCount: number;
  monthlyAmount: number;
  remainingAmount: number;
  startDate: string;
  nextBillingDate?: string;
  nextTransactionDate?: string;
  transactions: Transaction[];
  isCompleted?: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  month: number; // 1 - 12
  year: number;  // YYYY
  isShared?: boolean;
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
}

export type BudgetAlertStatus = 'normal' | 'warning' | 'danger';

export interface BudgetCalculationResult {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentageSpent: number;
  status: BudgetAlertStatus; // normal (<80%), warning (80-100%), danger (>100%)
}

// --- Orçamento por 3 Baldes (Realidade BR) ---
export interface ThreeBucketsConfig {
  month: number;
  year: number;
  customIncome?: number; // Renda manual opcional informada pelo usuário
  essentialsPct: number; // Ex: 70
  lifestylePct: number;  // Ex: 20
  futurePct: number;     // Ex: 10
  isCustomized: boolean; // Se o usuário alterou a sugestão automática
  updatedAt: string;
}

export interface BucketCalculation {
  bucket: CategoryBucket;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  percentageTarget: number;
  targetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageSpent: number;
  dailyAvailableRestOfMonth: number;
  status: BudgetAlertStatus;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    spent: number;
    color: string;
    icon: string;
  }>;
}

export interface ThreeBucketsSummary {
  referenceIncome: number;
  incomeSource: 'manual' | 'current_month' | 'historical_average' | 'minimum_wage';
  totalSpent: number;
  totalTarget: number;
  overallSobra: number;
  buckets: {
    essentials: BucketCalculation;
    lifestyle: BucketCalculation;
    future: BucketCalculation;
  };
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // YYYY-MM-DD (opcional)
  color: string;
  icon: string;
  isCompleted: boolean;
  createdAt: string;
  autoContributionEnabled?: boolean;
  monthlyContributionAmount?: number;
  lastAutoContributionDate?: string;
  isShared?: boolean;
  ownerId?: string;
  ownerName?: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  isAutomatic: boolean;
  note?: string;
  contributedById?: string;
  contributedByName?: string;
  createdAt: string;
}

export interface GoalCalculationResult {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageCompleted: number;
  daysRemaining: number | null;
  isCompleted: boolean;
  isOverdue: boolean;
}

export interface PendingNotification {
  id: string;
  bankPackage: string;
  bankName: string;
  bankId?: string;
  rawTitle: string;
  rawText: string;
  parsedAmount: number;
  parsedMerchant: string;
  parsedType: 'expense' | 'income';
  /**
   * Sub-tipo semântico que determina o fluxo de confirmação no modal:
   * - 'expense'  → compra/pagamento (fluxo padrão)
   * - 'income'   → Pix/depósito recebido
   * - 'cashback' → pergunta: "deseja registrar como receita?"
   * - 'refund'   → pergunta: "deseja inserir como crédito na fatura?"
   */
  notificationKind?: 'expense' | 'income' | 'cashback' | 'refund';
  parsedPaymentMethod: PaymentMethod;
  detectedBalance?: number | null; // Saldo da conta capturado na notificação
  suggestedCategoryId?: string;
  suggestedAccountId?: string;
  detectedAt: string;
  status: 'pending' | 'approved' | 'discarded';
  isSuspectedDuplicate?: boolean;
  duplicateReason?: string;
  // Detecção de Parcelamento
  isInstallment?: boolean;
  installmentCount?: number;
  installmentNumber?: number;
  installmentAmount?: number;
  originalTotalAmount?: number;
  isFromSms?: boolean;
  cardLastDigits?: string; // Últimos 4 dígitos do cartão capturado na notificação (ex: "5023")
  requiresAccountRegistration?: boolean; // Se o banco/cartão detectado ainda não foi cadastrado no app
  isUnregisteredBank?: boolean; // Indicador de banco não vinculado a contas existentes
  generatedTransactionId?: string; // ID da transação criada diretamente na fatura
}

export interface ParsedBankNotification {
  bankId: string;
  bankName: string;
  amount: number;
  merchant: string;
  type: 'expense' | 'income';
  /**
   * Sub-tipo semântico da notificação:
   * - 'expense'  → compra/pagamento confirmado (padrão)
   * - 'income'   → Pix/TED/depósito recebido
   * - 'cashback' → recompensa detectada; pergunta se quer lançar como receita
   * - 'refund'   → estorno/reembolso detectado; pergunta se quer inserir na fatura
   */
  notificationKind?: 'expense' | 'income' | 'cashback' | 'refund';
  paymentMethod: PaymentMethod;
  detectedBalance?: number | null; // Saldo da conta capturado na notificação
  cardLastDigits?: string; // Últimos 4 dígitos do cartão capturado (ex: "5023")
  confidence: number; // 0.0 to 1.0
  rawTitle: string;
  rawText: string;
  timestamp: string;
  // Detecção Inteligente de Parcelamento
  isInstallment?: boolean;
  installmentCount?: number;
  installmentNumber?: number;
  installmentAmount?: number;
  originalTotalAmount?: number;
  isFromSms?: boolean;
}

// --- Categorização Inteligente Local ---
export interface CategoryRule {
  id: string;
  merchantPattern: string; // Termo normalizado (ex: 'ifood', 'padaria estrela')
  categoryId: string;
  userOverride: boolean;
  updatedAt: string;
}

// --- Regras de Padronização de Nomes / Descrições (Merchant Cleaning Rules) ---
export interface DescriptionRule {
  id: string;
  pattern: string; // Termo normalizado de busca (ex: 'ifood', 'uber', 'posto shell')
  replacement: string; // Nome limpo padronizado (ex: 'iFood', 'Uber', 'Posto Shell')
  userOverride: boolean;
  updatedAt: string;
}

// --- Assinaturas & Recorrências ---
export type SubscriptionCadence = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled';
export type SubscriptionSentiment = 'keep' | 'doubt' | 'cancel'; // 'Uso sempre' | 'Em dúvida' | 'Quero cancelar'

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  accountId?: string;
  cadence: SubscriptionCadence;
  nextBillingDate: string; // YYYY-MM-DD
  status: SubscriptionStatus;
  sentiment?: SubscriptionSentiment; // Autoavaliação do usuário: 'keep' (Uso sempre), 'doubt' (Em dúvida), 'cancel' (Quero cancelar)
  type?: 'expense' | 'income'; // Permite diferenciar assinaturas de despesa e receitas recorrentes (salário, renda fixa)
  previousAmount?: number; // Armazena valor anterior para detecção de reajuste
  lastChargeDate?: string; // Data da última cobrança observada
  dayOfMonth?: number; // Dia habitual do mês em que cai a cobrança/receita (1–31)
  isShared?: boolean;
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSuggestion {
  id: string;
  merchantName: string;
  amount: number;
  previousAmount?: number;
  categoryId: string;
  accountId?: string;
  cadence: SubscriptionCadence;
  intervalDays: number;
  transactionCount: number;
  lastDate: string;
  nextBillingDate: string;
  transactions: Transaction[];
}

export interface CategoryOverlapAlert {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  subscriptions: Subscription[];
  totalMonthlyAmount: number;
}
