-- Migration: Stock Opname 3-Step Workflow
-- Tahap 1: Admin buat → Tahap 2: Staff hitung → Tahap 3: Admin approve/reject

-- Tambah kolom untuk tracking siapa yang menghitung dan menyetujui
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS counted_by VARCHAR(36) NULL AFTER created_by;
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS counted_at TIMESTAMP NULL AFTER counted_by;
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36) NULL AFTER counted_at;
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL AFTER approved_by;
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS approve_notes TEXT NULL AFTER approved_at;
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS reject_reason TEXT NULL AFTER approve_notes;
ALTER TABLE stock_opname ADD COLUMN IF NOT EXISTS discrepancy_count INT DEFAULT 0 AFTER reject_reason;
