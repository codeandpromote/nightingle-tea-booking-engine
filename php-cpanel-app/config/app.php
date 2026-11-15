<?php
declare(strict_types=1);

/**
 * Nightingale Tea Tourism - Application Configuration
 * Automatically adapts to Subdomain (booking.nightingaletea.com) OR Subfolder (nightingaletea.com/booking).
 */

$scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
$basePath = rtrim(dirname($scriptName), '/');
if ($basePath === '/public') {
    $basePath = '';
} elseif (str_ends_with($basePath, '/public')) {
    $basePath = substr($basePath, 0, -7);
}

$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $trimmed, 2);
        $k = trim($k);
        $v = trim($v, " \t\n\r\0\x0B\"'");
        if ($k !== '' && getenv($k) === false) {
            putenv("$k=$v");
            $_ENV[$k] = $v;
        }
    }
}

return [
    'app_name' => 'Nightingale Tea Tourism',
    'env' => getenv('APP_ENV') ?: 'production',
    'base_path' => getenv('APP_BASE_PATH') !== false ? rtrim((string) getenv('APP_BASE_PATH'), '/') : $basePath,
    'primary_domain' => getenv('PRIMARY_DOMAIN') ?: 'https://nightingaletea.com',
    'allowed_origins' => [
        'https://nightingaletea.com',
        'https://www.nightingaletea.com',
        'https://nightingaletea.in',
        'https://www.nightingaletea.in',
        'https://booking.nightingaletea.com',
        'https://booking.nightingaletea.in',
    ],
    'timezone' => 'Asia/Kolkata',
    'session_name' => 'NTT_BOOKING_SESS',
    'hold_ttl_minutes' => (int) (getenv('HOLD_TTL_MINUTES') ?: 30),
    'cache_ttl_seconds' => (int) (getenv('CACHE_TTL_SECONDS') ?: 45),
    'cron_secret' => getenv('CRON_SECRET') ?: 'CHANGE_ME_IN_CPANEL_ENV',
    'razorpay' => [
        'key_id' => getenv('RAZORPAY_KEY_ID') ?: '',
        'key_secret' => getenv('RAZORPAY_KEY_SECRET') ?: '',
        'webhook_secret' => getenv('RAZORPAY_WEBHOOK_SECRET') ?: '',
    ],
    'upi' => [
        'vpa' => getenv('MERCHANT_UPI_ID') ?: 'nightingaletea@icici',
        'merchant_name' => getenv('MERCHANT_UPI_NAME') ?: 'Nightingale Tea Tourism',
    ],
    'rate_limits' => [
        'public_api_per_min' => 120,
        'booking_create_per_min' => 12,
        'admin_login_per_5min' => 8,
    ],
    'paths' => [
        'root' => dirname(__DIR__),
        'storage' => dirname(__DIR__) . '/storage',
        'cache' => dirname(__DIR__) . '/storage/cache',
        'uploads' => dirname(__DIR__) . '/storage/uploads',
        'logs' => dirname(__DIR__) . '/storage/logs',
        'ratelimits' => dirname(__DIR__) . '/storage/ratelimits',
        'views' => dirname(__DIR__) . '/views',
    ],
];
