<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/config/database.php';

try {
    $db = getDB();
    
    echo "--- INBOUND TRANSACTIONS ---\n";
    $stmt = $db->query("SELECT id, ref_number, warehouse_id, status FROM inbound_transactions ORDER BY created_at DESC LIMIT 5");
    $txs = $stmt->fetchAll();
    foreach ($txs as $tx) {
        echo "ID: {$tx['id']} | Ref: {$tx['ref_number']} | Warehouse: {$tx['warehouse_id']} | Status: {$tx['status']}\n";
        
        // Fetch items
        $itemsStmt = $db->prepare("SELECT ii.item_id, ii.qty_received, i.sku, i.name FROM inbound_items ii JOIN items i ON i.id = ii.item_id WHERE ii.transaction_id = ?");
        $itemsStmt->execute([$tx['id']]);
        $items = $itemsStmt->fetchAll();
        foreach ($items as $item) {
            echo "   -> Item: {$item['name']} (SKU: {$item['sku']}) | Qty: {$item['qty_received']}\n";
        }
    }
    
    echo "\n--- ITEM STOCKS FOR ES CREAM ---\n";
    $sStmt = $db->query("SELECT s.item_id, s.warehouse_id, s.current_stock, i.name, w.name as warehouse_name FROM item_stocks s JOIN items i ON i.id = s.item_id JOIN warehouses w ON w.id = s.warehouse_id WHERE i.name LIKE '%Es Cream%' OR i.sku = 'KL01'");
    foreach ($sStmt->fetchAll() as $s) {
        echo "Item: {$s['name']} | Warehouse: {$s['warehouse_name']} | Stock: {$s['current_stock']}\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
