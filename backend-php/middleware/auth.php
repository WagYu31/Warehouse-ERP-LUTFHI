<?php
// ============================================================
// Auth Middleware
// ============================================================

function requireAuth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$header && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if (strpos($header, 'Bearer ') !== 0) {
        respondError('Authorization token required', 401);
    }

    $token = substr($header, 7);
    $payload = jwtVerify($token);

    if (!$payload) {
        respondError('Invalid or expired token', 401);
    }

    return $payload;
}

function requireRole(array $user, string ...$roles): void {
    if (!in_array($user['role'] ?? '', $roles, true)) {
        respondError('Access denied: insufficient permissions', 403);
    }
}

function hasRole(array $user, string ...$roles): bool {
    return in_array($user['role'] ?? '', $roles, true);
}
