-- Migration: Add Laba Ditahan Account (3400)
-- Date: 2026-06-20
-- Description: Add account 3400 "Laba Ditahan" for closing entries system

-- Insert account 3400 for all existing companies
INSERT INTO accounts (id, company_id, code, name, type, normal_balance, parent_id, is_cash, is_active, neraca_section, created_at, updated_at)
SELECT
  bp.id || '_3400',
  bp.id,
  '3400',
  'Laba Ditahan',
  'equity',
  'credit',
  NULL,
  false,
  true,
  'ekuitas',
  NOW(),
  NOW()
FROM business_profiles bp
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a
  WHERE a.company_id = bp.id AND a.code = '3400'
);
