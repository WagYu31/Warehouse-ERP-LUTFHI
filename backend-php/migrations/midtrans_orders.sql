-- Tabel untuk tracking midtrans orders per invoice
CREATE TABLE IF NOT EXISTS midtrans_orders (
    id         VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL,
    order_id   VARCHAR(100) NOT NULL UNIQUE,
    amount     DECIMAL(15,2) NOT NULL,
    status     ENUM('pending','settled','cancel','expire','deny') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_invoice_id (invoice_id),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
