-- ============================================================
-- KasFlow Marketplace Integration — Supabase Migration
-- ============================================================
-- Keputusan arsitektur yang disepakati:
--   1. Statement-based sync: transaksi KasFlow dibuat per statement harian,
--      bukan per order. 1 statement = max 3 transaksi (income, expense, transfer).
--   2. Dimension/tag approach: marketplace_connection_id sebagai filter reporting,
--      bukan akun terpisah per toko. CoA tetap clean.
--   3. Dual-layer reporting: laporan akuntansi konsolidasi (existing) +
--      analytics per toko (dari tabel marketplace cache).
--   4. Idempotency: statement yang sudah punya kasflow_transaction_id tidak
--      dijurnal ulang. Re-sync aman dari duplikasi.
--   5. Order cache: marketplace_orders & items hanya untuk analytics/dashboard,
--      TIDAK langsung membuat transaksi KasFlow.
--
-- Konsisten dengan schema existing:
--   - TEXT primary keys (bukan UUID)
--   - company_id TEXT REFERENCES business_profiles(id)
--   - RLS via auth_user_company_id()
--   - Trigger auto-update updated_at
-- ============================================================

-- ============================================================
-- 1. MARKETPLACE CONNECTIONS
-- ============================================================
-- Menyimpan koneksi OAuth ke marketplace (TikTok Shop, dll)
CREATE TABLE IF NOT EXISTS marketplace_connections (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  platform TEXT NOT NULL DEFAULT 'tiktok_shop',
  shop_id TEXT,
  shop_name TEXT,                            -- Nama toko dari marketplace API (read-only)
  display_name TEXT,                         -- Label custom dari user (optional, fallback ke shop_name)
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

COMMENT ON TABLE marketplace_connections IS
  'OAuth connections ke marketplace (TikTok Shop, Shopee, dll). '
  'shop_name = nama asli dari API, display_name = label custom user. '
  'UI menampilkan COALESCE(display_name, shop_name).';

-- ============================================================
-- 2. MARKETPLACE ACCOUNT MAPPING
-- ============================================================
-- Mapping antara tipe transaksi marketplace → akun KasFlow
CREATE TABLE IF NOT EXISTS marketplace_account_mapping (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),
  mapping_type TEXT NOT NULL
    CHECK (mapping_type IN (
      'revenue',           -- Pendapatan penjualan
      'platform_fee',      -- Biaya komisi platform
      'shipping_fee',      -- Ongkos kirim
      'adjustment',        -- Penyesuaian (refund, penalty, dll)
      'receivable',        -- Piutang marketplace (belum cair ke bank)
      'settlement_bank'    -- Akun bank penerima payout
    )),
  kasflow_account_id TEXT,
  kasflow_cash_account_id TEXT,
  kasflow_category_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, mapping_type)
);

CREATE INDEX idx_mkp_mapping_company ON marketplace_account_mapping(company_id);
CREATE INDEX idx_mkp_mapping_connection ON marketplace_account_mapping(connection_id);

COMMENT ON TABLE marketplace_account_mapping IS
  'Mapping akun: setiap tipe transaksi marketplace dipetakan ke akun/kategori/kas KasFlow. '
  'User bisa custom mapping ini saat setup koneksi.';

-- ============================================================
-- 3. MARKETPLACE ORDERS (Cache)
-- ============================================================
-- Cache order dari marketplace, source of truth untuk UI
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),

  -- TikTok order data
  platform_order_id TEXT NOT NULL,
  platform_status TEXT,
  order_create_time TIMESTAMPTZ,
  order_update_time TIMESTAMPTZ,

  -- Financial
  currency TEXT DEFAULT 'IDR',
  subtotal NUMERIC(15,2) DEFAULT 0,
  shipping_fee NUMERIC(15,2) DEFAULT 0,
  seller_discount NUMERIC(15,2) DEFAULT 0,
  platform_discount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,

  -- Settlement (diisi dari Finance API setelah settle)
  settlement_status TEXT DEFAULT 'unsettled'
    CHECK (settlement_status IN ('settled', 'unsettled', 'processing', 'failed')),
  statement_id TEXT,
  settlement_amount NUMERIC(15,2) DEFAULT 0,
  revenue_amount NUMERIC(15,2) DEFAULT 0,
  fee_amount NUMERIC(15,2) DEFAULT 0,
  adjustment_amount NUMERIC(15,2) DEFAULT 0,
  shipping_cost_amount NUMERIC(15,2) DEFAULT 0,

  -- Sync ke KasFlow
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'error', 'skipped')),
  kasflow_transaction_id TEXT,
  kasflow_journal_id TEXT,
  synced_at TIMESTAMPTZ,

  -- Meta
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

COMMENT ON TABLE marketplace_orders IS
  'Cache order dari marketplace. HANYA untuk analytics & dashboard. '
  'Order TIDAK langsung membuat transaksi KasFlow — transaksi dibuat '
  'berdasarkan statement harian (lihat marketplace_statements).';

-- ============================================================
-- 4. MARKETPLACE ORDER ITEMS (SKU-level detail)
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
-- 5. MARKETPLACE STATEMENTS (Cache)
-- ============================================================
-- Statement harian dari TikTok Finance API
CREATE TABLE IF NOT EXISTS marketplace_statements (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  company_id TEXT NOT NULL REFERENCES business_profiles(id),

  -- TikTok statement data
  platform_statement_id TEXT NOT NULL,
  statement_time TIMESTAMPTZ,
  currency TEXT DEFAULT 'IDR',

  -- Amounts
  settlement_amount NUMERIC(15,2) DEFAULT 0,
  revenue_amount NUMERIC(15,2) DEFAULT 0,
  fee_amount NUMERIC(15,2) DEFAULT 0,
  adjustment_amount NUMERIC(15,2) DEFAULT 0,
  net_sales_amount NUMERIC(15,2) DEFAULT 0,
  shipping_cost_amount NUMERIC(15,2) DEFAULT 0,

  -- Payment
  payment_status TEXT DEFAULT 'PROCESSING'
    CHECK (payment_status IN ('PAID', 'FAILED', 'PROCESSING')),
  payment_id TEXT,
  payment_time TIMESTAMPTZ,

  -- Reconciliation & KasFlow link
  reconciled BOOLEAN DEFAULT FALSE,
  kasflow_income_txn_id TEXT,                -- Link ke transaksi income (revenue harian)
  kasflow_expense_txn_id TEXT,               -- Link ke transaksi expense (fee harian)
  kasflow_transfer_txn_id TEXT,              -- Link ke transaksi transfer (payout ke bank)
  order_count INTEGER DEFAULT 0,             -- Jumlah order dalam statement ini (untuk UI)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, platform_statement_id)
);

CREATE INDEX idx_mkp_stmt_company ON marketplace_statements(company_id);
CREATE INDEX idx_mkp_stmt_date ON marketplace_statements(company_id, statement_time DESC);
CREATE INDEX idx_mkp_stmt_payment ON marketplace_statements(company_id, payment_status);

COMMENT ON TABLE marketplace_statements IS
  'Statement harian dari marketplace (1 statement = 1 hari). '
  'SOURCE OF TRUTH untuk pembuatan transaksi KasFlow. '
  '1 statement settled = max 3 transaksi (income + expense + transfer). '
  'Idempotency: cek kasflow_income_txn_id IS NULL sebelum buat transaksi baru.';

-- ============================================================
-- 6. MARKETPLACE SYNC LOGS
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

COMMENT ON TABLE marketplace_sync_logs IS
  'Log setiap proses sinkronisasi: jumlah data, durasi, error. Digunakan untuk monitoring.';

-- ============================================================
-- 7. UPDATE EXISTING TABLES FOR MARKETPLACE INTEGRATION
-- ============================================================

-- 7a. Add 'marketplace' as a valid source for journal_entries
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_check
  CHECK (source IN ('transaction', 'opening_balance', 'closing', 'manual', 'seed', 'marketplace'));

COMMENT ON COLUMN journal_entries.source IS
  'Source of journal entry. marketplace = auto-generated from daily statement sync.';

-- 7b. Add marketplace_connection_id dimension to transactions
--     Nullable — hanya terisi untuk transaksi yang di-generate dari marketplace sync.
--     Digunakan sebagai filter reporting per toko (dimension-based approach).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS marketplace_connection_id TEXT;
ALTER TABLE transactions ADD CONSTRAINT fk_txn_mkp_conn
  FOREIGN KEY (marketplace_connection_id) REFERENCES marketplace_connections(id);

CREATE INDEX idx_txn_mkp_conn ON transactions(company_id, marketplace_connection_id)
  WHERE marketplace_connection_id IS NOT NULL;

COMMENT ON COLUMN transactions.marketplace_connection_id IS
  'Dimension tag: link ke marketplace connection untuk reporting per toko. '
  'NULL untuk transaksi manual. Diisi otomatis saat sync marketplace.';

-- 7c. Add marketplace_connection_id dimension to journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS marketplace_connection_id TEXT;
ALTER TABLE journal_entries ADD CONSTRAINT fk_je_mkp_conn
  FOREIGN KEY (marketplace_connection_id) REFERENCES marketplace_connections(id);

CREATE INDEX idx_je_mkp_conn ON journal_entries(company_id, marketplace_connection_id)
  WHERE marketplace_connection_id IS NOT NULL;

COMMENT ON COLUMN journal_entries.marketplace_connection_id IS
  'Dimension tag: link ke marketplace connection untuk P&L per toko. '
  'NULL untuk jurnal manual. Diisi otomatis saat sync marketplace.';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_account_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sync_logs ENABLE ROW LEVEL SECURITY;

-- Marketplace Connections
CREATE POLICY "Company mkp connections read"
  ON marketplace_connections FOR SELECT
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp connections write"
  ON marketplace_connections FOR INSERT
  WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp connections update"
  ON marketplace_connections FOR UPDATE
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp connections delete"
  ON marketplace_connections FOR DELETE
  USING (company_id = auth_user_company_id());

-- Marketplace Account Mapping
CREATE POLICY "Company mkp mapping read"
  ON marketplace_account_mapping FOR SELECT
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp mapping write"
  ON marketplace_account_mapping FOR INSERT
  WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp mapping update"
  ON marketplace_account_mapping FOR UPDATE
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp mapping delete"
  ON marketplace_account_mapping FOR DELETE
  USING (company_id = auth_user_company_id());

-- Marketplace Orders
CREATE POLICY "Company mkp orders read"
  ON marketplace_orders FOR SELECT
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp orders write"
  ON marketplace_orders FOR INSERT
  WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp orders update"
  ON marketplace_orders FOR UPDATE
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp orders delete"
  ON marketplace_orders FOR DELETE
  USING (company_id = auth_user_company_id());

-- Marketplace Order Items
CREATE POLICY "Company mkp items read"
  ON marketplace_order_items FOR SELECT
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp items write"
  ON marketplace_order_items FOR INSERT
  WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp items update"
  ON marketplace_order_items FOR UPDATE
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp items delete"
  ON marketplace_order_items FOR DELETE
  USING (company_id = auth_user_company_id());

-- Marketplace Statements
CREATE POLICY "Company mkp statements read"
  ON marketplace_statements FOR SELECT
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp statements write"
  ON marketplace_statements FOR INSERT
  WITH CHECK (company_id = auth_user_company_id());
CREATE POLICY "Company mkp statements update"
  ON marketplace_statements FOR UPDATE
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp statements delete"
  ON marketplace_statements FOR DELETE
  USING (company_id = auth_user_company_id());

-- Marketplace Sync Logs
CREATE POLICY "Company mkp synclogs read"
  ON marketplace_sync_logs FOR SELECT
  USING (company_id = auth_user_company_id());
CREATE POLICY "Company mkp synclogs write"
  ON marketplace_sync_logs FOR INSERT
  WITH CHECK (company_id = auth_user_company_id());

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_statements;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_sync_logs;

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_account_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketplace_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
