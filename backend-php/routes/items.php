<?php
// ============================================================
// Items Routes: /api/items
// ============================================================

function handleItems(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /items/export/csv
    if ($method === 'GET' && $uri === '/items/export/csv') {
        $stmt = $db->query("
            SELECT i.sku, i.name, c.name as category, u.abbreviation as unit,
                   COALESCE(SUM(s.current_stock),0) as total_stock,
                   i.min_stock, i.price, i.is_active
            FROM items i
            LEFT JOIN categories c ON c.id = i.category_id
            LEFT JOIN units u ON u.id = i.unit_id
            LEFT JOIN item_stocks s ON s.item_id = i.id
            WHERE i.is_active = 1
            GROUP BY i.id
            ORDER BY i.name
        ");
        $rows = $stmt->fetchAll();

        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="items_' . date('Ymd') . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['SKU','Nama','Kategori','Satuan','Stok Total','Min Stok','Harga','Aktif']);
        foreach ($rows as $row) fputcsv($out, $row);
        fclose($out);
        exit;
    }

    // GET /items
    if ($method === 'GET' && $uri === '/items') {
        [$limit, $offset] = paginate();
        $search   = $_GET['search'] ?? '';
        $category = $_GET['category_id'] ?? '';
        $wid      = $_GET['warehouse_id'] ?? '';

        $where = 'WHERE 1=1';
        $bind  = [];
        if ($search)   { $where .= ' AND (i.name LIKE ? OR i.sku LIKE ?)'; $bind[] = "%$search%"; $bind[] = "%$search%"; }
        if ($category) { $where .= ' AND i.category_id = ?'; $bind[] = $category; }

        $total = $db->prepare("SELECT COUNT(*) FROM items i $where");
        $total->execute($bind);
        $count = (int)$total->fetchColumn();

        // Stock subquery
        $stockJoin = $wid
            ? "LEFT JOIN item_stocks s ON s.item_id=i.id AND s.warehouse_id='$wid'"
            : "LEFT JOIN (SELECT item_id, SUM(current_stock) as current_stock FROM item_stocks GROUP BY item_id) s ON s.item_id=i.id";

        $bindClone = $bind;
        $stmt = $db->prepare("
            SELECT i.id, i.sku, i.name, i.description, i.min_stock, i.max_stock,
                   i.price, i.photo_url, i.barcode, i.is_active,
                   i.batch_tracking, i.expired_tracking, i.outbound_method,
                   i.created_at, i.updated_at,
                   c.name AS category_name, u.name AS unit_name, u.abbreviation AS unit_abbreviation,
                   COALESCE(s.current_stock,0) AS current_stock
            FROM items i
            LEFT JOIN categories c ON c.id=i.category_id
            LEFT JOIN units u ON u.id=i.unit_id
            $stockJoin
            $where ORDER BY i.name LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($bindClone);
        respondList($stmt->fetchAll(), $count);
        return;
    }

    // GET /items/:id
    if ($method === 'GET' && preg_match('#^/items/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT i.*, c.name AS category_name, u.name AS unit_name, u.abbreviation AS unit_abbreviation
            FROM items i
            LEFT JOIN categories c ON c.id=i.category_id
            LEFT JOIN units u ON u.id=i.unit_id
            WHERE i.id=?
        ");
        $stmt->execute([$m[1]]);
        $item = $stmt->fetch();
        if (!$item) respondError('Item not found', 404);

        // Stock per warehouse
        $ss = $db->prepare("SELECT s.*, w.name AS warehouse_name FROM item_stocks s JOIN warehouses w ON w.id=s.warehouse_id WHERE s.item_id=?");
        $ss->execute([$m[1]]);
        $item['stocks'] = $ss->fetchAll();

        respond($item);
        return;
    }

    // POST /items
    if ($method === 'POST' && $uri === '/items') {
        requireRole($user, 'admin');
        $b = requireBody();
        requireFields($b, ['sku','name','unit_id']);

        $check = $db->prepare("SELECT id FROM items WHERE sku=?");
        $check->execute([$b['sku']]);
        if ($check->fetch()) respondError('SKU already exists', 409);

        $id = generateUUID();
        $db->prepare("
            INSERT INTO items(id,sku,name,description,category_id,unit_id,min_stock,max_stock,
                              price,photo_url,barcode,is_active,batch_tracking,expired_tracking,
                              alert_days_before,outbound_method)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $id, $b['sku'], $b['name'], $b['description']??null, $b['category_id']??null,
            $b['unit_id'], $b['min_stock']??0, $b['max_stock']??null, $b['price']??0,
            $b['photo_url']??null, $b['barcode']??null, $b['is_active']??1,
            $b['batch_tracking']??0, $b['expired_tracking']??0,
            $b['alert_days_before']??30, $b['outbound_method']??'fefo'
        ]);

        // Initialize stock in all warehouses = 0
        $wh = $db->query("SELECT id FROM warehouses WHERE is_active=1");
        $prep = $db->prepare("INSERT IGNORE INTO item_stocks(id,item_id,warehouse_id,current_stock) VALUES(?,?,?,0)");
        foreach ($wh->fetchAll() as $w) {
            $prep->execute([generateUUID(), $id, $w['id']]);
        }

        respond(['id' => $id, 'message' => 'Item created']);
        return;
    }

    // PUT /items/:id
    if ($method === 'PUT' && preg_match('#^/items/([^/]+)$#', $uri, $m)) {
        requireRole($user, 'admin');
        $b = requireBody();
        $db->prepare("
            UPDATE items SET sku=?,name=?,description=?,category_id=?,unit_id=?,min_stock=?,
                             max_stock=?,price=?,photo_url=?,barcode=?,is_active=?,
                             batch_tracking=?,expired_tracking=?,outbound_method=?,updated_at=NOW()
            WHERE id=?
        ")->execute([
            $b['sku'], $b['name'], $b['description']??null, $b['category_id']??null,
            $b['unit_id'], $b['min_stock']??0, $b['max_stock']??null, $b['price']??0,
            $b['photo_url']??null, $b['barcode']??null, $b['is_active']??1,
            $b['batch_tracking']??0, $b['expired_tracking']??0,
            $b['outbound_method']??'fefo', $m[1]
        ]);
        respond(['message' => 'Item updated']);
        return;
    }

    // DELETE /items/:id
    if ($method === 'DELETE' && preg_match('#^/items/([^/]+)$#', $uri, $m)) {
        requireRole($user, 'admin');
        $db->prepare("DELETE FROM items WHERE id=?")->execute([$m[1]]);
        respond(['message' => 'Item deleted']);
        return;
    }

    respondError('Items route not found', 404);
}
