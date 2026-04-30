<?php
// ============================================================
// Master Data Routes: warehouses, departments, categories, units,
//                     suppliers, locations
// ============================================================

function handleMaster(string $method, string $uri, array $user, array &$params): void {
    $db = getDB();

    // ── DEPARTMENTS ──────────────────────────────────────────
    if (strpos($uri, '/departments') === 0) {
        if ($method === 'GET' && $uri === '/departments') {
            $stmt = $db->query("SELECT id,name,head_name,created_at FROM departments ORDER BY name");
            respondList($stmt->fetchAll());
        } elseif ($method === 'POST' && $uri === '/departments') {
            requireRole($user, 'admin');
            $b = requireBody(); requireFields($b, ['name']);
            $id = generateUUID();
            $db->prepare("INSERT INTO departments(id,name,head_name) VALUES(?,?,?)")
               ->execute([$id, $b['name'], $b['head_name']??null]);
            respond(['id'=>$id]);
        } elseif ($method === 'PUT' && preg_match('#^/departments/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $b = requireBody();
            $db->prepare("UPDATE departments SET name=?,head_name=? WHERE id=?")
               ->execute([$b['name'],$b['head_name']??null,$m[1]]);
            respond(['message'=>'Updated']);
        } elseif ($method === 'DELETE' && preg_match('#^/departments/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $db->prepare("DELETE FROM departments WHERE id=?")->execute([$m[1]]);
            respond(['message'=>'Deleted']);
        }
        return;
    }

    // ── WAREHOUSES ───────────────────────────────────────────
    if (strpos($uri, '/warehouses') === 0) {
        if ($method === 'GET' && $uri === '/warehouses') {
            $stmt = $db->query("SELECT id,code,name,address,city,pic_name,pic_phone,is_active,created_at FROM warehouses ORDER BY name");
            respondList($stmt->fetchAll());
        } elseif ($method === 'POST' && $uri === '/warehouses') {
            requireRole($user, 'admin');
            $b = requireBody(); requireFields($b, ['code','name']);
            $id = generateUUID();
            $db->prepare("INSERT INTO warehouses(id,code,name,address,city,pic_name,pic_phone) VALUES(?,?,?,?,?,?,?)")
               ->execute([$id,$b['code'],$b['name'],$b['address']??null,$b['city']??null,$b['pic_name']??null,$b['pic_phone']??null]);
            respond(['id'=>$id]);
        } elseif ($method === 'PUT' && preg_match('#^/warehouses/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $b = requireBody();
            $db->prepare("UPDATE warehouses SET code=?,name=?,address=?,city=?,pic_name=?,pic_phone=?,is_active=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['code'],$b['name'],$b['address']??null,$b['city']??null,$b['pic_name']??null,$b['pic_phone']??null,$b['is_active']??1,$m[1]]);
            respond(['message'=>'Updated']);
        } elseif ($method === 'DELETE' && preg_match('#^/warehouses/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $db->prepare("DELETE FROM warehouses WHERE id=?")->execute([$m[1]]);
            respond(['message'=>'Deleted']);
        }
        return;
    }

    // ── LOCATIONS ────────────────────────────────────────────
    if (strpos($uri, '/locations') === 0) {
        if ($method === 'GET' && $uri === '/locations') {
            $wid = $_GET['warehouse_id'] ?? null;
            if ($wid) {
                $stmt = $db->prepare("SELECT l.*,w.name as warehouse_name FROM locations l JOIN warehouses w ON w.id=l.warehouse_id WHERE l.warehouse_id=? ORDER BY l.zone,l.rack,l.bin");
                $stmt->execute([$wid]);
            } else {
                $stmt = $db->query("SELECT l.*,w.name as warehouse_name FROM locations l JOIN warehouses w ON w.id=l.warehouse_id ORDER BY w.name,l.zone,l.rack,l.bin");
            }
            respondList($stmt->fetchAll());
        } elseif ($method === 'POST' && $uri === '/locations') {
            requireRole($user, 'admin','staff');
            $b = requireBody(); requireFields($b, ['warehouse_id']);
            $id = generateUUID();
            $db->prepare("INSERT INTO locations(id,warehouse_id,zone,rack,bin,description) VALUES(?,?,?,?,?,?)")
               ->execute([$id,$b['warehouse_id'],$b['zone']??null,$b['rack']??null,$b['bin']??null,$b['description']??null]);
            respond(['id'=>$id]);
        } elseif ($method === 'PUT' && preg_match('#^/locations/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $b = requireBody();
            $db->prepare("UPDATE locations SET zone=?,rack=?,bin=?,description=? WHERE id=?")
               ->execute([$b['zone']??null,$b['rack']??null,$b['bin']??null,$b['description']??null,$m[1]]);
            respond(['message'=>'Updated']);
        } elseif ($method === 'DELETE' && preg_match('#^/locations/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $db->prepare("DELETE FROM locations WHERE id=?")->execute([$m[1]]);
            respond(['message'=>'Deleted']);
        }
        return;
    }

    // ══════════════════════════════════════════════════════════
    //  CATEGORIES — Production-grade with soft delete & search
    // ══════════════════════════════════════════════════════════
    if (strpos($uri, '/categories') === 0) {
        // GET /categories — list with optional search & is_active filter
        if ($method === 'GET' && $uri === '/categories') {
            $search = $_GET['search'] ?? '';
            $active = $_GET['is_active'] ?? null;

            $where = [];
            $bind  = [];
            if ($search) {
                $where[] = "(name LIKE ? OR description LIKE ?)";
                $bind[] = "%$search%";
                $bind[] = "%$search%";
            }
            if ($active !== null && $active !== '') {
                $where[] = "is_active = ?";
                $bind[] = (int)$active;
            }
            $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

            $stmt = $db->prepare("SELECT id,name,description,is_active,created_at,updated_at FROM categories $whereSQL ORDER BY name");
            $stmt->execute($bind);
            respondList($stmt->fetchAll());

        // POST /categories — create new category
        } elseif ($method === 'POST' && $uri === '/categories') {
            requireRole($user, 'admin');
            $b = requireBody(); requireFields($b, ['name']);

            // Check duplicate name
            $dup = $db->prepare("SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1");
            $dup->execute([$b['name']]);
            if ($dup->fetch()) respondError('Kategori dengan nama tersebut sudah ada', 409);

            $id = generateUUID();
            $db->prepare("INSERT INTO categories(id,name,description,is_active) VALUES(?,?,?,1)")
               ->execute([$id, $b['name'], $b['description']??null]);
            respondCreated(['id'=>$id, 'message'=>'Kategori berhasil ditambahkan']);

        // PUT /categories/:id — update category
        } elseif ($method === 'PUT' && preg_match('#^/categories/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $b = requireBody();

            // Check duplicate name (exclude self)
            if (isset($b['name'])) {
                $dup = $db->prepare("SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1");
                $dup->execute([$b['name'], $m[1]]);
                if ($dup->fetch()) respondError('Kategori dengan nama tersebut sudah ada', 409);
            }

            $db->prepare("UPDATE categories SET name=?,description=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['name'],$b['description']??null,$m[1]]);
            respond(['message'=>'Kategori berhasil diperbarui']);

        // PUT /categories/:id/toggle — soft delete (toggle active/inactive)
        } elseif ($method === 'PUT' && preg_match('#^/categories/([^/]+)/toggle$#',$uri,$m)) {
            requireRole($user, 'admin');
            $db->prepare("UPDATE categories SET is_active = NOT is_active, updated_at=NOW() WHERE id=?")
               ->execute([$m[1]]);
            respond(['message'=>'Status kategori diperbarui']);

        // DELETE /categories/:id — hard delete (only if not used by any item)
        } elseif ($method === 'DELETE' && preg_match('#^/categories/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');

            // Check if used by items
            $used = $db->prepare("SELECT COUNT(*) FROM items WHERE category_id = ?");
            $used->execute([$m[1]]);
            if ((int)$used->fetchColumn() > 0) {
                respondError('Kategori masih digunakan oleh item. Nonaktifkan saja jika tidak diperlukan lagi.', 409);
            }

            $db->prepare("DELETE FROM categories WHERE id=?")->execute([$m[1]]);
            respond(['message'=>'Kategori berhasil dihapus']);
        }
        return;
    }

    // ══════════════════════════════════════════════════════════
    //  UNITS — Production-grade with soft delete, auto-abbr
    // ══════════════════════════════════════════════════════════
    if (strpos($uri, '/units') === 0) {
        // GET /units — list with optional search & is_active filter
        if ($method === 'GET' && $uri === '/units') {
            $search = $_GET['search'] ?? '';
            $active = $_GET['is_active'] ?? null;

            $where = [];
            $bind  = [];
            if ($search) {
                $where[] = "(name LIKE ? OR abbreviation LIKE ?)";
                $bind[] = "%$search%";
                $bind[] = "%$search%";
            }
            if ($active !== null && $active !== '') {
                $where[] = "is_active = ?";
                $bind[] = (int)$active;
            }
            $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

            $stmt = $db->prepare("SELECT id,name,abbreviation,is_active,created_at,updated_at FROM units $whereSQL ORDER BY name");
            $stmt->execute($bind);
            respondList($stmt->fetchAll());

        // POST /units — create new unit
        } elseif ($method === 'POST' && $uri === '/units') {
            requireRole($user, 'admin');
            $b = requireBody(); requireFields($b, ['name']);
            $abbr = $b['abbreviation'] ?? mb_substr($b['name'], 0, 3);

            // Check duplicate name
            $dup = $db->prepare("SELECT id FROM units WHERE LOWER(name) = LOWER(?) LIMIT 1");
            $dup->execute([$b['name']]);
            if ($dup->fetch()) respondError('Satuan dengan nama tersebut sudah ada', 409);

            // Check duplicate abbreviation
            $dupA = $db->prepare("SELECT id FROM units WHERE LOWER(abbreviation) = LOWER(?) LIMIT 1");
            $dupA->execute([$abbr]);
            if ($dupA->fetch()) respondError("Singkatan '$abbr' sudah dipakai oleh satuan lain", 409);

            $id = generateUUID();
            $db->prepare("INSERT INTO units(id,name,abbreviation,is_active) VALUES(?,?,?,1)")
               ->execute([$id, $b['name'], $abbr]);
            respondCreated(['id'=>$id, 'message'=>'Satuan berhasil ditambahkan']);

        // PUT /units/:id — update unit
        } elseif ($method === 'PUT' && preg_match('#^/units/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $b = requireBody();

            // Check duplicate (exclude self)
            if (isset($b['name'])) {
                $dup = $db->prepare("SELECT id FROM units WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1");
                $dup->execute([$b['name'], $m[1]]);
                if ($dup->fetch()) respondError('Satuan dengan nama tersebut sudah ada', 409);
            }

            $abbr = $b['abbreviation'] ?? mb_substr($b['name'] ?? '', 0, 3);
            $db->prepare("UPDATE units SET name=?,abbreviation=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['name'],$abbr,$m[1]]);
            respond(['message'=>'Satuan berhasil diperbarui']);

        // PUT /units/:id/toggle — soft delete (toggle active/inactive)
        } elseif ($method === 'PUT' && preg_match('#^/units/([^/]+)/toggle$#',$uri,$m)) {
            requireRole($user, 'admin');
            $db->prepare("UPDATE units SET is_active = NOT is_active, updated_at=NOW() WHERE id=?")
               ->execute([$m[1]]);
            respond(['message'=>'Status satuan diperbarui']);

        // DELETE /units/:id — hard delete (only if not used)
        } elseif ($method === 'DELETE' && preg_match('#^/units/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');

            // Check if used by items
            $used = $db->prepare("SELECT COUNT(*) FROM items WHERE unit_id = ?");
            $used->execute([$m[1]]);
            if ((int)$used->fetchColumn() > 0) {
                respondError('Satuan masih digunakan oleh item. Nonaktifkan saja jika tidak diperlukan lagi.', 409);
            }

            $db->prepare("DELETE FROM units WHERE id=?")->execute([$m[1]]);
            respond(['message'=>'Satuan berhasil dihapus']);
        }
        return;
    }

    // ── SUPPLIERS ────────────────────────────────────────────
    if (strpos($uri, '/suppliers') === 0) {
        if ($method === 'GET' && $uri === '/suppliers') {
            [$limit, $offset] = paginate();
            $search = $_GET['search'] ?? '';
            $where  = $search ? "WHERE name LIKE ? OR code LIKE ?" : '';
            $bind   = $search ? ["%$search%","%$search%"] : [];

            $total = $db->prepare("SELECT COUNT(*) FROM suppliers $where");
            $total->execute($bind);

            $stmt = $db->prepare("SELECT id,code,name,email,phone,city,is_active,is_blacklisted,rating,payment_terms FROM suppliers $where ORDER BY name LIMIT $limit OFFSET $offset");
            $stmt->execute($bind);
            respondList($stmt->fetchAll(), (int)$total->fetchColumn());
        } elseif ($method === 'POST' && $uri === '/suppliers') {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody(); requireFields($b, ['name']);
            $id = generateUUID();
            $db->prepare("INSERT INTO suppliers(id,code,name,email,phone,address,city,npwp,is_pkp,payment_terms,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
               ->execute([$id,$b['code']??null,$b['name'],$b['email']??null,$b['phone']??null,$b['address']??null,$b['city']??null,$b['npwp']??null,$b['is_pkp']??1,$b['payment_terms']??30,$b['notes']??null]);
            respond(['id'=>$id]);
        } elseif ($method === 'PUT' && preg_match('#^/suppliers/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin','finance_procurement');
            $b = requireBody();
            $db->prepare("UPDATE suppliers SET code=?,name=?,email=?,phone=?,address=?,city=?,npwp=?,is_pkp=?,payment_terms=?,is_active=?,is_blacklisted=?,notes=?,updated_at=NOW() WHERE id=?")
               ->execute([$b['code']??null,$b['name'],$b['email']??null,$b['phone']??null,$b['address']??null,$b['city']??null,$b['npwp']??null,$b['is_pkp']??1,$b['payment_terms']??30,$b['is_active']??1,$b['is_blacklisted']??0,$b['notes']??null,$m[1]]);
            respond(['message'=>'Updated']);
        } elseif ($method === 'DELETE' && preg_match('#^/suppliers/([^/]+)$#',$uri,$m)) {
            requireRole($user, 'admin');
            $db->prepare("DELETE FROM suppliers WHERE id=?")->execute([$m[1]]);
            respond(['message'=>'Deleted']);
        }
        return;
    }

    respondError('Master route not found', 404);
}
