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

                $db->prepare("INSERT INTO purchase_orders(id,po_number,supplier_id,warehouse_id,department_id,order_date,expected_date,payment_terms,notes,total_amount,status,created_by)
                    VALUES(?,?,?,?,?,?,?,?,?,?,'draft',?)")
                   ->execute([$id,$poNum,$b['supplier_id'],$b['warehouse_id']??null,$b['department_id']??null,date('Y-m-d'),$b['expected_date']??null,$b['payment_terms']??30,$b['notes']??null,$total_amount,$user['sub']]);

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
                SELECT po.*, s.name AS supplier_name, u.name AS created_by_name, w.name AS warehouse_name
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id=po.supplier_id
                LEFT JOIN users u ON u.id=po.created_by
                LEFT JOIN warehouses w ON w.id=po.warehouse_id
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

        // PUT /purchase-orders/:id/status — Generic status update (backward compat)
        if ($method === 'PUT' && preg_match('#^/purchase-orders/([^/]+)/status$#', $sub, $m)) {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody(); requireFields($b, ['status']);
            $db->prepare("UPDATE purchase_orders SET status=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['status'],$m[1]]);
            respond(['message'=>'PO status updated']);
            return;
        }

        // PUT /purchase-orders/:id/approve — Admin approve PO + auto-create Invoice
        if ($method === 'PUT' && preg_match('#^/purchase-orders/([^/]+)/approve$#', $sub, $m)) {
            requireRole($user, 'admin');
            $chk = $db->prepare("SELECT * FROM purchase_orders WHERE id=?");
            $chk->execute([$m[1]]);
            $po = $chk->fetch();
            if (!$po) respondError('PO tidak ditemukan', 404);
            if ($po['status'] !== 'draft') respondError('Hanya PO draft yang bisa di-approve', 400);

            $db->beginTransaction();
            try {
                // Budget check & deduction
                $budgetMsg = '';
                if (!empty($po['department_id']) && $po['total_amount'] > 0) {
                    $budgetStmt = $db->prepare("SELECT id, total_budget, used_budget FROM budgets WHERE department_id=? AND budget_year=YEAR(NOW()) LIMIT 1");
                    $budgetStmt->execute([$po['department_id']]);
                    $budget = $budgetStmt->fetch();
                    if ($budget) {
                        $sisa = $budget['total_budget'] - $budget['used_budget'];
                        if ($po['total_amount'] > $sisa) {
                            throw new Exception('Budget tidak cukup! Sisa: Rp ' . number_format($sisa, 0, ',', '.') . ', PO: Rp ' . number_format($po['total_amount'], 0, ',', '.'));
                        }
                        $db->prepare("UPDATE budgets SET used_budget=used_budget+? WHERE id=?")
                           ->execute([$po['total_amount'], $budget['id']]);
                        $budgetMsg = ' Budget terpotong Rp ' . number_format($po['total_amount'], 0, ',', '.');
                    }
                }

                // Update PO status
                $db->prepare("UPDATE purchase_orders SET status='approved',approved_by=?,updated_at=NOW() WHERE id=?")
                   ->execute([$user['sub'], $m[1]]);

                // Auto-create Invoice from PO
                $invId = generateUUID();
                $invNum = generateRef('INV');
                $paymentTerms = (int)($po['payment_terms'] ?? 30);
                $dueDate = date('Y-m-d', strtotime("+{$paymentTerms} days"));

                $db->prepare("INSERT INTO invoices(id,invoice_number,po_id,supplier_id,invoice_date,due_date,total_amount,amount_paid,status,notes,created_by)
                    VALUES(?,?,?,?,NOW(),?,?,0,'unpaid',?,?)")
                   ->execute([$invId, $invNum, $m[1], $po['supplier_id'], $dueDate, $po['total_amount'], 'Auto-generated dari PO '.$po['po_number'], $user['sub']]);

                $db->commit();
                respond([
                    'message' => 'PO disetujui & Invoice dibuat!' . $budgetMsg,
                    'invoice_id' => $invId,
                    'invoice_number' => $invNum
                ]);
            } catch (Exception $e) {
                $db->rollBack();
                respondError($e->getMessage(), 500);
            }
            return;
        }

        // PUT /purchase-orders/:id/reject — Admin reject PO
        if ($method === 'PUT' && preg_match('#^/purchase-orders/([^/]+)/reject$#', $sub, $m)) {
            requireRole($user, 'admin');
            $b = getBody();
            $chk = $db->prepare("SELECT id,status FROM purchase_orders WHERE id=?");
            $chk->execute([$m[1]]);
            $po = $chk->fetch();
            if (!$po) respondError('PO tidak ditemukan', 404);
            if ($po['status'] !== 'draft') respondError('Hanya PO draft yang bisa ditolak', 400);

            $db->prepare("UPDATE purchase_orders SET status='cancelled',reject_reason=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['reason']??'', $m[1]]);
            respond(['message'=>'PO ditolak']);
            return;
        }

        // POST /purchase-orders/:id/receive — Terima barang → Auto-create Inbound
        if ($method === 'POST' && preg_match('#^/purchase-orders/([^/]+)/receive$#', $sub, $m)) {
            requireRole($user, 'admin','staff');
            $po = $db->prepare("SELECT * FROM purchase_orders WHERE id=?");
            $po->execute([$m[1]]);
            $poData = $po->fetch();
            if (!$poData) respondError('PO tidak ditemukan', 404);
            if ($poData['status'] !== 'approved') respondError('Hanya PO yang sudah di-approve yang bisa diterima', 400);

            $db->beginTransaction();
            try {
                // Create inbound transaction from PO
                $inboundId = generateUUID();
                $ref = generateRef('GRN');
                $db->prepare("INSERT INTO inbound_transactions(id,ref_number,supplier_id,warehouse_id,received_by,received_date,po_number,notes,status)
                    VALUES(?,?,?,?,?,NOW(),?,?,'pending')")
                   ->execute([$inboundId, $ref, $poData['supplier_id'], $poData['warehouse_id'], $user['sub'], $poData['po_number'], 'Auto-created dari PO '.$poData['po_number']]);

                // Copy PO items to inbound items
                $poItems = $db->prepare("SELECT item_id, qty_ordered, unit_price FROM po_items WHERE po_id=?");
                $poItems->execute([$m[1]]);
                $prepItem = $db->prepare("INSERT INTO inbound_items(id,transaction_id,item_id,qty_received,unit_price) VALUES(?,?,?,?,?)");
                foreach ($poItems->fetchAll() as $item) {
                    $prepItem->execute([generateUUID(), $inboundId, $item['item_id'], $item['qty_ordered'], $item['unit_price']]);
                }

                // Update PO status to received
                $db->prepare("UPDATE purchase_orders SET status='received',updated_at=NOW() WHERE id=?")
                   ->execute([$m[1]]);

                $db->commit();
                respond([
                    'message' => 'Barang diterima! Inbound dibuat otomatis. Konfirmasi inbound untuk update stok.',
                    'inbound_id' => $inboundId,
                    'inbound_ref' => $ref
                ]);
            } catch (Exception $e) {
                $db->rollBack();
                respondError($e->getMessage(), 500);
            }
            return;
        }
    }

    // ── INVOICES ─────────────────────────────────────────────
    if (strpos($sub, '/invoices') === 0) {

        // Buat snap token Midtrans untuk pembayaran invoice
        if ($method === 'POST' && preg_match('#^/invoices/([^/]+)/snap-token$#', $sub, $m)) {
            requireRole($user, 'admin','finance_procurement');
            $inv = $db->prepare("SELECT inv.*, s.name AS supplier_name FROM invoices inv LEFT JOIN suppliers s ON s.id=inv.supplier_id WHERE inv.id=?");
            $inv->execute([$m[1]]);
            $invoice = $inv->fetch();
            if (!$invoice) respondError('Invoice not found', 404);
            if ($invoice['status'] === 'paid') respondError('Invoice sudah lunas', 400);

            $sisa   = (float)$invoice['total_amount'] - (float)($invoice['amount_paid'] ?? 0);
            $orderId = 'WMS-INV-' . $m[1] . '-' . time();

            $payload = [
                'transaction_details' => [
                    'order_id'     => $orderId,
                    'gross_amount' => (int)ceil($sisa),
                ],
                'item_details' => [[
                    'id'       => $m[1],
                    'price'    => (int)ceil($sisa),
                    'quantity' => 1,
                    'name'     => 'Invoice ' . $invoice['invoice_number'],
                ]],
                'customer_details' => [
                    'first_name' => 'Finance',
                    'last_name'  => 'Manager',
                    'email'      => 'finance@lutfhi.co.id',
                ],
                'custom_field1' => $m[1], // invoice_id
            ];

            $serverKey = getenv('MIDTRANS_SERVER_KEY') ?: '';
            $url       = getenv('MIDTRANS_IS_PRODUCTION') === 'true'
                ? 'https://app.midtrans.com/snap/v1/transactions'
                : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => json_encode($payload),
                CURLOPT_HTTPHEADER     => [
                    'Content-Type: application/json',
                    'Authorization: Basic ' . base64_encode($serverKey . ':'),
                ],
            ]);
            $result = json_decode(curl_exec($ch), true);
            curl_close($ch);

            if (!isset($result['token'])) {
                respondError('Gagal buat snap token: ' . ($result['error_messages'][0] ?? 'Unknown error'), 500);
            }

            // Simpan order_id untuk referensi webhook
            $db->prepare("INSERT INTO midtrans_orders(id, invoice_id, order_id, amount, status, created_at)
                VALUES(?,?,?,?,'pending',NOW()) ON DUPLICATE KEY UPDATE order_id=VALUES(order_id), amount=VALUES(amount)")
               ->execute([generateUUID(), $m[1], $orderId, (int)ceil($sisa)]);

            respond(['token' => $result['token'], 'order_id' => $orderId]);
            return;
        }

        // POST /erp/invoices/:id/check-payment — Cek & sync status dari Midtrans API
        if ($method === 'POST' && preg_match('#^/invoices/([^/]+)/check-payment$#', $sub, $m)) {
            requireRole($user, 'admin','finance_procurement');
            $invoiceId = $m[1];
            $serverKey = getenv('MIDTRANS_SERVER_KEY') ?: '';

            if (!$serverKey) {
                respondError('MIDTRANS_SERVER_KEY belum dikonfigurasi', 500);
            }

            // Ambil order_id terbaru yang masih pending
            $stmt = $db->prepare("SELECT order_id, amount, status FROM midtrans_orders WHERE invoice_id=? AND status NOT IN ('settled','paid') ORDER BY created_at DESC LIMIT 1");
            $stmt->execute([$invoiceId]);
            $order = $stmt->fetch();

            if (!$order) {
                // Tidak ada pending order — kembalikan status invoice saja
                $invStmt = $db->prepare("SELECT status FROM invoices WHERE id=?");
                $invStmt->execute([$invoiceId]);
                $inv = $invStmt->fetch();
                respond(['message' => 'Tidak ada transaksi pending', 'synced' => false, 'invoice_status' => $inv['status'] ?? 'unknown']);
                return;
            }

            $orderId = $order['order_id'];
            $storedAmount = (float)$order['amount'];

            // Query Midtrans Transaction Status API
            $isProduction = getenv('MIDTRANS_IS_PRODUCTION') === 'true';
            $baseUrl = $isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
            $statusUrl = $baseUrl . '/v2/' . $orderId . '/status';

            $ch = curl_init($statusUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => [
                    'Accept: application/json',
                    'Authorization: Basic ' . base64_encode($serverKey . ':'),
                ],
            ]);
            $mtResp = json_decode(curl_exec($ch), true);
            curl_close($ch);

            $txStatus   = $mtResp['transaction_status'] ?? '';
            $fraudStatus = $mtResp['fraud_status'] ?? 'accept';
            $grossAmount = (float)($mtResp['gross_amount'] ?? $storedAmount);

            $settled = in_array($txStatus, ['settlement', 'capture']) && $fraudStatus !== 'deny';

            if ($settled) {
                // Cek idempotency — jangan double payment
                $chk = $db->prepare("SELECT status FROM midtrans_orders WHERE order_id=?");
                $chk->execute([$orderId]);
                $existing = $chk->fetch();
                if ($existing && $existing['status'] === 'settled') {
                    $invStmt = $db->prepare("SELECT status FROM invoices WHERE id=?");
                    $invStmt->execute([$invoiceId]);
                    $inv = $invStmt->fetch();
                    respond(['message' => 'Sudah diproses sebelumnya', 'synced' => true, 'invoice_status' => $inv['status'] ?? 'paid']);
                    return;
                }

                // Update invoice
                $invStmt = $db->prepare("SELECT total_amount, amount_paid FROM invoices WHERE id=?");
                $invStmt->execute([$invoiceId]);
                $inv = $invStmt->fetch();

                $newPaid   = (float)$inv['amount_paid'] + $grossAmount;
                $newStatus = $newPaid >= (float)$inv['total_amount'] ? 'paid' : 'partial';

                $db->prepare("UPDATE invoices SET amount_paid=?, status=?, updated_at=NOW() WHERE id=?")
                   ->execute([$newPaid, $newStatus, $invoiceId]);

                $db->prepare("INSERT INTO invoice_payments(id,invoice_id,amount,payment_method,payment_date,notes,recorded_by) VALUES(?,?,?,'midtrans',NOW(),?,NULL)")
                   ->execute([generateUUID(), $invoiceId, $grossAmount, 'Midtrans - ' . $orderId]);

                $db->prepare("UPDATE midtrans_orders SET status='settled' WHERE order_id=?")
                   ->execute([$orderId]);

                respond(['message' => '✅ Pembayaran dikonfirmasi!', 'synced' => true, 'invoice_status' => $newStatus]);
                return;
            }

            if ($txStatus === 'pending') {
                respond(['message' => '⏳ Pembayaran masih pending', 'synced' => false, 'invoice_status' => 'unpaid', 'transaction_status' => $txStatus]);
                return;
            }

            if (in_array($txStatus, ['cancel', 'expire', 'deny'])) {
                $db->prepare("UPDATE midtrans_orders SET status=? WHERE order_id=?")->execute([$txStatus, $orderId]);
                respond(['message' => 'Transaksi ' . $txStatus, 'synced' => false, 'invoice_status' => 'unpaid', 'transaction_status' => $txStatus]);
                return;
            }

            respond(['message' => 'Status: ' . $txStatus, 'synced' => false, 'invoice_status' => 'unpaid', 'transaction_status' => $txStatus]);
            return;
        }


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

// ── MIDTRANS WEBHOOK HANDLER (public, no auth) ────────────────
function handleMidtransWebhook(): void {
    $db         = getDB();
    $serverKey  = getenv('MIDTRANS_SERVER_KEY') ?: '';
    $body       = json_decode(file_get_contents('php://input'), true);

    if (!$body || !isset($body['order_id'])) {
        http_response_code(400); echo json_encode(['error'=>'Invalid payload']); return;
    }

    // Verifikasi signature
    $signKey = hash('sha512', $body['order_id'] . $body['status_code'] . $body['gross_amount'] . $serverKey);
    if ($signKey !== ($body['signature_key'] ?? '')) {
        http_response_code(403); echo json_encode(['error'=>'Invalid signature']); return;
    }

    $orderId = $body['order_id'];
    $txStatus = $body['transaction_status'];
    $fraudStatus = $body['fraud_status'] ?? 'accept';

    // Cari invoice_id dari order_id
    $stmt = $db->prepare("SELECT invoice_id, amount FROM midtrans_orders WHERE order_id=?");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) { http_response_code(200); echo json_encode(['ok'=>true]); return; }

    $invoiceId = $order['invoice_id'];
    $amount    = $order['amount'];

    $settled = in_array($txStatus, ['capture', 'settlement']) && $fraudStatus !== 'deny';

    if ($settled) {
        // Ambil invoice saat ini
        $invStmt = $db->prepare("SELECT total_amount, amount_paid FROM invoices WHERE id=?");
        $invStmt->execute([$invoiceId]);
        $inv = $invStmt->fetch();
        if (!$inv) { http_response_code(200); echo json_encode(['ok'=>true]); return; }

        $newPaid = (float)$inv['amount_paid'] + (float)$amount;
        $newStatus = $newPaid >= (float)$inv['total_amount'] ? 'paid' : 'partial';

        $db->prepare("UPDATE invoices SET amount_paid=?, status=?, updated_at=NOW() WHERE id=?")
           ->execute([$newPaid, $newStatus, $invoiceId]);

        $db->prepare("INSERT INTO invoice_payments(id,invoice_id,amount,payment_method,payment_date,notes,recorded_by)
            VALUES(?,?,?,'midtrans',NOW(),?,NULL)")
           ->execute([generateUUID(), $invoiceId, $amount, 'Midtrans - Order ID: ' . $orderId]);

        $db->prepare("UPDATE midtrans_orders SET status='settled' WHERE order_id=?")->execute([$orderId]);
    } elseif (in_array($txStatus, ['cancel', 'expire', 'deny'])) {
        $db->prepare("UPDATE midtrans_orders SET status=? WHERE order_id=?")->execute([$txStatus, $orderId]);
    }

    http_response_code(200);
    echo json_encode(['ok' => true]);
}
