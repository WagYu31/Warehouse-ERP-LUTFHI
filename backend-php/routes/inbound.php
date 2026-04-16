<?php
// ============================================================
// Inbound Routes: /api/inbound
// ============================================================

function handleInbound(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /inbound
    if ($method === 'GET' && $uri === '/inbound') {
        [$limit, $offset] = paginate();
        $wid    = $_GET['warehouse_id'] ?? '';
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';

        $where = 'WHERE 1=1';
        $bind  = [];
        if ($wid)    { $where .= ' AND t.warehouse_id=?'; $bind[] = $wid; }
        if ($status) { $where .= ' AND t.status=?'; $bind[] = $status; }
        if ($search) { $where .= ' AND (t.ref_number LIKE ? OR s.name LIKE ?)'; $bind[] = "%$search%"; $bind[] = "%$search%"; }

        $total = $db->prepare("SELECT COUNT(*) FROM inbound_transactions t LEFT JOIN suppliers s ON s.id=t.supplier_id $where");
        $total->execute($bind);
        $count = (int)$total->fetchColumn();

        $stmt = $db->prepare("
            SELECT t.id, t.ref_number, t.received_date, t.status, t.notes,
                   t.po_number, t.created_at,
                   s.name AS supplier_name,
                   w.name AS warehouse_name,
                   u.name AS received_by_name,
                   (SELECT COUNT(*) FROM inbound_items WHERE transaction_id=t.id) AS item_count
            FROM inbound_transactions t
            LEFT JOIN suppliers s ON s.id=t.supplier_id
            LEFT JOIN warehouses w ON w.id=t.warehouse_id
            LEFT JOIN users u ON u.id=t.received_by
            $where ORDER BY t.created_at DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($bind);
        respondList($stmt->fetchAll(), $count);
        return;
    }

    // GET /inbound/:id
    if ($method === 'GET' && preg_match('#^/inbound/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT t.*, s.name AS supplier_name, w.name AS warehouse_name, u.name AS received_by_name
            FROM inbound_transactions t
            LEFT JOIN suppliers s ON s.id=t.supplier_id
            LEFT JOIN warehouses w ON w.id=t.warehouse_id
            LEFT JOIN users u ON u.id=t.received_by
            WHERE t.id=?
        ");
        $stmt->execute([$m[1]]);
        $tx = $stmt->fetch();
        if (!$tx) respondError('Inbound not found', 404);

        $items = $db->prepare("
            SELECT ii.*, i.name AS item_name, i.sku, u.abbreviation AS unit,
                   l.zone, l.rack, l.bin
            FROM inbound_items ii
            JOIN items i ON i.id=ii.item_id
            LEFT JOIN units u ON u.id=i.unit_id
            LEFT JOIN locations l ON l.id=ii.location_id
            WHERE ii.transaction_id=?
        ");
        $items->execute([$m[1]]);
        $tx['items'] = $items->fetchAll();

        respond($tx);
        return;
    }

    // POST /inbound
    if ($method === 'POST' && $uri === '/inbound') {
        requireRole($user, 'admin', 'staff');
        $b = requireBody();
        requireFields($b, ['warehouse_id', 'received_date', 'items']);

        if (empty($b['items'])) respondError('At least one item required', 400);

        $db->beginTransaction();
        try {
            $id  = generateUUID();
            $ref = generateRef('GRN');

            $db->prepare("
                INSERT INTO inbound_transactions(id,ref_number,supplier_id,warehouse_id,received_by,received_date,po_number,notes,status)
                VALUES(?,?,?,?,?,?,?,?,'pending')
            ")->execute([$id, $ref, $b['supplier_id']??null, $b['warehouse_id'],
                         $user['sub'], $b['received_date'], $b['po_number']??null, $b['notes']??null]);

            $prepItem = $db->prepare("INSERT INTO inbound_items(id,transaction_id,item_id,qty_received,unit_price,batch_number,expired_date,location_id,notes) VALUES(?,?,?,?,?,?,?,?,?)");

            foreach ($b['items'] as $item) {
                if (empty($item['item_id']) || empty($item['qty_received'])) continue;
                $prepItem->execute([generateUUID(), $id, $item['item_id'], $item['qty_received'], $item['unit_price']??0, $item['batch_number']??null, $item['expired_date']??null, $item['location_id']??null, $item['notes']??null]);
            }

            $db->commit();
            respond(['id' => $id, 'ref_number' => $ref, 'message' => 'Inbound created']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError('Failed to create inbound: ' . $e->getMessage(), 500);
        }
        return;
    }

    // PUT /inbound/:id/confirm — confirm and update stock
    if ($method === 'PUT' && preg_match('#^/inbound/([^/]+)/confirm$#', $uri, $m)) {
        requireRole($user, 'admin', 'staff');

        $stmt = $db->prepare("SELECT * FROM inbound_transactions WHERE id=?");
        $stmt->execute([$m[1]]);
        $tx = $stmt->fetch();
        if (!$tx) respondError('Not found', 404);
        if ($tx['status'] === 'confirmed') respondError('Already confirmed', 400);

        $db->beginTransaction();
        try {
            // Update inbound status
            $db->prepare("UPDATE inbound_transactions SET status='confirmed',updated_at=NOW() WHERE id=?")
               ->execute([$m[1]]);

            // Update stock for each item
            $items = $db->prepare("SELECT item_id, qty_received FROM inbound_items WHERE transaction_id=?");
            $items->execute([$m[1]]);

            $upsert = $db->prepare("
                INSERT INTO item_stocks(id,item_id,warehouse_id,current_stock,last_updated)
                VALUES(?,?,?,?,NOW())
                ON DUPLICATE KEY UPDATE current_stock=current_stock+VALUES(current_stock), last_updated=NOW()
            ");

            foreach ($items->fetchAll() as $itm) {
                $upsert->execute([generateUUID(), $itm['item_id'], $tx['warehouse_id'], $itm['qty_received']]);
            }

            $db->commit();
            respond(['message' => 'Inbound confirmed, stock updated']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError('Confirm failed: ' . $e->getMessage(), 500);
        }
        return;
    }

    respondError('Inbound route not found', 404);
}
