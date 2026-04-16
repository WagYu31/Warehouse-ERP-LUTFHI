<?php
// ============================================================
// ERP Routes: /api/erp/purchase-orders, invoices, budgets
// ============================================================

function handleERP(string $method, string $uri, array $user, array &$params): void {
    requireRole($user, 'admin','finance_procurement','manager');
    $db = getDB();

    // Strip /erp prefix
    $sub = substr($uri, 4); // remove '/erp'

    // ── PURCHASE ORDERS ──────────────────────────────────────
    if (strpos($sub, '/purchase-orders') === 0) {

        if ($method === 'GET' && $sub === '/purchase-orders') {
            [$limit, $offset] = paginate();
            $status = $_GET['status'] ?? '';
            $search = $_GET['search'] ?? '';

            $where = 'WHERE 1=1';
            $bind  = [];
            if ($status) { $where .= ' AND po.status=?'; $bind[] = $status; }
            if ($search) { $where .= ' AND (po.po_number LIKE ? OR s.name LIKE ?)'; $bind[] = "%$search%"; $bind[] = "%$search%"; }

            $total = $db->prepare("SELECT COUNT(*) FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id $where");
            $total->execute($bind);

            $stmt = $db->prepare("
                SELECT po.id, po.po_number, po.status, po.order_date, po.expected_date,
                       po.total_amount, po.notes, po.created_at,
                       s.name AS supplier_name, u.name AS created_by_name,
                       (SELECT COUNT(*) FROM po_items WHERE po_id=po.id) AS item_count
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id=po.supplier_id
                LEFT JOIN users u ON u.id=po.created_by
                $where ORDER BY po.created_at DESC LIMIT $limit OFFSET $offset
            ");
            $stmt->execute($bind);
            respondList($stmt->fetchAll(), (int)$total->fetchColumn());
            return;
        }

        if ($method === 'POST' && $sub === '/purchase-orders') {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody();
            requireFields($b, ['supplier_id','items']);

            $db->beginTransaction();
            try {
                $id = generateUUID();
                $poNum = generateRef('PO');
                $total_amount = 0;

                foreach ($b['items'] as $item) {
                    $total_amount += ($item['qty'] ?? 0) * ($item['unit_price'] ?? 0);
                }

                $db->prepare("INSERT INTO purchase_orders(id,po_number,supplier_id,warehouse_id,order_date,expected_date,payment_terms,notes,total_amount,status,created_by)
                    VALUES(?,?,?,?,?,?,?,?,?,'draft',?)")
                   ->execute([$id,$poNum,$b['supplier_id'],$b['warehouse_id']??null,date('Y-m-d'),$b['expected_date']??null,$b['payment_terms']??30,$b['notes']??null,$total_amount,$user['sub']]);

                $prep = $db->prepare("INSERT INTO po_items(id,po_id,item_id,qty_ordered,unit_price,notes) VALUES(?,?,?,?,?,?)");
                foreach ($b['items'] as $item) {
                    $prep->execute([generateUUID(),$id,$item['item_id'],$item['qty']??1,$item['unit_price']??0,$item['notes']??null]);
                }

                $db->commit();
                respond(['id'=>$id,'po_number'=>$poNum]);
            } catch (Exception $e) {
                $db->rollBack();
                respondError($e->getMessage(), 500);
            }
            return;
        }

        if ($method === 'GET' && preg_match('#^/purchase-orders/([^/]+)$#', $sub, $m)) {
            $stmt = $db->prepare("
                SELECT po.*, s.name AS supplier_name, u.name AS created_by_name
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id=po.supplier_id
                LEFT JOIN users u ON u.id=po.created_by
                WHERE po.id=?
            ");
            $stmt->execute([$m[1]]);
            $po = $stmt->fetch();
            if (!$po) respondError('PO not found', 404);

            $items = $db->prepare("SELECT pi.*, i.name AS item_name, i.sku, un.abbreviation AS unit FROM po_items pi JOIN items i ON i.id=pi.item_id LEFT JOIN units un ON un.id=i.unit_id WHERE pi.po_id=?");
            $items->execute([$m[1]]);
            $po['items'] = $items->fetchAll();
            respond($po);
            return;
        }

        if ($method === 'PUT' && preg_match('#^/purchase-orders/([^/]+)/status$#', $sub, $m)) {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody(); requireFields($b, ['status']);
            $db->prepare("UPDATE purchase_orders SET status=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['status'],$m[1]]);
            respond(['message'=>'PO status updated']);
            return;
        }
    }

    // ── INVOICES ─────────────────────────────────────────────
    if (strpos($sub, '/invoices') === 0) {

        if ($method === 'GET' && $sub === '/invoices') {
            [$limit, $offset] = paginate();
            $status = $_GET['status'] ?? '';
            $search = $_GET['search'] ?? '';

            $where = 'WHERE 1=1';
            $bind  = [];
            if ($status) { $where .= ' AND inv.status=?'; $bind[] = $status; }
            if ($search) { $where .= ' AND (inv.invoice_number LIKE ? OR s.name LIKE ?)'; $bind[] = "%$search%"; $bind[] = "%$search%"; }

            $total = $db->prepare("SELECT COUNT(*) FROM invoices inv LEFT JOIN suppliers s ON s.id=inv.supplier_id $where");
            $total->execute($bind);

            $stmt = $db->prepare("
                SELECT inv.id, inv.invoice_number, inv.status, inv.invoice_date,
                       inv.due_date, inv.total_amount, inv.amount_paid, inv.created_at,
                       s.name AS supplier_name
                FROM invoices inv
                LEFT JOIN suppliers s ON s.id=inv.supplier_id
                $where ORDER BY inv.created_at DESC LIMIT $limit OFFSET $offset
            ");
            $stmt->execute($bind);
            respondList($stmt->fetchAll(), (int)$total->fetchColumn());
            return;
        }

        if ($method === 'POST' && $sub === '/invoices') {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody(); requireFields($b, ['supplier_id','total_amount']);
            $id = generateUUID();
            $invNum = generateRef('INV');

            $db->prepare("INSERT INTO invoices(id,invoice_number,po_id,supplier_id,invoice_date,due_date,total_amount,amount_paid,status,notes,created_by)
                VALUES(?,?,?,?,?,?,?,0,'unpaid',?,?)")
               ->execute([$id,$invNum,$b['po_id']??null,$b['supplier_id'],date('Y-m-d'),$b['due_date']??null,$b['total_amount'],$b['notes']??null,$user['sub']]);
            respond(['id'=>$id,'invoice_number'=>$invNum]);
            return;
        }

        if ($method === 'GET' && preg_match('#^/invoices/([^/]+)$#', $sub, $m)) {
            $stmt = $db->prepare("SELECT inv.*, s.name AS supplier_name FROM invoices inv LEFT JOIN suppliers s ON s.id=inv.supplier_id WHERE inv.id=?");
            $stmt->execute([$m[1]]);
            $inv = $stmt->fetch();
            if (!$inv) respondError('Invoice not found', 404);
            respond($inv);
            return;
        }

        if ($method === 'POST' && preg_match('#^/invoices/([^/]+)/payment$#', $sub, $m)) {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody(); requireFields($b, ['amount','method']);

            $inv = $db->prepare("SELECT * FROM invoices WHERE id=?");
            $inv->execute([$m[1]]);
            $invoice = $inv->fetch();
            if (!$invoice) respondError('Invoice not found', 404);

            $newPaid = $invoice['amount_paid'] + $b['amount'];
            $status  = $newPaid >= $invoice['total_amount'] ? 'paid' : 'partial';

            $db->prepare("UPDATE invoices SET amount_paid=?, status=?, updated_at=NOW() WHERE id=?")->execute([$newPaid,$status,$m[1]]);
            $db->prepare("INSERT INTO invoice_payments(id,invoice_id,amount,payment_method,payment_date,notes,recorded_by) VALUES(?,?,?,?,?,?,?)")
               ->execute([generateUUID(),$m[1],$b['amount'],$b['method'],date('Y-m-d'),$b['notes']??null,$user['sub']]);

            respond(['message'=>'Payment recorded','status'=>$status,'total_paid'=>$newPaid]);
            return;
        }

        if ($method === 'GET' && preg_match('#^/invoices/([^/]+)/payments$#', $sub, $m)) {
            $stmt = $db->prepare("SELECT p.*,u.name AS recorded_by_name FROM invoice_payments p LEFT JOIN users u ON u.id=p.recorded_by WHERE p.invoice_id=? ORDER BY p.payment_date DESC");
            $stmt->execute([$m[1]]);
            respondList($stmt->fetchAll());
            return;
        }
    }

    // ── BUDGETS ──────────────────────────────────────────────
    if (strpos($sub, '/budgets') === 0) {
        if ($method === 'GET' && $sub === '/budgets') {
            $year = $_GET['year'] ?? date('Y');
            $stmt = $db->prepare("SELECT b.*,d.name AS department_name FROM budgets b LEFT JOIN departments d ON d.id=b.department_id WHERE b.budget_year=? ORDER BY b.created_at DESC");
            $stmt->execute([$year]);
            respondList($stmt->fetchAll());
            return;
        }

        if ($method === 'POST' && $sub === '/budgets') {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody(); requireFields($b, ['budget_year','department_id','total_budget']);
            $id = generateUUID();
            $db->prepare("INSERT INTO budgets(id,budget_year,department_id,total_budget,used_budget,notes,created_by) VALUES(?,?,?,?,0,?,?)")
               ->execute([$id,$b['budget_year'],$b['department_id'],$b['total_budget'],$b['notes']??null,$user['sub']]);
            respond(['id'=>$id]);
            return;
        }
    }

    // ── ERP SUMMARY ──────────────────────────────────────────
    if ($method === 'GET' && $sub === '/reports/summary') {
        $totalPO       = $db->query("SELECT COUNT(*) FROM purchase_orders WHERE YEAR(created_at)=YEAR(NOW())")->fetchColumn();
        $totalInvoices = $db->query("SELECT COUNT(*) FROM invoices WHERE YEAR(created_at)=YEAR(NOW())")->fetchColumn();
        $unpaidAmount  = $db->query("SELECT COALESCE(SUM(total_amount-amount_paid),0) FROM invoices WHERE status IN ('unpaid','partial')")->fetchColumn();
        $paidAmount    = $db->query("SELECT COALESCE(SUM(amount_paid),0) FROM invoices WHERE YEAR(created_at)=YEAR(NOW())")->fetchColumn();
        $totalBudget   = $db->query("SELECT COALESCE(SUM(total_budget),0) FROM budgets WHERE budget_year=YEAR(NOW())")->fetchColumn();
        $usedBudget    = $db->query("SELECT COALESCE(SUM(used_budget),0) FROM budgets WHERE budget_year=YEAR(NOW())")->fetchColumn();

        respond([
            'total_po'      => (int)$totalPO,
            'total_invoices'=> (int)$totalInvoices,
            'unpaid_amount' => (float)$unpaidAmount,
            'paid_amount'   => (float)$paidAmount,
            'total_budget'  => (float)$totalBudget,
            'used_budget'   => (float)$usedBudget,
        ]);
        return;
    }

    respondError('ERP route not found', 404);
}
