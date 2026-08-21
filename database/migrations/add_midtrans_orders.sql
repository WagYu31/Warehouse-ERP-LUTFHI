-- Migration: Create midtrans_orders table for payment gateway reconciliation
-- Column names match PHP backend-php/routes/erp.php usage

CREATE TABLE IF NOT EXISTS midtrans_orders (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(100) NOT NULL UNIQUE,
    amount BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_order_id (order_id),
    INDEX idx_invoice_id (invoice_id),
    INDEX idx_status (status),
    
    CONSTRAINT fk_midtrans_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
