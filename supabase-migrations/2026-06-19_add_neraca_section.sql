-- Migration: Add PMSAK Neraca Section Classification
-- Date: 2026-06-19

-- 1. Add sub_type column (if not exists)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS sub_type TEXT;

-- 2. Add neraca_section column
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS neraca_section TEXT;

-- 3. Backfill existing default accounts with neraca_section values
UPDATE accounts SET neraca_section = 'aset_lancar' WHERE code IN ('1100','1110','1120','1130','1200','1300');
UPDATE accounts SET neraca_section = 'kewajiban_lancar' WHERE code IN ('2100','2200');
UPDATE accounts SET neraca_section = 'kewajiban_jangka_panjang' WHERE code = '2300';
UPDATE accounts SET neraca_section = 'ekuitas' WHERE code IN ('3100','3200','3300');
UPDATE accounts SET neraca_section = 'aset_tetap' WHERE code IN ('1400','1410','1420');
UPDATE accounts SET neraca_section = 'akumulasi_penyusutan' WHERE code = '1500';

-- 4. Insert new PMSAK default accounts for all existing companies
INSERT INTO accounts (id, company_id, code, name, type, normal_balance, parent_id, is_cash, is_active, neraca_section, created_at, updated_at)
SELECT
  bp.id || '_1400', bp.id, '1400', 'Aset Tetap', 'asset', 'debit', NULL, false, true, 'aset_tetap', NOW(), NOW()
FROM business_profiles bp
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bp.id || '_1400')
UNION ALL
SELECT
  bp.id || '_1410', bp.id, '1410', 'Peralatan & Inventaris', 'asset', 'debit', bp.id || '_1400', false, true, 'aset_tetap', NOW(), NOW()
FROM business_profiles bp
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bp.id || '_1410')
UNION ALL
SELECT
  bp.id || '_1420', bp.id, '1420', 'Kendaraan', 'asset', 'debit', bp.id || '_1400', false, true, 'aset_tetap', NOW(), NOW()
FROM business_profiles bp
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bp.id || '_1420')
UNION ALL
SELECT
  bp.id || '_1500', bp.id, '1500', 'Akumulasi Penyusutan', 'asset', 'credit', NULL, false, true, 'akumulasi_penyusutan', NOW(), NOW()
FROM business_profiles bp
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bp.id || '_1500')
UNION ALL
SELECT
  bp.id || '_2300', bp.id, '2300', 'Utang Bank', 'liability', 'credit', NULL, false, true, 'kewajiban_jangka_panjang', NOW(), NOW()
FROM business_profiles bp
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bp.id || '_2300');
