<?php
// ============================================================
// Delivery Orders: /api/delivery-orders
// Workflow: Staff buat (pending) → Admin approve (stok keluar) / reject
// ============================================================

function handleDelivery(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /delivery-orders — List all
    if ($method === 'GET' && $uri === '/delivery-orders') {
        [$limit, $offset] = paginate();
        $wid = $_GET['warehouse_id'] ?? '';
        $where = $wid ? "WHERE d.warehouse_id='$wid'" : '';
        $stmt = $db->query("
            SELECT d.id, d.ref_number, d.delivery_date, d.destination, d.status,
                   d.notes, d.created_at, d.approved_by, d.reject_reason,
                   w.name AS warehouse_name, u.name AS created_by_name, ua.name AS approved_by_name
            FROM delivery_orders d
            LEFT JOIN warehouses w ON w.id=d.warehouse_id
            LEFT JOIN users u ON u.id=d.created_by
            LEFT JOIN users ua ON ua.id=d.approved_by
            $where
            ORDER BY d.created_at DESC LIMIT $limit OFFSET $offset
        ");
        respondList($stmt->fetchAll());
        return;
    }

    // GET /delivery-orders/:id — Detail with items
    if ($method === 'GET' && preg_match('#^/delivery-orders/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT d.*, w.name AS warehouse_name, u.name AS created_by_name, ua.name AS approved_by_name
            FROM delivery_orders d
            LEFT JOIN warehouses w ON w.id=d.warehouse_id
            LEFT JOIN users u ON u.id=d.created_by
            LEFT JOIN users ua ON ua.id=d.approved_by
            WHERE d.id=?
        ");
        $stmt->execute([$m[1]]);
        $do = $stmt->fetch();
        if (!$do) respondError('Not found', 404);

        $items = $db->prepare("SELECT di.*,i.name AS item_name,i.sku FROM delivery_items di JOIN items i ON i.id=di.item_id WHERE di.delivery_id=?");
        $items->execute([$m[1]]);
        $do['items'] = $items->fetchAll();
        respond($do);
        return;
    }

    // POST /delivery-orders — Staff/Admin buat request (status: pending)
    if ($method === 'POST' && $uri === '/delivery-orders') {
        requireRole($user, 'admin','staff');
        $b = requireBody(); requireFields($b, ['warehouse_id','delivery_date','items']);
        $id = generateUUID();
        $ref = generateRef('SJ');

        $db->beginTransaction();
        try {
            $db->prepare("INSERT INTO delivery_orders(id,ref_number,warehouse_id,created_by,delivery_date,destination,notes,status)
                VALUES(?,?,?,?,?,?,?,'pending')")
               ->execute([$id,$ref,$b['warehouse_id'],$user['sub'],$b['delivery_date'],$b['destination']??null,$b['notes']??null]);

            $prep = $db->prepare("INSERT INTO delivery_items(id,delivery_id,item_id,qty) VALUES(?,?,?,?)");
            foreach ($b['items'] as $item) {
                if (empty($item['item_id'])) continue;
                $prep->execute([generateUUID(),$id,$item['item_id'],$item['qty']??1]);
            }

            $db->commit();
            respond(['id'=>$id,'ref_number'=>$ref,'message'=>'Surat Jalan dibuat, menunggu approval Admin']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    // PUT /delivery-orders/:id/approve — Admin approve & deduct stock
    if ($method === 'PUT' && preg_match('#^/delivery-orders/([^/]+)/approve$#', $uri, $m)) {
        requireRole($user, 'admin');
        $did = $m[1];

        $chk = $db->prepare("SELECT * FROM delivery_orders WHERE id=? AND status='pending'");
        $chk->execute([$did]);
        $do = $chk->fetch();
        if (!$do) respondError('Surat Jalan tidak ditemukan atau sudah diproses', 400);

        $db->beginTransaction();
        try {
            // Get items
            $items = $db->prepare("SELECT * FROM delivery_items WHERE delivery_id=?");
            $items->execute([$did]);
            $deliveryItems = $items->fetchAll();

            // Deduct stock from warehouse
            foreach ($deliveryItems as $item) {
                $db->prepare("UPDATE item_stocks SET current_stock=GREATEST(0,current_stock-?),last_updated=NOW() WHERE item_id=? AND warehouse_id=?")
                   ->execute([$item['qty'], $item['item_id'], $do['warehouse_id']]);
            }

            // Update status to approved/dispatched
            $db->prepare("UPDATE delivery_orders SET status='dispatched',approved_by=?,updated_at=NOW() WHERE id=?")
               ->execute([$user['sub'], $did]);

            $db->commit();
            respond(['message'=>'Surat Jalan disetujui, stok sudah dikurangi dari gudang']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    // PUT /delivery-orders/:id/reject — Admin reject
    if ($method === 'PUT' && preg_match('#^/delivery-orders/([^/]+)/reject$#', $uri, $m)) {
        requireRole($user, 'admin');
        $b = requireBody();
        $reason = $b['reason'] ?? '';

        $chk = $db->prepare("SELECT id FROM delivery_orders WHERE id=? AND status='pending'");
        $chk->execute([$m[1]]);
        if (!$chk->fetch()) respondError('Surat Jalan tidak ditemukan atau sudah diproses', 400);

        $db->prepare("UPDATE delivery_orders SET status='cancelled',approved_by=?,reject_reason=?,updated_at=NOW() WHERE id=?")
           ->execute([$user['sub'], $reason, $m[1]]);
        respond(['message'=>'Surat Jalan ditolak']);
        return;
    }

    // PUT /delivery-orders/:id/confirm — Konfirmasi diterima
    if ($method === 'PUT' && preg_match('#^/delivery-orders/([^/]+)/confirm$#', $uri, $m)) {
        requireRole($user, 'admin','staff');
        $b = getBody();
        $db->prepare("UPDATE delivery_orders SET status='delivered',updated_at=NOW() WHERE id=? AND status='dispatched'")
           ->execute([$m[1]]);
        respond(['message'=>'Pengiriman dikonfirmasi diterima']);
        return;
    }

    respondError('Delivery route not found', 404);
}
