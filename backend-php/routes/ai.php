<?php
// ============================================================
// AI Chatbot Routes — Gemini-powered WMS Assistant
// ============================================================

function handleAI($method, $uri, $user) {
    $db = getDB();

    // POST /ai/chat
    if ($method === 'POST' && $uri === '/ai/chat') {
        $body = requireBody();
        $message = trim($body['message'] ?? '');
        if (!$message) respondError('Message is required', 400);

        // Gather context data based on user role
        $context = gatherContextForRole($db, $user);

        // Build prompt
        $systemPrompt = buildSystemPrompt($user, $context);

        // Call Gemini API
        $apiKey = getenv('GEMINI_API_KEY') ?: 'AIzaSyAYmzVKMagPOCn1CnOmT7PGxMM7-UAEF3E';
        $response = callGemini($apiKey, $systemPrompt, $message);

        respond([
            'reply' => $response,
            'role' => $user['role'],
            'timestamp' => date('Y-m-d H:i:s'),
        ]);
    }

    respondError('AI route not found', 404);
}

function gatherContextForRole($db, $user) {
    $ctx = [];
    $role = $user['role'];

    // === DATA STOK (semua role) ===
    try {
        $stmt = $db->query("SELECT i.name, i.sku, COALESCE(SUM(s.current_stock),0) as total_stock, i.min_stock, i.price, c.name as category
            FROM items i
            LEFT JOIN item_stocks s ON s.item_id=i.id
            LEFT JOIN categories c ON c.id=i.category_id
            WHERE i.is_active=1
            GROUP BY i.id ORDER BY total_stock ASC LIMIT 50");
        $ctx['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) { $ctx['items'] = []; }

    // Stok kritis
    $ctx['critical_items'] = array_filter($ctx['items'], function($i) {
        return $i['total_stock'] <= $i['min_stock'] && $i['min_stock'] > 0;
    });

    // === GUDANG ===
    try {
        $stmt = $db->query("SELECT name, code, city, pic_name FROM warehouses WHERE is_active=1");
        $ctx['warehouses'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) { $ctx['warehouses'] = []; }

    // === OPERASIONAL (admin, staff) ===
    if (in_array($role, ['admin', 'staff'])) {
        try {
            $stmt = $db->query("SELECT COUNT(*) as total, SUM(status='pending') as pending, SUM(status='confirmed') as confirmed FROM inbound_transactions");
            $ctx['inbound_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT COUNT(*) as total FROM outbound_transactions");
            $ctx['outbound_total'] = $stmt->fetch()['total'];
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT COUNT(*) as total, SUM(status='pending') as pending, SUM(status='approved') as approved, SUM(status='rejected') as rejected FROM requests");
            $ctx['spb_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT COUNT(*) as total, SUM(status='in_progress') as in_progress, SUM(status='completed') as completed FROM stock_opname");
            $ctx['opname_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    // === KEUANGAN (admin, finance) ===
    if (in_array($role, ['admin', 'finance_procurement'])) {
        try {
            $stmt = $db->query("SELECT COUNT(*) as total, SUM(status='draft') as draft, SUM(status='sent') as sent, SUM(status='complete') as complete, SUM(total_amount) as total_value FROM purchase_orders");
            $ctx['po_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT COUNT(*) as total, SUM(status='unpaid') as unpaid, SUM(status='partial') as partial, SUM(status='paid') as paid, SUM(status='overdue') as overdue, SUM(total_amount) as total_tagihan, SUM(paid_amount) as total_terbayar FROM invoices");
            $ctx['invoice_stats'] = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        try {
            $stmt = $db->query("SELECT COUNT(*) as total, SUM(total_budget) as total_budget, SUM(used_amount) as total_used FROM budgets");
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
            $stmt = $db->query("SELECT DATE(t.received_date) as tgl, COUNT(*) as jumlah, SUM(ti.qty_received * ti.unit_price) as nilai
                FROM inbound_transactions t
                JOIN inbound_items ti ON ti.transaction_id=t.id
                WHERE t.received_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(t.received_date) ORDER BY tgl DESC LIMIT 10");
            $ctx['inbound_trend'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    return $ctx;
}

function buildSystemPrompt($user, $ctx) {
    $role = $user['role'];
    $name = $user['name'];

    $prompt = "Kamu adalah AI Asisten WMS LUTFHI (Warehouse Management System). ";
    $prompt .= "Kamu membantu user bernama \"{$name}\" dengan role \"{$role}\". ";
    $prompt .= "Jawab dalam Bahasa Indonesia. Jawab singkat, padat, dan langsung ke poin. ";
    $prompt .= "Gunakan emoji untuk memperjelas. Format jawaban dengan bullet points jika perlu.\n\n";

    // Role-specific instructions
    switch ($role) {
        case 'admin':
            $prompt .= "User ini adalah ADMIN yang bisa mengakses semua fitur. Bantu dengan data stok, keuangan, laporan, dan manajemen sistem.\n";
            break;
        case 'staff':
            $prompt .= "User ini adalah STAFF GUDANG. Fokus bantu operasional: stok, barang masuk/keluar, opname, transfer. JANGAN jawab soal keuangan (PO/invoice/budget).\n";
            break;
        case 'finance_procurement':
            $prompt .= "User ini adalah FINANCE & PROCUREMENT. Fokus bantu keuangan: PO, invoice, budget, supplier. JANGAN jawab soal operasional gudang (GRN/outbound/transfer).\n";
            break;
        case 'manager':
            $prompt .= "User ini adalah MANAGER (viewer). Fokus bantu analisis dan laporan. User ini hanya bisa MELIHAT data, tidak bisa membuat/mengedit.\n";
            break;
    }

    // Inject real data
    $prompt .= "\n=== DATA REAL-TIME ===\n";

    // Items & stock
    if (!empty($ctx['items'])) {
        $prompt .= "\n📦 STOK ITEM (top " . count($ctx['items']) . "):\n";
        foreach ($ctx['items'] as $i) {
            $status = ($i['total_stock'] <= $i['min_stock'] && $i['min_stock'] > 0) ? '⚠️KRITIS' : '✅';
            $prompt .= "- {$i['name']} (SKU: {$i['sku']}): stok={$i['total_stock']}, min={$i['min_stock']}, harga=Rp" . number_format($i['price'],0,',','.') . " [{$status}]\n";
        }
    }

    if (!empty($ctx['critical_items'])) {
        $prompt .= "\n🚨 ITEM KRITIS (" . count($ctx['critical_items']) . " item di bawah minimum):\n";
    }

    if (!empty($ctx['warehouses'])) {
        $prompt .= "\n🏭 GUDANG AKTIF: " . count($ctx['warehouses']) . " gudang\n";
        foreach ($ctx['warehouses'] as $w) {
            $prompt .= "- {$w['name']} ({$w['code']}) — {$w['city']}, PIC: {$w['pic_name']}\n";
        }
    }

    // Operational
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

    // Financial
    if (!empty($ctx['po_stats'])) {
        $s = $ctx['po_stats'];
        $prompt .= "\n🛒 PURCHASE ORDER: Total={$s['total']}, Draft={$s['draft']}, Sent={$s['sent']}, Complete={$s['complete']}, Nilai=Rp" . number_format($s['total_value']??0,0,',','.') . "\n";
    }
    if (!empty($ctx['invoice_stats'])) {
        $s = $ctx['invoice_stats'];
        $prompt .= "📄 INVOICE: Total={$s['total']}, Unpaid={$s['unpaid']}, Partial={$s['partial']}, Paid={$s['paid']}, Overdue={$s['overdue']}\n";
        $prompt .= "   Tagihan=Rp" . number_format($s['total_tagihan']??0,0,',','.') . ", Terbayar=Rp" . number_format($s['total_terbayar']??0,0,',','.') . "\n";
    }
    if (!empty($ctx['budget_stats'])) {
        $s = $ctx['budget_stats'];
        $prompt .= "💰 BUDGET: {$s['total']} anggaran, Total=Rp" . number_format($s['total_budget']??0,0,',','.') . ", Terpakai=Rp" . number_format($s['total_used']??0,0,',','.') . "\n";
    }
    if (!empty($ctx['suppliers'])) {
        $prompt .= "\n🏢 SUPPLIER (" . count($ctx['suppliers']) . " aktif)\n";
    }

    return $prompt;
}

function callGemini($apiKey, $systemPrompt, $userMessage) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" . $apiKey;

    $payload = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $systemPrompt . "\n\nPertanyaan user: " . $userMessage]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.7,
            'maxOutputTokens' => 1024,
        ]
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return "Maaf, AI sedang tidak tersedia. Silakan coba lagi nanti. (Error: $httpCode)";
    }

    $data = json_decode($response, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? 'Maaf, tidak dapat memproses pertanyaan.';

    return $text;
}
