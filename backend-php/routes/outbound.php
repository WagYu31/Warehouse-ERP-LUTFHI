<?php
// ============================================================
// Outbound Routes: /api/outbound
// ============================================================

function handleOutbound(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/outbound') {
        [$limit, $offset] = paginate();
        $wid    = $_GET['warehouse_id'] ?? '';
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';

        $where = 'WHERE 1=1';
        $bind  = [];
        if ($wid)    { $where .= ' AND t.warehouse_id=?'; $bind[] = $wid; }
        if ($status) { $where .= ' AND t.status=?'; $bind[] = $status; }
        if ($search) { $where .= ' AND t.ref_number LIKE ?'; $bind[] = "%$search%"; }

        $total = $db->prepare("SELECT COUNT(*) FROM outbound_transactions t $where");
        $total->execute($bind);
        $count = (int)$total->fetchColumn();

        $stmt = $db->prepare("
            SELECT t.id, t.ref_number, t.outbound_date, t.status, t.destination,
                   t.notes, t.created_at,
                   w.name AS warehouse_name, u.name AS issued_by_name,
                   (SELECT COUNT(*) FROM outbound_items WHERE transaction_id=t.id) AS item_count
            FROM outbound_transactions t
            LEFT JOIN warehouses w ON w.id=t.warehouse_id
            LEFT JOIN users u ON u.id=t.issued_by
            $where ORDER BY t.created_at DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($bind);
        respondList($stmt->fetchAll(), $count);
        return;
    }

    if ($method === 'GET' && preg_match('#^/outbound/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT t.*, w.name AS warehouse_name, u.name AS issued_by_name
            FROM outbound_transactions t
            LEFT JOIN warehouses w ON w.id=t.warehouse_id
            LEFT JOIN users u ON u.id=t.issued_by
            WHERE t.id=?
        ");
        $stmt->execute([$m[1]]);
        $tx = $stmt->fetch();
        if (!$tx) respondError('Not found', 404);

        $items = $db->prepare("
            SELECT oi.*, i.name AS item_name, i.sku, un.abbreviation AS unit
            FROM outbound_items oi
            JOIN items i ON i.id=oi.item_id
            LEFT JOIN units un ON un.id=i.unit_id
            WHERE oi.transaction_id=?
        ");
        $items->execute([$m[1]]);
        $tx['items'] = $items->fetchAll();
        respond($tx);
        return;
    }

    if ($method === 'POST' && $uri === '/outbound') {
        requireRole($user, 'admin', 'staff');
        $b = requireBody();
        requireFields($b, ['warehouse_id','outbound_date','items']);
        if (empty($b['items'])) respondError('Items required', 400);

        $db->beginTransaction();
        try {
            $id  = generateUUID();
            $ref = generateRef('DO');

            $db->prepare("
                INSERT INTO outbound_transactions(id,ref_number,warehouse_id,issued_by,outbound_date,destination,request_id,notes,status)
                VALUES(?,?,?,?,?,?,?,?,'confirmed')
            ")->execute([$id,$ref,$b['warehouse_id'],$user['sub'],$b['outbound_date'],$b['destination']??null,$b['request_id']??null,$b['notes']??null]);

            $prepItem = $db->prepare("INSERT INTO outbound_items(id,transaction_id,item_id,qty_issued,batch_number,notes) VALUES(?,?,?,?,?,?)");
            $deductStock = $db->prepare("
                UPDATE item_stocks SET current_stock=GREATEST(0,current_stock-?), last_updated=NOW()
                WHERE item_id=? AND warehouse_id=?
            ");

            foreach ($b['items'] as $item) {
                if (empty($item['item_id']) || empty($item['qty_issued'])) continue;
                $prepItem->execute([generateUUID(),$id,$item['item_id'],$item['qty_issued'],$item['batch_number']??null,$item['notes']??null]);
                $deductStock->execute([$item['qty_issued'],$item['item_id'],$b['warehouse_id']]);
            }

            $db->commit();
            respond(['id'=>$id,'ref_number'=>$ref,'message'=>'Outbound created']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError('Failed: '.$e->getMessage(), 500);
        }
        return;
    }

    respondError('Outbound route not found', 404);
}
