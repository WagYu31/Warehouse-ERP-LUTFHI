<?php
// ============================================================
// Stock Opname, Stock Transfers, Returns — Simplified handlers
// ============================================================

function handleOpname(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/opname') {
        [$limit, $offset] = paginate();
        $stmt = $db->prepare("SELECT o.*,w.name AS warehouse_name,u.name AS created_by_name FROM stock_opname o LEFT JOIN warehouses w ON w.id=o.warehouse_id LEFT JOIN users u ON u.id=o.created_by ORDER BY o.created_at DESC LIMIT $limit OFFSET $offset");
        $stmt->execute();
        respondList($stmt->fetchAll());
        return;
    }

    if ($method === 'GET' && preg_match('#^/opname/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("SELECT o.*,w.name AS warehouse_name FROM stock_opname o LEFT JOIN warehouses w ON w.id=o.warehouse_id WHERE o.id=?");
        $stmt->execute([$m[1]]);
        $op = $stmt->fetch();
        if (!$op) respondError('Not found', 404);
        $items = $db->prepare("SELECT oi.*,i.name AS item_name,i.sku FROM opname_items oi JOIN items i ON i.id=oi.item_id WHERE oi.opname_id=?");
        $items->execute([$m[1]]);
        $op['items'] = $items->fetchAll();
        respond($op);
        return;
    }

    if ($method === 'POST' && $uri === '/opname') {
        requireRole($user, 'admin','staff');
        $b = requireBody(); requireFields($b, ['warehouse_id','opname_date']);
        $id = generateUUID(); $ref = generateRef('OPN');

        $db->prepare("INSERT INTO stock_opname(id,ref_number,warehouse_id,opname_date,status,notes,created_by) VALUES(?,?,?,?,'in_progress',?,?)")
           ->execute([$id,$ref,$b['warehouse_id'],$b['opname_date'],$b['notes']??null,$user['sub']]);

        // Auto-populate items with current stock
        $stocks = $db->prepare("SELECT item_id,current_stock FROM item_stocks WHERE warehouse_id=?");
        $stocks->execute([$b['warehouse_id']]);
        $prep = $db->prepare("INSERT INTO opname_items(id,opname_id,item_id,system_stock) VALUES(?,?,?,?)");
        foreach ($stocks->fetchAll() as $s) {
            $prep->execute([generateUUID(),$id,$s['item_id'],$s['current_stock']]);
        }

        respond(['id'=>$id,'ref_number'=>$ref]);
        return;
    }

    if ($method === 'POST' && preg_match('#^/opname/([^/]+)/submit$#', $uri, $m)) {
        requireRole($user, 'admin','staff');
        $b = requireBody();

        $db->beginTransaction();
        try {
            foreach (($b['counts'] ?? []) as $c) {
                $disc = ($c['physical_count'] ?? 0) - ($c['system_stock'] ?? 0);
                $db->prepare("UPDATE opname_items SET physical_count=?,discrepancy=?,notes=? WHERE id=?")
                   ->execute([$c['physical_count']??0,$disc,$c['notes']??null,$c['id']??null]);

                // Adjust actual stock if confirmed
                if ($b['adjust_stock'] ?? false) {
                    $db->prepare("UPDATE item_stocks SET current_stock=?,last_updated=NOW() WHERE item_id=? AND warehouse_id=?")
                       ->execute([$c['physical_count']??0,$c['item_id']??null,$b['warehouse_id']??null]);
                }
            }
            $db->prepare("UPDATE stock_opname SET status='completed' WHERE id=?")->execute([$m[1]]);
            $db->commit();
            respond(['message'=>'Opname submitted']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    respondError('Opname route not found', 404);
}

function handleStockTransfers(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/stock-transfers') {
        [$limit, $offset] = paginate();
        $stmt = $db->query("SELECT t.id,t.ref_number,t.transfer_date,t.status,t.notes,t.created_at,wf.name AS from_warehouse,wt.name AS to_warehouse FROM stock_transfers t LEFT JOIN warehouses wf ON wf.id=t.from_warehouse_id LEFT JOIN warehouses wt ON wt.id=t.to_warehouse_id ORDER BY t.created_at DESC LIMIT $limit OFFSET $offset");
        respondList($stmt->fetchAll());
        return;
    }

    if ($method === 'POST' && $uri === '/stock-transfers') {
        requireRole($user, 'admin','staff');
        $b = requireBody(); requireFields($b, ['from_warehouse_id','to_warehouse_id','transfer_date','items']);
        $id = generateUUID(); $ref = generateRef('TRF');

        $db->beginTransaction();
        try {
            $db->prepare("INSERT INTO stock_transfers(id,ref_number,from_warehouse_id,to_warehouse_id,transfer_date,notes,status,created_by) VALUES(?,?,?,?,?,?,'completed',?)")
               ->execute([$id,$ref,$b['from_warehouse_id'],$b['to_warehouse_id'],$b['transfer_date'],$b['notes']??null,$user['sub']]);

            foreach ($b['items'] as $item) {
                if (empty($item['item_id'])) continue;
                // Deduct from source
                $db->prepare("UPDATE item_stocks SET current_stock=GREATEST(0,current_stock-?),last_updated=NOW() WHERE item_id=? AND warehouse_id=?")
                   ->execute([$item['qty']??1,$item['item_id'],$b['from_warehouse_id']]);
                // Add to destination
                $db->prepare("INSERT INTO item_stocks(id,item_id,warehouse_id,current_stock,last_updated) VALUES(?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE current_stock=current_stock+VALUES(current_stock),last_updated=NOW()")
                   ->execute([generateUUID(),$item['item_id'],$b['to_warehouse_id'],$item['qty']??1]);
            }

            $db->commit();
            respond(['id'=>$id,'ref_number'=>$ref]);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    respondError('Stock transfers route not found', 404);
}

function handleReturns(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/returns') {
        [$limit, $offset] = paginate();
        $stmt = $db->query("SELECT r.*,s.name AS supplier_name,w.name AS warehouse_name FROM returns r LEFT JOIN suppliers s ON s.id=r.supplier_id LEFT JOIN warehouses w ON w.id=r.warehouse_id ORDER BY r.created_at DESC LIMIT $limit OFFSET $offset");
        respondList($stmt->fetchAll());
        return;
    }

    if ($method === 'POST' && $uri === '/returns') {
        requireRole($user, 'admin','staff','finance_procurement');
        $b = requireBody(); requireFields($b, ['return_date','type']);
        $id = generateUUID(); $ref = generateRef('RTN');
        $db->prepare("INSERT INTO returns(id,ref_number,type,warehouse_id,supplier_id,return_date,reason,status,created_by) VALUES(?,?,?,?,?,?,'pending',?)")
           ->execute([$id,$ref,$b['type'],$b['warehouse_id']??null,$b['supplier_id']??null,$b['return_date'],$b['reason']??null,$user['sub']]);
        respond(['id'=>$id,'ref_number'=>$ref]);
        return;
    }

    if ($method === 'PUT' && preg_match('#^/returns/([^/]+)/approve$#', $uri, $m)) {
        requireRole($user, 'admin');
        $db->prepare("UPDATE returns SET status='approved',approved_by=? WHERE id=?")->execute([$user['sub'],$m[1]]);
        respond(['message'=>'Return approved']);
        return;
    }

    respondError('Returns route not found', 404);
}
