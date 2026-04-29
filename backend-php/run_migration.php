<?php
header('Content-Type: text/plain');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$host   = 'localhost';
$dbname = 'pitiagic_wms_lutfh';
$user   = 'pitiagic_wms_user';
$pass   = 'WmsLuth@2026#Secure';

$dsn = "mysql:host={$host};port=3306;dbname={$dbname};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "CONNECTED OK!\n\n";

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
            $pdo->exec($sql);
            echo "OK: Query " . ($i+1) . "\n";
        } catch (Exception $e) {
            echo "SKIP: " . $e->getMessage() . "\n";
        }
    }
    echo "\nMigration complete!\n";
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
