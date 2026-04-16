<?php
// ============================================================
// User Routes: /api/users, /api/users/me, etc.
// ============================================================

function handleUsers(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // GET /users/me
    if ($method === 'GET' && $uri === '/users/me') {
        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.is_active,
                   u.last_login_at, u.created_at,
                   d.name AS department_name
            FROM users u
            LEFT JOIN departments d ON d.id = u.department_id
            WHERE u.id = ?
        ");
        $stmt->execute([$user['sub']]);
        $me = $stmt->fetch();
        if (!$me) respondError('User not found', 404);

        // warehouses
        $ws = $db->prepare("
            SELECT w.id, w.name, w.code, uw.is_primary
            FROM user_warehouses uw JOIN warehouses w ON w.id = uw.warehouse_id
            WHERE uw.user_id = ?
        ");
        $ws->execute([$user['sub']]);
        $me['warehouses'] = $ws->fetchAll();

        respond($me);
        return;
    }

    // PUT /users/me — Update profile
    if ($method === 'PUT' && $uri === '/users/me') {
        $body = requireBody();
        $db->prepare("UPDATE users SET name=?, phone=?, updated_at=NOW() WHERE id=?")
           ->execute([$body['name'] ?? null, $body['phone'] ?? null, $user['sub']]);
        respond(['message' => 'Profile updated']);
        return;
    }

    // PUT /users/me/password
    if ($method === 'PUT' && $uri === '/users/me/password') {
        $body = requireBody();
        requireFields($body, ['old_password', 'new_password']);

        $stmt = $db->prepare("SELECT password_hash FROM users WHERE id=?");
        $stmt->execute([$user['sub']]);
        $u = $stmt->fetch();

        if (!password_verify($body['old_password'], $u['password_hash'])) {
            respondError('Current password is incorrect', 400);
        }
        if (strlen($body['new_password']) < 8) {
            respondError('New password must be at least 8 characters', 400);
        }

        $hash = password_hash($body['new_password'], PASSWORD_BCRYPT);
        $db->prepare("UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?")
           ->execute([$hash, $user['sub']]);
        respond(['message' => 'Password changed successfully']);
        return;
    }

    // Admin only routes below
    requireRole($user, 'admin');

    // GET /users
    if ($method === 'GET' && $uri === '/users') {
        [$limit, $offset] = paginate();
        $search = $_GET['search'] ?? '';
        $role   = $_GET['role'] ?? '';

        $where = 'WHERE 1=1';
        $bind  = [];
        if ($search) { $where .= ' AND (u.name LIKE ? OR u.email LIKE ?)'; $bind[] = "%$search%"; $bind[] = "%$search%"; }
        if ($role)   { $where .= ' AND u.role = ?'; $bind[] = $role; }

        $total = $db->prepare("SELECT COUNT(*) FROM users u $where");
        $total->execute($bind);
        $count = (int)$total->fetchColumn();

        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active,
                   u.last_login_at, u.created_at, d.name AS department_name
            FROM users u LEFT JOIN departments d ON d.id = u.department_id
            $where ORDER BY u.created_at DESC LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($bind);
        respondList($stmt->fetchAll(), $count);
        return;
    }

    // POST /users
    if ($method === 'POST' && $uri === '/users') {
        $body = requireBody();
        requireFields($body, ['name', 'email', 'password', 'role']);

        $check = $db->prepare("SELECT id FROM users WHERE email=?");
        $check->execute([strtolower($body['email'])]);
        if ($check->fetch()) respondError('Email already exists', 409);

        $id   = generateUUID();
        $hash = password_hash($body['password'], PASSWORD_BCRYPT);
        $db->prepare("INSERT INTO users (id, name, email, password_hash, role, department_id, phone)
                      VALUES (?, ?, ?, ?, ?, ?, ?)")
           ->execute([$id, $body['name'], strtolower($body['email']), $hash, $body['role'],
                      $body['department_id'] ?? null, $body['phone'] ?? null]);
        respond(['id' => $id, 'message' => 'User created']);
        return;
    }

    // PUT /users/:id
    if ($method === 'PUT' && preg_match('#^/users/([^/]+)$#', $uri, $m)) {
        $body = requireBody();
        $db->prepare("UPDATE users SET name=?, role=?, department_id=?, phone=?, is_active=?, updated_at=NOW() WHERE id=?")
           ->execute([$body['name'], $body['role'], $body['department_id'] ?? null,
                      $body['phone'] ?? null, $body['is_active'] ?? 1, $m[1]]);
        respond(['message' => 'User updated']);
        return;
    }

    // DELETE /users/:id
    if ($method === 'DELETE' && preg_match('#^/users/([^/]+)$#', $uri, $m)) {
        if ($m[1] === $user['sub']) respondError('Cannot delete yourself', 400);
        $db->prepare("DELETE FROM users WHERE id=?")->execute([$m[1]]);
        respond(['message' => 'User deleted']);
        return;
    }

    respondError('User route not found', 404);
}
