<?php
declare(strict_types=1);

/**
 * Shared cPanel Cron Job: Expire unpaid holds & purge availability cache.
 * Recommended cPanel Cron schedule: */5 * * * * php -q /home/USER/booking/cron/expire_holds.php
 */

require_once dirname(__DIR__) . '/app/Core/Database.php';
require_once dirname(__DIR__) . '/app/Core/CacheService.php';
require_once dirname(__DIR__) . '/app/Services/TariffService.php';
require_once dirname(__DIR__) . '/app/Services/BookingService.php';

$config = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set($config['timezone']);

if (PHP_SAPI !== 'cli') {
    $token = $_GET['token'] ?? '';
    if (!hash_equals($config['cron_secret'], (string) $token)) {
        http_response_code(403);
        echo 'Forbidden';
        exit;
    }
}

$cache = new App\Core\CacheService($config['paths']['cache']);
$service = new App\Services\BookingService($cache, $config);
$expired = $service->expireStaleHolds();

echo json_encode([
    'status' => 'ok',
    'expired_holds' => $expired,
    'timestamp' => date('c'),
]) . PHP_EOL;
