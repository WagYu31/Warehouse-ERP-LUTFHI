<?php
require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    echo "Connected to database OK\n";

    // 1. Alter table to support 'dispatched' in ENUM
    echo "Altering delivery_orders status ENUM...\n";
    $db->exec("ALTER TABLE delivery_orders MODIFY COLUMN status ENUM('pending','dispatched','delivered','cancelled') DEFAULT 'pending'");
    echo "✅ ALTER TABLE success!\n";

    // 2. Fix invalid empty strings in status column to 'dispatched'
    echo "Updating empty statuses to 'dispatched'...\n";
    $stmt = $db->prepare("UPDATE delivery_orders SET status='dispatched' WHERE status = '' OR status IS NULL");
    $stmt->execute();
    $rows = $stmt->rowCount();
    echo "✅ Updated $rows rows to 'dispatched'!\n";

    echo "\nDatabase migration completed successfully!\n";
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
