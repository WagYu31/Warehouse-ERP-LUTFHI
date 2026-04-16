<?php
// ============================================================
// Request (SPB) Routes: /api/requests
// ============================================================

function handleRequests(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/requests') {
        [$limit, $offset] = paginate();
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $mine   = ($_GET['my'] ?? '') === '1';

        $where = 'WHERE 1=1';
        $bind  = [];
        if ($mine)   { $where .= ' AND r.requested_by=?'; $bind[] = $user['sub']; }
        if ($status) { $where .= ' AND r.status=?'; $bind[] = $status; }
        if ($search) { $where .= ' AND (r.ref_number LIKE ? OR r.purpose LIKE ?)'; $bind[] = "%$search%"; $bind[] = "%$search%"; }

        $total = $db->prepare("SELECT COUNT(*) FROM requests r $where");
        $total->execute($bind);
        $count = (int)$total->fetchColumn();

        $stmt = $db->prepare("
            SELECT r.id, r.ref_number, r.status, r.purpose, r.priority,
                   r.required_date, r.created_at,
                   u.name AS requested_by_name,
                   d.name AS department_name,
                   (SELECT COUNT(*) FROM request_items WHERE request_id=r.id) AS item_count
            FROM requests r
            LEFT JOIN users u ON u.id=r.requested_by
            LEFT JOIN departments d ON d.id=r.department_id
            $where ORDER BY r.created_at DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($bind);
        respondList($stmt->fetchAll(), $count);
        return;
    }

    if ($method === 'GET' && preg_match('#^/requests/([^/]+)$#', $uri, $m)) {
        $stmt = $db->prepare("
            SELECT r.*, u.name AS requested_by_name, d.name AS department_name,
                   a.name AS approved_by_name
            FROM requests r
            LEFT JOIN users u ON u.id=r.requested_by
            LEFT JOIN users a ON a.id=r.approved_by
            LEFT JOIN departments d ON d.id=r.department_id
            WHERE r.id=?
        ");
        $stmt->execute([$m[1]]);
        $req = $stmt->fetch();
        if (!$req) respondError('Not found', 404);

        $items = $db->prepare("
            SELECT ri.*, i.name AS item_name, i.sku, u.abbreviation AS unit
            FROM request_items ri
            JOIN items i ON i.id=ri.item_id
            LEFT JOIN units u ON u.id=i.unit_id
            WHERE ri.request_id=?
        ");
        $items->execute([$m[1]]);
        $req['items'] = $items->fetchAll();
        respond($req);
        return;
    }

    if ($method === 'POST' && $uri === '/requests') {
        requireRole($user, 'admin','staff','requester');
        $b = requireBody();
        requireFields($b, ['items']);
        if (empty($b['items'])) respondError('Items required', 400);

        $db->beginTransaction();
        try {
            $id  = generateUUID();
            $ref = generateRef('SPB');

            $db->prepare("
                INSERT INTO requests(id,ref_number,requested_by,department_id,purpose,priority,required_date,notes,status)
                VALUES(?,?,?,?,?,?,?,?,'pending')
            ")->execute([$id,$ref,$user['sub'],$b['department_id']??null,$b['purpose']??null,$b['priority']??'normal',$b['required_date']??null,$b['notes']??null]);

            $prep = $db->prepare("INSERT INTO request_items(id,request_id,item_id,qty_requested,notes) VALUES(?,?,?,?,?)");
            foreach ($b['items'] as $item) {
                if (empty($item['item_id'])) continue;
                $prep->execute([generateUUID(),$id,$item['item_id'],$item['qty_requested']??1,$item['notes']??null]);
            }

            $db->commit();
            respond(['id'=>$id,'ref_number'=>$ref,'message'=>'Request created']);
        } catch (Exception $e) {
            $db->rollBack();
            respondError('Failed: '.$e->getMessage(), 500);
        }
        return;
    }

    if ($method === 'PUT' && preg_match('#^/requests/([^/]+)/(approve|reject)$#', $uri, $m)) {
        requireRole($user, 'admin','staff');
        $b = getBody();
        $newStatus = $m[2] === 'approve' ? 'approved' : 'rejected';

        $db->prepare("UPDATE requests SET status=?,approved_by=?,approval_notes=?,approved_at=NOW() WHERE id=?")
           ->execute([$newStatus,$user['sub'],$b['notes']??null,$m[1]]);
        respond(['message'=>'Request '.($m[2]==='approve'?'approved':'rejected')]);
        return;
    }

    respondError('Requests route not found', 404);
}
