<?php
// ============================================================
// Database Configuration — MySQL
// ============================================================

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host   = getenv('DB_HOST') ?: 'localhost';
    $port   = getenv('DB_PORT') ?: '3306';
    $dbname = getenv('DB_NAME') ?: 'pitiagic_wms_lutfh';
    $user   = getenv('DB_USER') ?: 'pitiagic_wms_user';
    $pass   = getenv('DB_PASSWORD') ?: 'Admin123!@#';

    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ]);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }
}

// Generate UUIDv4
function generateUUID(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Generate reference number
function generateRef(string $prefix): string {
    return $prefix . '-' . date('Ymd') . '-' . strtoupper(substr(generateUUID(), 0, 6));
}
