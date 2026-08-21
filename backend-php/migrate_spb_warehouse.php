<?php
require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    echo "Connected to database OK\n";

    // 1. Add warehouse_id to requests table if it doesn't exist
    echo "Checking if warehouse_id column exists in requests table...\n";
    $q = $db->query("SHOW COLUMNS FROM requests LIKE 'warehouse_id'");
    if (!$q->fetch()) {
        echo "Adding warehouse_id column...\n";
        $db->exec("ALTER TABLE requests ADD COLUMN warehouse_id CHAR(36) NULL AFTER department_id");
        $db->exec("ALTER TABLE requests ADD FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL");
        echo "✅ Column warehouse_id added successfully!\n";
    } else {
        echo "✅ Column warehouse_id already exists.\n";
    }

    echo "\nDatabase migration completed successfully!\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
