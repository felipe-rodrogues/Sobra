/**
 * Sobra - Schema do Banco de Dados SQLite (Compatível com Open Finance)
 */

import { Category } from '../core/types';

export const SQLITE_SCHEMA = `
-- Tabela de Contas / Carteiras
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checking', 'credit_card', 'cash', 'savings', 'investment'
  balance REAL NOT NULL DEFAULT 0.0,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  open_finance_provider TEXT, -- 'pluggy', 'belvo' ou null
  open_finance_account_id TEXT, -- ID no agregador externo
  sync_status TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'synced', 'pending', 'error'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense'
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'pending_review'
  payment_method TEXT NOT NULL DEFAULT 'other', -- 'credit', 'debit', 'pix', 'cash', 'transfer', 'other'
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'notification', 'csv', 'open_finance'
  raw_notification_payload TEXT,
  external_id TEXT, -- ID no Open Finance ou banco externo
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- Tabela de Orçamentos Mensais por Categoria
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  monthly_limit REAL NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, month, year)
);

-- Tabela de Metas Financeiras
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0.0,
  target_date TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Fila de Notificações Detectadas Pendentes de Aprovação
CREATE TABLE IF NOT EXISTS pending_notifications (
  id TEXT PRIMARY KEY,
  bank_package TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  raw_title TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_amount REAL NOT NULL,
  parsed_merchant TEXT NOT NULL,
  parsed_type TEXT NOT NULL,
  parsed_payment_method TEXT NOT NULL,
  suggested_category_id TEXT,
  suggested_account_id TEXT,
  detected_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'approved', 'discarded'
);

-- Tabela de Assinaturas e Recorrências
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category_id TEXT NOT NULL,
  account_id TEXT,
  cadence TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
  next_billing_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled'
  previous_amount REAL,
  last_charge_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Tabela de Regras e Histórico de Aprendizado de Categorias
CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY,
  merchant_pattern TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL,
  user_override INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Tabela de Sugestões de Assinaturas Dispensadas
CREATE TABLE IF NOT EXISTS dismissed_subscription_suggestions (
  id TEXT PRIMARY KEY,
  merchant_pattern TEXT NOT NULL UNIQUE,
  dismissed_at TEXT NOT NULL
);

-- Índices para alta performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(year, month);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_category_rules_merchant ON category_rules(merchant_pattern);
`;

export const INITIAL_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  // Receitas (Salário no topo, outras receitas no rodapé)
  { id: 'cat-salario', name: 'Salário & Renda', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false },
  { id: 'cat-freelas', name: 'Freelas & Renda Extra', type: 'income', icon: 'Laptop', color: '#34D399', isCustom: false },
  { id: 'cat-invest', name: 'Rendimentos', type: 'income', icon: 'TrendingUp', color: '#059669', isCustom: false },
  { id: 'cat-outras-rec', name: 'Outras Receitas', type: 'income', icon: 'PlusCircle', color: '#6EE7B7', isCustom: false },
  
  // 1. Alimentação & Cozinha vs Comer Fora (Sem a redundante 'Alimentação Geral')
  { id: 'cat-mercado', name: 'Supermercado & Feira', type: 'expense', icon: 'ShoppingCart', color: '#10B981', isCustom: false, bucket: 'essentials' },
  { id: 'cat-restaurantes', name: 'Restaurantes & Delivery', type: 'expense', icon: 'Utensils', color: '#F97316', isCustom: false, bucket: 'lifestyle' },

  // 2. Transporte & Mobilidade (Uber, 99, combustível, metrô, ônibus, pedágio)
  { id: 'cat-transp', name: 'Transporte & Mobilidade', type: 'expense', icon: 'Car', color: '#5F72CE', isCustom: false, bucket: 'essentials' },

  // 3. Moradia & Contas da Casa
  { id: 'cat-moradia', name: 'Moradia', type: 'expense', icon: 'Home', color: '#78BC71', isCustom: false, bucket: 'essentials' },
  { id: 'cat-contas', name: 'Contas Residenciais', type: 'expense', icon: 'Zap', color: '#F59E0B', isCustom: false, bucket: 'essentials' },

  // 4. Saúde & Cuidados Cotidianos
  { id: 'cat-farmacia', name: 'Farmácia & Remédios', type: 'expense', icon: 'Pill', color: '#EF4444', isCustom: false, bucket: 'essentials' },
  { id: 'cat-saude', name: 'Saúde & Consultas', type: 'expense', icon: 'Heart', color: '#F43F5E', isCustom: false, bucket: 'essentials' },

  // 5. Estilo de Vida, Assinaturas & Lazer
  { id: 'cat-compras', name: 'Compras & Vestuário', type: 'expense', icon: 'ShoppingBag', color: '#EC4899', isCustom: false, bucket: 'lifestyle' },
  { id: 'cat-streaming', name: 'Assinaturas & Streaming', type: 'expense', icon: 'Tv', color: '#8B5CF6', isCustom: false, bucket: 'lifestyle' },
  { id: 'cat-lazer', name: 'Lazer', type: 'expense', icon: 'Film', color: '#AA84E1', isCustom: false, bucket: 'lifestyle' },
  { id: 'cat-cuidados', name: 'Cuidados & Beleza', type: 'expense', icon: 'Scissors', color: '#D946EF', isCustom: false, bucket: 'lifestyle' },
  { id: 'cat-pets', name: 'Pets', type: 'expense', icon: 'Dog', color: '#D97706', isCustom: false, bucket: 'lifestyle' },

  // 6. Educação, Financiamentos & Presentes
  { id: 'cat-educ', name: 'Educação', type: 'expense', icon: 'BookOpen', color: '#06B6D4', isCustom: false, bucket: 'essentials' },
  { id: 'cat-dividas', name: 'Dívidas & Financiamentos', type: 'expense', icon: 'Receipt', color: '#DC2626', isCustom: false, bucket: 'essentials' },
  { id: 'cat-presentes', name: 'Presentes & Doações', type: 'expense', icon: 'Gift', color: '#14B8A6', isCustom: false, bucket: 'lifestyle' },

  // 7. Futuro & Investimentos (Unificado em Investimentos & Reserva)
  { id: 'cat-invest-futuro', name: 'Investimentos & Reserva', type: 'expense', icon: 'TrendingUp', color: '#059669', isCustom: false, bucket: 'future' },

  // 8. Fallback / Outros
  { id: 'cat-outros-desp', name: 'Outras Despesas', type: 'expense', icon: 'MoreHorizontal', color: '#9EA3A9', isCustom: false, bucket: 'lifestyle' },
];
