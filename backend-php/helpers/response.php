<?php
// ============================================================
// Standard JSON Response helpers
// ============================================================

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respondList(array $rows, int $total = 0, int $code = 200): void {
    http_response_code($code);
    echo json_encode([
        'success' => true,
        'data'    => $rows,
        'total'   => $total ?: count($rows),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respondError(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function respondCreated($data): void {
    respond($data, 201);
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function requireBody(): array {
    $body = getBody();
    if (empty($body)) respondError('Request body required', 400);
    return $body;
}

function requireFields(array $body, array $fields): void {
    foreach ($fields as $field) {
        if (!isset($body[$field]) || $body[$field] === '') {
            respondError("Field '{$field}' is required", 400);
        }
    }
}

function paginate(): array {
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;
    return [$limit, $offset, $page];
}
