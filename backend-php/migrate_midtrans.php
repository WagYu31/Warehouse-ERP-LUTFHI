<?php
// ============================================================
// Migration: Create midtrans_orders table for payment gateway
// Maps Midtrans order_id to local invoice_id for reconciliation
// ============================================================
require __DIR__ . '/config/database.php';
$db = getDB();
echo "Connected to database OK\n";

$sqls = [
    // Create midtrans_orders table
    "CREATE TABLE IF NOT EXISTS midtrans_orders (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

foreach ($sqls as $sql) {
    try {
        $db->exec($sql);
        echo "✅ OK: Tabel midtrans_orders berhasil dibuat\n";
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'already exists') !== false) {
            echo "⏭️  SKIP (table sudah ada)\n";
        } else {
            echo "❌ ERROR: $msg\n";
        }
    }
}

echo "\n✅ Migration complete! Tabel midtrans_orders siap digunakan.\n";
echo "⚠️  PENTING: Pastikan MIDTRANS_SERVER_KEY sudah di-set di environment server!\n";
