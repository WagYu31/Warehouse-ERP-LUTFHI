<?php
require __DIR__ . '/config/database.php';
$db = getDB();
echo "Connected to database OK\n";

// Run migration
$sqls = [
    "ALTER TABLE stock_transfers ADD COLUMN approved_by VARCHAR(36) DEFAULT NULL",
    "ALTER TABLE stock_transfers ADD COLUMN reject_reason TEXT DEFAULT NULL",
    "CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id VARCHAR(36) PRIMARY KEY,
        transfer_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        qty INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_transfer_id (transfer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

foreach ($sqls as $sql) {
    try {
        $db->exec($sql);
        echo "OK: " . substr($sql, 0, 70) . "\n";
    } catch (Exception $e) {
        echo "SKIP: " . $e->getMessage() . "\n";
    }
}
echo "Migration complete!\n";
