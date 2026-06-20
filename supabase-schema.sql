-- ============================================================
-- KasFlow — Complete Supabase Schema
-- Last updated: 2026-06-20
-- Run this ENTIRE file in Supabase SQL Editor to set up a fresh project.
-- For existing projects, apply only the NEW sections from supabase-migrations/.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- RLS helper: resolve company_id from the current auth user
CREATE OR REPLACE FUNCTION auth_user_company_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM users WHERE uid = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 1. BUSINESS PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL DEFAULT 'Bisnis Baru',
  owner_name TEXT NOT NULL DEFAULT 'Owner',
  business_type TEXT NOT NULL DEFAULT 'retail'
    CHECK (business_type IN ('retail', 'service', 'online_shop', 'distributor', 'freelancer')),
  tax_number TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'IDR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. USERS (maps Supabase auth.users → business_profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'accountant', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_company_id ON users(company_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. ACCOUNTS (Chart of Accounts — COA)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  sub_type TEXT,
  normal_balance TEXT NOT NULL
    CHECK (normal_balance IN ('debit', 'credit')),
  parent_id TEXT,
  is_cash BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  neraca_section TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_company_id ON accounts(company_id);
CREATE INDEX idx_accounts_code ON accounts(company_id, code);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. ACCOUNT CATEGORIES (income / expense buckets)
-- ============================================================
CREATE TABLE IF NOT EXISTS account_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  account_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_categories_company_id ON account_categories(company_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. CASH ACCOUNTS (cash / bank / e-wallet)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet')),
  account_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_accounts_company_id ON cash_accounts(company_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cash_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_deleted_at ON customers(company_id, deleted_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX idx_suppliers_deleted_at ON suppliers(company_id, deleted_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  type TEXT NOT NULL
    CHECK (type IN ('income', 'expense', 'transfer', 'capital')),
  date DATE NOT NULL,
  category_id TEXT,
  cash_account_id TEXT,
  source_account_id TEXT,
  destination_account_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted', 'void')),
  capital_type TEXT
    CHECK (capital_type IN ('setoran', 'prive', 'dividen')),
  marketplace_connection_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_company_id ON transactions(company_id);
CREATE INDEX idx_transactions_date ON transactions(company_id, date DESC);
CREATE INDEX idx_transactions_deleted_at ON transactions(company_id, deleted_at);
CREATE INDEX idx_transactions_capital_type ON transactions(company_id, capital_type)
  WHERE capital_type IS NOT NULL;
CREATE INDEX idx_transactions_mkp_conn ON transactions(company_id, marketplace_connection_id)
  WHERE marketplace_connection_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. JOURNAL ENTRIES (source of truth for all reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  transaction_id TEXT,
  date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted', 'locked')),
  source TEXT NOT NULL DEFAULT 'transaction'
    CHECK (source IN ('transaction', 'opening_balance', 'closing', 'manual', 'seed', 'marketplace')),
  marketplace_connection_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(company_id, date DESC);
CREATE INDEX idx_journal_entries_deleted_at ON journal_entries(company_id, deleted_at);
CREATE INDEX idx_journal_entries_transaction_id ON journal_entries(transaction_id);
CREATE INDEX idx_journal_entries_mkp_conn ON journal_entries(company_id, marketplace_connection_id)
  WHERE marketplace_connection_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. TAX SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_settings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  name TEXT NOT NULL DEFAULT 'PPh Final UMKM',
  rate NUMERIC NOT NULL DEFAULT 0.005,
  base TEXT NOT NULL DEFAULT 'gross_revenue'
    CHECK (base IN ('gross_revenue', 'net_profit')),
  due_day INTEGER NOT NULL DEFAULT 15,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_settings_company_id ON tax_settings(company_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tax_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. ACCOUNTING PERIODS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounting_periods_company_id ON accounting_periods(company_id);
CREATE INDEX idx_accounting_periods_status ON accounting_periods(company_id, status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  "user" TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL
    CHECK (action IN ('create', 'update', 'delete', 'export', 'reset', 'restore', 'close_period')),
  module TEXT NOT NULL DEFAULT '',
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(company_id, timestamp DESC);

-- ============================================================
-- 13. MARKETPLACE CONNECTIONS (TikTok Shop, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_connections (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  platform TEXT NOT NULL DEFAULT 'tiktok_shop',
  shop_id TEXT,
  shop_name TEXT,
  display_name TEXT,
  shop_cipher TEXT,
  region TEXT,
  seller_type TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_start_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'expired', 'error')),
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, platform, shop_id)
);

CREATE INDEX idx_mkp_conn_company ON marketplace_connections(company_id);
CREATE INDEX idx_mkp_conn_deleted ON marketplace_connections(company_id, deleted_at);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 14. MARKETPLACE ACCOUNT MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_account_mapping (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  mapping_type TEXT NOT NULL
    CHECK (mapping_type IN ('revenue', 'platform_fee', 'shipping_fee', 'adjustment', 'receivable', 'settlement_bank')),
  kasflow_account_id TEXT,
  kasflow_cash_account_id TEXT,
  kasflow_category_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, mapping_type)
);

CREATE INDEX idx_mkp_mapping_company ON marketplace_account_mapping(company_id);
CREATE INDEX idx_mkp_mapping_connection ON marketplace_account_mapping(connection_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_account_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 15. MARKETPLACE ORDERS (cache from platform API)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  platform_order_id TEXT NOT NULL,
  platform_status TEXT,
  order_create_time TIMESTAMPTZ,
  order_update_time TIMESTAMPTZ,
  currency TEXT DEFAULT 'IDR',
  subtotal NUMERIC(15,2) DEFAULT 0,
  shipping_fee NUMERIC(15,2) DEFAULT 0,
  seller_discount NUMERIC(15,2) DEFAULT 0,
  platform_discount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  settlement_status TEXT DEFAULT 'unsettled'
    CHECK (settlement_status IN ('settled', 'unsettled', 'processing', 'failed')),
  statement_id TEXT,
  settlement_amount NUMERIC(15,2) DEFAULT 0,
  revenue_amount NUMERIC(15,2) DEFAULT 0,
  fee_amount NUMERIC(15,2) DEFAULT 0,
  adjustment_amount NUMERIC(15,2) DEFAULT 0,
  shipping_cost_amount NUMERIC(15,2) DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'error', 'skipped')),
  kasflow_transaction_id TEXT,
  kasflow_journal_id TEXT,
  synced_at TIMESTAMPTZ,
  raw_data JSONB,
  cancellation_initiator TEXT,
  shipping_provider TEXT,
  buyer_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_order_id)
);

CREATE INDEX idx_mkp_orders_company ON marketplace_orders(company_id);
CREATE INDEX idx_mkp_orders_sync ON marketplace_orders(company_id, sync_status);
CREATE INDEX idx_mkp_orders_date ON marketplace_orders(company_id, order_create_time DESC);
CREATE INDEX idx_mkp_orders_settlement ON marketplace_orders(company_id, settlement_status);
CREATE INDEX idx_mkp_orders_statement ON marketplace_orders(statement_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 16. MARKETPLACE ORDER ITEMS (SKU-level detail)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES marketplace_orders(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  sku_id TEXT,
  sku_name TEXT,
  product_name TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(15,2) DEFAULT 0,
  settlement_amount NUMERIC(15,2) DEFAULT 0,
  revenue_amount NUMERIC(15,2) DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mkp_items_order ON marketplace_order_items(order_id);
CREATE INDEX idx_mkp_items_company ON marketplace_order_items(company_id);

-- ============================================================
-- 17. MARKETPLACE STATEMENTS (settlement cache + approval workflow)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_statements (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  platform_statement_id TEXT NOT NULL,
  statement_time TIMESTAMPTZ,
  currency TEXT DEFAULT 'IDR',
  settlement_amount NUMERIC(15,2) DEFAULT 0,
  revenue_amount NUMERIC(15,2) DEFAULT 0,
  fee_amount NUMERIC(15,2) DEFAULT 0,
  adjustment_amount NUMERIC(15,2) DEFAULT 0,
  net_sales_amount NUMERIC(15,2) DEFAULT 0,
  shipping_cost_amount NUMERIC(15,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'PROCESSING'
    CHECK (payment_status IN ('PAID', 'FAILED', 'PROCESSING')),
  payment_id TEXT,
  payment_time TIMESTAMPTZ,
  reconciled BOOLEAN DEFAULT FALSE,
  kasflow_income_txn_id TEXT,
  kasflow_expense_txn_id TEXT,
  kasflow_transfer_txn_id TEXT,
  order_count INTEGER DEFAULT 0,
  approval_status TEXT DEFAULT 'pending_approval'
    CHECK (approval_status IN ('pending_approval', 'approved', 'rejected', 'auto_approved')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_statement_id)
);

CREATE INDEX idx_mkp_stmt_company ON marketplace_statements(company_id);
CREATE INDEX idx_mkp_stmt_date ON marketplace_statements(company_id, statement_time DESC);
CREATE INDEX idx_mkp_stmt_payment ON marketplace_statements(company_id, payment_status);
CREATE INDEX idx_statements_approval_status ON marketplace_statements(company_id, approval_status)
  WHERE approval_status = 'pending_approval';
CREATE INDEX idx_statements_approval_filter ON marketplace_statements(company_id, connection_id, approval_status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN marketplace_statements.approval_status IS
  'Approval workflow: pending_approval | approved | rejected | auto_approved';

-- ============================================================
-- 18. MARKETPLACE SYNC LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_sync_logs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  sync_type TEXT NOT NULL
    CHECK (sync_type IN ('orders', 'statements', 'unsettled', 'full', 'backfill')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'error', 'partial')),
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mkp_synclog_company ON marketplace_sync_logs(company_id);
CREATE INDEX idx_mkp_synclog_date ON marketplace_sync_logs(company_id, started_at DESC);
CREATE INDEX idx_mkp_synclog_connection ON marketplace_sync_logs(connection_id);

-- ============================================================
-- FOREIGN KEYS: marketplace → core tables
-- ============================================================
ALTER TABLE transactions
  ADD CONSTRAINT fk_txn_mkp_conn
  FOREIGN KEY (marketplace_connection_id) REFERENCES marketplace_connections(id);

ALTER TABLE journal_entries
  ADD CONSTRAINT fk_je_mkp_conn
  FOREIGN KEY (marketplace_connection_id) REFERENCES marketplace_connections(id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — all tables
-- ============================================================
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_account_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sync_logs ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "Users can read own row" ON users FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "Users can update own row" ON users FOR UPDATE USING (auth.uid() = uid);
CREATE POLICY "Users can insert own row" ON users FOR INSERT WITH CHECK (auth.uid() = uid);

-- Business Profiles: via users.company_id
CREATE POLICY "Users can read own company" ON business_profiles FOR SELECT USING (id = auth_user_company_id());
CREATE POLICY "Users can update own company" ON business_profiles FOR UPDATE USING (id = auth_user_company_id());
CREATE POLICY "Users can insert own company" ON business_profiles FOR INSERT WITH CHECK (id = auth_user_company_id());

-- Generic company-scoped CRUD policies
-- Accounts
CREATE POLICY "Company accounts read" ON accounts FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company accounts write" ON accounts FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company accounts update" ON accounts FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company accounts delete" ON accounts FOR DELETE USING (company_id = auth_user_company_id());

-- Account Categories
CREATE POLICY "Company categories read" ON account_categories FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company categories write" ON account_categories FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company categories update" ON account_categories FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company categories delete" ON account_categories FOR DELETE USING (company_id = auth_user_company_id());

-- Cash Accounts
CREATE POLICY "Company cash accounts read" ON cash_accounts FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company cash accounts write" ON cash_accounts FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company cash accounts update" ON cash_accounts FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company cash accounts delete" ON cash_accounts FOR DELETE USING (company_id = auth_user_company_id());

-- Customers
CREATE POLICY "Company customers read" ON customers FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company customers write" ON customers FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company customers update" ON customers FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company customers delete" ON customers FOR DELETE USING (company_id = auth_user_company_id());

-- Suppliers
CREATE POLICY "Company suppliers read" ON suppliers FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company suppliers write" ON suppliers FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company suppliers update" ON suppliers FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company suppliers delete" ON suppliers FOR DELETE USING (company_id = auth_user_company_id());

-- Transactions
CREATE POLICY "Company transactions read" ON transactions FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company transactions write" ON transactions FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company transactions update" ON transactions FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company transactions delete" ON transactions FOR DELETE USING (company_id = auth_user_company_id());

-- Journal Entries
CREATE POLICY "Company journals read" ON journal_entries FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company journals write" ON journal_entries FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company journals update" ON journal_entries FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company journals delete" ON journal_entries FOR DELETE USING (company_id = auth_user_company_id());

-- Tax Settings
CREATE POLICY "Company tax read" ON tax_settings FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company tax write" ON tax_settings FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company tax update" ON tax_settings FOR UPDATE USING (company_id = auth_user_company_id());

-- Accounting Periods
CREATE POLICY "Company periods read" ON accounting_periods FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company periods write" ON accounting_periods FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company periods update" ON accounting_periods FOR UPDATE USING (company_id = auth_user_company_id());

-- Audit Logs
CREATE POLICY "Company audit read" ON audit_logs FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company audit write" ON audit_logs FOR INSERT WITH CHECK (company_id = auth_user_company_id());

-- Marketplace Connections
CREATE POLICY "Company mkp connections read" ON marketplace_connections FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp connections write" ON marketplace_connections FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp connections update" ON marketplace_connections FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp connections delete" ON marketplace_connections FOR DELETE USING (company_id = auth_user_company_id());

-- Marketplace Account Mapping
CREATE POLICY "Company mkp mapping read" ON marketplace_account_mapping FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp mapping write" ON marketplace_account_mapping FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp mapping update" ON marketplace_account_mapping FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp mapping delete" ON marketplace_account_mapping FOR DELETE USING (company_id = auth_user_company_id());

-- Marketplace Orders
CREATE POLICY "Company mkp orders read" ON marketplace_orders FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp orders write" ON marketplace_orders FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp orders update" ON marketplace_orders FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp orders delete" ON marketplace_orders FOR DELETE USING (company_id = auth_user_company_id());

-- Marketplace Order Items
CREATE POLICY "Company mkp items read" ON marketplace_order_items FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp items write" ON marketplace_order_items FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp items update" ON marketplace_order_items FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp items delete" ON marketplace_order_items FOR DELETE USING (company_id = auth_user_company_id());

-- Marketplace Statements
CREATE POLICY "Company mkp statements read" ON marketplace_statements FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp statements write" ON marketplace_statements FOR INSERT WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp statements update" ON marketplace_statements FOR UPDATE USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp statements delete" ON marketplace_statements FOR DELETE USING (company_id = auth_user_company_id());

-- Marketplace Sync Logs
CREATE POLICY "Company mkp synclogs read" ON marketplace_sync_logs FOR SELECT USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp synclogs write" ON marketplace_sync_logs FOR INSERT WITH CHECK (company_id = auth_user_company_id());

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE business_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE account_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE tax_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE accounting_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_statements;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_sync_logs;
