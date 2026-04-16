<?php
// ============================================================
// Pure PHP JWT Implementation (no composer needed)
// ============================================================

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

function jwtSign(array $payload, int $expiresInHours = 24): string {
    $header = base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload['iat'] = time();
    $payload['exp'] = time() + ($expiresInHours * 3600);
    $payloadEncoded = base64UrlEncode(json_encode($payload));

    $signature = base64UrlEncode(hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true));
    return "$header.$payloadEncoded.$signature";
}

function jwtVerify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;

    // Verify signature
    $expected = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $signature)) return null;

    // Decode payload
    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data) return null;

    // Check expiry
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data;
}
