<?php
// Web-accessible migration - access via browser: https://wms.alumni590.com/api/run_migration.php
header('Content-Type: text/plain');
require __DIR__ . '/config/database.php';

try {
    $db = getDB();
    echo "✅ Connected to database\n\n";
} catch (Exception $e) {
    echo "❌ Connection failed: " . $e->getMessage() . "\n";
    exit;
}

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

foreach ($sqls as $i => $sql) {
    try {
        $db->exec($sql);
        echo "✅ Query " . ($i+1) . " OK\n";
    } catch (Exception $e) {
        echo "⚠️ Query " . ($i+1) . " SKIP: " . $e->getMessage() . "\n";
    }
}

echo "\n🎉 Migration complete!\n";
