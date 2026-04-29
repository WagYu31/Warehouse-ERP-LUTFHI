<?php
// ============================================================
// Stock Opname, Stock Transfers, Returns — Simplified handlers
// ============================================================

function handleOpname(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /opname — List all opname
    if ($method === 'GET' && $uri === '/opname') {
        [$limit, $offset] = paginate();
        $stmt = $db->prepare("SELECT o.*,w.name AS warehouse_name,u.name AS created_by_name,u2.name AS counted_by_name,u3.name AS approved_by_name FROM stock_opname o LEFT JOIN warehouses w ON w.id=o.warehouse_id LEFT JOIN users u ON u.id=o.created_by LEFT JOIN users u2 ON u2.id=o.counted_by LEFT JOIN users u3 ON u3.id=o.approved_by ORDER BY o.created_at DESC LIMIT $limit OFFSET $offset");
        $stmt->execute();
        respondList($stmt->fetchAll());
        return;
    }

    // GET /opname/:id — Detail opname
    if ($method === 'GET' && preg_match('#^/opname/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("SELECT o.*,w.name AS warehouse_name,u.name AS created_by_name,u2.name AS counted_by_name,u3.name AS approved_by_name FROM stock_opname o LEFT JOIN warehouses w ON w.id=o.warehouse_id LEFT JOIN users u ON u.id=o.created_by LEFT JOIN users u2 ON u2.id=o.counted_by LEFT JOIN users u3 ON u3.id=o.approved_by WHERE o.id=?");
        $stmt->execute([$m[1]]);
        $op = $stmt->fetch();
        if (!$op) respondError('Not found', 404);
        $items = $db->prepare("SELECT oi.*,i.name AS item_name,i.sku FROM opname_items oi JOIN items i ON i.id=oi.item_id WHERE oi.opname_id=?");
        $items->execute([$m[1]]);
        $op['items'] = $items->fetchAll();
        respond($op);
        return;
    }

    // POST /opname — Tahap 1: Admin buat jadwal opname
    if ($method === 'POST' && $uri === '/opname') {
        requireRole($user, 'admin');
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

    // POST /opname/:id/submit — Tahap 2: Staff input hitungan fisik
    if ($method === 'POST' && preg_match('#^/opname/([^/]+)/submit$#', $uri, $m)) {
        requireRole($user, 'staff');
        $b = requireBody();

        // Validasi status harus in_progress
        $check = $db->prepare("SELECT status FROM stock_opname WHERE id=?");
        $check->execute([$m[1]]);
        $current = $check->fetch();
        if (!$current) respondError('Opname not found', 404);
        if ($current['status'] !== 'in_progress') {
            respondError('Opname ini sudah tidak bisa dihitung (status: ' . $current['status'] . ')', 400);
        }

        $db->beginTransaction();
        try {
            $discCount = 0;
            foreach (($b['items'] ?? []) as $c) {
                $physCount = (int)($c['physical_count'] ?? 0);
                $sysStock = (int)($c['system_stock'] ?? 0);
                $disc = $physCount - $sysStock;
                if ($disc !== 0) $discCount++;

                $db->prepare("UPDATE opname_items SET physical_count=?,discrepancy=?,notes=? WHERE item_id=? AND opname_id=?")
                   ->execute([$physCount,$disc,$c['notes']??null,$c['item_id']??null,$m[1]]);
            }
            // Status berubah ke pending_review, catat siapa yang menghitung
            $db->prepare("UPDATE stock_opname SET status='pending_review',counted_by=?,counted_at=NOW(),discrepancy_count=? WHERE id=?")
               ->execute([$user['sub'],$discCount,$m[1]]);
            $db->commit();
            respond(['message'=>'Hitungan berhasil dikirim, menunggu approval Admin','discrepancy_count'=>$discCount]);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    // PUT /opname/:id/approve — Tahap 3: Admin approve & adjust stok
    if ($method === 'PUT' && preg_match('#^/opname/([^/]+)/approve$#', $uri, $m)) {
        requireRole($user, 'admin');
        $b = getBody();

        $check = $db->prepare("SELECT o.status,o.warehouse_id FROM stock_opname o WHERE o.id=?");
        $check->execute([$m[1]]);
        $current = $check->fetch();
        if (!$current) respondError('Opname not found', 404);
        if ($current['status'] !== 'pending_review') {
            respondError('Hanya opname dengan status "Menunggu Review" yang bisa di-approve', 400);
        }

        $db->beginTransaction();
        try {
            // Adjust stok sesuai hitungan fisik
            if ($b['adjust_stock'] ?? true) {
                $items = $db->prepare("SELECT item_id,physical_count FROM opname_items WHERE opname_id=?");
                $items->execute([$m[1]]);
                foreach ($items->fetchAll() as $item) {
                    $db->prepare("UPDATE item_stocks SET current_stock=?,last_updated=NOW() WHERE item_id=? AND warehouse_id=?")
                       ->execute([$item['physical_count'],$item['item_id'],$current['warehouse_id']]);
                }
            }
            $db->prepare("UPDATE stock_opname SET status='completed',approved_by=?,approved_at=NOW(),approve_notes=? WHERE id=?")
               ->execute([$user['sub'],$b['notes']??null,$m[1]]);
            $db->commit();
            respond(['message'=>'Opname disetujui dan stok telah disesuaikan']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    // PUT /opname/:id/reject — Admin tolak, kirim balik untuk hitung ulang
    if ($method === 'PUT' && preg_match('#^/opname/([^/]+)/reject$#', $uri, $m)) {
        requireRole($user, 'admin');
        $b = getBody();

        $check = $db->prepare("SELECT status FROM stock_opname WHERE id=?");
        $check->execute([$m[1]]);
        $current = $check->fetch();
        if (!$current) respondError('Opname not found', 404);
        if ($current['status'] !== 'pending_review') {
            respondError('Hanya opname dengan status "Menunggu Review" yang bisa ditolak', 400);
        }

        // Reset ke in_progress agar Staff bisa hitung ulang
        $db->prepare("UPDATE stock_opname SET status='in_progress',reject_reason=?,counted_by=NULL,counted_at=NULL WHERE id=?")
           ->execute([$b['reason']??'Perlu hitung ulang',$m[1]]);
        respond(['message'=>'Opname ditolak, Staff perlu menghitung ulang']);
        return;
    }

    respondError('Opname route not found', 404);
}

function handleStockTransfers(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /stock-transfers — list all
    if ($method === 'GET' && $uri === '/stock-transfers') {
        [$limit, $offset] = paginate();
        $wid = $_GET['warehouse_id'] ?? '';
        $where = $wid ? "WHERE (t.from_warehouse_id='$wid' OR t.to_warehouse_id='$wid')" : '';
        $stmt = $db->query("
            SELECT t.id, t.ref_number, t.transfer_date, t.status, t.notes, t.created_at, t.approved_by, t.reject_reason,
                   wf.name AS from_warehouse, wt.name AS to_warehouse,
                   uc.name AS created_by_name, ua.name AS approved_by_name
            FROM stock_transfers t
            LEFT JOIN warehouses wf ON wf.id=t.from_warehouse_id
            LEFT JOIN warehouses wt ON wt.id=t.to_warehouse_id
            LEFT JOIN users uc ON uc.id=t.created_by
            LEFT JOIN users ua ON ua.id=t.approved_by
            $where
            ORDER BY t.created_at DESC LIMIT $limit OFFSET $offset
        ");
        respondList($stmt->fetchAll());
        return;
    }

    // GET /stock-transfers/:id — detail with items
    if ($method === 'GET' && preg_match('#^/stock-transfers/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT t.*, wf.name AS from_warehouse, wt.name AS to_warehouse,
                   uc.name AS created_by_name, ua.name AS approved_by_name
            FROM stock_transfers t
            LEFT JOIN warehouses wf ON wf.id=t.from_warehouse_id
            LEFT JOIN warehouses wt ON wt.id=t.to_warehouse_id
            LEFT JOIN users uc ON uc.id=t.created_by
            LEFT JOIN users ua ON ua.id=t.approved_by
            WHERE t.id=?
        ");
        $stmt->execute([$m[1]]);
        $trf = $stmt->fetch();
        if (!$trf) respondError('Transfer not found', 404);

        // Get transfer items
        $items = $db->prepare("SELECT ti.*, i.name AS item_name, i.sku FROM stock_transfer_items ti LEFT JOIN items i ON i.id=ti.item_id WHERE ti.transfer_id=?");
        $items->execute([$m[1]]);
        $trf['items'] = $items->fetchAll();

        respond($trf);
        return;
    }

    // POST /stock-transfers — Staff/Admin buat request (status: pending)
    if ($method === 'POST' && $uri === '/stock-transfers') {
        requireRole($user, 'admin','staff');
        $b = requireBody(); requireFields($b, ['from_warehouse_id','to_warehouse_id','transfer_date','items']);
        $id = generateUUID(); $ref = generateRef('TRF');

        $db->beginTransaction();
        try {
            // Insert transfer as PENDING (stok belum berpindah)
            $db->prepare("INSERT INTO stock_transfers(id,ref_number,from_warehouse_id,to_warehouse_id,transfer_date,notes,status,created_by) VALUES(?,?,?,?,?,?,'pending',?)")
               ->execute([$id,$ref,$b['from_warehouse_id'],$b['to_warehouse_id'],$b['transfer_date'],$b['notes']??null,$user['sub']]);

            // Save transfer items for approval reference
            $prep = $db->prepare("INSERT INTO stock_transfer_items(id,transfer_id,item_id,qty) VALUES(?,?,?,?)");
            foreach ($b['items'] as $item) {
                if (empty($item['item_id'])) continue;
                $prep->execute([generateUUID(), $id, $item['item_id'], $item['qty']??1]);
            }

            $db->commit();
            respond(['id'=>$id,'ref_number'=>$ref,'message'=>'Transfer dibuat, menunggu approval Admin']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    // PUT /stock-transfers/:id/approve — Admin approve & move stock
    if ($method === 'PUT' && preg_match('#^/stock-transfers/([^/]+)/approve$#', $uri, $m)) {
        requireRole($user, 'admin');
        $tid = $m[1];

        // Check status
        $chk = $db->prepare("SELECT * FROM stock_transfers WHERE id=? AND status='pending'");
        $chk->execute([$tid]);
        $trf = $chk->fetch();
        if (!$trf) respondError('Transfer tidak ditemukan atau sudah diproses', 400);

        $db->beginTransaction();
        try {
            // Get items
            $items = $db->prepare("SELECT * FROM stock_transfer_items WHERE transfer_id=?");
            $items->execute([$tid]);
            $transferItems = $items->fetchAll();

            // Move stock
            foreach ($transferItems as $item) {
                // Deduct from source
                $db->prepare("UPDATE item_stocks SET current_stock=GREATEST(0,current_stock-?),last_updated=NOW() WHERE item_id=? AND warehouse_id=?")
                   ->execute([$item['qty'], $item['item_id'], $trf['from_warehouse_id']]);
                // Add to destination
                $db->prepare("INSERT INTO item_stocks(id,item_id,warehouse_id,current_stock,last_updated) VALUES(?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE current_stock=current_stock+VALUES(current_stock),last_updated=NOW()")
                   ->execute([generateUUID(), $item['item_id'], $trf['to_warehouse_id'], $item['qty']]);
            }

            // Update status
            $db->prepare("UPDATE stock_transfers SET status='completed',approved_by=? WHERE id=?")
               ->execute([$user['sub'], $tid]);

            $db->commit();
            respond(['message'=>'Transfer disetujui, stok sudah berpindah']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError($e->getMessage(), 500);
        }
        return;
    }

    // PUT /stock-transfers/:id/reject — Admin reject
    if ($method === 'PUT' && preg_match('#^/stock-transfers/([^/]+)/reject$#', $uri, $m)) {
        requireRole($user, 'admin');
        $b = requireBody();
        $reason = $b['reason'] ?? '';

        $chk = $db->prepare("SELECT id FROM stock_transfers WHERE id=? AND status='pending'");
        $chk->execute([$m[1]]);
        if (!$chk->fetch()) respondError('Transfer tidak ditemukan atau sudah diproses', 400);

        $db->prepare("UPDATE stock_transfers SET status='rejected',approved_by=?,reject_reason=? WHERE id=?")
           ->execute([$user['sub'], $reason, $m[1]]);
        respond(['message'=>'Transfer ditolak']);
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
        $db->prepare("INSERT INTO returns(id,ref_number,type,warehouse_id,supplier_id,return_date,reason,status,created_by) VALUES(?,?,?,?,?,?,?,'pending',?)")
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
