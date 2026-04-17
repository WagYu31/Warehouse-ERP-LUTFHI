<?php
// ============================================================
// Dashboard Stats: /api/dashboard/stats
// ============================================================

function handleDashboard(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && strpos($uri, '/dashboard/stats') === 0) {
        $wid = $_GET['warehouse_id'] ?? null;

        // Total items
        $totalItems = $db->query("SELECT COUNT(*) FROM items WHERE is_active=1")->fetchColumn();

        // Total suppliers
        $totalSuppliers = $db->query("SELECT COUNT(*) FROM suppliers WHERE is_active=1")->fetchColumn();

        // Critical/Low stock items
        $lowStockQ = "SELECT COUNT(*) FROM items i
                      JOIN item_stocks s ON s.item_id=i.id
                      WHERE i.is_active=1 AND s.current_stock <= i.min_stock AND i.min_stock > 0";
        if ($wid) { $lowStockQ .= " AND s.warehouse_id='$wid'"; }
        $lowStock = $db->query($lowStockQ)->fetchColumn();

        // Pending inbound
        $pendingInbound = $db->query("SELECT COUNT(*) FROM inbound_transactions WHERE status='pending'")->fetchColumn();

        // Pending requests
        $pendingRequests = $db->query("SELECT COUNT(*) FROM requests WHERE status='pending'")->fetchColumn();

        // Total stock value
        $stockValue = $db->query("SELECT COALESCE(SUM(s.current_stock * i.price),0) FROM item_stocks s JOIN items i ON i.id=s.item_id WHERE i.is_active=1")->fetchColumn();

        // Recent inbound (last 7 days)
        $recentInbound = $db->query("SELECT COUNT(*) FROM inbound_transactions WHERE created_at >= DATE_SUB(NOW(),INTERVAL 7 DAY)")->fetchColumn();

        // Recent outbound (last 7 days)
        $recentOutbound = $db->query("SELECT COUNT(*) FROM outbound_transactions WHERE created_at >= DATE_SUB(NOW(),INTERVAL 7 DAY)")->fetchColumn();

        // Recent transactions list (last 10, inbound + outbound combined)
        $recentTx = $db->query("
            SELECT ref_number AS ref, status, created_at AS date, 'inbound' AS type
            FROM inbound_transactions
            UNION ALL
            SELECT transaction_number AS ref, status, created_at AS date, 'outbound' AS type
            FROM outbound_transactions
            ORDER BY date DESC
            LIMIT 10
        ")->fetchAll();
        $recentTransactions = array_map(function($r) {
            return [
                'ref'    => $r['ref'],
                'status' => $r['status'],
                'date'   => date('d M Y', strtotime($r['date'])),
                'type'   => $r['type'],
            ];
        }, $recentTx);

        // Monthly inbound trend (12 months)
        $trend = $db->query("
            SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
                   COUNT(*) AS count
            FROM inbound_transactions
            WHERE created_at >= DATE_SUB(NOW(),INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(created_at,'%Y-%m')
            ORDER BY month
        ")->fetchAll();

        // Top 5 items by outbound (30 days)
        $topItems = $db->query("
            SELECT i.name, i.sku, SUM(oi.quantity) AS total_out
            FROM outbound_items oi
            JOIN items i ON i.id=oi.item_id
            JOIN outbound_transactions t ON t.id=oi.transaction_id
            WHERE t.created_at >= DATE_SUB(NOW(),INTERVAL 30 DAY)
            GROUP BY i.id
            ORDER BY total_out DESC
            LIMIT 5
        ")->fetchAll();

        // Low stock list
        $lowStockList = $db->query("
            SELECT i.id, i.sku, i.name, i.min_stock,
                   COALESCE(SUM(s.current_stock),0) AS current_stock,
                   u.abbreviation AS unit
            FROM items i
            LEFT JOIN item_stocks s ON s.item_id=i.id
            LEFT JOIN units u ON u.id=i.unit_id
            WHERE i.is_active=1 AND i.min_stock > 0
            GROUP BY i.id
            HAVING current_stock <= i.min_stock
            ORDER BY current_stock ASC
            LIMIT 10
        ")->fetchAll();

        respond([
            'total_items'          => (int)$totalItems,
            'critical_items'       => (int)$lowStock,
            'low_stock'            => (int)$lowStock,
            'total_suppliers'      => (int)$totalSuppliers,
            'pending_inbound'      => (int)$pendingInbound,
            'pending_requests'     => (int)$pendingRequests,
            'stock_value'          => (float)$stockValue,
            'recent_inbound'       => (int)$recentInbound,
            'recent_outbound'      => (int)$recentOutbound,
            'recent_transactions'  => $recentTransactions,
            'trend'                => $trend,
            'top_items'            => $topItems,
            'low_stock_items'      => $lowStockList,
        ]);
        return;
    }

    respondError('Dashboard route not found', 404);
}
