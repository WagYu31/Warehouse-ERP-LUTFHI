<?php
require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    echo "Connected to database OK\n";

    // 1. Create return_items table
    echo "Creating return_items table if it does not exist...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS return_items (
            id CHAR(36) PRIMARY KEY,
            return_id CHAR(36) NOT NULL,
            item_id CHAR(36) NOT NULL,
            qty INT NOT NULL,
            warehouse_id CHAR(36),
            unit_price DECIMAL(15,2) DEFAULT 0,
            FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    echo "✅ Table return_items verified/created successfully!\n";

    echo "\nDatabase migration completed successfully!\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
