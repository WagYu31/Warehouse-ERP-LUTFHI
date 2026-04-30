<?php
// ============================================================
// Backup Routes — Export All Data as CSV ZIP (Admin Only)
// Fixed queries to match actual database schema
// ============================================================

function handleBackup($method, $uri, $user) {
    requireRole($user, ['admin']);
    $db = getDB();

    // GET /backup/csv — Download ZIP of all tables
    if ($method === 'GET' && $uri === '/backup/csv') {
        $tables = [
            'items' => "SELECT i.id, i.sku, i.name, c.name AS category, u.name AS unit, u.abbreviation AS unit_abbr, i.min_stock, i.max_stock, i.price, i.description, i.is_active, i.created_at FROM items i LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN units u ON u.id=i.unit_id ORDER BY i.name",

            'item_stocks' => "SELECT s.id, i.sku, i.name AS item_name, w.name AS warehouse, s.current_stock, s.last_updated FROM item_stocks s LEFT JOIN items i ON i.id=s.item_id LEFT JOIN warehouses w ON w.id=s.warehouse_id ORDER BY i.name",

            'inbound_transactions' => "SELECT t.id, t.ref_number, t.received_date, t.status, t.notes, s.name AS supplier, w.name AS warehouse, u.name AS received_by, t.created_at FROM inbound_transactions t LEFT JOIN suppliers s ON s.id=t.supplier_id LEFT JOIN warehouses w ON w.id=t.warehouse_id LEFT JOIN users u ON u.id=t.received_by ORDER BY t.created_at DESC",

            'outbound_transactions' => "SELECT t.id, t.ref_number, t.outbound_date, t.status, t.notes, w.name AS warehouse, u.name AS processed_by, t.created_at FROM outbound_transactions t LEFT JOIN warehouses w ON w.id=t.warehouse_id LEFT JOIN users u ON u.id=t.processed_by ORDER BY t.created_at DESC",

            'purchase_orders' => "SELECT po.id, po.po_number, po.status, po.expected_date, po.subtotal, po.discount_amount, po.tax_rate, po.tax_amount, po.total_amount, po.notes, s.name AS supplier, w.name AS warehouse, u.name AS created_by, po.created_at FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id LEFT JOIN warehouses w ON w.id=po.warehouse_id LEFT JOIN users u ON u.id=po.created_by ORDER BY po.created_at DESC",

            'invoices' => "SELECT inv.id, inv.invoice_number, inv.status, inv.invoice_date, inv.due_date, inv.total_amount, inv.paid_amount, inv.notes, s.name AS supplier, po.po_number, u.name AS created_by, inv.created_at FROM invoices inv LEFT JOIN suppliers s ON s.id=inv.supplier_id LEFT JOIN purchase_orders po ON po.id=inv.po_id LEFT JOIN users u ON u.id=inv.created_by ORDER BY inv.created_at DESC",

            'suppliers' => "SELECT id, code, name, email, phone, address, city, npwp, is_pkp, payment_terms, rating, is_active, is_blacklisted, notes, created_at FROM suppliers ORDER BY name",

            'warehouses' => "SELECT id, code, name, address, city, pic_name, pic_phone, is_active, created_at FROM warehouses ORDER BY name",

            'stock_opnames' => "SELECT o.id, o.ref_number, o.status, o.notes, w.name AS warehouse, u.name AS conducted_by, o.start_date, o.end_date, o.created_at FROM stock_opnames o LEFT JOIN warehouses w ON w.id=o.warehouse_id LEFT JOIN users u ON u.id=o.conducted_by ORDER BY o.created_at DESC",

            'stock_transfers' => "SELECT t.id, t.ref_number, t.status, t.notes, wf.name AS from_warehouse, wt.name AS to_warehouse, u.name AS created_by, t.created_at FROM stock_transfers t LEFT JOIN warehouses wf ON wf.id=t.from_warehouse_id LEFT JOIN warehouses wt ON wt.id=t.to_warehouse_id LEFT JOIN users u ON u.id=t.created_by ORDER BY t.created_at DESC",

            'delivery_orders' => "SELECT d.id, d.do_number, d.status, d.driver_name, d.vehicle_plate, d.recipient_name, d.recipient_address, d.recipient_phone, d.notes, w.name AS warehouse, u.name AS created_by, d.delivered_at, d.created_at FROM delivery_orders d LEFT JOIN warehouses w ON w.id=d.warehouse_id LEFT JOIN users u ON u.id=d.created_by ORDER BY d.created_at DESC",

            'returns' => "SELECT r.id, r.return_number, r.type, r.status, r.reason, r.notes, w.name AS warehouse, u.name AS created_by, rv.name AS reviewed_by, r.reviewed_at, r.created_at FROM returns r LEFT JOIN warehouses w ON w.id=r.warehouse_id LEFT JOIN users u ON u.id=r.created_by LEFT JOIN users rv ON rv.id=r.reviewed_by ORDER BY r.created_at DESC",

            'requests' => "SELECT r.id, r.spb_number, r.status, r.purpose, r.priority, r.needed_date, r.notes, d.name AS department, w.name AS warehouse, u.name AS requester, rv.name AS reviewed_by, r.review_notes, r.reviewed_at, r.created_at FROM requests r LEFT JOIN departments d ON d.id=r.department_id LEFT JOIN warehouses w ON w.id=r.warehouse_id LEFT JOIN users u ON u.id=r.requester_id LEFT JOIN users rv ON rv.id=r.reviewed_by ORDER BY r.created_at DESC",

            'budgets' => "SELECT id, name, period_type, period_start, period_end, total_amount, spent_amount, notes, created_at FROM budgets ORDER BY created_at DESC",

            'users' => "SELECT u.id, u.name, u.email, u.role, u.phone, d.name AS department, u.is_active, u.last_login_at, u.created_at FROM users u LEFT JOIN departments d ON d.id=u.department_id ORDER BY u.name",

            'categories' => "SELECT id, name, description, created_at FROM categories ORDER BY name",

            'units' => "SELECT id, name, abbreviation, created_at FROM units ORDER BY name",

            'departments' => "SELECT id, name, head_name, created_at FROM departments ORDER BY name",
        ];

        $tmpFile = tempnam(sys_get_temp_dir(), 'wms_backup_');
        $zip = new ZipArchive();
        $zip->open($tmpFile, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        $successCount = 0;
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
                $successCount++;
            } catch (Exception $e) {
                $zip->addFromString($name . '_ERROR.txt', 'Error: ' . $e->getMessage());
            }
        }

        // Add metadata
        $meta = "WMS LUTFHI Backup\n";
        $meta .= "Tanggal: " . date('Y-m-d H:i:s') . "\n";
        $meta .= "Exported by: " . $user['name'] . " (" . $user['email'] . ")\n";
        $meta .= "Total tables: " . $successCount . "/" . count($tables) . "\n";
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
        $tablesToCount = ['items','item_stocks','inbound_transactions','outbound_transactions','purchase_orders','invoices','suppliers','warehouses','stock_opnames','stock_transfers','delivery_orders','returns','requests','budgets','users','categories','units','departments'];

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
            'total_tables' => count(array_filter($counts, fn($c) => $c > 0)),
            'total_records' => array_sum($counts),
            'server_time' => date('Y-m-d H:i:s'),
        ]);
    }

    respondError('Backup route not found', 404);
}
