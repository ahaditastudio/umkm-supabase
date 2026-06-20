-- Migration: Add capital transaction support
-- Date: 2026-06-19
-- Description: Add capital_type column and update type constraint to support capital transactions (setoran modal, prive, dividen)

-- Step 1: Drop existing CHECK constraint on type column
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Step 2: Add new CHECK constraint that includes 'capital'
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'transfer', 'capital'));

-- Step 3: Add capital_type column
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS capital_type TEXT
  CHECK (capital_type IN ('setoran', 'prive', 'dividen'));

-- Step 4: Add index for capital_type queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_transactions_capital_type ON transactions(company_id, capital_type)
  WHERE capital_type IS NOT NULL;
