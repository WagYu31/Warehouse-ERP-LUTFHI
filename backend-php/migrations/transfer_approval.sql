-- Migration: Stock Transfer Approval Workflow
-- Adds columns for approval tracking and creates transfer items table

-- Add approval tracking columns to stock_transfers
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36) DEFAULT NULL;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS reject_reason TEXT DEFAULT NULL;

-- Create transfer items table (stores items per transfer for approval reference)
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id VARCHAR(36) PRIMARY KEY,
    transfer_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_transfer_id (transfer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Update existing 'completed' transfers (already moved stock, keep as is)
-- New transfers will be created as 'pending' and require admin approval
