-- WMS LUTFHI - MySQL Init Script
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    pic_name VARCHAR(100),
    pic_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    head_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','staff','requester','finance_procurement','manager') NOT NULL DEFAULT 'requester',
    department_id VARCHAR(36),
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_warehouses (
    user_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(30) UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    address TEXT,
    city VARCHAR(100),
    npwp VARCHAR(30),
    is_pkp BOOLEAN DEFAULT TRUE,
    payment_terms INTEGER DEFAULT 30,
    rating DECIMAL(3,1) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(36) PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id VARCHAR(36),
    unit_id VARCHAR(36),
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER,
    price DECIMAL(15,2) DEFAULT 0,
    photo_url VARCHAR(500),
    barcode VARCHAR(100),
    qr_code VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    batch_tracking BOOLEAN DEFAULT FALSE,
    expired_tracking BOOLEAN DEFAULT FALSE,
    alert_days_before INTEGER DEFAULT 30,
    outbound_method ENUM('fefo','fifo','manual') DEFAULT 'fefo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_stocks (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    current_stock INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS item_batches (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    batch_number VARCHAR(100) NOT NULL,
    expired_date DATE,
    qty_received INTEGER NOT NULL,
    qty_remaining INTEGER NOT NULL,
    inbound_transaction_id VARCHAR(36),
    status ENUM('active','quarantine','disposed') DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(36) PRIMARY KEY,
    warehouse_id VARCHAR(36),
    zone VARCHAR(50),
    rack VARCHAR(50),
    bin VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inbound_transactions (
    id VARCHAR(36) PRIMARY KEY,
    ref_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    received_by VARCHAR(36),
    received_date DATE NOT NULL,
    po_number VARCHAR(50),
    po_id VARCHAR(36),
    notes TEXT,
    photo_url VARCHAR(500),
    status ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inbound_items (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36),
    item_id VARCHAR(36),
    location_id VARCHAR(36),
    qty_ordered INTEGER DEFAULT 0,
    qty_received INTEGER NOT NULL,
    unit_price DECIMAL(15,2) DEFAULT 0,
    `condition` VARCHAR(50) DEFAULT 'good',
    batch_number VARCHAR(100),
    expired_date DATE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS outbound_transactions (
    id VARCHAR(36) PRIMARY KEY,
    ref_number VARCHAR(50) UNIQUE NOT NULL,
    request_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    processed_by VARCHAR(36),
    outbound_date DATE NOT NULL,
    notes TEXT,
    status ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbound_items (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36),
    item_id VARCHAR(36),
    location_id VARCHAR(36),
    batch_id VARCHAR(36),
    qty INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(36) PRIMARY KEY,
    spb_number VARCHAR(50) UNIQUE NOT NULL,
    requester_id VARCHAR(36),
    department_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    needed_date DATE NOT NULL,
    purpose TEXT NOT NULL,
    priority VARCHAR(10) DEFAULT 'normal',
    status ENUM('draft','pending','approved','rejected','in_process','delivered','completed','cancelled') DEFAULT 'draft',
    notes TEXT,
    attachment_url VARCHAR(500),
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_items (
    id VARCHAR(36) PRIMARY KEY,
    request_id VARCHAR(36),
    item_id VARCHAR(36),
    qty_requested INTEGER NOT NULL,
    qty_approved INTEGER DEFAULT 0,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS stock_opnames (
    id VARCHAR(36) PRIMARY KEY,
    ref_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id VARCHAR(36),
    conducted_by VARCHAR(36),
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'in_progress',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opname_items (
    id VARCHAR(36) PRIMARY KEY,
    opname_id VARCHAR(36),
    item_id VARCHAR(36),
    location_id VARCHAR(36),
    system_qty INTEGER DEFAULT 0,
    physical_qty INTEGER DEFAULT 0,
    difference INTEGER GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id VARCHAR(36) PRIMARY KEY,
    ref_number VARCHAR(50) UNIQUE NOT NULL,
    from_warehouse_id VARCHAR(36),
    to_warehouse_id VARCHAR(36),
    created_by VARCHAR(36),
    confirmed_by_sender VARCHAR(36),
    confirmed_by_receiver VARCHAR(36),
    status ENUM('pending','in_transit','completed','cancelled') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id VARCHAR(36) PRIMARY KEY,
    transfer_id VARCHAR(36),
    item_id VARCHAR(36),
    qty INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS tax_configs (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(36) PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    created_by VARCHAR(36),
    expected_date DATE,
    status ENUM('draft','sent','partial','complete','cancelled') DEFAULT 'draft',
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 11,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    approved_by VARCHAR(36),
    approved_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id VARCHAR(36) PRIMARY KEY,
    po_id VARCHAR(36),
    item_id VARCHAR(36),
    qty_ordered INTEGER NOT NULL,
    qty_received INTEGER DEFAULT 0,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price) STORED,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(36) PRIMARY KEY,
    invoice_number VARCHAR(100) NOT NULL,
    po_id VARCHAR(36),
    supplier_id VARCHAR(36),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    dpp DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 11,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status ENUM('unpaid','partial','paid','overdue') DEFAULT 'unpaid',
    faktur_pajak_number VARCHAR(50),
    supplier_is_pkp BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36),
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash','transfer','cheque') DEFAULT 'transfer',
    reference_number VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    period_type VARCHAR(20) DEFAULT 'monthly',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    department_id VARCHAR(36),
    total_amount DECIMAL(15,2) NOT NULL,
    spent_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reorder_configs (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    reorder_point INTEGER NOT NULL,
    reorder_qty INTEGER NOT NULL,
    preferred_supplier_id VARCHAR(36),
    auto_create_pr BOOLEAN DEFAULT FALSE,
    UNIQUE(item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS price_history (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36),
    supplier_id VARCHAR(36),
    unit_price DECIMAL(15,2) NOT NULL,
    po_id VARCHAR(36),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expiry_alerts (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36),
    batch_id VARCHAR(36),
    alert_type ENUM('h30','h7','expired') NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_acknowledged BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    user_name VARCHAR(100),
    action VARCHAR(20) NOT NULL,
    module VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id VARCHAR(100),
    old_data JSON,
    new_data JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint(255))
);

CREATE TABLE IF NOT EXISTS delivery_orders (
    id VARCHAR(36) PRIMARY KEY,
    do_number VARCHAR(50) UNIQUE NOT NULL,
    outbound_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    driver_name VARCHAR(100),
    vehicle_plate VARCHAR(20),
    recipient_name VARCHAR(100),
    recipient_address TEXT,
    recipient_phone VARCHAR(30),
    status ENUM('pending','in_transit','delivered','cancelled') DEFAULT 'pending',
    delivered_at TIMESTAMP NULL,
    notes TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS returns (
    id VARCHAR(36) PRIMARY KEY,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    type ENUM('customer','supplier') DEFAULT 'customer',
    reference_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    reason TEXT,
    status ENUM('pending','approved','rejected','completed') DEFAULT 'pending',
    notes TEXT,
    created_by VARCHAR(36),
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS return_items (
    id VARCHAR(36) PRIMARY KEY,
    return_id VARCHAR(36),
    item_id VARCHAR(36),
    qty INTEGER NOT NULL,
    `condition` VARCHAR(50) DEFAULT 'good',
    notes TEXT
);

-- SEED DATA
INSERT IGNORE INTO warehouses (id, code, name, city, is_active) VALUES
(UUID(), 'GDG-01', 'Gudang Utama', 'Jakarta', TRUE),
(UUID(), 'GDG-02', 'Gudang Cadangan', 'Tangerang', TRUE);

INSERT IGNORE INTO departments (id, name) VALUES
(UUID(), 'IT'), (UUID(), 'Finance'), (UUID(), 'HR'),
(UUID(), 'Operations'), (UUID(), 'Marketing'), (UUID(), 'Management');

INSERT IGNORE INTO units (id, name, abbreviation) VALUES
(UUID(), 'Pieces', 'pcs'), (UUID(), 'Kilogram', 'kg'),
(UUID(), 'Liter', 'ltr'), (UUID(), 'Box', 'box'),
(UUID(), 'Rim', 'rim'), (UUID(), 'Unit', 'unit'),
(UUID(), 'Set', 'set'), (UUID(), 'Meter', 'mtr'),
(UUID(), 'Roll', 'roll'), (UUID(), 'Lusin', 'lsn');

INSERT IGNORE INTO categories (id, name) VALUES
(UUID(), 'Alat Tulis Kantor'), (UUID(), 'Elektronik'),
(UUID(), 'Furnitur'), (UUID(), 'Bahan Habis Pakai'),
(UUID(), 'Spare Part'), (UUID(), 'Peralatan Kebersihan'),
(UUID(), 'Bahan Kimia'), (UUID(), 'Makanan & Minuman'),
(UUID(), 'Obat-obatan'), (UUID(), 'Lainnya');

INSERT IGNORE INTO tax_configs (id, name, rate, is_default, is_active) VALUES
(UUID(), 'PPN 11%', 11.00, TRUE, TRUE),
(UUID(), 'PPN 0% (Non-PKP)', 0.00, FALSE, TRUE),
(UUID(), 'Bebas PPN', 0.00, FALSE, TRUE);

-- Admin user (password: Admin@2026)
INSERT IGNORE INTO users (id, name, email, password_hash, role, is_active) VALUES
('admin-uuid-001', 'Super Admin', 'admin@wms-lutfhi.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSbkAuS', 'admin', TRUE);

INSERT IGNORE INTO users (id, name, email, password_hash, role, is_active) VALUES
('staff-uuid-001', 'Warehouse Staff', 'staff@wms-lutfhi.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSbkAuS', 'staff', TRUE);

INSERT IGNORE INTO users (id, name, email, password_hash, role, is_active) VALUES
('manager-uuid-001', 'Manager', 'manager@wms-lutfhi.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSbkAuS', 'manager', TRUE);

INSERT IGNORE INTO users (id, name, email, password_hash, role, is_active) VALUES
('finance-uuid-001', 'Finance Officer', 'finance@wms-lutfhi.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSbkAuS', 'finance_procurement', TRUE);

INSERT IGNORE INTO users (id, name, email, password_hash, role, is_active) VALUES
('requester-uuid-001', 'Requester User', 'requester@wms-lutfhi.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSbkAuS', 'requester', TRUE);
