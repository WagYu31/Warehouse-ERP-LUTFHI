-- ============================================================
--  WMS LUTFHI v3.0 — Migration: Tabel Baru
-- ============================================================

-- Delivery Orders / Surat Jalan
CREATE TABLE IF NOT EXISTS delivery_orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    do_number         VARCHAR(50) UNIQUE NOT NULL,
    outbound_id       UUID REFERENCES outbound_transactions(id),
    status            VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- pending, dispatched, delivered, cancelled
    recipient_name    VARCHAR(200) NOT NULL,
    recipient_address TEXT,
    recipient_phone   VARCHAR(30),
    driver            VARCHAR(100),
    vehicle           VARCHAR(50),
    delivery_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes             TEXT,
    received_by       VARCHAR(100),
    delivery_notes    TEXT,
    delivered_at      TIMESTAMPTZ,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_order_items (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    do_id     UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
    item_id   UUID NOT NULL REFERENCES items(id),
    qty       INTEGER NOT NULL DEFAULT 1,
    notes     TEXT
);

-- Returns / Retur Barang
CREATE TABLE IF NOT EXISTS returns (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number  VARCHAR(50) UNIQUE NOT NULL,
    return_type    VARCHAR(30) NOT NULL, -- to_supplier, from_customer
    supplier_id    UUID REFERENCES suppliers(id),
    status         VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- pending, approved, rejected, completed
    reason         TEXT NOT NULL,
    notes          TEXT,
    return_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     UUID REFERENCES users(id),
    approved_by    UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id    UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    item_id      UUID NOT NULL REFERENCES items(id),
    qty          INTEGER NOT NULL DEFAULT 1,
    warehouse_id UUID REFERENCES warehouses(id),
    unit_price   DECIMAL(15,2) DEFAULT 0
);

-- Update audit_logs table (pastikan kolom tersedia)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource    VARCHAR(200);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address  VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS duration_ms BIGINT;

-- Update departments (tambah description jika belum ada)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT;

-- Update locations (pastikan kolom type dan capacity ada)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS type      VARCHAR(30) DEFAULT 'rack';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS capacity  INTEGER DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_date ON delivery_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_type ON returns(return_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_item_stocks_item ON item_stocks(item_id);
CREATE INDEX IF NOT EXISTS idx_item_stocks_warehouse ON item_stocks(warehouse_id);

-- Pastikan users punya kolom department_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

RAISE NOTICE '✅ WMS LUTFHI v3.0 Migration selesai';
