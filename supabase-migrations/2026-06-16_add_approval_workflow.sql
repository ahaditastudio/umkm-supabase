-- Migration: Add Approval Workflow to Marketplace Statements
-- Date: 2026-06-16
-- Description: Add manual approval workflow for TikTok marketplace transactions

-- Add approval fields to marketplace_statements
ALTER TABLE marketplace_statements
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending_approval'
  CHECK (approval_status IN ('pending_approval', 'approved', 'rejected', 'auto_approved')),
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Mark existing statements that have transactions as auto_approved
UPDATE marketplace_statements
SET approval_status = 'auto_approved'
WHERE kasflow_income_txn_id IS NOT NULL
  AND (approval_status IS NULL OR approval_status = 'pending_approval');

-- Create index for performance on pending approvals
CREATE INDEX IF NOT EXISTS idx_statements_approval_status
ON marketplace_statements(company_id, approval_status)
WHERE approval_status = 'pending_approval';

-- Create index for filtering by approval status
CREATE INDEX IF NOT EXISTS idx_statements_approval_filter
ON marketplace_statements(company_id, connection_id, approval_status);

-- Add comment for documentation
COMMENT ON COLUMN marketplace_statements.approval_status IS 'Approval workflow status: pending_approval (awaiting review), approved (manually approved), rejected (rejected with reason), auto_approved (existing data before workflow)';
COMMENT ON COLUMN marketplace_statements.approved_by IS 'User ID who approved this statement';
COMMENT ON COLUMN marketplace_statements.approved_at IS 'Timestamp when statement was approved';
COMMENT ON COLUMN marketplace_statements.rejected_reason IS 'Optional reason for rejection';
