<?php
// ============================================================
// Auth Routes: POST /api/auth/login, POST /api/auth/refresh
// ============================================================

function handleAuth(string $method, string $uri): void {
    $db = getDB();

    // POST /auth/login
    if ($method === 'POST' && $uri === '/auth/login') {
        $body = requireBody();
        requireFields($body, ['email', 'password']);

        $stmt = $db->prepare("
            SELECT id, name, email, password_hash, role, department_id,
                   phone, avatar_url, is_active
            FROM users
            WHERE email = ? LIMIT 1
        ");
        $stmt->execute([strtolower(trim($body['email']))]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($body['password'], $user['password_hash'])) {
            respondError('Invalid email or password', 401);
        }

        if (!$user['is_active']) {
            respondError('Account is deactivated', 403);
        }

        // Update last login
        $db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?")
           ->execute([$user['id']]);

        // Get warehouses
        $wStmt = $db->prepare("
            SELECT w.id, w.name, w.code, uw.is_primary
            FROM user_warehouses uw
            JOIN warehouses w ON w.id = uw.warehouse_id
            WHERE uw.user_id = ?
        ");
        $wStmt->execute([$user['id']]);
        $warehouses = $wStmt->fetchAll();

        $token = jwtSign([
            'sub'   => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'name'  => $user['name'],
        ]);

        unset($user['password_hash']);
        $user['warehouses'] = $warehouses;

        respond([
            'token' => $token,
            'user'  => $user,
        ]);
        return;
    }

    // POST /auth/refresh
    if ($method === 'POST' && $uri === '/auth/refresh') {
        $currentUser = requireAuth();
        $stmt = $db->prepare("SELECT id, name, email, role, is_active FROM users WHERE id = ?");
        $stmt->execute([$currentUser['sub']]);
        $user = $stmt->fetch();

        if (!$user || !$user['is_active']) {
            respondError('User not found or deactivated', 401);
        }

        $token = jwtSign([
            'sub'   => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'name'  => $user['name'],
        ]);

        respond(['token' => $token]);
        return;
    }

    respondError('Auth route not found', 404);
}
