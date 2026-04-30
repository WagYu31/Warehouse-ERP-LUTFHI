<?php
// ============================================================
// Migration: Upgrade Categories & Units for Production
// Adds: is_active, updated_at columns for soft delete support
// ============================================================
require __DIR__ . '/config/database.php';
$db = getDB();
echo "Connected to database OK\n";

$sqls = [
    // Categories: add is_active and updated_at
    "ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1",
    "ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",

    // Units: add is_active and updated_at
    "ALTER TABLE units ADD COLUMN is_active TINYINT(1) DEFAULT 1",
    "ALTER TABLE units ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
];

foreach ($sqls as $sql) {
    try {
        $db->exec($sql);
        echo "✅ OK: $sql\n";
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'Duplicate column') !== false) {
            echo "⏭️  SKIP (kolom sudah ada): " . substr($sql, 0, 60) . "...\n";
        } else {
            echo "❌ ERROR: $msg\n";
        }
    }
}

echo "\n✅ Migration complete! Semua data existing otomatis is_active=1 (aktif)\n";
