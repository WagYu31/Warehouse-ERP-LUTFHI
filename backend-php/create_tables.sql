-- ============================================================
-- WMS LUTFHI — MySQL Schema v3.0
-- Import via phpMyAdmin
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- 1. WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id`          CHAR(36) NOT NULL,
  `code`        VARCHAR(20) UNIQUE NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `address`     TEXT,
  `city`        VARCHAR(100),
  `pic_name`    VARCHAR(100),
  `pic_phone`   VARCHAR(20),
  `is_active`   TINYINT(1) DEFAULT 1,
  `created_at`  DATETIME DEFAULT NOW(),
  `updated_at`  DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS `departments` (
  `id`          CHAR(36) NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `head_name`   VARCHAR(100),
  `created_at`  DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`              CHAR(36) NOT NULL,
  `name`            VARCHAR(100) NOT NULL,
  `email`           VARCHAR(150) UNIQUE NOT NULL,
  `password_hash`   VARCHAR(255) NOT NULL,
  `role`            ENUM('admin','staff','requester','finance_procurement','manager') NOT NULL DEFAULT 'requester',
  `department_id`   CHAR(36),
  `phone`           VARCHAR(20),
  `avatar_url`      VARCHAR(500),
  `is_active`       TINYINT(1) DEFAULT 1,
  `last_login_at`   DATETIME,
  `created_at`      DATETIME DEFAULT NOW(),
  `updated_at`      DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_warehouses` (
  `user_id`       CHAR(36) NOT NULL,
  `warehouse_id`  CHAR(36) NOT NULL,
  `is_primary`    TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`user_id`,`warehouse_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id`          CHAR(36) NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT,
  `created_at`  DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. UNITS
-- ============================================================
CREATE TABLE IF NOT EXISTS `units` (
  `id`            CHAR(36) NOT NULL,
  `name`          VARCHAR(50) NOT NULL,
  `abbreviation`  VARCHAR(10) NOT NULL,
  `created_at`    DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`              CHAR(36) NOT NULL,
  `code`            VARCHAR(30) UNIQUE,
  `name`            VARCHAR(150) NOT NULL,
  `email`           VARCHAR(150),
  `phone`           VARCHAR(30),
  `address`         TEXT,
  `city`            VARCHAR(100),
  `npwp`            VARCHAR(30),
  `is_pkp`          TINYINT(1) DEFAULT 1,
  `payment_terms`   INT DEFAULT 30,
  `rating`          DECIMAL(3,1) DEFAULT 0,
  `is_active`       TINYINT(1) DEFAULT 1,
  `is_blacklisted`  TINYINT(1) DEFAULT 0,
  `notes`           TEXT,
  `created_at`      DATETIME DEFAULT NOW(),
  `updated_at`      DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. ITEMS (Master Barang)
-- ============================================================
CREATE TABLE IF NOT EXISTS `items` (
  `id`                CHAR(36) NOT NULL,
  `sku`               VARCHAR(50) UNIQUE NOT NULL,
  `name`              VARCHAR(200) NOT NULL,
  `description`       TEXT,
  `category_id`       CHAR(36),
  `unit_id`           CHAR(36),
  `min_stock`         INT DEFAULT 0,
  `max_stock`         INT,
  `price`             DECIMAL(15,2) DEFAULT 0,
  `photo_url`         VARCHAR(500),
  `barcode`           VARCHAR(100),
  `qr_code`           VARCHAR(500),
  `is_active`         TINYINT(1) DEFAULT 1,
  `batch_tracking`    TINYINT(1) DEFAULT 0,
  `expired_tracking`  TINYINT(1) DEFAULT 0,
  `alert_days_before` INT DEFAULT 30,
  `outbound_method`   ENUM('fefo','fifo','manual') DEFAULT 'fefo',
  `created_at`        DATETIME DEFAULT NOW(),
  `updated_at`        DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `item_stocks` (
  `id`            CHAR(36) NOT NULL,
  `item_id`       CHAR(36) NOT NULL,
  `warehouse_id`  CHAR(36) NOT NULL,
  `current_stock` INT DEFAULT 0,
  `last_updated`  DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_item_warehouse` (`item_id`,`warehouse_id`),
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `item_batches` (
  `id`                      CHAR(36) NOT NULL,
  `item_id`                 CHAR(36) NOT NULL,
  `warehouse_id`            CHAR(36) NOT NULL,
  `batch_number`            VARCHAR(100) NOT NULL,
  `expired_date`            DATE,
  `qty_received`            INT NOT NULL,
  `qty_remaining`           INT NOT NULL,
  `status`                  ENUM('active','quarantine','disposed') DEFAULT 'active',
  `notes`                   TEXT,
  `created_at`              DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. LOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS `locations` (
  `id`            CHAR(36) NOT NULL,
  `warehouse_id`  CHAR(36) NOT NULL,
  `zone`          VARCHAR(50),
  `rack`          VARCHAR(50),
  `bin`           VARCHAR(50),
  `description`   TEXT,
  `created_at`    DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. INBOUND TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS `inbound_transactions` (
  `id`            CHAR(36) NOT NULL,
  `ref_number`    VARCHAR(50) UNIQUE NOT NULL,
  `supplier_id`   CHAR(36),
  `warehouse_id`  CHAR(36),
  `received_by`   CHAR(36),
  `received_date` DATE NOT NULL,
  `po_number`     VARCHAR(50),
  `po_id`         CHAR(36),
  `notes`         TEXT,
  `photo_url`     VARCHAR(500),
  `status`        ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
  `created_at`    DATETIME DEFAULT NOW(),
  `updated_at`    DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inbound_items` (
  `id`              CHAR(36) NOT NULL,
  `transaction_id`  CHAR(36) NOT NULL,
  `item_id`         CHAR(36) NOT NULL,
  `qty_received`    INT NOT NULL,
  `unit_price`      DECIMAL(15,2) DEFAULT 0,
  `batch_number`    VARCHAR(100),
  `expired_date`    DATE,
  `location_id`     CHAR(36),
  `notes`           TEXT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`transaction_id`) REFERENCES `inbound_transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. OUTBOUND TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS `outbound_transactions` (
  `id`            CHAR(36) NOT NULL,
  `ref_number`    VARCHAR(50) UNIQUE NOT NULL,
  `warehouse_id`  CHAR(36),
  `issued_by`     CHAR(36),
  `outbound_date` DATE NOT NULL,
  `destination`   VARCHAR(200),
  `request_id`    CHAR(36),
  `notes`         TEXT,
  `status`        ENUM('pending','confirmed','cancelled') DEFAULT 'confirmed',
  `created_at`    DATETIME DEFAULT NOW(),
  `updated_at`    DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `outbound_items` (
  `id`              CHAR(36) NOT NULL,
  `transaction_id`  CHAR(36) NOT NULL,
  `item_id`         CHAR(36) NOT NULL,
  `qty_issued`      INT NOT NULL,
  `batch_number`    VARCHAR(100),
  `notes`           TEXT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`transaction_id`) REFERENCES `outbound_transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. REQUESTS (SPB)
-- ============================================================
CREATE TABLE IF NOT EXISTS `requests` (
  `id`              CHAR(36) NOT NULL,
  `ref_number`      VARCHAR(50) UNIQUE NOT NULL,
  `requested_by`    CHAR(36) NOT NULL,
  `department_id`   CHAR(36),
  `purpose`         TEXT,
  `priority`        ENUM('low','normal','high','urgent') DEFAULT 'normal',
  `required_date`   DATE,
  `notes`           TEXT,
  `status`          ENUM('draft','pending','approved','rejected','in_process','delivered','completed','cancelled') DEFAULT 'pending',
  `approved_by`     CHAR(36),
  `approval_notes`  TEXT,
  `approved_at`     DATETIME,
  `created_at`      DATETIME DEFAULT NOW(),
  `updated_at`      DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `request_items` (
  `id`            CHAR(36) NOT NULL,
  `request_id`    CHAR(36) NOT NULL,
  `item_id`       CHAR(36) NOT NULL,
  `qty_requested` INT NOT NULL DEFAULT 1,
  `qty_approved`  INT,
  `notes`         TEXT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. DELIVERY ORDERS (Surat Jalan)
-- ============================================================
CREATE TABLE IF NOT EXISTS `delivery_orders` (
  `id`            CHAR(36) NOT NULL,
  `ref_number`    VARCHAR(50) UNIQUE NOT NULL,
  `warehouse_id`  CHAR(36),
  `created_by`    CHAR(36),
  `delivery_date` DATE NOT NULL,
  `destination`   VARCHAR(200),
  `notes`         TEXT,
  `status`        ENUM('pending','in_transit','delivered','cancelled') DEFAULT 'pending',
  `created_at`    DATETIME DEFAULT NOW(),
  `updated_at`    DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `delivery_items` (
  `id`          CHAR(36) NOT NULL,
  `delivery_id` CHAR(36) NOT NULL,
  `item_id`     CHAR(36) NOT NULL,
  `qty`         INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`delivery_id`) REFERENCES `delivery_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 13. PURCHASE ORDERS (ERP)
-- ============================================================
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id`              CHAR(36) NOT NULL,
  `po_number`       VARCHAR(50) UNIQUE NOT NULL,
  `supplier_id`     CHAR(36),
  `warehouse_id`    CHAR(36),
  `order_date`      DATE NOT NULL,
  `expected_date`   DATE,
  `payment_terms`   INT DEFAULT 30,
  `notes`           TEXT,
  `total_amount`    DECIMAL(15,2) DEFAULT 0,
  `status`          ENUM('draft','sent','partial','complete','cancelled') DEFAULT 'draft',
  `created_by`      CHAR(36),
  `created_at`      DATETIME DEFAULT NOW(),
  `updated_at`      DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `po_items` (
  `id`          CHAR(36) NOT NULL,
  `po_id`       CHAR(36) NOT NULL,
  `item_id`     CHAR(36) NOT NULL,
  `qty_ordered` INT NOT NULL,
  `qty_received`INT DEFAULT 0,
  `unit_price`  DECIMAL(15,2) DEFAULT 0,
  `notes`       TEXT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 14. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS `invoices` (
  `id`              CHAR(36) NOT NULL,
  `invoice_number`  VARCHAR(50) UNIQUE NOT NULL,
  `po_id`           CHAR(36),
  `supplier_id`     CHAR(36),
  `invoice_date`    DATE NOT NULL,
  `due_date`        DATE,
  `total_amount`    DECIMAL(15,2) NOT NULL DEFAULT 0,
  `amount_paid`     DECIMAL(15,2) NOT NULL DEFAULT 0,
  `status`          ENUM('unpaid','partial','paid','overdue') DEFAULT 'unpaid',
  `notes`           TEXT,
  `created_by`      CHAR(36),
  `created_at`      DATETIME DEFAULT NOW(),
  `updated_at`      DATETIME DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `invoice_payments` (
  `id`              CHAR(36) NOT NULL,
  `invoice_id`      CHAR(36) NOT NULL,
  `amount`          DECIMAL(15,2) NOT NULL,
  `payment_method`  ENUM('cash','transfer','cheque') DEFAULT 'transfer',
  `payment_date`    DATE NOT NULL,
  `notes`           TEXT,
  `recorded_by`     CHAR(36),
  `created_at`      DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 15. BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS `budgets` (
  `id`            CHAR(36) NOT NULL,
  `budget_year`   INT NOT NULL,
  `department_id` CHAR(36),
  `total_budget`  DECIMAL(15,2) NOT NULL DEFAULT 0,
  `used_budget`   DECIMAL(15,2) NOT NULL DEFAULT 0,
  `notes`         TEXT,
  `created_by`    CHAR(36),
  `created_at`    DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 16. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`          CHAR(36) NOT NULL,
  `user_id`     CHAR(36),
  `title`       VARCHAR(200) NOT NULL,
  `message`     TEXT,
  `type`        VARCHAR(50) DEFAULT 'info',
  `link`        VARCHAR(500),
  `is_read`     TINYINT(1) DEFAULT 0,
  `created_at`  DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 17. STOCK OPNAME
-- ============================================================
CREATE TABLE IF NOT EXISTS `stock_opname` (
  `id`            CHAR(36) NOT NULL,
  `ref_number`    VARCHAR(50) UNIQUE NOT NULL,
  `warehouse_id`  CHAR(36),
  `opname_date`   DATE NOT NULL,
  `status`        ENUM('draft','in_progress','completed') DEFAULT 'draft',
  `notes`         TEXT,
  `created_by`    CHAR(36),
  `created_at`    DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `opname_items` (
  `id`              CHAR(36) NOT NULL,
  `opname_id`       CHAR(36) NOT NULL,
  `item_id`         CHAR(36) NOT NULL,
  `system_stock`    INT NOT NULL DEFAULT 0,
  `physical_count`  INT,
  `discrepancy`     INT,
  `notes`           TEXT,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`opname_id`) REFERENCES `stock_opname`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 18. RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS `returns` (
  `id`            CHAR(36) NOT NULL,
  `ref_number`    VARCHAR(50) UNIQUE NOT NULL,
  `type`          ENUM('inbound','outbound') DEFAULT 'inbound',
  `warehouse_id`  CHAR(36),
  `supplier_id`   CHAR(36),
  `return_date`   DATE NOT NULL,
  `reason`        TEXT,
  `status`        ENUM('pending','approved','rejected') DEFAULT 'pending',
  `approved_by`   CHAR(36),
  `created_by`    CHAR(36),
  `created_at`    DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED DATA — Default Users
-- ============================================================
-- Passwords: all set to "password123" (bcrypt hash)
-- IMPORTANT: Change passwords after first login!

INSERT IGNORE INTO `departments` (id, name, head_name) VALUES
  ('dept-admin-0001-0001-000000000001', 'Administrasi', 'Admin'),
  ('dept-gudang-001-0001-000000000002', 'Gudang', 'Kepala Gudang'),
  ('dept-finance-01-0001-000000000003', 'Finance & Pengadaan', 'Manager Finance'),
  ('dept-manager-01-0001-000000000004', 'Manajemen', 'Direktur'),
  ('dept-user-0001-0001-000000000005', 'Umum', NULL);

INSERT IGNORE INTO `warehouses` (id, code, name, address, city, is_active) VALUES
  ('wh-utama-00001-0001-000000000001', 'GDG-UTAMA', 'Gudang Utama', 'Jl. Industri No. 1', 'Jakarta', 1),
  ('wh-cabang-0001-0001-000000000002', 'GDG-CABANG', 'Gudang Cabang', 'Jl. Raya No. 2', 'Surabaya', 1);

-- Admin user (password: Admin@2026)
INSERT IGNORE INTO `users` (id, name, email, password_hash, role, department_id, is_active) VALUES
  ('user-admin-0001-0001-000000000001', 'Administrator', 'admin@wms-lutfhi.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
   'admin', 'dept-admin-0001-0001-000000000001', 1),
  ('user-staff-0001-0001-000000000002', 'Staff Gudang', 'staff@wms-lutfhi.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'staff', 'dept-gudang-001-0001-000000000002', 1),
  ('user-finance-001-0001-000000000003', 'Finance Manager', 'finance@wms-lutfhi.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'finance_procurement', 'dept-finance-01-0001-000000000003', 1),
  ('user-manager-001-0001-000000000004', 'Manager', 'manager@wms-lutfhi.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'manager', 'dept-manager-01-0001-000000000004', 1),
  ('user-user-0001-0001-000000000005', 'Requester', 'user@wms-lutfhi.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'requester', 'dept-user-0001-0001-000000000005', 1);

-- Assign users to warehouses
INSERT IGNORE INTO `user_warehouses` (user_id, warehouse_id, is_primary) VALUES
  ('user-admin-0001-0001-000000000001', 'wh-utama-00001-0001-000000000001', 1),
  ('user-admin-0001-0001-000000000001', 'wh-cabang-0001-0001-000000000002', 0),
  ('user-staff-0001-0001-000000000002', 'wh-utama-00001-0001-000000000001', 1),
  ('user-finance-001-0001-000000000003', 'wh-utama-00001-0001-000000000001', 1),
  ('user-manager-001-0001-000000000004', 'wh-utama-00001-0001-000000000001', 1),
  ('user-user-0001-0001-000000000005', 'wh-utama-00001-0001-000000000001', 1);

-- Sample categories
INSERT IGNORE INTO `categories` (id, name, description) VALUES
  ('cat-atk-00001-0001-000000000001', 'ATK (Alat Tulis Kantor)', 'Perlengkapan kantor'),
  ('cat-elektronik-001-000000000002', 'Elektronik', 'Peralatan elektronik'),
  ('cat-furniture-0-001-000000000003', 'Furniture', 'Perabotan kantor'),
  ('cat-komputer-00-001-000000000004', 'Komputer & Aksesori', 'Hardware dan aksesori'),
  ('cat-kebersihan-0-01-000000000005', 'Kebersihan', 'Perlengkapan kebersihan');

-- Sample units
INSERT IGNORE INTO `units` (id, name, abbreviation) VALUES
  ('unit-pcs-000001-0001-000000000001', 'Pieces', 'pcs'),
  ('unit-box-000001-0001-000000000002', 'Box', 'box'),
  ('unit-rim-000001-0001-000000000003', 'Rim', 'rim'),
  ('unit-lusin-00001-0001-000000000004', 'Lusin', 'lsn'),
  ('unit-buah-00001-0001-000000000005', 'Buah', 'bh'),
  ('unit-liter-0001-0001-000000000006', 'Liter', 'L'),
  ('unit-kg-000001-0001-000000000007', 'Kilogram', 'kg');

-- Sample suppliers
INSERT IGNORE INTO `suppliers` (id, code, name, email, phone, city, payment_terms, is_active) VALUES
  ('sup-berkah-0001-0001-000000000001', 'SUP-BRK-001', 'PT Berkah Jaya Mandiri', 'info@berkah.co.id', '021-5551234', 'Jakarta', 30, 1),
  ('sup-sumber-0001-0001-000000000002', 'SUP-SBR-001', 'CV Sumber Makmur', 'order@sumbermakmur.com', '031-5559876', 'Surabaya', 14, 1),
  ('sup-prima-00001-0001-000000000003', 'SUP-PRM-001', 'PT Prima Sukses', 'procurement@prima.id', '022-5554321', 'Bandung', 30, 1);

SET FOREIGN_KEY_CHECKS = 1;
