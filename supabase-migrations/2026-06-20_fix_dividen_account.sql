-- Migration: Fix equity account 3300 - rename to Dividen with debit normal balance
-- Date: 2026-06-20
-- Description: Account 3300 should be "Dividen" (not "Laba Ditahan") with debit normal balance
--              to correctly reduce equity per SAK EMKM / UMKM standards

UPDATE accounts
SET name = 'Dividen', normal_balance = 'debit', updated_at = NOW()
WHERE code = '3300';
