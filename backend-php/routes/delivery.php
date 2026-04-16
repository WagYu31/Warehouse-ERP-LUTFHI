<?php
// ============================================================
// Delivery Orders: /api/delivery-orders
// ============================================================

function handleDelivery(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/delivery-orders') {
        [$limit, $offset] = paginate();
        $stmt = $db->prepare("
            SELECT d.id, d.ref_number, d.delivery_date, d.destination, d.status,
                   d.notes, d.created_at,
                   w.name AS warehouse_name, u.name AS created_by_name
            FROM delivery_orders d
            LEFT JOIN warehouses w ON w.id=d.warehouse_id
            LEFT JOIN users u ON u.id=d.created_by
            ORDER BY d.created_at DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute();
        respondList($stmt->fetchAll());
        return;
    }

    if ($method === 'GET' && preg_match('#^/delivery-orders/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT d.*, w.name AS warehouse_name, u.name AS created_by_name
            FROM delivery_orders d LEFT JOIN warehouses w ON w.id=d.warehouse_id
            LEFT JOIN users u ON u.id=d.created_by WHERE d.id=?
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

    if ($method === 'POST' && $uri === '/delivery-orders') {
        requireRole($user, 'admin','staff');
        $b = requireBody(); requireFields($b, ['warehouse_id','delivery_date','items']);
        $id = generateUUID();
        $ref = generateRef('SJ');

        $db->prepare("INSERT INTO delivery_orders(id,ref_number,warehouse_id,created_by,delivery_date,destination,notes,status)
            VALUES(?,?,?,?,?,?,?,'pending')")
           ->execute([$id,$ref,$b['warehouse_id'],$user['sub'],$b['delivery_date'],$b['destination']??null,$b['notes']??null]);

        $prep = $db->prepare("INSERT INTO delivery_items(id,delivery_id,item_id,qty) VALUES(?,?,?,?)");
        foreach ($b['items'] as $item) {
            $prep->execute([generateUUID(),$id,$item['item_id'],$item['qty']??1]);
        }

        respond(['id'=>$id,'ref_number'=>$ref]);
        return;
    }

    if ($method === 'PUT' && preg_match('#^/delivery-orders/([^/]+)/confirm$#', $uri, $m)) {
        requireRole($user, 'admin','staff');
        $db->prepare("UPDATE delivery_orders SET status='delivered',updated_at=NOW() WHERE id=?")
           ->execute([$m[1]]);
        respond(['message'=>'Delivery confirmed']);
        return;
    }

    respondError('Delivery route not found', 404);
}
