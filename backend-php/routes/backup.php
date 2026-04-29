<?php
// ============================================================
// Backup Routes — Export All Data as CSV ZIP (Admin Only)
// ============================================================

function handleBackup($method, $uri, $user) {
    requireRole($user, ['admin']);
    $db = getDB();

    // GET /backup/csv — Download ZIP of all tables
    if ($method === 'GET' && $uri === '/backup/csv') {
        $tables = [
            'items'                 => "SELECT i.id, i.sku, i.name, c.name AS category, u.name AS unit, u.abbreviation AS unit_abbr, i.current_stock, i.min_stock, i.price, i.description, i.is_active, i.created_at FROM items i LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN units u ON u.id=i.unit_id ORDER BY i.name",
            'inbound_transactions'  => "SELECT t.id, t.ref_number, t.received_date, t.status, t.notes, s.name AS supplier, w.name AS warehouse, u.name AS received_by, t.created_at FROM inbound_transactions t LEFT JOIN suppliers s ON s.id=t.supplier_id LEFT JOIN warehouses w ON w.id=t.warehouse_id LEFT JOIN users u ON u.id=t.received_by ORDER BY t.created_at DESC",
            'outbound_transactions' => "SELECT t.id, t.ref_number, t.outbound_date, t.status, t.destination, t.notes, w.name AS warehouse, u.name AS issued_by, t.created_at FROM outbound_transactions t LEFT JOIN warehouses w ON w.id=t.warehouse_id LEFT JOIN users u ON u.id=t.issued_by ORDER BY t.created_at DESC",
            'purchase_orders'       => "SELECT po.id, po.po_number, po.status, po.order_date, po.expected_date, po.total_amount, po.payment_terms, po.notes, s.name AS supplier, w.name AS warehouse, u.name AS created_by, po.created_at FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id LEFT JOIN warehouses w ON w.id=po.warehouse_id LEFT JOIN users u ON u.id=po.created_by ORDER BY po.created_at DESC",
            'invoices'              => "SELECT inv.id, inv.invoice_number, inv.status, inv.invoice_date, inv.due_date, inv.total_amount, inv.paid_amount, inv.notes, s.name AS supplier, po.po_number, u.name AS created_by, inv.created_at FROM invoices inv LEFT JOIN suppliers s ON s.id=inv.supplier_id LEFT JOIN purchase_orders po ON po.id=inv.po_id LEFT JOIN users u ON u.id=inv.created_by ORDER BY inv.created_at DESC",
            'suppliers'             => "SELECT id, code, name, contact, phone, email, address, city, payment_terms, is_pkp, npwp, bank_account, created_at FROM suppliers ORDER BY name",
            'warehouses'            => "SELECT id, code, name, address, city, phone, pic_name, pic_phone, is_active, created_at FROM warehouses ORDER BY name",
            'stock_opnames'         => "SELECT o.id, o.ref_number, o.opname_date, o.status, o.notes, w.name AS warehouse, u.name AS created_by, o.created_at FROM stock_opnames o LEFT JOIN warehouses w ON w.id=o.warehouse_id LEFT JOIN users u ON u.id=o.created_by ORDER BY o.created_at DESC",
            'stock_transfers'       => "SELECT t.id, t.ref_number, t.transfer_date, t.status, t.notes, wf.name AS from_warehouse, wt.name AS to_warehouse, u.name AS created_by, t.created_at FROM stock_transfers t LEFT JOIN warehouses wf ON wf.id=t.from_warehouse_id LEFT JOIN warehouses wt ON wt.id=t.to_warehouse_id LEFT JOIN users u ON u.id=t.created_by ORDER BY t.created_at DESC",
            'delivery_orders'       => "SELECT d.id, d.ref_number, d.delivery_date, d.destination, d.status, d.notes, w.name AS warehouse, u.name AS created_by, d.created_at FROM delivery_orders d LEFT JOIN warehouses w ON w.id=d.warehouse_id LEFT JOIN users u ON u.id=d.created_by ORDER BY d.created_at DESC",
            'returns'               => "SELECT r.id, r.ref_number, r.type, r.return_date, r.reason, r.status, s.name AS supplier, w.name AS warehouse, u.name AS created_by, r.created_at FROM returns r LEFT JOIN suppliers s ON s.id=r.supplier_id LEFT JOIN warehouses w ON w.id=r.warehouse_id LEFT JOIN users u ON u.id=r.created_by ORDER BY r.created_at DESC",
            'requests'              => "SELECT r.id, r.ref_number, r.status, r.purpose, r.priority, r.required_date, r.notes, d.name AS department, u.name AS requested_by, a.name AS approved_by, r.approval_notes, r.created_at FROM requests r LEFT JOIN departments d ON d.id=r.department_id LEFT JOIN users u ON u.id=r.requested_by LEFT JOIN users a ON a.id=r.approved_by ORDER BY r.created_at DESC",
            'budgets'               => "SELECT * FROM budgets ORDER BY created_at DESC",
            'item_stocks'           => "SELECT s.id, i.sku, i.name AS item_name, w.name AS warehouse, s.current_stock, s.last_updated FROM item_stocks s LEFT JOIN items i ON i.id=s.item_id LEFT JOIN warehouses w ON w.id=s.warehouse_id ORDER BY i.name",
            'users'                 => "SELECT id, name, email, role, phone, department, position, is_active, created_at FROM users ORDER BY name",
            'categories'            => "SELECT id, name, description, created_at FROM categories ORDER BY name",
            'units'                 => "SELECT id, name, abbreviation, created_at FROM units ORDER BY name",
            'departments'           => "SELECT id, name, code, created_at FROM departments ORDER BY name",
        ];

        $tmpFile = tempnam(sys_get_temp_dir(), 'wms_backup_');
        $zip = new ZipArchive();
        $zip->open($tmpFile, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach ($tables as $name => $sql) {
            try {
                $stmt = $db->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if (empty($rows)) {
                    $csv = "Tidak ada data\n";
                } else {
                    // Header
                    $csv = implode(',', array_keys($rows[0])) . "\n";
                    // Rows
                    foreach ($rows as $row) {
                        $csv .= implode(',', array_map(function($v) {
                            $v = str_replace(['"', "\n", "\r"], ['""', ' ', ' '], $v ?? '');
                            return '"' . $v . '"';
                        }, array_values($row))) . "\n";
                    }
                }
                $zip->addFromString($name . '.csv', $csv);
            } catch (Exception $e) {
                $zip->addFromString($name . '_ERROR.txt', 'Error: ' . $e->getMessage());
            }
        }

        // Add metadata
        $meta = "WMS LUTFHI Backup\n";
        $meta .= "Tanggal: " . date('Y-m-d H:i:s') . "\n";
        $meta .= "Exported by: " . $user['name'] . " (" . $user['email'] . ")\n";
        $meta .= "Total tables: " . count($tables) . "\n";
        $zip->addFromString('_INFO.txt', $meta);

        $zip->close();

        // Send ZIP
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="WMS_LUTFHI_Backup_' . date('Y-m-d_His') . '.zip"');
        header('Content-Length: ' . filesize($tmpFile));
        header('Cache-Control: no-cache');
        readfile($tmpFile);
        unlink($tmpFile);
        exit;
    }

    // GET /backup/info — Get backup summary (table counts)
    if ($method === 'GET' && $uri === '/backup/info') {
        $counts = [];
        $tablesToCount = ['items','inbound_transactions','outbound_transactions','purchase_orders','invoices','suppliers','warehouses','stock_opnames','stock_transfers','delivery_orders','returns','requests','budgets','users','categories','units','departments'];

        foreach ($tablesToCount as $t) {
            try {
                $stmt = $db->query("SELECT COUNT(*) as cnt FROM $t");
                $counts[$t] = (int)$stmt->fetch()['cnt'];
            } catch (Exception $e) {
                $counts[$t] = 0;
            }
        }

        respond([
            'tables' => $counts,
            'total_records' => array_sum($counts),
            'server_time' => date('Y-m-d H:i:s'),
        ]);
    }

    respondError('Backup route not found', 404);
}
