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
  // Receitas
  { id: 'cat-salario', name: 'Salário & Renda', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false },
  { id: 'cat-invest', name: 'Rendimentos', type: 'income', icon: 'TrendingUp', color: '#059669', isCustom: false },
  { id: 'cat-outras-rec', name: 'Outras Receitas', type: 'income', icon: 'PlusCircle', color: '#34D399', isCustom: false },
  
  // Despesas (Cores da paleta fiel ao Mockup)
  { id: 'cat-moradia', name: 'Moradia & Contas', type: 'expense', icon: 'Home', color: '#78BC71', isCustom: false },
  { id: 'cat-alim', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#E79F52', isCustom: false },
  { id: 'cat-transp', name: 'Transporte', type: 'expense', icon: 'Car', color: '#5F72CE', isCustom: false },
  { id: 'cat-saude', name: 'Saúde', type: 'expense', icon: 'Heart', color: '#EF4444', isCustom: false },
  { id: 'cat-lazer', name: 'Lazer & Entretenimento', type: 'expense', icon: 'Film', color: '#AA84E1', isCustom: false },
  { id: 'cat-educ', name: 'Educação', type: 'expense', icon: 'BookOpen', color: '#EC4899', isCustom: false },
  { id: 'cat-compras', name: 'Compras & Vestuário', type: 'expense', icon: 'ShoppingBag', color: '#F97316', isCustom: false },
  { id: 'cat-outros-desp', name: 'Outras Despesas', type: 'expense', icon: 'MoreHorizontal', color: '#9EA3A9', isCustom: false },
];
