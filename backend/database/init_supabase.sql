-- ============================================================
-- WMS LUTFHI - Database Initialization Script
-- PostgreSQL 16
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- untuk full-text search

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'requester', 'finance_procurement', 'manager');
CREATE TYPE request_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'in_process', 'delivered', 'completed', 'cancelled');
CREATE TYPE po_status AS ENUM ('draft', 'sent', 'partial', 'complete', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE transfer_status AS ENUM ('pending', 'in_transit', 'completed', 'cancelled');
CREATE TYPE batch_status AS ENUM ('active', 'quarantine', 'disposed');
CREATE TYPE outbound_method AS ENUM ('fefo', 'fifo', 'manual');
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'cheque');
CREATE TYPE sync_direction AS ENUM ('erp_to_wms', 'wms_to_erp');
CREATE TYPE sync_status AS ENUM ('running', 'success', 'failed');
CREATE TYPE alert_type AS ENUM ('h30', 'h7', 'expired');

-- ============================================================
-- 1. WAREHOUSES (Multi-Gudang)
-- ============================================================
CREATE TABLE warehouses (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    address     TEXT,
    city        VARCHAR(100),
    pic_name    VARCHAR(100),
    pic_phone   VARCHAR(20),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    head_name   VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'requester',
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    phone           VARCHAR(20),
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- User ↔ Gudang Assignment
CREATE TABLE user_warehouses (
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    is_primary      BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, warehouse_id)
);

-- ============================================================
-- 4. CATEGORIES
-- ============================================================
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. UNITS OF MEASURE
-- ============================================================
CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) NOT NULL,
    abbreviation    VARCHAR(10) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. SUPPLIERS
-- ============================================================
CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(30) UNIQUE,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150),
    phone           VARCHAR(30),
    address         TEXT,
    city            VARCHAR(100),
    npwp            VARCHAR(30),
    is_pkp          BOOLEAN DEFAULT TRUE,
    payment_terms   INTEGER DEFAULT 30, -- hari
    rating          NUMERIC(3,1) DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    is_blacklisted  BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ITEMS (Master Barang)
-- ============================================================
CREATE TABLE items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku                 VARCHAR(50) UNIQUE NOT NULL,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit_id             UUID REFERENCES units(id) ON DELETE SET NULL,
    min_stock           INTEGER DEFAULT 0,
    max_stock           INTEGER,
    price               NUMERIC(15,2) DEFAULT 0,
    photo_url           VARCHAR(500),
    barcode             VARCHAR(100),
    qr_code             VARCHAR(500),
    is_active           BOOLEAN DEFAULT TRUE,
    -- Batch & Expired
    batch_tracking      BOOLEAN DEFAULT FALSE,
    expired_tracking    BOOLEAN DEFAULT FALSE,
    alert_days_before   INTEGER DEFAULT 30,
    outbound_method     outbound_method DEFAULT 'fefo',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Stok per Gudang (bukan stok global)
CREATE TABLE item_stocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id         UUID REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    current_stock   INTEGER DEFAULT 0,
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, warehouse_id)
);

-- Batch per Penerimaan
CREATE TABLE item_batches (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id                     UUID REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id                UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    batch_number                VARCHAR(100) NOT NULL,
    expired_date                DATE,
    qty_received                INTEGER NOT NULL,
    qty_remaining               INTEGER NOT NULL,
    inbound_transaction_id      UUID, -- FK ditambah setelah tabel dibuat
    status                      batch_status DEFAULT 'active',
    notes                       TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. LOCATIONS (Zona / Rak / Bin per Gudang)
-- ============================================================
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    zone            VARCHAR(50),
    rack            VARCHAR(50),
    bin             VARCHAR(50),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. INBOUND TRANSACTIONS (Barang Masuk / GRN)
-- ============================================================
CREATE TABLE inbound_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ref_number      VARCHAR(50) UNIQUE NOT NULL,
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    received_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    received_date   DATE NOT NULL,
    po_number       VARCHAR(50), -- referensi ke PO
    po_id           UUID, -- FK ke purchase_orders
    notes           TEXT,
    photo_url       VARCHAR(500),
    status          transaction_status DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inbound_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id      UUID REFERENCES inbound_transactions(id) ON DELETE CASCADE,
    item_id             UUID REFERENCES items(id) ON DELETE SET NULL,
    location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
    qty_ordered         INTEGER DEFAULT 0,
    qty_received        INTEGER NOT NULL,
    unit_price          NUMERIC(15,2) DEFAULT 0,
    condition           VARCHAR(50) DEFAULT 'good',
    batch_number        VARCHAR(100),
    expired_date        DATE,
    notes               TEXT
);

-- ============================================================
-- 10. OUTBOUND TRANSACTIONS (Barang Keluar)
-- ============================================================
CREATE TABLE outbound_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ref_number      VARCHAR(50) UNIQUE NOT NULL,
    request_id      UUID, -- FK ke requests
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    processed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    outbound_date   DATE NOT NULL,
    notes           TEXT,
    status          transaction_status DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outbound_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id      UUID REFERENCES outbound_transactions(id) ON DELETE CASCADE,
    item_id             UUID REFERENCES items(id) ON DELETE SET NULL,
    location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
    batch_id            UUID REFERENCES item_batches(id) ON DELETE SET NULL,
    qty                 INTEGER NOT NULL,
    notes               TEXT
);

-- ============================================================
-- 11. REQUESTS (SPB - Surat Permintaan Barang)
-- ============================================================
CREATE TABLE requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spb_number      VARCHAR(50) UNIQUE NOT NULL,
    requester_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    needed_date     DATE NOT NULL,
    purpose         TEXT NOT NULL,
    priority        VARCHAR(10) DEFAULT 'normal', -- normal | urgent
    status          request_status DEFAULT 'draft',
    notes           TEXT,
    attachment_url  VARCHAR(500),
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    review_notes    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE request_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id      UUID REFERENCES requests(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
    qty_requested   INTEGER NOT NULL,
    qty_approved    INTEGER DEFAULT 0,
    notes           TEXT
);

-- ============================================================
-- 12. STOCK OPNAME
-- ============================================================
CREATE TABLE stock_opnames (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ref_number      VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id    UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    conducted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    start_date      TIMESTAMPTZ DEFAULT NOW(),
    end_date        TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'in_progress', -- in_progress|completed|cancelled
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opname_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opname_id       UUID REFERENCES stock_opnames(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
    location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
    system_qty      INTEGER DEFAULT 0,
    physical_qty    INTEGER DEFAULT 0,
    difference      INTEGER GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
    notes           TEXT
);

-- ============================================================
-- 13. STOCK TRANSFERS (Antar Gudang)
-- ============================================================
CREATE TABLE stock_transfers (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ref_number              VARCHAR(50) UNIQUE NOT NULL,
    from_warehouse_id       UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id         UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by_sender     UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by_receiver   UUID REFERENCES users(id) ON DELETE SET NULL,
    status                  transfer_status DEFAULT 'pending',
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id     UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
    qty             INTEGER NOT NULL,
    notes           TEXT
);

-- ============================================================
-- 14. ERP: TAX CONFIG
-- ============================================================
CREATE TABLE tax_configs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) NOT NULL,
    rate        NUMERIC(5,2) NOT NULL,
    is_default  BOOLEAN DEFAULT FALSE,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. ERP: PURCHASE ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number           VARCHAR(50) UNIQUE NOT NULL,
    supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    warehouse_id        UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    expected_date       DATE,
    status              po_status DEFAULT 'draft',
    subtotal            NUMERIC(15,2) DEFAULT 0,
    discount_amount     NUMERIC(15,2) DEFAULT 0,
    tax_rate            NUMERIC(5,2) DEFAULT 11,
    tax_amount          NUMERIC(15,2) DEFAULT 0,
    total_amount        NUMERIC(15,2) DEFAULT 0,
    notes               TEXT,
    approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    email_sent          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id           UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
    qty_ordered     INTEGER NOT NULL,
    qty_received    INTEGER DEFAULT 0,
    unit_price      NUMERIC(15,2) NOT NULL,
    total_price     NUMERIC(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price) STORED,
    notes           TEXT
);

-- ============================================================
-- 16. ERP: INVOICES (Accounts Payable)
-- ============================================================
CREATE TABLE invoices (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number          VARCHAR(100) NOT NULL,
    po_id                   UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id             UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    invoice_date            DATE NOT NULL,
    due_date                DATE NOT NULL,
    subtotal                NUMERIC(15,2) DEFAULT 0,
    discount_amount         NUMERIC(15,2) DEFAULT 0,
    dpp                     NUMERIC(15,2) DEFAULT 0,
    tax_rate                NUMERIC(5,2) DEFAULT 11,
    tax_amount              NUMERIC(15,2) DEFAULT 0,
    total_amount            NUMERIC(15,2) NOT NULL,
    paid_amount             NUMERIC(15,2) DEFAULT 0,
    remaining_amount        NUMERIC(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status                  invoice_status DEFAULT 'unpaid',
    faktur_pajak_number     VARCHAR(50),
    supplier_is_pkp         BOOLEAN DEFAULT TRUE,
    notes                   TEXT,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. ERP: PAYMENTS
-- ============================================================
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id          UUID REFERENCES invoices(id) ON DELETE CASCADE,
    amount              NUMERIC(15,2) NOT NULL,
    payment_date        DATE NOT NULL,
    payment_method      payment_method DEFAULT 'transfer',
    reference_number    VARCHAR(100),
    notes               TEXT,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. ERP: BUDGET
-- ============================================================
CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    period_type     VARCHAR(20) DEFAULT 'monthly', -- monthly|quarterly|yearly
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    total_amount    NUMERIC(15,2) NOT NULL,
    spent_amount    NUMERIC(15,2) DEFAULT 0,
    notes           TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. REORDER CONFIG
-- ============================================================
CREATE TABLE reorder_configs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id                 UUID REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id            UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    reorder_point           INTEGER NOT NULL,
    reorder_qty             INTEGER NOT NULL,
    preferred_supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    auto_create_pr          BOOLEAN DEFAULT FALSE,
    UNIQUE(item_id, warehouse_id)
);

-- Price History per Item per Supplier
CREATE TABLE price_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id         UUID REFERENCES items(id) ON DELETE CASCADE,
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    unit_price      NUMERIC(15,2) NOT NULL,
    po_id           UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    link        VARCHAR(500),
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 21. EXPIRY ALERTS
-- ============================================================
CREATE TABLE expiry_alerts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id             UUID REFERENCES items(id) ON DELETE CASCADE,
    batch_id            UUID REFERENCES item_batches(id) ON DELETE CASCADE,
    alert_type          alert_type NOT NULL,
    sent_at             TIMESTAMPTZ DEFAULT NOW(),
    is_acknowledged     BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 22. AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name       VARCHAR(100),
    action          VARCHAR(20) NOT NULL, -- create|update|delete|login|logout
    module          VARCHAR(50) NOT NULL,
    table_name      VARCHAR(50),
    record_id       VARCHAR(100),
    old_data        JSONB,
    new_data        JSONB,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 23. PUSH NOTIFICATION SUBSCRIPTIONS (PWA)
-- ============================================================
CREATE TABLE push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- ============================================================
-- ADD FOREIGN KEYS yang circular (setelah semua tabel dibuat)
-- ============================================================
ALTER TABLE item_batches
    ADD CONSTRAINT fk_batch_inbound
    FOREIGN KEY (inbound_transaction_id)
    REFERENCES inbound_transactions(id) ON DELETE SET NULL;

ALTER TABLE inbound_transactions
    ADD CONSTRAINT fk_inbound_po
    FOREIGN KEY (po_id)
    REFERENCES purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE outbound_transactions
    ADD CONSTRAINT fk_outbound_request
    FOREIGN KEY (request_id)
    REFERENCES requests(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES untuk performa query
-- ============================================================
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_name_trgm ON items USING gin(name gin_trgm_ops);
CREATE INDEX idx_item_stocks_item ON item_stocks(item_id);
CREATE INDEX idx_item_stocks_warehouse ON item_stocks(warehouse_id);
CREATE INDEX idx_item_batches_item ON item_batches(item_id);
CREATE INDEX idx_item_batches_expired ON item_batches(expired_date) WHERE status = 'active';
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_requester ON requests(requester_id);
CREATE INDEX idx_inbound_date ON inbound_transactions(received_date);
CREATE INDEX idx_outbound_date ON outbound_transactions(outbound_date);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================
-- SEED DATA AWAL
-- ============================================================

-- Default Warehouse
INSERT INTO warehouses (code, name, city, is_active) VALUES
('GDG-01', 'Gudang Utama', 'Jakarta', TRUE),
('GDG-02', 'Gudang Cadangan', 'Tangerang', TRUE);

-- Default Departments
INSERT INTO departments (name) VALUES
('IT'),
('Finance'),
('HR'),
('Operations'),
('Marketing'),
('Management');

-- Default Units
INSERT INTO units (name, abbreviation) VALUES
('Pieces', 'pcs'),
('Kilogram', 'kg'),
('Liter', 'ltr'),
('Box', 'box'),
('Rim', 'rim'),
('Unit', 'unit'),
('Set', 'set'),
('Meter', 'mtr'),
('Roll', 'roll'),
('Lusin', 'lsn');

-- Default Categories
INSERT INTO categories (name) VALUES
('Alat Tulis Kantor'),
('Elektronik'),
('Furnitur'),
('Bahan Habis Pakai'),
('Spare Part'),
('Peralatan Kebersihan'),
('Bahan Kimia'),
('Makanan & Minuman'),
('Obat-obatan'),
('Lainnya');

-- Default Tax Config
INSERT INTO tax_configs (name, rate, is_default, is_active) VALUES
('PPN 11%', 11.00, TRUE, TRUE),
('PPN 0% (Non-PKP)', 0.00, FALSE, TRUE),
('Bebas PPN', 0.00, FALSE, TRUE);

-- Default Admin User (password: Admin@2026)
-- bcrypt hash untuk "Admin@2026"
INSERT INTO users (name, email, password_hash, role, is_active) VALUES
(
    'Super Admin',
    'admin@wms-lutfhi.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSbkAuS',
    'admin',
    TRUE
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger ke semua tabel yang punya updated_at
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inbound_updated BEFORE UPDATE ON inbound_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_outbound_updated BEFORE UPDATE ON outbound_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON stock_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ============================================================
