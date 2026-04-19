<?php
// ============================================================
// Reorder Configs: /api/reorder-configs
// ============================================================

function handleReorderConfigs(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /reorder-configs
    if ($method === 'GET' && $uri === '/reorder-configs') {
        $stmt = $db->query("
            SELECT rc.*,
                   i.name AS item_name, i.sku, i.min_stock,
                   w.name AS warehouse_name,
                   COALESCE(s.current_stock,0) AS current_stock
            FROM reorder_configs rc
            JOIN items i ON i.id=rc.item_id
            JOIN warehouses w ON w.id=rc.warehouse_id
            LEFT JOIN item_stocks s ON s.item_id=rc.item_id AND s.warehouse_id=rc.warehouse_id
            ORDER BY i.name
        ");
        $rows = $stmt->fetchAll();
        $result = array_map(function($r) {
            return [
                'id' => $r['id'],
                'reorder_point' => (int)$r['reorder_point'],
                'reorder_qty' => (int)$r['reorder_qty'],
                'auto_po' => (bool)$r['auto_po'],
                'current_stock' => (int)$r['current_stock'],
                'item' => [
                    'id' => $r['item_id'],
                    'name' => $r['item_name'],
                    'sku' => $r['sku'],
                    'min_stock' => (int)$r['min_stock'],
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

    // POST /reorder-configs
    if ($method === 'POST' && $uri === '/reorder-configs') {
        $b = requireBody();
        requireFields($b, ['item_id','warehouse_id']);
        $id = generateUUID();
        $db->prepare("
            INSERT INTO reorder_configs(id,item_id,warehouse_id,reorder_point,reorder_qty,auto_po)
            VALUES(?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE reorder_point=VALUES(reorder_point),reorder_qty=VALUES(reorder_qty),auto_po=VALUES(auto_po)
        ")->execute([
            $id, $b['item_id'], $b['warehouse_id'],
            $b['reorder_point'] ?? 0, $b['reorder_qty'] ?? 0, $b['auto_po'] ?? 0
        ]);
        respond(['id' => $id, 'message' => 'Reorder config saved']);
        return;
    }

    respondError('Reorder config route not found', 404);
}
