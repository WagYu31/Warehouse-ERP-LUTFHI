<?php
// ============================================================
// AI Chatbot Routes — Groq-powered WMS Assistant
// ============================================================

function handleAI($method, $uri, $user) {
    $db = getDB();

    // POST /ai/chat
    if ($method === 'POST' && $uri === '/ai/chat') {
        $body = requireBody();
        $message = trim($body['message'] ?? '');
        if (!$message) respondError('Message is required', 400);

        // Try executing command actions directly
        $actionResult = tryExecuteAIAction($db, $message, $user);
        if ($actionResult !== null) {
            respond([
                'reply'     => $actionResult,
                'role'      => $user['role'],
                'timestamp' => date('Y-m-d H:i:s'),
            ]);
            return;
        }

        // Load environmental variables (like GROQ_API_KEY)
        loadAIEnv();

        // Gather context data based on user role
        $context = gatherContextForRole($db, $user);

        // Get API Key
        $apiKey = getenv('GROQ_API_KEY') ?: 'GROQ_API_KEY_PLACEHOLDER';

        // Use fallback if API key is not set or is still the placeholder
        if (empty($apiKey) || $apiKey === 'GROQ_API_KEY_PLACEHOLDER') {
            $response = ruleBasedReply($message, formatContextForFallback($context));
        } else {
            // Build prompt
            $systemPrompt = buildSystemPrompt($user, $context);
            // Call Groq API
            $response = callGroq($apiKey, $systemPrompt, $message);
            
            // Graceful degradation: if API returns an error, use rule-based answer
            if (strpos($response, '⚠️ AI Error:') === 0) {
                $response = "⚠️ AI sedang sibuk, ini jawaban ringkas:\n\n" . ruleBasedReply($message, formatContextForFallback($context));
            }
        }

        respond([
            'reply'     => $response,
            'role'      => $user['role'],
            'timestamp' => date('Y-m-d H:i:s'),
        ]);
    }

    respondError('AI route not found', 404);
}

function gatherContextForRole($db, $user) {
    $ctx  = [];
    $role = $user['role'];

    // === DATA STOK (semua role) ===
    try {
        $stmt = $db->query(
            "SELECT i.name, i.sku, i.min_stock, i.max_stock, i.price, c.name as category
             FROM items i
             LEFT JOIN categories c ON c.id = i.category_id
             WHERE i.is_active = 1
             ORDER BY i.name ASC LIMIT 50"
        );
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $ctx['items'] = $items;

        // Stok kritis: min_stock > 0 → tandai
        $ctx['critical_count'] = count(array_filter($items, fn($i) => $i['min_stock'] > 0));
    } catch (Exception $e) {
        $ctx['items'] = [];
    }

    // === GUDANG ===
    try {
        $stmt = $db->query("SELECT name, code, city, pic_name FROM warehouses WHERE is_active = 1");
        $ctx['warehouses'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $ctx['warehouses'] = [];
    }

    // === OPERASIONAL (admin, staff, staff_gudang) ===
    if (in_array($role, ['admin', 'staff', 'staff_gudang'])) {
        try {
            $stmt = $db->query(
                "SELECT COUNT(*) as total,
                        SUM(status='pending') as pending,
                        SUM(status='confirmed') as confirmed
                 FROM inbound_transactions"
            );
            $ctx['inbound_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT COUNT(*) as total FROM outbound_transactions");
            $ctx['outbound_total'] = $stmt->fetch()['total'];
        } catch (Exception $e) {}

        try {
            $stmt = $db->query(
                "SELECT COUNT(*) as total,
                        SUM(status='pending') as pending,
                        SUM(status='approved') as approved,
                        SUM(status='rejected') as rejected
                 FROM requests"
            );
            $ctx['spb_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query(
                "SELECT COUNT(*) as total,
                        SUM(status='in_progress') as in_progress,
                        SUM(status='completed') as completed
                 FROM stock_opname"
            );
            $ctx['opname_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    // === KEUANGAN (admin, finance_procurement) ===
    if (in_array($role, ['admin', 'finance_procurement'])) {
        try {
            $stmt = $db->query(
                "SELECT COUNT(*) as total,
                        SUM(status='draft') as draft,
                        SUM(status='sent') as sent,
                        SUM(status='complete') as complete,
                        SUM(total_amount) as total_value
                 FROM purchase_orders"
            );
            $ctx['po_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query(
                "SELECT COUNT(*) as total,
                        SUM(status='unpaid') as unpaid,
                        SUM(status='partial') as partial,
                        SUM(status='paid') as paid,
                        SUM(status='overdue') as overdue,
                        SUM(total_amount) as total_tagihan,
                        SUM(paid_amount) as total_terbayar
                 FROM invoices"
            );
            $ctx['invoice_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query(
                "SELECT COUNT(*) as total,
                        SUM(total_budget) as total_budget,
                        SUM(used_amount) as total_used
                 FROM budgets"
            );
            $ctx['budget_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT name, code, phone, email, city FROM suppliers ORDER BY name LIMIT 20");
            $ctx['suppliers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    // === LAPORAN (admin, finance, manager) ===
    if (in_array($role, ['admin', 'finance_procurement', 'manager'])) {
        try {
            $stmt = $db->query(
                "SELECT DATE(t.received_date) as tgl, COUNT(*) as jumlah
                 FROM inbound_transactions t
                 WHERE t.received_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                 GROUP BY DATE(t.received_date)
                 ORDER BY tgl DESC LIMIT 10"
            );
            $ctx['inbound_trend'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    return $ctx;
}

function buildSystemPrompt($user, $ctx) {
    $role = $user['role'];
    $name = $user['name'];

    $prompt  = "Kamu adalah AI Asisten WMS LUTFHI (Warehouse Management System). ";
    $prompt .= "Kamu membantu user bernama \"{$name}\" dengan role \"{$role}\". ";
    $prompt .= "Jawab dalam Bahasa Indonesia. Jawab singkat, padat, dan langsung ke poin. ";
    $prompt .= "Gunakan emoji untuk memperjelas. Format jawaban dengan bullet points jika perlu.\n\n";

    // Role-specific instructions
    switch ($role) {
        case 'admin':
            $prompt .= "User ini adalah ADMIN yang bisa mengakses semua fitur. Bantu dengan data stok, keuangan, laporan, dan manajemen sistem.\n";
            break;
        case 'staff':
        case 'staff_gudang':
            $prompt .= "User ini adalah STAFF GUDANG. Fokus bantu operasional: stok, barang masuk/keluar, opname, transfer. JANGAN jawab soal keuangan (PO/invoice/budget).\n";
            break;
        case 'finance_procurement':
            $prompt .= "User ini adalah FINANCE & PROCUREMENT. Fokus bantu keuangan: PO, invoice, budget, supplier. JANGAN jawab soal operasional gudang detail (GRN/outbound/transfer).\n";
            break;
        case 'manager':
            $prompt .= "User ini adalah MANAGER (viewer). Fokus bantu analisis dan laporan. User ini hanya bisa MELIHAT data, tidak bisa membuat/mengedit.\n";
            break;
    }

    // Inject real data
    $prompt .= "\n=== DATA REAL-TIME ===\n";

    // Items
    if (!empty($ctx['items'])) {
        $prompt .= "\n📦 INVENTARIS (" . count($ctx['items']) . " item aktif):\n";
        foreach ($ctx['items'] as $i) {
            $prompt .= "- {$i['name']} (SKU: {$i['sku']}): min_stok={$i['min_stock']}, harga=Rp" . number_format($i['price'], 0, ',', '.') . "\n";
        }
        if (($ctx['critical_count'] ?? 0) > 0) {
            $prompt .= "🚨 " . $ctx['critical_count'] . " item memiliki min_stock > 0 (perlu pemantauan)\n";
        }
    }

    if (!empty($ctx['warehouses'])) {
        $prompt .= "\n🏭 GUDANG AKTIF: " . count($ctx['warehouses']) . " gudang\n";
        foreach ($ctx['warehouses'] as $w) {
            $prompt .= "- {$w['name']} ({$w['code']}) — {$w['city']}, PIC: {$w['pic_name']}\n";
        }
    }

    if (!empty($ctx['inbound_stats'])) {
        $s = $ctx['inbound_stats'];
        $prompt .= "\n⬇️ BARANG MASUK: Total={$s['total']}, Pending={$s['pending']}, Confirmed={$s['confirmed']}\n";
    }
    if (!empty($ctx['outbound_total'])) {
        $prompt .= "⬆️ BARANG KELUAR: Total={$ctx['outbound_total']}\n";
    }
    if (!empty($ctx['spb_stats'])) {
        $s = $ctx['spb_stats'];
        $prompt .= "📋 SPB: Total={$s['total']}, Pending={$s['pending']}, Approved={$s['approved']}, Rejected={$s['rejected']}\n";
    }
    if (!empty($ctx['opname_stats'])) {
        $s = $ctx['opname_stats'];
        $prompt .= "🔄 OPNAME: Total={$s['total']}, Berlangsung={$s['in_progress']}, Selesai={$s['completed']}\n";
    }
    if (!empty($ctx['po_stats'])) {
        $s = $ctx['po_stats'];
        $prompt .= "\n🛒 PURCHASE ORDER: Total={$s['total']}, Draft={$s['draft']}, Sent={$s['sent']}, Complete={$s['complete']}, Nilai=Rp" . number_format($s['total_value'] ?? 0, 0, ',', '.') . "\n";
    }
    if (!empty($ctx['invoice_stats'])) {
        $s = $ctx['invoice_stats'];
        $prompt .= "📄 INVOICE: Total={$s['total']}, Unpaid={$s['unpaid']}, Partial={$s['partial']}, Paid={$s['paid']}, Overdue={$s['overdue']}\n";
        $prompt .= "   Tagihan=Rp" . number_format($s['total_tagihan'] ?? 0, 0, ',', '.') . ", Terbayar=Rp" . number_format($s['total_terbayar'] ?? 0, 0, ',', '.') . "\n";
    }
    if (!empty($ctx['budget_stats'])) {
        $s = $ctx['budget_stats'];
        $prompt .= "💰 BUDGET: {$s['total']} anggaran, Total=Rp" . number_format($s['total_budget'] ?? 0, 0, ',', '.') . ", Terpakai=Rp" . number_format($s['total_used'] ?? 0, 0, ',', '.') . "\n";
    }
    if (!empty($ctx['suppliers'])) {
        $prompt .= "\n🏢 SUPPLIER (" . count($ctx['suppliers']) . " aktif)\n";
    }

    return $prompt;
}

function callGroq($apiKey, $systemPrompt, $userMessage) {
    $url     = "https://api.groq.com/openai/v1/chat/completions";
    $payload = json_encode([
        'model'       => 'llama-3.3-70b-versatile',
        'messages'    => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user',   'content' => $userMessage],
        ],
        'temperature' => 0.7,
        'max_tokens'  => 1024,
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $res      = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        $err = json_decode($res, true);
        return "⚠️ AI Error: " . ($err['error']['message'] ?? "HTTP $httpCode");
    }

    $data = json_decode($res, true);
    return $data['choices'][0]['message']['content'] ?? 'Maaf, tidak dapat memproses pertanyaan.';
}

// ── Helper to Load Env variables ───────────────────────────────
function loadAIEnv() {
    $paths = [
        defined('BASE_PATH') ? BASE_PATH . '/.env' : __DIR__ . '/.env',
        defined('BASE_PATH') ? dirname(BASE_PATH) . '/backend/.env' : dirname(__DIR__) . '/backend/.env',
        defined('BASE_PATH') ? dirname(BASE_PATH) . '/.env' : dirname(__DIR__) . '/.env'
    ];
    foreach ($paths as $path) {
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), '#') === 0) continue;
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $key = trim($parts[0]);
                    $val = trim($parts[1]);
                    $val = trim($val, "\"'");
                    if (!getenv($key)) {
                        putenv("$key=$val");
                        $_ENV[$key] = $val;
                    }
                }
            }
            break;
        }
    }
}

// ── Rule-based fallback (no API key / API error) ──────────────
function ruleBasedReply($msg, $ctx) {
    $lower = strtolower($msg);
    
    if (containsAny($lower, ['kritis', 'critical', 'minimum', 'min stock', 'habis'])) {
        return "🚨 Berikut kondisi stok kritis saat ini:\n\n" . $ctx;
    }
    if (containsAny($lower, ['stok', 'stock', 'inventaris', 'barang', 'item'])) {
        return "📦 Ringkasan inventaris saat ini:\n\n" . $ctx;
    }
    if (containsAny($lower, ['invoice', 'faktur', 'tagihan', 'pembayaran'])) {
        return "📄 Status pembayaran & invoice:\n\n" . $ctx;
    }
    if (containsAny($lower, ['budget', 'anggaran', 'biaya'])) {
        return "💰 Situasi anggaran:\n\n" . $ctx;
    }
    if (containsAny($lower, ['po', 'purchase order', 'pembelian', 'pengadaan'])) {
        return "🛒 Status Purchase Order:\n\n" . $ctx;
    }
    if (containsAny($lower, ['transaksi', 'masuk', 'keluar', 'inbound', 'outbound'])) {
        return "🔄 Transaksi bulan ini:\n\n" . $ctx;
    }
    if (containsAny($lower, ['ringkasan', 'summary', 'laporan', 'rekap'])) {
        return "📊 Ringkasan sistem WMS LUTFHI:\n\n" . $ctx;
    }
    if (containsAny($lower, ['halo', 'hai', 'hello', 'hi', 'selamat'])) {
        return "👋 Halo! Saya AI Asisten WMS LUTFHI.\n\nSaya bisa bantu cek:\n• 📦 Stok & inventaris\n• 🚨 Item kritis\n• 💰 Anggaran & invoice\n• 🛒 Purchase Order\n• 📊 Laporan transaksi\n\nApa yang ingin Anda tanyakan?";
    }
    
    return "🤖 Saya siap membantu tentang WMS & ERP!\n\nCoba tanya:\n• \"Berapa item yang kritis?\"\n• \"Status invoice belum bayar?\"\n• \"Ringkasan anggaran bulan ini?\"\n\n📊 Data sistem:\n" . $ctx;
}

function containsAny($str, array $keywords) {
    foreach ($keywords as $k) {
        if (strpos($str, $k) !== false) {
            return true;
        }
    }
    return false;
}

// ── Format Context for Fallback ────────────────────────────────
function formatContextForFallback($ctx) {
    $out = "";
    if (!empty($ctx['items'])) {
        $out .= "**📦 INVENTARIS BARANG**:\n\n";
        $out .= "| Nama Barang | SKU | Min Stok | Harga |\n";
        $out .= "| :--- | :--- | :--- | :--- |\n";
        $count = 0;
        foreach ($ctx['items'] as $i) {
            if ($count >= 10) {
                $out .= "| ... dan " . (count($ctx['items']) - 10) . " item lainnya. | | | |\n";
                break;
            }
            $out .= "| {$i['name']} | {$i['sku']} | {$i['min_stock']} | Rp" . number_format($i['price'], 0, ',', '.') . " |\n";
            $count++;
        }
        $out .= "\n";
    }
    
    if (isset($ctx['critical_count']) && $ctx['critical_count'] > 0) {
        $out .= "🚨 **Item Kritis**: {$ctx['critical_count']} item perlu restock segera.\n\n";
    }
    
    if (!empty($ctx['warehouses'])) {
        $out .= "**🏭 GUDANG AKTIF**:\n\n";
        $out .= "| Nama Gudang | Kode | Kota | PIC |\n";
        $out .= "| :--- | :--- | :--- | :--- |\n";
        foreach ($ctx['warehouses'] as $w) {
            $out .= "| {$w['name']} | {$w['code']} | {$w['city']} | {$w['pic_name']} |\n";
        }
        $out .= "\n";
    }
    
    $hasStats = !empty($ctx['inbound_stats']) || !empty($ctx['outbound_total']) || !empty($ctx['spb_stats']) || !empty($ctx['opname_stats']);
    if ($hasStats) {
        $out .= "**🔄 STATUS OPERASIONAL**:\n";
        if (!empty($ctx['inbound_stats'])) {
            $s = $ctx['inbound_stats'];
            $out .= "• **Barang Masuk**: Total {$s['total']} transaksi ({$s['pending']} pending, {$s['confirmed']} confirmed)\n";
        }
        if (!empty($ctx['outbound_total'])) {
            $out .= "• **Barang Keluar**: Total {$ctx['outbound_total']} transaksi\n";
        }
        if (!empty($ctx['spb_stats'])) {
            $s = $ctx['spb_stats'];
            $out .= "• **SPB Pending**: {$s['pending']} dari {$s['total']} pengajuan\n";
        }
        if (!empty($ctx['opname_stats'])) {
            $s = $ctx['opname_stats'];
            $out .= "• **Stock Opname**: {$s['in_progress']} sedang berlangsung, {$s['completed']} selesai\n";
        }
        $out .= "\n";
    }
    
    $hasFinance = !empty($ctx['po_stats']) || !empty($ctx['invoice_stats']) || !empty($ctx['budget_stats']);
    if ($hasFinance) {
        $out .= "**💰 STATUS KEUANGAN & ERP**:\n";
        if (!empty($ctx['po_stats'])) {
            $s = $ctx['po_stats'];
            $out .= "• **Purchase Order**: Total {$s['total']} PO (Nilai: Rp" . number_format($s['total_value'] ?? 0, 0, ',', '.') . ")\n";
        }
        if (!empty($ctx['invoice_stats'])) {
            $s = $ctx['invoice_stats'];
            $out .= "• **Invoice**: {$s['unpaid']} unpaid, {$s['overdue']} overdue (Tagihan: Rp" . number_format($s['total_tagihan'] ?? 0, 0, ',', '.') . ")\n";
        }
        if (!empty($ctx['budget_stats'])) {
            $s = $ctx['budget_stats'];
            $out .= "• **Budget**: Total Rp" . number_format($s['total_budget'] ?? 0, 0, ',', '.') . " (Terpakai: Rp" . number_format($s['total_used'] ?? 0, 0, ',', '.') . ")\n";
        }
    }
    
    return $out;
}

// ── Try executing command actions directly ──────────────────────
function tryExecuteAIAction($db, $message, $user) {
    $msg = trim($message);

    // Help / Bantuan Command
    if (preg_match('/^(?:bantuan|help|menu|fitur|perintah)/i', $msg)) {
        $help = "💡 **MENU PERINTAH AI (ACTION-ORIENTED ASSISTANT)**\n\n";
        $help .= "Sebagai asisten cerdas, saya dapat mengeksekusi aksi berikut secara instan:\n\n";
        $help .= "1. **Menyetujui / Menolak SPB**:\n";
        $help .= "   * Format: `setujui spb [NOMOR_SPB]` atau `tolak spb [NOMOR_SPB]`\n";
        $help .= "   * Contoh: `setujui spb SPB-20260429-84A996`\n\n";
        $help .= "2. **Menambah Gudang Baru**:\n";
        $help .= "   * Format: `tambah gudang [Nama Gudang] kode [Kode] kota [Kota] pic [Nama PIC]`\n";
        $help .= "   * Contoh: `tambah gudang Gudang Baru Surabaya kode GDG-SRB kota Surabaya pic Andi`\n\n";
        $help .= "3. **Menambah Barang Baru**:\n";
        $help .= "   * Format: `tambah barang [Nama Barang] sku [SKU] harga [Harga] stok [MinStok]`\n";
        $help .= "   * Contoh: `tambah barang Monitor Xiaomi sku XMI-MON harga 2500000 stok 5`\n\n";
        $help .= "*(Catatan: Aksi penulisan database memerlukan wewenang akun Admin atau Staff)*";
        return $help;
    }

    // 1. Approve / Reject SPB
    if (preg_match('/^(setujui|approve|tolak|reject)\s+spb\s+([A-Za-z0-9\-]+)/i', $msg, $m)) {
        if (!in_array($user['role'], ['admin', 'staff'])) {
            return "⚠️ Maaf, Anda tidak memiliki hak akses (role: {$user['role']}) untuk menyetujui/menolak pengajuan SPB.";
        }
        
        $action = strtolower($m[1]);
        $param  = trim($m[2]);
        $newStatus = ($action === 'setujui' || $action === 'approve') ? 'approved' : 'rejected';
        
        $stmt = $db->prepare("SELECT id, ref_number, status FROM requests WHERE ref_number = ? OR id = ?");
        $stmt->execute([$param, $param]);
        $req = $stmt->fetch();
        
        if (!$req) {
            return "⚠️ Pengajuan SPB dengan nomor/ID '{$param}' tidak ditemukan di sistem.";
        }
        
        if ($req['status'] === $newStatus) {
            return "ℹ️ Pengajuan SPB **{$req['ref_number']}** memang sudah berstatus **" . ($newStatus === 'approved' ? 'disetujui' : 'ditolak') . "**.";
        }
        
        $db->prepare("UPDATE requests SET status=?, approved_by=?, approval_notes='Diproses otomatis via AI Assistant', approved_at=NOW() WHERE id=?")
           ->execute([$newStatus, $user['sub'], $req['id']]);
           
        return "✅ **SPB {$req['ref_number']}** berhasil di-**" . ($newStatus === 'approved' ? 'setujui' : 'tolak') . "** via AI Assistant!";
    }

    // 2. Tambah Gudang
    if (preg_match('/^(?:tambah|buat)\s+gudang\s+(.+)$/i', $msg, $m)) {
        if ($user['role'] !== 'admin') {
            return "⚠️ Maaf, Anda tidak memiliki hak akses (role: {$user['role']}) untuk membuat gudang baru.";
        }
        
        $rest = $m[1];
        
        $code = "";
        if (preg_match('/kode\s*(?::|)?\s*([A-Za-z0-9\-]+)/i', $rest, $cm)) {
            $code = trim($cm[1]);
        }
        
        $city = "";
        if (preg_match('/kota\s*(?::|)?\s*([^,;]+)/i', $rest, $cym)) {
            $city = trim($cym[1]);
        }
        
        $pic = "";
        if (preg_match('/pic\s*(?::|)?\s*([^,;]+)/i', $rest, $pm)) {
            $pic = trim($pm[1]);
        }
        
        $name = $rest;
        $keywords = ['kode', 'kota', 'pic'];
        foreach ($keywords as $kw) {
            $pos = stripos($name, $kw);
            if ($pos !== false) {
                $name = substr($name, 0, $pos);
            }
        }
        $name = trim(rtrim($name, ' ,:'));
        
        if (empty($name)) {
            return "⚠️ Nama gudang harus diisi. Contoh: `tambah gudang Gudang Baru kode GDG-NEW`";
        }
        
        if (empty($code)) {
            $code = "GDG-" . strtoupper(substr(uniqid(), -5));
        }
        
        // Check code duplicate
        $check = $db->prepare("SELECT id FROM warehouses WHERE code=?");
        $check->execute([$code]);
        if ($check->fetch()) {
            return "⚠️ Kode gudang '{$code}' sudah terdaftar untuk gudang lain.";
        }
        
        $id = generateUUID();
        $db->prepare("INSERT INTO warehouses(id,code,name,city,pic_name,is_active) VALUES(?,?,?,?,?,1)")
           ->execute([$id, $code, $name, $city ?: null, $pic ?: null]);
           
        return "✅ **Gudang Baru Berhasil Dibuat**:\n\n| Nama Gudang | Kode | Kota | PIC |\n| :--- | :--- | :--- | :--- |\n| {$name} | {$code} | " . ($city ?: '-') . " | " . ($pic ?: '-') . " |";
    }

    // 3. Tambah Barang
    if (preg_match('/^(?:tambah|buat)\s+(?:barang|item)\s+(.+)$/i', $msg, $m)) {
        if (!in_array($user['role'], ['admin', 'staff'])) {
            return "⚠️ Maaf, Anda tidak memiliki hak akses (role: {$user['role']}) untuk mendaftarkan barang baru.";
        }
        
        $rest = $m[1];
        
        $sku = "";
        if (preg_match('/sku\s*(?::|)?\s*([A-Za-z0-9\-]+)/i', $rest, $sm)) {
            $sku = trim($sm[1]);
        }
        
        $price = 0;
        if (preg_match('/harga\s*(?::|)?\s*(?:rp|)?\s*([0-9\.]+)/i', $rest, $pm)) {
            $price = (float)str_replace('.', '', $pm[1]);
        }
        
        $minStock = 0;
        if (preg_match('/(?:min\s*|)?stok\s*(?::|)?\s*([0-9]+)/i', $rest, $stm)) {
            $minStock = (int)$stm[1];
        }
        
        $name = $rest;
        $keywords = ['sku', 'harga', 'stok', 'min'];
        foreach ($keywords as $kw) {
            $pos = stripos($name, $kw);
            if ($pos !== false) {
                $name = substr($name, 0, $pos);
            }
        }
        $name = trim(rtrim($name, ' ,:'));
        
        if (empty($name)) {
            return "⚠️ Nama barang harus diisi. Contoh: `tambah barang Laptop Asus sku ASUS-123 harga 15000000`";
        }
        
        if (empty($sku)) {
            $sku = "ITM-" . strtoupper(substr(uniqid(), -5));
        }
        
        // Check SKU conflict
        $check = $db->prepare("SELECT id FROM items WHERE sku=?");
        $check->execute([$sku]);
        if ($check->fetch()) {
            return "⚠️ SKU '{$sku}' sudah terdaftar untuk barang lain.";
        }
        
        // Fetch default unit and category
        $unitId = $db->query("SELECT id FROM units LIMIT 1")->fetchColumn();
        $categoryId = $db->query("SELECT id FROM categories LIMIT 1")->fetchColumn();
        
        $id = generateUUID();
        $db->prepare("INSERT INTO items(id,sku,name,price,min_stock,unit_id,category_id,is_active) VALUES(?,?,?,?,?,?,?,1)")
           ->execute([$id, $sku, $name, $price, $minStock, $unitId ?: null, $categoryId ?: null]);
           
        return "✅ **Barang Baru Berhasil Terdaftar**:\n\n| Nama Barang | SKU | Min Stok | Harga |\n| :--- | :--- | :--- | :--- |\n| {$name} | {$sku} | {$minStock} | Rp" . number_format($price, 0, ',', '.') . " |";
    }

    return null; // Not an action command
}
