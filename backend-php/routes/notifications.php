<?php
// ============================================================
// Notifications: /api/notifications, /api/alerts/low-stock
// ============================================================

function handleNotifications(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    if ($method === 'GET' && $uri === '/notifications') {
        $stmt = $db->prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$user['sub']]);
        respondList($stmt->fetchAll());
        return;
    }

    if ($method === 'PUT' && preg_match('#^/notifications/([^/]+)/read$#', $uri, $m)) {
        $db->prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?")->execute([$m[1],$user['sub']]);
        respond(['message'=>'Marked as read']);
        return;
    }

    if ($method === 'GET' && $uri === '/alerts/low-stock') {
        $stmt = $db->query("
            SELECT i.id, i.sku, i.name, i.min_stock,
                   COALESCE(SUM(s.current_stock),0) AS current_stock,
                   u.abbreviation AS unit, c.name AS category
            FROM items i
            LEFT JOIN item_stocks s ON s.item_id=i.id
            LEFT JOIN units u ON u.id=i.unit_id
            LEFT JOIN categories c ON c.id=i.category_id
            WHERE i.is_active=1 AND i.min_stock > 0
            GROUP BY i.id
            HAVING current_stock <= i.min_stock
            ORDER BY current_stock ASC
        ");
        respondList($stmt->fetchAll());
        return;
    }

    respondError('Notifications route not found', 404);
}
