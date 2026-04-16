<?php
// ============================================================
// Reports: /api/reports/*
// ============================================================

function handleReports(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /reports/kartu-stok
    if ($method === 'GET' && $uri === '/reports/kartu-stok') {
        $itemId = $_GET['item_id'] ?? null;
        $wid    = $_GET['warehouse_id'] ?? null;

        if (!$itemId) respondError('item_id required', 400);

        // Get item info
        $item = $db->prepare("SELECT i.*,c.name AS category,u.abbreviation AS unit FROM items i LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN units u ON u.id=i.unit_id WHERE i.id=?");
        $item->execute([$itemId]);
        $itemData = $item->fetch();
        if (!$itemData) respondError('Item not found', 404);

        // Inbound history
        $inQ = "SELECT 'inbound' AS type, t.ref_number, t.received_date AS date,
                       ii.qty_received AS qty, t.status, s.name AS party
                FROM inbound_items ii
                JOIN inbound_transactions t ON t.id=ii.transaction_id
                LEFT JOIN suppliers s ON s.id=t.supplier_id
                WHERE ii.item_id=? AND t.status='confirmed'";
        $inBind = [$itemId];
        if ($wid) { $inQ .= " AND t.warehouse_id=?"; $inBind[] = $wid; }

        $inStmt = $db->prepare($inQ);
        $inStmt->execute($inBind);
        $inbound = $inStmt->fetchAll();

        // Outbound history
        $outQ = "SELECT 'outbound' AS type, t.ref_number, t.outbound_date AS date,
                        oi.qty_issued AS qty, t.status, t.destination AS party
                 FROM outbound_items oi
                 JOIN outbound_transactions t ON t.id=oi.transaction_id
                 WHERE oi.item_id=?";
        $outBind = [$itemId];
        if ($wid) { $outQ .= " AND t.warehouse_id=?"; $outBind[] = $wid; }

        $outStmt = $db->prepare($outQ);
        $outStmt->execute($outBind);
        $outbound = $outStmt->fetchAll();

        // Current stock
        $stockQ = $wid
            ? "SELECT current_stock FROM item_stocks WHERE item_id=? AND warehouse_id=?"
            : "SELECT COALESCE(SUM(current_stock),0) AS current_stock FROM item_stocks WHERE item_id=?";
        $stockBind = $wid ? [$itemId, $wid] : [$itemId];
        $currentStock = $db->prepare($stockQ);
        $currentStock->execute($stockBind);

        respond([
            'item'          => $itemData,
            'current_stock' => $currentStock->fetchColumn(),
            'inbound'       => $inbound,
            'outbound'      => $outbound,
        ]);
        return;
    }

    // GET /reports/stock-valuation
    if ($method === 'GET' && $uri === '/reports/stock-valuation') {
        $stmt = $db->query("
            SELECT i.id, i.sku, i.name, i.price,
                   c.name AS category, u.abbreviation AS unit,
                   COALESCE(SUM(s.current_stock),0) AS total_stock,
                   COALESCE(SUM(s.current_stock),0) * i.price AS total_value
            FROM items i
            LEFT JOIN categories c ON c.id=i.category_id
            LEFT JOIN units u ON u.id=i.unit_id
            LEFT JOIN item_stocks s ON s.item_id=i.id
            WHERE i.is_active=1
            GROUP BY i.id
            ORDER BY total_value DESC
        ");
        $rows = $stmt->fetchAll();
        $grandTotal = array_sum(array_column($rows, 'total_value'));
        respond(['items' => $rows, 'grand_total' => $grandTotal]);
        return;
    }

    // GET /reports/aging-invoice
    if ($method === 'GET' && $uri === '/reports/aging-invoice') {
        requireRole($user, 'admin','finance_procurement','manager');
        $stmt = $db->query("
            SELECT inv.invoice_number, s.name AS supplier_name,
                   inv.invoice_date, inv.due_date,
                   inv.total_amount, inv.amount_paid,
                   (inv.total_amount - inv.amount_paid) AS outstanding,
                   DATEDIFF(NOW(), inv.due_date) AS overdue_days,
                   inv.status
            FROM invoices inv
            LEFT JOIN suppliers s ON s.id=inv.supplier_id
            WHERE inv.status IN ('unpaid','partial','overdue')
            ORDER BY overdue_days DESC
        ");
        respondList($stmt->fetchAll());
        return;
    }

    // GET /reports/budget-realization
    if ($method === 'GET' && $uri === '/reports/budget-realization') {
        requireRole($user, 'admin','finance_procurement','manager');
        $year = $_GET['year'] ?? date('Y');
        $stmt = $db->prepare("
            SELECT b.*, d.name AS department_name,
                   (b.total_budget - b.used_budget) AS remaining,
                   ROUND((b.used_budget / NULLIF(b.total_budget,0)) * 100, 2) AS utilization_pct
            FROM budgets b
            LEFT JOIN departments d ON d.id=b.department_id
            WHERE b.budget_year=?
            ORDER BY utilization_pct DESC
        ");
        $stmt->execute([$year]);
        respondList($stmt->fetchAll());
        return;
    }

    respondError('Report not found', 404);
}
