<?php
// ============================================================
// WMS LUTFHI — PHP Backend v1.0
// Main Router — All requests come here
// ============================================================

define('BASE_PATH', __DIR__);
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'WmsLutfhi2026_SecretKey_SangatAmanDanPanjangMin32Char');
define('APP_VERSION', '3.0.0');

// Disable error display in production, log instead
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Set JSON content type
header('Content-Type: application/json; charset=utf-8');

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Load helpers
require_once BASE_PATH . '/config/database.php';
require_once BASE_PATH . '/helpers/jwt.php';
require_once BASE_PATH . '/helpers/response.php';
require_once BASE_PATH . '/middleware/auth.php';

// Get request method and URI
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip base path prefix (e.g., /api)
$basePath = '/api';
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}
$uri = rtrim($uri, '/') ?: '/';

// Route matching helper
function matchRoute(string $pattern, string $uri, array &$params = []): bool {
    $regex = preg_replace('/\/:([a-zA-Z_]+)/', '/(?P<$1>[^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    if (preg_match($regex, $uri, $matches)) {
        foreach ($matches as $key => $value) {
            if (!is_int($key)) $params[$key] = $value;
        }
        return true;
    }
    return false;
}

// ── Route Dispatch ────────────────────────────────────────────
$params = [];

try {
    // Health check
    if ($method === 'GET' && $uri === '/health') {
        respond(['status' => 'ok', 'version' => APP_VERSION, 'service' => 'WMS LUTFHI PHP']);
        exit;
    }

    // ── Auth Routes (public) ──────────────────────────────────
    if (strpos($uri, '/auth') === 0) {
        require_once BASE_PATH . '/routes/auth.php';
        handleAuth($method, $uri);
        exit;
    }

    // ── All other routes require authentication ───────────────
    $user = requireAuth();

    // Users
    if (strpos($uri, '/users') === 0) {
        require_once BASE_PATH . '/routes/users.php';
        handleUsers($method, $uri, $user, $params);
        exit;
    }

    // Master Data
    if (strpos($uri, '/departments') === 0 ||
        strpos($uri, '/warehouses') === 0 ||
        strpos($uri, '/locations') === 0 ||
        strpos($uri, '/categories') === 0 ||
        strpos($uri, '/units') === 0 ||
        strpos($uri, '/suppliers') === 0) {
        require_once BASE_PATH . '/routes/master.php';
        handleMaster($method, $uri, $user, $params);
        exit;
    }

    // Items
    if (strpos($uri, '/items') === 0) {
        require_once BASE_PATH . '/routes/items.php';
        handleItems($method, $uri, $user, $params);
        exit;
    }

    // Inbound
    if (strpos($uri, '/inbound') === 0) {
        require_once BASE_PATH . '/routes/inbound.php';
        handleInbound($method, $uri, $user, $params);
        exit;
    }

    // Outbound
    if (strpos($uri, '/outbound') === 0) {
        require_once BASE_PATH . '/routes/outbound.php';
        handleOutbound($method, $uri, $user, $params);
        exit;
    }

    // Delivery Orders
    if (strpos($uri, '/delivery-orders') === 0) {
        require_once BASE_PATH . '/routes/delivery.php';
        handleDelivery($method, $uri, $user, $params);
        exit;
    }

    // Requests (SPB)
    if (strpos($uri, '/requests') === 0) {
        require_once BASE_PATH . '/routes/requests.php';
        handleRequests($method, $uri, $user, $params);
        exit;
    }

    // Stock Opname
    if (strpos($uri, '/opname') === 0) {
        require_once BASE_PATH . '/routes/opname.php';
        handleOpname($method, $uri, $user, $params);
        exit;
    }

    // Stock Transfers
    if (strpos($uri, '/stock-transfers') === 0) {
        require_once BASE_PATH . '/routes/stock_transfers.php';
        handleStockTransfers($method, $uri, $user, $params);
        exit;
    }

    // Returns
    if (strpos($uri, '/returns') === 0) {
        require_once BASE_PATH . '/routes/returns.php';
        handleReturns($method, $uri, $user, $params);
        exit;
    }

    // Notifications
    if (strpos($uri, '/notifications') === 0 || strpos($uri, '/alerts') === 0) {
        require_once BASE_PATH . '/routes/notifications.php';
        handleNotifications($method, $uri, $user, $params);
        exit;
    }

    // Dashboard
    if (strpos($uri, '/dashboard') === 0) {
        require_once BASE_PATH . '/routes/dashboard.php';
        handleDashboard($method, $uri, $user, $params);
        exit;
    }

    // Reports
    if (strpos($uri, '/reports') === 0) {
        require_once BASE_PATH . '/routes/reports.php';
        handleReports($method, $uri, $user, $params);
        exit;
    }

    // Item Stocks
    if (strpos($uri, '/item-stocks') === 0) {
        require_once BASE_PATH . '/routes/item_stocks.php';
        handleItemStocks($method, $uri, $user, $params);
        exit;
    }

    // Reorder Configs
    if (strpos($uri, '/reorder-configs') === 0) {
        require_once BASE_PATH . '/routes/reorder_configs.php';
        handleReorderConfigs($method, $uri, $user, $params);
        exit;
    }

    // ERP (Purchase Orders, Invoices, Budgets)
    if (strpos($uri, '/erp') === 0) {
        require_once BASE_PATH . '/routes/erp.php';
        handleERP($method, $uri, $user, $params);
        exit;
    }

    // 404
    respondError('Route not found: ' . $method . ' ' . $uri, 404);

} catch (Exception $e) {
    respondError('Server error: ' . $e->getMessage(), 500);
}
