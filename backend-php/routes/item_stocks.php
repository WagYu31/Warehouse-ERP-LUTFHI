<?php
// ============================================================
// Item Stocks: /api/item-stocks/*
// ============================================================

function handleItemStocks(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /item-stocks — list all stock per warehouse
    if ($method === 'GET' && $uri === '/item-stocks') {
        $stmt = $db->query("
            SELECT s.*, i.name AS item_name, i.sku, i.min_stock, i.price,
                   w.name AS warehouse_name, c.name AS category_name
            FROM item_stocks s
            JOIN items i ON i.id=s.item_id
            JOIN warehouses w ON w.id=s.warehouse_id
            LEFT JOIN categories c ON c.id=i.category_id
            WHERE i.is_active=1
            ORDER BY i.name
        ");
        respondList($stmt->fetchAll());
        return;
    }

    // GET /item-stocks/low — items below min stock
    if ($method === 'GET' && $uri === '/item-stocks/low') {
        $stmt = $db->query("
            SELECT s.id, s.item_id, s.warehouse_id, s.current_stock,
                   i.name AS item_name, i.sku, i.min_stock, i.price,
                   w.name AS warehouse_name
            FROM item_stocks s
            JOIN items i ON i.id=s.item_id
            JOIN warehouses w ON w.id=s.warehouse_id
            WHERE i.is_active=1 AND s.current_stock <= i.min_stock
            ORDER BY s.current_stock ASC
        ");
        $rows = $stmt->fetchAll();
        // Transform to match frontend expected format
        $result = array_map(function($r) {
            return [
                'id' => $r['id'],
                'current_stock' => (int)$r['current_stock'],
                'item' => [
                    'id' => $r['item_id'],
                    'name' => $r['item_name'],
                    'sku' => $r['sku'],
                    'min_stock' => (int)$r['min_stock'],
                    'price' => $r['price'],
                ],
                'warehouse' => [
                    'id' => $r['warehouse_id'],
                    'name' => $r['warehouse_name'],
                ],
            ];
        }, $rows);
        respondList($result);
        return;
    }

    respondError('Item stocks route not found', 404);
}
